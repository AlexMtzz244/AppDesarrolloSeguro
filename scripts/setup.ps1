#Requires -Version 5.1
<#
.SYNOPSIS
    Deja SecureCampus corriendo desde cero.

.DESCRIPTION
    Hace el camino completo: comprueba requisitos, genera el .env con secretos
    nuevos, levanta la infraestructura en Docker, aplica las migraciones,
    siembra los datos de desarrollo y arranca la aplicacion.

    El script se detiene en el primer fallo y dice que hacer. Es deliberado:
    seguir adelante con un paso a medias deja un entorno que parece funcionar y
    no funciona, y eso cuesta mas de diagnosticar que un corte limpio.

.PARAMETER Reiniciar
    Borra los volumenes de Docker y el .env antes de empezar. Es la unica forma
    de un arranque REALMENTE limpio: el rol de aplicacion de Postgres se crea
    una sola vez, en el primer arranque del contenedor, asi que cambiar su
    contrasena no tiene ningun efecto mientras el volumen siga vivo.

.PARAMETER ConPruebas
    Corre las 13 pruebas negativas obligatorias antes de arrancar. Vacian la
    base, asi que el script vuelve a sembrarla al terminar.

.PARAMETER SinArrancar
    Deja todo listo pero no levanta los servidores de desarrollo.

.EXAMPLE
    .\scripts\setup.ps1
    Setup normal. Conserva el .env y los datos si ya existen.

.EXAMPLE
    .\scripts\setup.ps1 -Reiniciar -ConPruebas
    Desde cero absoluto, verificando las 13 pruebas negativas.
#>
[CmdletBinding()]
param(
    [switch]$Reiniciar,
    [switch]$ConPruebas,
    [switch]$SinArrancar
)

# 'Continue' y no 'Stop', a proposito. En Windows PowerShell 5.1, con 'Stop'
# cada linea que un ejecutable nativo escribe en stderr se convierte en error
# terminante, y tanto docker como pnpm mandan ahi su salida de progreso: el
# script moriria en el primer "Container ... Stopping" sin que nada hubiera
# fallado.
#
# El control de errores real de este script no depende de esa preferencia:
# despues de cada comando se comprueba $LASTEXITCODE y se llama a `Fallar`.
$ErrorActionPreference = 'Continue'

$Raiz = Split-Path -Parent $PSScriptRoot
Set-Location $Raiz

# --- Salida ------------------------------------------------------------------

$script:NumeroPaso = 0

function Paso([string]$texto) {
    $script:NumeroPaso++
    Write-Host ''
    Write-Host ('[{0}] {1}' -f $script:NumeroPaso, $texto) -ForegroundColor Cyan
}

function Ok([string]$texto)      { Write-Host "    ok   $texto" -ForegroundColor Green }
function Aviso([string]$texto)   { Write-Host "    !    $texto" -ForegroundColor Yellow }
function Detalle([string]$texto) { Write-Host "         $texto" -ForegroundColor DarkGray }

function Fallar([string]$texto, [string[]]$comoArreglarlo = @()) {
    Write-Host ''
    Write-Host "ERROR: $texto" -ForegroundColor Red
    foreach ($linea in $comoArreglarlo) { Write-Host "       $linea" -ForegroundColor Yellow }
    Write-Host ''
    exit 1
}

# --- Utilidades --------------------------------------------------------------

<#
    Bytes aleatorios en hexadecimal.

    Hexadecimal y no base64 porque estas cadenas viajan DENTRO de DATABASE_URL:
    los caracteres '+', '/' y '=' de base64 romperian la URL o cambiarian de
    significado al interpretarse.
#>
function NuevoHex([int]$bytes) {
    $buffer = New-Object byte[] $bytes
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
    return (($buffer | ForEach-Object { $_.ToString('x2') }) -join '')
}

<# 32 bytes en base64, que es lo que exige el esquema de arranque. #>
function NuevoSecreto {
    $buffer = New-Object byte[] 32
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($buffer)
}

<#
    Carga el .env en el proceso actual.

    Hace falta porque NADA lo carga solo: la API lee `process.env` directamente
    y Prisma busca su .env en apps/api, no en la raiz. Dentro de Docker lo
    resuelve `env_file`; en el host hay que ponerlo aqui.
#>
function ImportarEntorno {
    $ruta = Join-Path $Raiz '.env'
    if (-not (Test-Path $ruta)) { Fallar "No existe $ruta." }
    foreach ($linea in (Get-Content $ruta)) {
        if ($linea -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
            Set-Item -Path ('env:' + $matches[1]) -Value $matches[2].Trim()
        }
    }
}

function PuertoOcupado([int]$puerto) {
    $conexion = Get-NetTCPConnection -State Listen -LocalPort $puerto -ErrorAction SilentlyContinue
    return [bool]$conexion
}

Write-Host ''
Write-Host '  SecureCampus - instalacion desde cero' -ForegroundColor White
Write-Host '  -------------------------------------' -ForegroundColor DarkGray

# --- 1. Requisitos -----------------------------------------------------------

Paso 'Comprobando requisitos'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fallar 'Node.js no esta instalado.' @('winget install -e --id OpenJS.NodeJS.LTS')
}
$versionNode = [version]((& node -v).TrimStart('v'))
if ($versionNode -lt [version]'20.11.0') {
    Fallar "Node $versionNode es muy antiguo; hace falta 20.11 o superior."
}
Ok "Node $versionNode"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Fallar 'pnpm no esta instalado.' @('npm install -g pnpm')
}
$versionPnpm = [version](& pnpm -v)
if ($versionPnpm -lt [version]'9.0.0') {
    Fallar "pnpm $versionPnpm es muy antiguo; hace falta 9 o superior."
}
Ok "pnpm $versionPnpm"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fallar 'Docker no esta instalado.' @(
        'winget install -e --id Docker.DockerDesktop',
        'Requiere permisos de administrador y reiniciar.'
    )
}

& docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
    Fallar 'Docker esta instalado pero el motor no responde.' @(
        'Abre Docker Desktop y espera a que diga "Engine running".',
        '',
        'Si dice "Virtualization support not detected", casi siempre es un',
        'REINICIO PENDIENTE y no un problema del BIOS: wsl --install habilita',
        'las caracteristicas de Windows, pero no se cargan hasta reiniciar.',
        'Comprueba con:  wsl --status'
    )
}
$versionDocker = & docker version --format '{{.Server.Version}}'
Ok "Docker $versionDocker"

# --- 2. Dependencias ---------------------------------------------------------

Paso 'Instalando dependencias'
& pnpm install
if ($LASTEXITCODE -ne 0) { Fallar 'Fallo pnpm install.' }
Ok 'Dependencias instaladas'

# --- 3. Configuracion --------------------------------------------------------

Paso 'Preparando .env'

$rutaEnv = Join-Path $Raiz '.env'

if ($Reiniciar -and (Test-Path $rutaEnv)) {
    Remove-Item $rutaEnv -Force
    Aviso '.env anterior eliminado (-Reiniciar)'
}

if (Test-Path $rutaEnv) {
    Ok '.env ya existe; se conserva'
    Detalle 'Usa -Reiniciar para regenerarlo con secretos nuevos.'
}
else {
    $claveBd    = NuevoHex 24
    $claveApp   = NuevoHex 24
    $claveS3    = NuevoHex 24
    $secretoSes = NuevoSecreto
    $secretoMfa = NuevoSecreto

    # OTEL_EXPORTER_OTLP_ENDPOINT va COMENTADO, no vacio. El esquema lo valida
    # como url().optional(), y `optional` acepta ausente pero no cadena vacia.
    # Copiar .env.example literal lo deja en "" y la API se niega a arrancar
    # con "Invalid url".
    $contenido = @"
# SecureCampus - entorno LOCAL de desarrollo.
# Generado por scripts/setup.ps1. NUNCA se commitea.

NODE_ENV=development
PERMITIR_DATOS_SEMILLA=true

POSTGRES_DB=securecampus
POSTGRES_USER=securecampus_owner
POSTGRES_PASSWORD=$claveBd
POSTGRES_APP_USER=securecampus_app
POSTGRES_APP_PASSWORD=$claveApp
DATABASE_URL=postgresql://securecampus_app:$claveApp@localhost:5432/securecampus?schema=public
DATABASE_URL_MIGRACIONES=postgresql://securecampus_owner:$claveBd@localhost:5432/securecampus?schema=public

REDIS_URL=redis://localhost:6379

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=securecampus
S3_SECRET_ACCESS_KEY=$claveS3
S3_BUCKET_DOCUMENTOS=securecampus-documentos
S3_BUCKET_CUARENTENA=securecampus-cuarentena
S3_FORCE_PATH_STYLE=true

CLAMAV_HOST=localhost
CLAMAV_PORT=3310

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=no-reply@securecampus.edu.mx

SESION_SECRETO_FIRMA=$secretoSes
MFA_CLAVE_CIFRADO=$secretoMfa

SESION_COOKIE_NOMBRE=sc_sesion
SESION_INACTIVIDAD_MINUTOS=30
SESION_DURACION_MAXIMA_HORAS=12
SESION_COOKIE_SECURE=false

ARGON2_MEMORIA_KIB=19456
ARGON2_ITERACIONES=2
ARGON2_PARALELISMO=1

LOGIN_MAX_INTENTOS_CUENTA=5
LOGIN_MAX_INTENTOS_IP=20
LOGIN_VENTANA_MINUTOS=15
LOGIN_RETARDO_BASE_MS=250
LOGIN_UMBRAL_CAPTCHA=3
LOGIN_LATENCIA_MINIMA_MS=400
CAPTCHA_PROVEEDOR=ninguno
CAPTCHA_SECRETO=

RECUPERACION_VIGENCIA_MINUTOS=20
RECUPERACION_MAX_SOLICITUDES_HORA=3

DOCUMENTO_TAMANO_MAXIMO_MB=10
DOCUMENTO_CUOTA_USUARIO_MB=100
DOCUMENTO_TIPOS_PERMITIDOS=application/pdf,image/jpeg,image/png

ALERTA_UMBRAL_403_POR_MINUTO=10
ALERTA_UMBRAL_DESCARGAS_POR_HORA=25
ALERTA_MINUTOS_CAPTURA_INMEDIATA=60
ALERTA_MINUTOS_REVERSION_SOSPECHOSA=120

API_PUERTO=3001
WEB_PUERTO=3000
CORS_ORIGENES_PERMITIDOS=http://localhost:3000
TRUST_PROXY_SALTOS=1

LOG_NIVEL=info
OTEL_HABILITADO=false
# OTEL_EXPORTER_OTLP_ENDPOINT=   <- vacio NO vale; el esquema exige una url

NEXT_PUBLIC_API_URL=http://localhost:3001
"@

    # Sin BOM: `Set-Content -Encoding utf8` de PowerShell 5.1 lo antepone, y
    # `source .env` en bash lo lee como parte de la primera linea.
    [System.IO.File]::WriteAllText($rutaEnv, $contenido, (New-Object System.Text.UTF8Encoding $false))
    Ok '.env generado con secretos nuevos'
    Detalle 'Contrasenas en hexadecimal (van dentro de DATABASE_URL).'
    Detalle 'Secretos de sesion y MFA de 32 bytes en base64.'
}

ImportarEntorno

$obligatorias = @(
    'DATABASE_URL', 'DATABASE_URL_MIGRACIONES', 'REDIS_URL',
    'SESION_SECRETO_FIRMA', 'MFA_CLAVE_CIFRADO', 'S3_SECRET_ACCESS_KEY'
)
foreach ($variable in $obligatorias) {
    $valor = (Get-Item ('env:' + $variable) -ErrorAction SilentlyContinue).Value
    if (-not $valor) {
        Fallar "La variable $variable esta vacia en .env." @(
            'Regenera el archivo con:  .\scripts\setup.ps1 -Reiniciar'
        )
    }
}
Ok 'Variables criticas presentes'

# --- 4. Infraestructura ------------------------------------------------------

Paso 'Levantando la infraestructura'

if ($Reiniciar) {
    Aviso 'Borrando contenedores y volumenes anteriores'
    & docker compose down -v --remove-orphans
}

# Solo los servicios de datos. El compose define tambien `api` y `web`, que
# publican 3000 y 3001: levantarlos aqui chocaria con `pnpm dev` mas adelante.
Detalle 'postgres, redis, minio, mailpit (la primera vez descarga imagenes)'
& docker compose up -d --wait postgres redis minio mailpit
if ($LASTEXITCODE -ne 0) {
    Fallar 'No se pudo levantar la infraestructura.' @(
        'Revisa el detalle con:  docker compose logs',
        '',
        'Si falla al descargar minio, comprueba que docker-compose.yml apunte',
        'a quay.io/minio/minio: las imagenes ya no estan en Docker Hub.'
    )
}
Ok 'Postgres, Redis, MinIO y Mailpit sanos'

Detalle 'Creando los buckets privados'
& docker compose up -d minio-init | Out-Null
$limite = (Get-Date).AddMinutes(2)
$bucketsListos = $false
while ((Get-Date) -lt $limite) {
    $estados = & docker compose ps -a --format '{{.Service}}|{{.State}}'
    if ($estados | Where-Object { $_ -like 'minio-init|exited*' }) { $bucketsListos = $true; break }
    Start-Sleep -Seconds 2
}
if ($bucketsListos) {
    Ok 'Buckets privados listos'
}
else {
    Aviso 'minio-init sigue corriendo; revisa docker compose logs minio-init'
}

# ClamAV descarga sus firmas al arrancar y tarda unos minutos. Solo se espera
# cuando hace falta de verdad, que es para las pruebas de documentos.
Detalle 'Arrancando ClamAV en segundo plano'
& docker compose up -d clamav | Out-Null
if ($ConPruebas) {
    Detalle 'Esperando a ClamAV (descarga de firmas, hasta 5 min)'
    & docker compose up -d --wait clamav
    if ($LASTEXITCODE -ne 0) { Fallar 'ClamAV no llego a estado sano.' }
    Ok 'ClamAV listo'
}
else {
    Aviso 'ClamAV tarda ~3 min; subir documentos fallara hasta que quede sano'
}

# --- 5. Base de datos --------------------------------------------------------

Paso 'Aplicando migraciones'
& pnpm --filter api db:deploy
if ($LASTEXITCODE -ne 0) {
    Fallar 'Fallaron las migraciones.' @(
        'Si regeneraste el .env pero conservaste el volumen, el rol de',
        'aplicacion de Postgres sigue con la contrasena anterior: solo se crea',
        'en el primer arranque del contenedor. Usa -Reiniciar.'
    )
}
Ok 'Esquema y bitacora append-only aplicados'

Paso 'Sembrando datos de desarrollo'
& pnpm --filter api db:seed
if ($LASTEXITCODE -ne 0) { Fallar 'Fallo la siembra de datos.' }
Ok 'Usuarios, roles y permisos sembrados'

# --- 6. Pruebas (opcional) ---------------------------------------------------

if ($ConPruebas) {
    Paso 'Corriendo las 13 pruebas negativas obligatorias'

    if ((PuertoOcupado 3001) -or (PuertoOcupado 3000)) {
        Fallar 'Hay un servidor de desarrollo corriendo.' @(
            'Las pruebas comparten Postgres y Redis con el: su worker de colas',
            'reacciona a la limpieza que hacen entre archivos y la suite se',
            'cuelga. Cierralo y vuelve a lanzar el script.'
        )
    }

    & pnpm --filter api test:int
    if ($LASTEXITCODE -ne 0) { Fallar 'Fallaron pruebas de integracion.' }
    Ok '72 pruebas en verde'

    Detalle 'Las pruebas vacian la base; volviendo a sembrar'
    & pnpm --filter api db:seed | Out-Null
    Ok 'Datos de desarrollo restaurados'
}

# --- 7. Arranque -------------------------------------------------------------

Write-Host ''
Write-Host '  Todo listo.' -ForegroundColor Green
Write-Host ''
Write-Host '  Aplicacion web   http://localhost:3000'
Write-Host '  API              http://localhost:3001'
Write-Host '  OpenAPI          http://localhost:3001/api/docs'
Write-Host '  Mailpit          http://localhost:8025'
Write-Host '  MinIO            http://localhost:9001'
Write-Host ''
Write-Host '  Contrasena de TODAS las cuentas de desarrollo:' -ForegroundColor DarkGray
Write-Host '  SemillaDesarrollo!2026'
Write-Host ''
Write-Host '  estudiante.a@securecampus.edu.mx    estudiante'
Write-Host '  estudiante.b@securecampus.edu.mx    estudiante (para probar A contra B)'
Write-Host '  profesor@securecampus.edu.mx        profesor'
Write-Host '  jefe.isc@securecampus.edu.mx        jefe de carrera'
Write-Host '  admin@securecampus.edu.mx           administrador'
Write-Host '  autoridad@securecampus.edu.mx       autoridad academica'
Write-Host ''

if ($SinArrancar) {
    Write-Host '  Para arrancar, en esta misma ventana:' -ForegroundColor DarkGray
    Write-Host '  pnpm dev'
    Write-Host ''
    Write-Host '  El .env ya esta cargado en esta sesion. En una ventana nueva' -ForegroundColor DarkGray
    Write-Host '  hay que volver a cargarlo; ver SETUP.md.' -ForegroundColor DarkGray
    Write-Host ''
    exit 0
}

if ((PuertoOcupado 3000) -or (PuertoOcupado 3001)) {
    Aviso 'Los puertos 3000/3001 ya estan ocupados; no se arranca nada'
    Detalle 'Probablemente ya tienes pnpm dev corriendo.'
    exit 0
}

Paso 'Arrancando la aplicacion (Ctrl+C para detener)'
& pnpm dev

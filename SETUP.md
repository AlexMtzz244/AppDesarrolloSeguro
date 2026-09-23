# Instalación desde cero

Cómo dejar SecureCampus corriendo en una máquina donde no hay nada todavía.

El camino corto es un script. El resto del documento explica qué hace y cómo
salir de los problemas que aparecen cuando algo no va bien, porque varios de
ellos dan mensajes de error que apuntan al lugar equivocado.

---

## Camino corto

```powershell
git clone <url-del-repositorio>
cd proyDesSeguro
.\scripts\setup.ps1
```

Eso comprueba requisitos, instala dependencias, genera el `.env` con secretos
nuevos, levanta la infraestructura en Docker, migra, siembra y arranca la
aplicación. Al terminar imprime las URL y las cuentas de prueba.

| Opción | Para qué |
|---|---|
| `.\scripts\setup.ps1` | Instalación normal. Conserva `.env` y datos si ya existen. |
| `.\scripts\setup.ps1 -Reiniciar` | Desde cero absoluto: borra volúmenes de Docker y `.env`. |
| `.\scripts\setup.ps1 -ConPruebas` | Corre además las 13 pruebas negativas obligatorias. |
| `.\scripts\setup.ps1 -SinArrancar` | Deja todo listo sin levantar los servidores. |

Si PowerShell se niega a ejecutar el script:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Eso afecta solo a esa ventana y no cambia nada del sistema.

El script es de PowerShell porque el equipo trabaja en Windows. En Linux o
macOS no hay equivalente todavía: sigue los pasos manuales de más abajo, que
son los mismos comandos.

---

## Requisitos

| | Versión | Cómo instalarlo |
|---|---|---|
| Node.js | ≥ 20.11 | `winget install -e --id OpenJS.NodeJS.LTS` |
| pnpm | ≥ 9 | `npm install -g pnpm` |
| Docker Desktop | cualquiera reciente | `winget install -e --id Docker.DockerDesktop` |

Docker Desktop necesita permisos de administrador para instalarse, y **reiniciar
la máquina** después. No es opcional: abajo se explica por qué.

`gitleaks` es opcional en local y obligatorio en CI:
`winget install gitleaks`.

---

## Qué levanta, y por qué está separado así

Son cinco servicios de datos en Docker, y la aplicación corriendo en tu
máquina.

| Servicio | Para qué |
|---|---|
| **Postgres** | La base. Arranca creando un rol de aplicación con privilegio mínimo. |
| **Redis** | Sesiones, límite de intentos y la cola de notificaciones. |
| **MinIO** | Almacenamiento privado de documentos, compatible con S3. |
| **ClamAV** | Antivirus para la cuarentena de archivos subidos. |
| **Mailpit** | Servidor de correo local; captura los envíos sin mandarlos de verdad. |

La aplicación corre en el host y no en Docker aunque el `docker-compose.yml`
también la defina. Dos razones:

- En Windows, el recargado en caliente a través de un volumen montado hacia un
  contenedor Linux es lento y poco fiable.
- Los servicios `api` y `web` del compose publican los puertos 3000 y 3001.
  Levantarlos **y además** correr `pnpm dev` hace que los puertos choquen. Hay
  que elegir uno de los dos caminos, y el script elige el primero.

Si prefieres todo en contenedores, usa `docker compose up -d` a secas y **no**
ejecutes `pnpm dev`.

---

## Pasos manuales

Por si el script falla, o si trabajas en Linux o macOS.

### 1. Dependencias

```bash
pnpm install
```

### 2. Configuración

```bash
cp .env.example .env
```

Y complétalo. Hacen falta cinco secretos que la plantilla deja vacíos a
propósito: la aplicación se niega a arrancar si falta alguno (RNFS-052).

```bash
# Contraseñas de base de datos: en hexadecimal, no en base64
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

# SESION_SECRETO_FIRMA y MFA_CLAVE_CIFRADO: 32 bytes en base64
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Tres detalles que hacen perder tiempo si no se saben:

- **Las contraseñas de Postgres van en hexadecimal.** Viajan dentro de
  `DATABASE_URL`, y los caracteres `+`, `/` y `=` de base64 rompen la URL.
- **`DATABASE_URL` y `DATABASE_URL_MIGRACIONES` usan usuarios distintos.** No es
  redundancia: si la aplicación pudiera migrar, podría revertir el `REVOKE` que
  protege la bitácora de auditoría.
- **`OTEL_EXPORTER_OTLP_ENDPOINT` debe quedar comentado, no vacío.** El esquema
  lo valida como `url().optional()`, y `optional` acepta que falte pero no una
  cadena vacía. Copiar `.env.example` literal deja `""` ahí y el arranque falla
  con `Invalid url`.

### 3. Infraestructura

```bash
docker compose up -d --wait postgres redis minio mailpit
docker compose up -d minio-init    # crea los buckets privados y termina
docker compose up -d clamav        # tarda ~3 min en descargar firmas
```

### 4. Cargar el `.env` en tu terminal

**Este paso no está en el README original y sin él nada de lo que sigue
funciona.** No hay nada que cargue el `.env` automáticamente: la API lee
`process.env` directamente, y Prisma busca su `.env` en `apps/api/`, no en la
raíz. Dentro de Docker lo resuelve `env_file`; en el host hay que hacerlo a
mano.

PowerShell:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
    Set-Item -Path "env:$($matches[1])" -Value $matches[2].Trim()
  }
}
```

bash:

```bash
set -a && source .env && set +a
```

Hay que repetirlo en cada ventana nueva.

### 5. Base de datos

```bash
pnpm --filter api db:deploy    # migraciones
pnpm --filter api db:seed      # datos de desarrollo
```

### 6. Arrancar

```bash
pnpm dev
```

---

## Dónde queda todo

| Servicio | URL |
|---|---|
| Aplicación web | http://localhost:3000 |
| API | http://localhost:3001 |
| OpenAPI | http://localhost:3001/api/docs |
| Mailpit | http://localhost:8025 |
| MinIO (consola) | http://localhost:9001 |

### Cuentas de desarrollo

Contraseña para todas: `SemillaDesarrollo!2026`

| Correo | Rol |
|---|---|
| `estudiante.a@securecampus.edu.mx` | Estudiante |
| `estudiante.b@securecampus.edu.mx` | Estudiante |
| `profesor@securecampus.edu.mx` | Profesor |
| `jefe.isc@securecampus.edu.mx` | Jefe de carrera (ISC) |
| `admin@securecampus.edu.mx` | Administrador |
| `autoridad@securecampus.edu.mx` | Autoridad académica |

Hay **dos estudiantes** a propósito: sin dos cuentas del mismo rol no se puede
comprobar que A no alcanza los datos de B, que es el control central del
proyecto. Entra como A y pide el perfil de B: debe responder 403 y dejar
evento en la bitácora.

Son credenciales de desarrollo documentadas públicamente. El arranque en
producción con datos semilla presentes falla de forma explícita (RNFS-058).

---

## Pruebas

```bash
pnpm test        # 39 unitarias y estructurales; no necesitan infraestructura
pnpm test:int    # 72 pruebas: las 13 negativas obligatorias
pnpm build       # compila API y web
```

**Antes de `pnpm test:int`, detén `pnpm dev`.** Comparten Postgres y Redis: el
servidor de desarrollo mantiene vivo un worker de BullMQ sobre el mismo Redis
que las pruebas limpian entre archivos, y con él corriendo la suite se cuelga.
El script lo comprueba y se niega a seguir si detecta los puertos ocupados.

Las pruebas vacían la base, así que al terminar hay que volver a sembrar:

```bash
pnpm --filter api db:seed
```

`pnpm lint` **no funciona todavía**: no existe ningún archivo de configuración
de ESLint en el repositorio y solo `apps/web` lo tiene como dependencia. CI no
lo ejecuta, así que no bloquea nada, pero el script del `package.json` promete
algo que no hay.

---

## Cuando algo falla

### Docker dice "Virtualization support not detected"

**Casi siempre es un reinicio pendiente, no el BIOS.** El mensaje sugiere hablar
con soporte o revisar la configuración del firmware, y normalmente ninguna de
las dos cosas aplica.

`wsl --install` habilita las características de Windows que hacen falta
—Plataforma de máquina virtual, Subsistema de Windows para Linux, Hyper-V—,
pero esas características no se cargan hasta que la máquina reinicia. Hasta
entonces WSL responde que la virtualización no está activa y Docker repite ese
diagnóstico.

Para distinguir un caso del otro:

```powershell
(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled
Get-CimInstance Win32_OptionalFeature -Filter "Name='VirtualMachinePlatform'" |
  Select-Object Name, InstallState
Test-Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending"
```

Si lo primero es `True`, la característica sale `InstallState = 1` y lo último
es `True`, el firmware está bien y solo falta reiniciar. Si
`VirtualizationFirmwareEnabled` es `False`, entonces sí hay que entrar al BIOS
y activar la virtualización (VT-x en Intel, SVM en AMD).

`HypervisorPlatform` puede aparecer deshabilitada y **es correcto así**: Docker
con backend WSL2 usa `VirtualMachinePlatform`, no esa. No la actives.

### "pull access denied for minio/minio"

MinIO ya no publica sus imágenes en Docker Hub. El `docker-compose.yml` apunta a
`quay.io/minio/minio` y `quay.io/minio/mc`. Si ves ese error, tienes una copia
vieja del archivo.

### Las migraciones fallan con error de autenticación

Si regeneraste el `.env` pero conservaste el volumen de Postgres, el rol de
aplicación sigue con la contraseña anterior: se crea **una sola vez**, en el
primer arranque del contenedor, y el script de inicialización ya no vuelve a
ejecutarse.

```powershell
.\scripts\setup.ps1 -Reiniciar
```

### "Environment variable not found: DATABASE_URL_MIGRACIONES"

Falta el paso 4: cargar el `.env` en la terminal.

### La aplicación se niega a arrancar y lista variables

Es el comportamiento correcto (RNFS-052). Un valor por defecto silencioso en una
variable de seguridad es peor que no arrancar, así que la validación corta el
proceso y enumera exactamente lo que falta. Complétalo en `.env` y vuelve a
intentar.

### Al arrancar avisa de decisiones sin firma

```
4 decision(es) institucional(es) operan bajo propuesta sin aprobar:
D-01, D-06, D-07, D-10.
```

También es correcto. El sistema funciona con los valores propuestos, pero los
mantiene visibles en `/panel/decisiones` y el arranque en producción los exigirá
firmados. Ver [docs/DECISIONES-PENDIENTES.md](https://github.com/AlexMtzz244/proyDesSeguro/blob/main/docs/DECISIONES-PENDIENTES.md).

### Subir un documento falla justo después de instalar

ClamAV tarda unos tres minutos en descargar sus firmas. Comprueba con:

```bash
docker compose ps
```

Hasta que aparezca `healthy`, la cuarentena de documentos no puede operar.

---

## Empezar de nuevo

```powershell
.\scripts\setup.ps1 -Reiniciar
```

Borra contenedores, volúmenes y `.env`, y reconstruye todo. Es destructivo: se
pierden los datos locales, incluida la bitácora de auditoría.

Para detener sin borrar nada:

```bash
docker compose stop
```

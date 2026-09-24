# Guía de pruebas

Cómo probar SecureCampus: con qué cuenta entrar, qué debe poder hacer cada
una, qué **no** debe poder hacer, y cómo correr las pruebas automáticas sin
romper el entorno.

Se asume que el entorno ya está levantado con `.\scripts\setup.ps1`
(ver [SETUP.md](SETUP.md)).

> En este proyecto un flujo no está probado hasta que se comprueba **lo que
> debe rechazar**. Iniciar sesión y ver datos es la mitad fácil; la mitad que
> importa es intentar lo que no te toca y confirmar que falla y deja rastro.

---

## 1. Credenciales

**Contraseña para todas las cuentas: `SemillaDesarrollo!2026`**

| Correo | Rol | Persona sembrada | Programa | Matrícula | MFA |
|---|---|---|---|---|---|
| `estudiante.a@securecampus.edu.mx` | Estudiante | Cesar Adan De La Cruz | ISC | `ISC202601` | opcional |
| `estudiante.b@securecampus.edu.mx` | Estudiante | Alejandro Martinez | ISC | `ISC202602` | opcional |
| `profesor@securecampus.edu.mx` | Profesor | Juan Pablo Castillo | ISC | — | **obligatorio** |
| `jefe.isc@securecampus.edu.mx` | Jefe de carrera | Diego Salazar | ISC | — | opcional |
| `admin@securecampus.edu.mx` | Administrador | Marelis Carrillo | — | — | **obligatorio** |
| `autoridad@securecampus.edu.mx` | Autoridad académica | Dirección Académica | — | — | **obligatorio** |

Son credenciales **de desarrollo**, documentadas a propósito. El arranque en
producción con datos semilla presentes falla (RNFS-058). No las uses fuera de
tu máquina.

### Qué puede y qué no puede cada cuenta

La tabla dice lo que la cuenta **debe** poder hacer (✔) y lo que **debe**
rechazarse (✘). Las dos columnas son igual de importantes para probar.

| Cuenta | ✔ Debe poder | ✘ Debe rechazarse |
|---|---|---|
| **estudiante.a / .b** | Ver y editar su perfil (teléfono) · ver sus calificaciones **publicadas** · subir y descargar sus documentos · crear y consultar sus solicitudes | Ver el perfil, documentos o solicitudes del otro estudiante · ver la lista de captura del grupo · entrar a usuarios, auditoría o alertas |
| **profesor** | Ver el grupo `ISC-601-A` (tiene asignación vigente) · capturar calificaciones en borrador · publicarlas | Capturar en un grupo sin asignación vigente · editar una calificación ya publicada · **corregir** calificaciones (es otro permiso) |
| **jefe.isc** | Ver periodos, materias, aulas y grupos de ISC · crear grupos en el periodo abierto · asignar y cerrar asignaciones docentes | Tocar grupos de otro programa · crear grupos en el periodo cerrado `2026-1` · asignarse a sí mismo como profesor · **ver o capturar calificaciones** |
| **admin** | Usuarios, roles, auditoría, alertas y decisiones (**con MFA**) · corregir una calificación publicada, con motivo · ejecutar un cambio retroactivo **con una autorización ajena** | Capturar calificaciones · asignarse roles a sí mismo · acumular permisos incompatibles · usar las pantallas administrativas sin MFA |
| **autoridad** | **Conceder** autorizaciones extraordinarias sobre el periodo cerrado (con MFA y motivo) · consultar auditoría y alertas | **Usar** esas autorizaciones · capturar o corregir calificaciones |

La separación entre admin, jefe y autoridad es deliberada: ninguna cuenta
puede encadenar sola "asignarse un grupo → calificar → revertir", ni "autorizar
un cambio retroactivo → ejecutarlo". Los pares prohibidos están en
[permisos.ts](packages/contracts/src/permisos.ts) (`PARES_INCOMPATIBLES`).

### Datos que ya existen después de sembrar

| Dato | Valor |
|---|---|
| Programa | `ISC` — Ingeniería en Sistemas Computacionales |
| Periodos | `2026-2` **abierto** · `2026-1` **cerrado** (para probar cambios retroactivos) |
| Materia | `ISC-601` — Desarrollo Seguro |
| Aula | `A-201` (edificio A, 40 lugares) |
| Grupo | `ISC-601-A`, periodo 2026-2, lunes y miércoles de 7:00 a 9:00 |
| Asignación | `profesor` es el profesor vigente de `ISC-601-A` (la creó `jefe.isc`) |
| Inscripciones | `estudiante.a` y `estudiante.b` están inscritos en `ISC-601-A` |
| Solicitudes | 3 tipos propuestos: constancia de estudios, revisión de calificación, corrección de datos |
| Calificaciones | ninguna: hay que capturarlas |

Para probar "un profesor sin asignación" o "un grupo de otro programa" hace
falta crear esos datos; las pruebas de integración lo hacen solas (sección 3).

---

## 2. Antes de probar: el segundo factor (MFA)

`admin`, `autoridad` y `profesor` tienen MFA obligatorio, pero **las cuentas
sembradas no lo traen configurado**. Pueden iniciar sesión, pero toda
operación marcada como sensible responde **403** hasta que la sesión tenga el
segundo factor verificado:

- usuarios y roles (listar, crear, activar o desactivar, asignar, revocar);
- auditoría y exportación · alertas · aprobar decisiones;
- corregir calificaciones · conceder autorizaciones retroactivas.

Ese 403 es correcto, no un error. Para activar el MFA:

1. Entra con la cuenta y ve a **Perfil → Segundo factor → Configurar**.
2. La pantalla muestra un **secreto** en texto. Regístralo en una aplicación de
   autenticación (Google Authenticator, Microsoft Authenticator, Aegis…) como
   "clave manual", tipo TOTP.
3. Escribe el código de 6 dígitos y confirma.
4. **Guarda los 10 códigos de recuperación** que aparecen: se muestran una sola
   vez.
5. Cierra sesión y vuelve a entrar. Ahora el login pide el código.

Sin aplicación a la mano, el código también se puede generar desde el propio
proyecto:

```powershell
pnpm --filter api exec node -e "console.log(require('otplib').authenticator.generate('PEGA_AQUI_EL_SECRETO'))"
```

El código cambia cada 30 segundos.

> Si reinicias el entorno (`setup.ps1 -Reiniciar` o `pnpm test:int`), las
> credenciales MFA se borran y hay que configurarlas de nuevo.

---

## 3. Pruebas automáticas

Hay cuatro niveles. Córrelos **en este orden**: cada uno necesita más
infraestructura que el anterior.

| # | Comando | Qué cubre | Necesita |
|---|---|---|---|
| 1 | `pnpm typecheck` | Tipos en todo el monorepo | nada |
| 2 | `pnpm test` | 39 pruebas unitarias y estructurales | nada |
| 3 | `pnpm test:int` | 72 pruebas de integración, incluidas las 13 negativas obligatorias | Docker arriba, **servidores de desarrollo apagados** |
| 4 | `pnpm e2e` | 9 pruebas de navegador (Playwright) | Docker arriba, **servidores de desarrollo encendidos** |

Todas se corren desde la raíz del repositorio.

### Nivel 1 y 2 — sin infraestructura

```powershell
pnpm typecheck
pnpm test
```

`pnpm test` incluye las **pruebas estructurales**, que son las que evitan que
un error se cuele sin que nadie lo note:

- `politicas-declaradas.spec.ts` — ninguna ruta queda sin política declarada.
  Si alguien agrega un endpoint sin `@Politica` ni `@Publico`, esta prueba
  falla.
- `separacion-funciones.spec.ts` — ningún rol sembrado acumula permisos
  incompatibles.
- `decisiones-resueltas.spec.ts` — nadie puede autorizar y ejecutar un cambio
  retroactivo a la vez, y las once decisiones institucionales están
  catalogadas.

Resultado esperado: `packages/contracts` 13 pasan · `apps/api` 26 pasan ·
`apps/web` no tiene unitarias.

### Nivel 3 — integración (las 13 negativas)

Corren contra el Postgres y el Redis reales, no contra imitaciones. Por eso
tienen tres reglas:

1. **Apaga `pnpm dev` antes.** El servidor de desarrollo tiene un worker de
   colas sobre el mismo Redis que las pruebas limpian, y con él encendido la
   suite se cuelga. `Ctrl+C` en la ventana donde corre.
2. **Carga el `.env` en la terminal.** Las pruebas necesitan
   `DATABASE_URL_MIGRACIONES`, porque vacían tablas con el usuario
   propietario (el de la app no tiene permiso de `TRUNCATE`).
3. **Vuelve a sembrar al terminar.** Las pruebas vacían la base; sin sembrar,
   las cuentas de la sección 1 dejan de existir.

```powershell
# Cargar el .env en esta ventana
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
    Set-Item -Path ('env:' + $matches[1]) -Value $matches[2].Trim()
  }
}

pnpm test:int
pnpm --filter api db:seed      # restaurar las cuentas de desarrollo
```

El atajo que hace las tres cosas y además comprueba que los puertos estén
libres:

```powershell
.\scripts\setup.ps1 -ConPruebas
```

No necesitan ClamAV ni MinIO: las pruebas de documentos insertan los estados
del antivirus directamente para no depender de las firmas.

Qué verifica cada una:

| # | Qué comprueba | Archivo en `apps/api/test/` |
|---|---|---|
| 1 | Estudiante A no alcanza los datos de B → 403 y queda evento | `autorizacion.int.spec.ts` |
| 2 | Profesor en grupo ajeno o con asignación cerrada → 403, sin mutación | `academico.int.spec.ts` |
| 3 | Una calificación publicada no se edita sin el flujo de corrección | `academico.int.spec.ts` |
| 4 | Jefe fuera de su programa, choque de aula, periodo cerrado, autoasignación | `academico.int.spec.ts` |
| 5 | Asignación creada y revertida: queda en el historial y la bitácora | `academico.int.spec.ts` |
| 6 | Mandar un rol en el cuerpo, alterar la cookie o una cabecera → no da nada | `autorizacion.int.spec.ts` |
| 7 | Límite de intentos, mismo mensaje y misma latencia exista o no la cuenta | `identidad.int.spec.ts` |
| 8 | Enlace de recuperación reutilizado, vencido o sustituido | `identidad.int.spec.ts` |
| 9 | Ejecutable renombrado a .pdf, tamaño, cuota, documento ajeno, cuarentena | `documentos.int.spec.ts` |
| 10 | Mutación y evento de auditoría en la misma transacción | `auditoria.int.spec.ts` |
| 11 | La sesión rota en cada login; cambiar la contraseña revoca todas | `identidad.int.spec.ts` |
| 12 | La bitácora rechaza UPDATE, DELETE y TRUNCATE | `auditoria.int.spec.ts` |
| 13 | Escaneo de secretos y auditoría de dependencias | `.github/workflows/ci.yml` |

La 13 no es una prueba de Vitest: la ejecuta CI. En local se reproduce con:

```powershell
pnpm secrets:scan                       # requiere gitleaks: winget install gitleaks
pnpm audit --audit-level=critical
```

Para correr un solo archivo mientras depuras:

```powershell
pnpm --filter api exec vitest run --config vitest.integracion.config.ts test/autorizacion.int.spec.ts
```

### Nivel 4 — end to end (navegador)

Comprueban lo que solo un navegador real puede ver: que la interfaz no abra
un atajo que el servidor cierra, que la cookie no sea legible desde
JavaScript, que el formulario funcione solo con teclado.

La primera vez hay que instalar el navegador de Playwright:

```powershell
pnpm --filter web exec playwright install chromium
```

Después, **con los servidores encendidos y la base sembrada**:

```powershell
pnpm dev          # en una ventana, con el .env cargado
pnpm e2e          # en otra
```

Si acabas de correr `pnpm test:int`, siembra antes: el E2E entra con
`estudiante.a`.

---

## 4. Pruebas manuales

Sirven para demostrar los controles en una revisión o una exposición. Cada
escenario dice qué hacer, qué debe pasar y con qué prueba automática
corresponde.

### Desde el navegador

Abre http://localhost:3000. Usa una **ventana de incógnito por cuenta** para
tener dos sesiones a la vez sin que se pisen.

La interfaz web cubre el acceso, el perfil, los grupos, los usuarios, la
auditoría y las decisiones. **No tiene pantallas** para capturar, publicar o
corregir calificaciones, crear grupos, subir documentos ni crear solicitudes:
esas pruebas se hacen por API (siguiente apartado).

| # | Pasos | Resultado esperado |
|---|---|---|
| A | Sin sesión, abre http://localhost:3000/panel/usuarios | Te manda a `/ingresar` |
| B | Entra con una contraseña equivocada para `estudiante.a`, y después para `no.existe@securecampus.edu.mx` | **El mismo mensaje** en los dos casos |
| C | Falla la contraseña de `estudiante.b` 5 veces seguidas y luego escribe la correcta | Se rechaza igual: la cuenta queda limitada durante 15 minutos (429 `DEMASIADOS_INTENTOS`) |
| D | Entra como `estudiante.a` y mira el menú | Inicio, Mi perfil, Calificaciones, Documentos, Solicitudes y Decisiones. Nada de Grupos, Usuarios, Auditoría ni Alertas |
| E | Como `estudiante.a`, escribe a mano la URL http://localhost:3000/panel/usuarios | No se muestran datos: la API responde 403 aunque la página exista. Ocultar el menú no es el control; el control está en el servidor |
| F | Como `jefe.isc`: **Grupos** → `ISC-601-A` → historial de asignaciones | Aparece la versión 1 (`profesor`, creada por `jefe.isc`). Al asignar otro profesor, la anterior **se cierra, no se sobrescribe** |
| G | Como `admin` **sin MFA**, abre Usuarios o Auditoría | Error de autorización. Configura el MFA (sección 2), vuelve a entrar y ahora sí carga |
| H | Como `admin` con MFA: **Usuarios** → `jefe.isc` → asignar el rol **profesor**, con motivo | **Se rechaza** por separación de funciones: el jefe ya asigna docentes y no puede además calificar |
| I | Como `admin` con MFA, intenta asignarte un rol a ti mismo | Se rechaza: nadie se otorga privilegios a sí mismo |
| J | **¿Olvidaste tu contraseña?** con `estudiante.a`, y luego con un correo inexistente | La misma respuesta en los dos. Solo el primero recibe correo en Mailpit (http://localhost:8025). El enlace sirve **una sola vez** |
| K | Abre dos sesiones de `estudiante.a`. En una: **Mi perfil → Cambiar contraseña** | **Las dos** sesiones quedan cerradas, incluida la que hizo el cambio |
| L | **Mi perfil → Sesiones activas**: cierra una de las otras sesiones | Esa sesión deja de funcionar en su ventana al recargar |
| M | Como `admin` con MFA, abre **Auditoría** | Aparecen los intentos denegados de los pasos anteriores: quién, qué, cuándo, resultado `denegado` y motivo técnico |

J y K **cambian la contraseña** de `estudiante.a`. Para restaurarla, ver la
sección 5.

### Desde la terminal, con curl

Para ver el código HTTP exacto sin pasar por la interfaz. Los ejemplos son de
**Git Bash** (viene con Git para Windows).

```bash
API=http://localhost:3001/api
H=(-H 'Content-Type: application/json' -H 'Origin: http://localhost:3000')

entrar() {  # entrar <usuario>  -> guarda la cookie en <usuario>.jar
  curl -s -c "$1.jar" "${H[@]}" -o /dev/null -w "login $1: %{http_code}\n" \
    -d "{\"correo\":\"$1@securecampus.edu.mx\",\"contrasena\":\"SemillaDesarrollo!2026\"}" \
    $API/auth/login
}
pedir() {   # pedir <usuario> <ruta>
  curl -s -b "$1.jar" "${H[@]}" "$API$2" -w "\n-> HTTP %{http_code}\n"
}

entrar estudiante.a; entrar estudiante.b; entrar profesor; entrar jefe.isc; entrar admin
```

**Prueba 1 — A no alcanza a B.** Primero se obtiene el identificador de B
desde su propia sesión, y luego se pide con la de A:

```bash
B=$(curl -s -b estudiante.b.jar "${H[@]}" $API/auth/yo | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

pedir estudiante.a /perfiles/me                         # 200: el propio
pedir estudiante.a /perfiles/$B                         # 403: el ajeno
pedir estudiante.a /perfiles/01ZZZZZZZZZZZZZZZZZZZZZZZZ # 403: inexistente, respuesta IDÉNTICA
```

Que el inexistente y el ajeno respondan exactamente igual es parte del
control: si uno diera 404 y el otro 403, recorrer identificadores revelaría
cuáles existen.

**Prueba 2 — la relación pesa más que el rol.**

```bash
G=$(curl -s -b profesor.jar "${H[@]}" $API/grupos | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

pedir profesor     /calificaciones/grupo/$G   # 200: tiene asignación vigente
pedir jefe.isc     /calificaciones/grupo/$G   # 403: el jefe no califica
pedir estudiante.a /calificaciones/grupo/$G   # 403
```

**MFA y rutas administrativas.**

```bash
pedir admin        /usuarios   # 403 mientras la sesión no tenga MFA verificada
pedir estudiante.a /usuarios   # 403: no tiene el permiso
curl -s "${H[@]}" $API/perfiles/me -w "\n-> HTTP %{http_code}\n"   # 401: sin sesión
```

**Prueba 9 — un ejecutable disfrazado de PDF.** Se crea un archivo que empieza
con la firma de un `.exe` (`MZ`) y se sube declarándolo como PDF:

```bash
printf 'MZ\x90\x00\x03\x00\x00\x00falso' > falso.pdf
curl -s -b estudiante.a.jar -H 'Origin: http://localhost:3000' \
  -F "archivo=@falso.pdf;type=application/pdf" \
  "$API/documentos?tipo=constancia" -w "\n-> HTTP %{http_code}\n"
```

Responde 400 `TIPO_NO_PERMITIDO`: el servidor mira el contenido real, no la
extensión ni lo que declara el navegador. Los tipos válidos son `constancia` e
`identificacion`.

**Prueba 4 — el jefe no crea grupos en un periodo cerrado.**

```bash
id_de() { curl -s -b jefe.isc.jar "${H[@]}" "$API$1" | grep -o "\"$2\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }
CERRADO=$(curl -s -b jefe.isc.jar "${H[@]}" $API/periodos | grep -o '"id":"[^"]*","clave":"2026-1"' | cut -d'"' -f4)
MATERIA=$(id_de /materias idPublico)
AULA=$(id_de /aulas idPublico)

curl -s -b jefe.isc.jar "${H[@]}" $API/grupos -w "\n-> HTTP %{http_code}\n" -d "{
  \"clave\": \"ISC-601-Z\", \"materiaId\": \"$MATERIA\", \"periodoId\": \"$CERRADO\",
  \"aulaId\": \"$AULA\", \"cupo\": 30, \"motivo\": \"Prueba de periodo cerrado\",
  \"horario\": [{\"dia\": \"martes\", \"horaInicio\": \"10:00\", \"horaFin\": \"12:00\"}]
}"
```

Responde 409 `PERIODO_CERRADO`. El cuerpo **no lleva programa**: el servidor
lo toma del perfil del jefe, así que no hay campo que alterar para crear
grupos en otra carrera.

**Prueba 3 — el profesor no corrige calificaciones.**

```bash
curl -s -b profesor.jar "${H[@]}" -w "\n-> HTTP %{http_code}\n" \
  -d '{"calificacionId":"01ZZZZZZZZZZZZZZZZZZZZZZZZ","valorNuevo":90,"motivo":"Intento de correccion directa"}' \
  $API/calificaciones/01ZZZZZZZZZZZZZZZZZZZZZZZZ/corregir
```

Responde 403: capturar y corregir son permisos distintos, y el profesor solo
tiene el primero.

Resultados comprobados contra el entorno sembrado:

| Petición | Esperado |
|---|---|
| A → su perfil | 200 |
| A → perfil de B | 403 `ACCESO_DENEGADO` |
| A → perfil inexistente | 403 `ACCESO_DENEGADO` (idéntico) |
| Sin sesión | 401 `SESION_INVALIDA` |
| Profesor → lista de captura de su grupo | 200 |
| Jefe o estudiante → lista de captura | 403 |
| Admin sin MFA → usuarios | 403 |
| Estudiante sube un `.exe` como PDF | 400 `TIPO_NO_PERMITIDO` |
| Jefe crea grupo en `2026-1` | 409 `PERIODO_CERRADO` |
| Profesor intenta corregir | 403 `ACCESO_DENEGADO` |

### El flujo completo de una calificación (modifica datos)

Esto no es un rechazo, sino el camino feliz: captura, publicación y
corrección con notificación. Sirve para demostrar que la corrección deja
rastro y avisa al afectado. **Deja calificaciones reales en la base de
desarrollo.**

1. **El profesor captura en borrador.** Los `estudianteId` salen de la lista
   de captura (`pedir profesor /calificaciones/grupo/$G`):

   ```bash
   curl -s -b profesor.jar "${H[@]}" $API/calificaciones/captura -w "\n-> HTTP %{http_code}\n" \
     -d "{\"grupoId\":\"$G\",\"calificaciones\":[{\"estudianteId\":\"<ID de A>\",\"valor\":85}]}"
   ```

2. **La publica.** El `id` de la calificación aparece ahora en la lista de
   captura:

   ```bash
   curl -s -b profesor.jar "${H[@]}" $API/calificaciones/publicar -w "\n-> HTTP %{http_code}\n" \
     -d "{\"grupoId\":\"$G\",\"calificacionIds\":[\"<ID de la calificacion>\"]}"
   ```

3. **`estudiante.a` la ve y `estudiante.b` no:** `pedir estudiante.a /calificaciones/mias`.

4. **Volver a capturar sobre ella se rechaza**: repite el paso 1 con otro
   valor. Una publicada solo cambia por el flujo de corrección.

5. **El admin la corrige**, con MFA verificada en su sesión y motivo
   obligatorio (sin MFA responde 403). Con el MFA activado, el login devuelve
   `mfa-requerido` y un `desafio`; la sesión se obtiene en un segundo paso:

   ```bash
   DESAFIO=$(curl -s "${H[@]}" $API/auth/login \
     -d '{"correo":"admin@securecampus.edu.mx","contrasena":"SemillaDesarrollo!2026"}' \
     | grep -o '"desafio":"[^"]*"' | cut -d'"' -f4)
   curl -s -c admin.jar "${H[@]}" $API/auth/mfa/verificar \
     -d "{\"desafio\":\"$DESAFIO\",\"codigo\":\"<codigo de 6 digitos>\"}"
   ```

   Y la corrección:

   ```bash
   curl -s -b admin.jar "${H[@]}" "$API/calificaciones/<ID>/corregir" -w "\n-> HTTP %{http_code}\n" \
     -d '{"calificacionId":"<ID>","valorNuevo":90,"motivo":"Error de captura documentado en acta"}'
   ```

6. **Comprueba el rastro:** `pedir profesor /calificaciones/<ID>/historial`
   (o con `estudiante.a`, su titular) muestra las versiones con el valor
   anterior, y en Mailpit (http://localhost:8025) aparece el aviso a
   `estudiante.a`. Esa notificación no se puede desactivar. El admin **no** puede
   leer el historial: corrige, pero no tiene `calificacion:leer`; su rastro
   queda en Auditoría.

La documentación interactiva de todas las rutas está en
http://localhost:3001/api/docs.

---

## 5. Dejar el entorno como estaba

| Situación | Qué hacer |
|---|---|
| Probaste a mano y quieres volver a las cuentas iniciales | `pnpm --filter api db:seed` (restaura contraseñas y datos base; **no** borra lo que creaste) |
| Corriste `pnpm test:int` | `pnpm --filter api db:seed` — obligatorio, la base quedó vacía |
| Quieres empezar de cero de verdad | `.\scripts\setup.ps1 -Reiniciar` — borra volúmenes y `.env`, genera secretos nuevos |
| Una cuenta quedó bloqueada por intentos fallidos | Espera 15 minutos, o reinicia Redis: `docker compose restart redis` |

La bitácora de auditoría **no se limpia** con `db:seed`: es de solo inserción
y así debe quedarse. Solo `-Reiniciar` (que borra el volumen completo) o las
pruebas de integración la vacían.

---

## 6. Cuando una prueba falla

| Síntoma | Causa probable |
|---|---|
| `pnpm test:int` se queda colgado | `pnpm dev` sigue encendido. Apágalo y vuelve a correr |
| "DATABASE_URL_MIGRACIONES es obligatoria" | No cargaste el `.env` en esa terminal (sección 3, nivel 3) |
| El login falla con todas las cuentas | La base está vacía después de `test:int`: siembra |
| `pnpm e2e` no encuentra el navegador | Falta `pnpm --filter web exec playwright install chromium` |
| `pnpm e2e` falla al entrar | Los servidores no están encendidos, o la base no está sembrada |
| Subir documentos siempre falla | ClamAV todavía descarga firmas: `docker compose ps clamav` debe decir `healthy` |
| Admin recibe 403 en todo lo administrativo | Es el MFA (sección 2), no un error |
| El código MFA nunca es válido | El reloj de Windows está desfasado. Sincronízalo en Configuración → Hora |
| `pnpm lint` falla | Conocido: no hay configuración de ESLint todavía (ver [SETUP.md](SETUP.md)) |

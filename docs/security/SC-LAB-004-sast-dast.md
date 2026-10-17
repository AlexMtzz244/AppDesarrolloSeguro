# SC-LAB-004 · Análisis de Seguridad Estático y Dinámico (SAST + DAST) — SecureCampus

> **Pregunta guía:** ¿Qué puede descubrir una herramienta al analizar el código fuente y qué puede descubrir al interactuar con una aplicación en ejecución?

Fecha: 2026-10-13 · Commit analizado: `2864ebd` (`main`, 151 archivos rastreados)
Evidencia completa: [`SC-LAB-004/`](SC-LAB-004/) — logs por paso, salidas crudas, informes y capturas.

## 1. Objetivo

Aplicar análisis estático (SAST) y dinámico (DAST) a todo el proyecto, interpretar la evidencia,
corregir lo que resulte verdadero positivo y comprobar la corrección con un reanálisis.

El manual del laboratorio describe una mini-app Flask con dos vulnerabilidades sembradas
(SQL por concatenación y XSS reflejado con f-string). Este proyecto es otro: un monorepo
NestJS + Prisma (API) y Next.js (web). Las técnicas y herramientas son las del manual;
los hallazgos son los que el código real produce, no los del guion.

## 2. Entorno

| Componente | Versión / detalle |
|---|---|
| Sistema | Windows 11 Pro, PowerShell 5.1 |
| Node / pnpm | 22.19.0 / 10.28.1 |
| Docker | Docker Desktop, engine 29.8, compose 5.5.1 |
| SAST | Semgrep Community (contenedor `semgrep/semgrep`), gitleaks, `pnpm audit` |
| DAST | OWASP ZAP 2.17.0 (`ghcr.io/zaproxy/zaproxy:stable`) |
| Aplicación | `pnpm dev`: web en `:3000`, API en `:3001`; Postgres, Redis, MinIO, ClamAV y Mailpit en Docker |

Todos los escaneos activos se dirigieron solo a `localhost` / `host.docker.internal`.
Log: [`01-entorno.log`](SC-LAB-004/logs/01-entorno.log).

## 3. Análisis humano previo (antes de ejecutar herramientas)

| Pregunta | Respuesta |
|---|---|
| ¿Qué dato controla el usuario? | Cuerpos JSON (login, perfiles, solicitudes, calificaciones), parámetros de ruta (`:id`) y de query, archivos subidos y la cookie de sesión. |
| ¿A dónde llega? | Pasa por `ZodValidacionPipe` y por `PoliticaGuard` antes del manejador; de ahí a Prisma (consultas parametrizadas por construcción), a S3 y a la bitácora. |
| ¿Qué riesgo observo? | SQL crudo: `$executeRawUnsafe` aparece solo en `scripts/preparar-bd-ci.ts` y en pruebas, con identificadores filtrados por `identificadorSeguro`. `dangerouslySetInnerHTML` en `layout.tsx` inserta una constante (script de tema), no entrada. `new Function` en `documentos.service.ts` tiene argumento fijo. La web **no define Content-Security-Policy** (la API sí, con helmet). El riesgo principal del dominio es de **autorización** (IDOR entre estudiantes), que ninguna herramienta genérica modela. |
| ¿Qué control propongo? | Añadir CSP a Next; verificar con pruebas negativas que A no alcanza recursos de B. |

## 4. SAST

### 4.1 Comandos

```powershell
docker run --rm -v "<copia limpia>:/src" -v "<repo>\docs\security\SC-LAB-004\sast:/out" semgrep/semgrep `
  semgrep scan --config auto --json-output=/out/semgrep-auto.json --sarif-output=/out/semgrep-auto.sarif --text-output=/out/semgrep-auto.txt /src
# y lo mismo con: p/typescript p/javascript p/nodejs p/react p/nextjs p/owasp-top-ten p/secrets p/dockerfile p/sql-injection p/github-actions
```

Desviación registrada: montar el repo de trabajo directamente dejaba `semgrep-core` bloqueado en E/S
sobre el bind mount de Docker Desktop (14 min, matado, exit 137 —
[`02-semgrep-scan-auto-intento1-colgado.log`](SC-LAB-004/logs/02-semgrep-scan-auto-intento1-colgado.log)).
Se escaneó una copia limpia de lo rastreado (`git archive HEAD`, sin `.env` ni `node_modules`): mismo
contenido, rutas reportadas como `/src/...`.

### 4.2 Resultados

`--config auto`: 258 reglas sobre 144 archivos. Rulesets explícitos: 154 reglas. **Ambos dieron los mismos
27 hallazgos** ([`resumen-semgrep.md`](SC-LAB-004/sast/resumen-semgrep.md)).

| # | Regla | Ubicación | Severidad | Interpretación |
|---|---|---|---|---|
| 1 | `gcm-no-tag-length` | `apps/api/src/identidad/mfa.service.ts:66` | ERROR | **Verdadero positivo.** El descifrado AES-256-GCM de los secretos TOTP no fija `authTagLength`; Node acepta tags truncados (hasta 4 bytes). Quien pudiera escribir en la fila (p. ej. con acceso a la BD) tendría que acertar muchos menos bits para que un secreto manipulado pase. Explotabilidad baja, corrección trivial. **Corregido** (§4.3). |
| 2–3 | `missing-user` | `apps/api/Dockerfile:25`, `apps/web/Dockerfile:17` | ERROR | **Falso positivo parcial.** La etapa `produccion` sí declara `USER node`; lo señalado es la etapa `desarrollo`, que corre como root dentro del contenedor de desarrollo. Riesgo aceptado en local; no llega a producción. |
| 4–24 | `github-actions-mutable-action-tag` | `ci.yml` (16), `cve-scan.yml` (5) | WARNING | **Verdadero positivo, riesgo de cadena de suministro.** `actions/checkout@v4` y similares apuntan a una etiqueta movible; fijar por SHA impide que una etiqueta re-publicada inyecte código en CI. Pendiente (ver §9). |
| 25–27 | `pnpm-block-exotic-sub-dependencies`, `pnpm-missing-minimum-release-age`, `pnpm-trust-policy` | `pnpm-workspace.yaml:1` | MEDIUM | Endurecimiento recomendado de pnpm (bloquear dependencias de git/tarball, retrasar versiones recién publicadas). Pendiente. |

**Evidencia SAST** (hallazgo principal, en el formato del manual):

| Registro | Detalle |
|---|---|
| Regla / hallazgo | `javascript.node-crypto.security.gcm-no-tag-length` (ERROR, bloqueante): `createDecipheriv` en modo GCM sin longitud de tag de autenticación esperada. |
| Archivo / línea | `apps/api/src/identidad/mfa.service.ts:66` |
| ¿Qué evidencia aporta? | Señala el patrón inseguro sin ejecutar la aplicación: Node acepta tags GCM truncados (de hasta 4 bytes) si no se fija `authTagLength`. No demuestra por sí sola que sea explotable; para hacerlo habría que poder escribir en la fila que guarda el secreto TOTP cifrado. |
| ¿Coincide con el análisis humano? | **No.** El análisis previo (§3) se centró en SQL crudo, `dangerouslySetInnerHTML`, `new Function`, la CSP y la autorización, y no anticipó este hallazgo. Sí coincidió en lo que Semgrep **no** marcó: ningún `$executeRawUnsafe` con entrada de usuario. |

Complementos SAST:

- **`pnpm audit`** (SCA): 45 vulnerabilidades — 3 critical, 18 high, 22 moderate, 2 low
  ([`resumen-sca-secretos.md`](SC-LAB-004/sast/resumen-sca-secretos.md)). Las 3 críticas venían de
  `vitest@2 → tinypool` (RCE por prototype pollution), dependencia de desarrollo. Eran además la causa de que
  el job "Auditoria de dependencias" de CI estuviera rojo. **Corregido** al actualizar vitest a 4
  (que ya no usa tinypool): quedan 0 críticas. Siguen 17 high, entre ellas `multer` (vía
  `@nestjs/platform-express`, código de producción que procesa las subidas) y `nodemailer`: son las
  siguientes a atender.
- **gitleaks** (historial, `--redact`): 10 coincidencias, todas URLs de Postgres de ejemplo o de los
  contenedores efímeros de CI (`setup.ps1`, `ci.yml`, `docker-compose.yml`). Ninguna es un secreto real;
  ningún valor de `.env` aparece en el repositorio ni en esta evidencia (verificado).

### 4.3 Corrección y reanálisis

```ts
const descifrador = createDecipheriv('aes-256-gcm', this.clave, nonce, { authTagLength: 16 });
```

Compatible con los datos existentes: `getAuthTag()` produce 16 bytes por omisión.
**Resultado del equipo:** reanálisis de `apps/api/src/identidad/` con `--config auto`: **210 reglas, 8 archivos,
0 hallazgos** ([`07-semgrep-retest-identidad.log`](SC-LAB-004/logs/07-semgrep-retest-identidad.log)).
Eso significa que las reglas ejecutadas ya no reportan nada en ese directorio, no que el módulo sea seguro.
Tras la segunda ronda de correcciones (2026-10-16), el reescaneo completo bajó de 27 a 3 hallazgos; el detalle
está en la [comparativa antes / después](SC-LAB-004-comparativa-antes-despues.md).

## 5. DAST

### 5.1 Baseline (pasivo)

| Objetivo | PASS | WARN | FAIL | Alertas relevantes |
|---|---|---|---|---|
| Web `:3000` | 59 | 8 | 0 | **10038 CSP Header Not Set** (Medium, 3); 90004 COEP/COOP/CORP ausentes (Low); 10044 Big Redirect; 10110 Dangerous JS Functions; 2 Private IP Disclosure |
| API `:3001/api/docs` | 61 | 6 | 0 | 10055 CSP wildcard y `style-src 'unsafe-inline'` (Medium); 10063 Permissions-Policy; 10096 Timestamp Disclosure |

Hallazgos del baseline, en el formato del manual:

| Hallazgo baseline | ¿Qué observa? | ¿Requiere análisis? |
|---|---|---|
| CSP Header Not Set [10038] (web) | Política de contenido ausente | Sí: verdadero positivo |
| COEP / COOP / CORP [90004] (web) | Cabeceras de aislamiento entre orígenes ausentes | Sí, opcional |
| CSP wildcard y `style-src 'unsafe-inline'` [10055] (API) | CSP laxa en `/api/docs` | Sí: limitado a Swagger UI |
| Dangerous JS Functions [10110], Private IP Disclosure [2] (web) | Código de los chunks de `next dev` | Sí: ruido del entorno de desarrollo |
| Big Redirect [10044] (web) | El `307` de `/` a `/panel` lleva cuerpo | Informativo |

Interpretación, alerta por alerta:

- **10038 en la web: verdadero positivo.** `next.config.mjs` envía `nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy` y `Permissions-Policy`, pero ninguna CSP. Hoy no hay XSS demostrable (§5.3), pero la CSP
  es la segunda línea que contendría uno futuro. Es la mejora más valiosa que deja el DAST.
- **10055 en la API: limitado a Swagger UI.** El resto de la API responde con `default-src 'none'`; la ruta
  `/api/docs` necesita estilos en línea y solo se publica fuera de producción (`main.ts`). Aceptado.
- **10110 y 2:** salen de los chunks de `next dev` (código de React/Next en modo desarrollo). Ruido de
  entorno; no aplican a un build de producción.
- **10044 Big Redirect:** el `307` de `/` a `/panel` lleva cuerpo. Informativo.
- **90004 COEP/COOP/CORP en la web:** endurecimiento opcional; la API ya envía COOP y CORP.

### 5.2 Escaneo activo

| Escaneo | PASS | WARN | FAIL | 40012 XSS reflejado | 40018 SQLi |
|---|---|---|---|---|---|
| API scan guiado por OpenAPI (79 URLs) | 119 | 0 | 0 | PASS | PASS |
| API scan autenticado (cookie de estudiante.a) | 119 | 0 | 0 | PASS | PASS |
| Full scan web (`-m 5 -T 30`) | 137 | 5 | 0 | PASS | PASS |

**Resultado del equipo:** Cross Site Scripting (Reflected) [40012] y SQL Injection [40018] quedaron en PASS
en los tres escaneos activos. A diferencia de la mini-app del manual, aquí no hubo ningún XSS que localizar.

Límites de esta evidencia, dichos sin rodeos:

- El escaneo de API sin sesión recibió 401/403 en casi todo: confirma que la autenticación cierra la
  superficie, pero no ejercita los manejadores. El escaneo autenticado dio un resultado casi idéntico, y no
  se pudo confirmar que la cookie se aplicara a todas las peticiones. Por eso el PASS de 40012/40018 en la
  API vale como "no se encontró", no como "no existe".
- El full scan web rastreó solo 13 endpoints de `next dev`, con un 9 % de fallos de red y un 56 % de
  respuestas lentas según sus propios *insights*. Para una cobertura seria haría falta escanear un build de
  producción con sesión.

### 5.3 Validación manual (pruebas negativas)

Log: [`05-pruebas-manuales.log`](SC-LAB-004/logs/05-pruebas-manuales.log). Capturas 12–17.

| Prueba | Resultado | Esperado |
|---|---|---|
| `<script>alert(1)</script>` como correo en login y recuperación | 400 `VALIDACION`; el payload no vuelve en la respuesta | No reflejar |
| Mismo payload escrito en el formulario (Edge) | Se muestra como texto; ningún diálogo, ningún `<script>`/`<img>` creado | No ejecutar |
| Payload en `?next=`/`?error=` de `/ingresar` | 200; solo aparece escapado (`<`) dentro del payload de React | No ejecutar |
| `' OR '1'='1` y `admin@...'--` como correo | 400 por validación de formato | Rechazo |
| `' OR '1'='1` y `x'; DROP TABLE usuarios;--` como contraseña | 401 `CREDENCIALES_INVALIDAS`, sin error de BD | Rechazo sin filtrar detalles |
| **IDOR**: A pide el perfil de B / B el de A / A modifica el teléfono de B | **403 / 403 / 403** `ACCESO_DENEGADO` | 403 |
| Sin sesión: `/perfiles/{idB}`, `/auth/yo`, `/usuarios` | 401 | 401 |
| Estudiante pide `/usuarios`, `/auditoria` | 403 | 403 |
| Estudiante pide `/decisiones` | 200 | **Intencional**: el controlador lo declara visible para todo usuario autenticado |
| Preflight CORS desde `http://evil.example` | 204 sin `Access-Control-Allow-Origin` | Origen no autorizado |

La cookie `sc_sesion` sale con `HttpOnly; SameSite=Lax`, sin `Secure` (correcto en `http://localhost`;
debe activarse detrás de TLS).

### 5.4 XSS: corrección y retesting

El paso del manual (cambiar un f-string por una plantilla con escape) **no aplica**: no hay XSS reflejado
que corregir. React escapa toda interpolación por omisión, la API responde JSON con `nosniff`, y ni ZAP
(40012 en PASS) ni la validación manual lograron que el payload se ejecutara. El equivalente honesto del
"retesting" es la tabla anterior, ejecutada contra la instancia en marcha.

## 6. Comparación SAST vs DAST (con lo observado aquí)

| Criterio | SAST | DAST |
|---|---|---|
| Objeto | Código, Dockerfiles, workflows, lockfile | Web y API en ejecución |
| Necesita ejecutar la app | No | Sí (y con datos sembrados para ir más allá del login) |
| Lo que encontró aquí | Tag GCM sin longitud, imágenes de desarrollo como root, acciones sin fijar, dependencias con CVE críticos | Web sin CSP, CSP laxa en Swagger, cabeceras COEP/COOP ausentes |
| Lo que no podía ver | Que la web no envía CSP (es configuración que nadie "llama"); el comportamiento real ante payloads | El tag GCM, los workflows de CI, las dependencias de desarrollo |
| Límite observado | Reglas genéricas: ninguna modela "A no debe ver lo de B" | 401/403 cortan el escaneo antes del manejador; cobertura de 13 endpoints en web |

No hubo ni un hallazgo en común: cada técnica vio una capa distinta. Y el control más importante del
proyecto, la autorización por relación usuario-recurso, solo lo demostró la prueba manual de IDOR.

## 7. Cambios hechos a partir del análisis y evidencia en GitHub

| Cambio | Origen | Verificación |
|---|---|---|
| `authTagLength: 16` en el descifrado GCM de MFA | SAST (Semgrep) | Reanálisis: 0 hallazgos; `tsc` sin errores |
| vitest 2 → 4 (elimina tinypool con 2 CVE críticos) | SAST (`pnpm audit`) | `pnpm audit --audit-level=critical`: 0 críticas; 39 pruebas unitarias y 84 de integración en verde |
| ESLint configurado, `contracts` compilado en postinstall, cliente Prisma generado en postinstall, entorno de CI completo, job E2E con la app levantada | CI rojo desde antes del laboratorio | Contenedor `node:22` con Postgres y Redis: lint, tipos, unitarias, integración y arranque completo |
| Segunda ronda (2026-10-16): `nodemailer` 6 → 10, `next` → 15.5.28, `file-type` → 21, overrides de `multer`, `postcss`, `sharp`, `vite`, `js-yaml`, `source-map-js`, `postcss-selector-parser` | SCA (`pnpm audit`) | `pnpm audit`: 45 → 2 (`braces` sin parche y `deepmerge-ts` de la CLI de Prisma, ambas de desarrollo); lint, tipos y 26 pruebas unitarias de la API en verde |
| CSP con nonce por petición (`apps/web/src/middleware.ts`), COOP y CORP en `next.config.mjs` | DAST (ZAP 10038, 90004) | Build de producción OK; cabecera y nonce del script de tema comprobados con `next start` |
| Acciones de GitHub fijadas por SHA; `blockExoticSubdeps`, `trustPolicy: no-downgrade` y `minimumReleaseAge` en pnpm; auditoría de CI a `--prod --audit-level=high` | SAST (Semgrep) | Pendiente de reescaneo con Semgrep |

Trazabilidad en Git (rama `security/sc-lab-004-sast-dast`):

| Commit | Autor | Fecha | Contenido |
|---|---|---|---|
| `08ae6fd` | AlexMtzz244 | 2026-10-13 | Evidencia SAST y DAST (en curso) |
| `d69d37b` | AlexMtzz244 | 2026-10-13 | Reparación de los jobs de CI |
| `3bf13d3` | AlexMtzz244 | 2026-10-13 | `authTagLength` en el descifrado GCM y este informe |
| `68ce509` | AlexMtzz244 | 2026-10-13 | SBOM con cdxgen |
| `00974c5` | AlexMtzz244 | 2026-10-13 | Quitar `autoFocus` del correo (accesibilidad) |
| `24f2bc2` | DiegoSR01 | 2026-10-16 | Dependencias, CSP con nonce, hardening de CI y pnpm |

Reanálisis con las mismas herramientas tras estos cambios: [comparativa antes / después](SC-LAB-004-comparativa-antes-despues.md).

## 8. Reflexión

1. **¿Por qué 0 findings en SAST no equivale a aplicación segura?** Porque solo dice que *las reglas
   ejecutadas* no coincidieron. Aquí 258 reglas no tienen forma de saber que un estudiante no debe leer el
   perfil de otro, ni que la web carece de CSP; ninguna de esas dos cosas es un patrón de código.
2. **¿Por qué validar un WARN de ZAP antes de declararlo vulnerabilidad?** Porque de 8 WARN en la web, solo
   uno (CSP ausente) es un riesgo real aplicable; 10110 y 2 provienen del código de `next dev`, y la CSP laxa
   de la API está limitada a Swagger UI, que no existe en producción. Declararlos todos sería ruido que
   esconde el importante.
3. **¿Qué diferencia hubo entre baseline y active scan?** El baseline solo observa respuestas (cabeceras,
   contenido) y no puede afirmar nada sobre XSS o SQLi: 40012/40018 ni siquiera corren en pasivo. El activo
   envía payloads y sí las evalúa, pero tarda más, genera carga (y en esta app, 401/403 que lo detienen).
4. **¿Por qué 200 OK no descarta una vulnerabilidad?** `/ingresar?next=<script>...` devolvió 200; lo
   que importa es *qué* devuelve. Aquí el payload volvía escapado y no se ejecutaba, pero el mismo 200 con
   el payload literal en el HTML sería un XSS. A la inversa, `/decisiones` devolvió 200 a un estudiante y es
   correcto por diseño. El código de estado no es el veredicto.
5. **¿Qué aprendí de reiniciar el servidor antes del retest?** Que la instancia en ejecución es lo que se
   prueba, no el archivo. En esta práctica ocurrió de verdad: `pnpm dev` arrancó con un `dist` viejo de
   `contracts` (del 24/09) y la API no compilaba hasta reconstruirlo; y `nest --watch` reinició la API a
   mitad de las pruebas manuales, invalidando un intento completo que hubo que repetir.
6. **¿Qué problema de autorización podría seguir sin que SAST ni DAST lo reporten?** Un IDOR en un endpoint
   que las pruebas manuales no cubrieron (por ejemplo, un profesor accediendo a calificaciones de un grupo
   que no imparte), o una escalada por relación (un jefe de carrera viendo datos de otro programa). Ambas
   herramientas son ciegas a la regla de negocio "quién puede ver qué"; solo las pruebas negativas por rol y
   relación —como las 13 obligatorias del proyecto— lo verifican.

## 9. Pendientes recomendados

1. CSP en `next.config.mjs` (con nonce para el script de tema de `layout.tsx`).
2. Fijar las acciones de GitHub por SHA en `ci.yml` y `cve-scan.yml`.
3. Atender las high de `multer` y `nodemailer` (código de producción).
4. Endurecimiento de pnpm (`minimumReleaseAge`, bloqueo de dependencias exóticas).
5. Repetir DAST contra un build de producción con sesión autenticada verificada, y ampliar el IDOR a los
   roles profesor y jefe de carrera.
6. `docker-compose.yml` sigue apuntando a `quay.io/minio/*`, que respondió 401 al hacer pull; los contenedores
   locales existentes usan `cgr.dev/chainguard/minio`. Conviene alinear el archivo.

## 10. Cobertura de la rúbrica del laboratorio

| Criterio | Puntos | Dónde se cubre |
|---|---|---|
| Ejecución e interpretación SAST | 20 | §3, §4.1–4.2 |
| Corrección SQL + reanálisis | 15 | §4.3 (aquí el hallazgo verdadero fue el tag GCM; no hay SQL inyectable, §3) |
| Baseline y Active Scan DAST | 20 | §5.1–5.2 |
| Validación / corrección / retesting XSS | 25 | §5.3–5.4 (no hubo XSS; se documenta la CSP como control y su retest en la comparativa) |
| Comparación SAST vs DAST | 10 | §6 |
| Evidencia Git/GitHub y reflexión | 10 | §7, §8 |

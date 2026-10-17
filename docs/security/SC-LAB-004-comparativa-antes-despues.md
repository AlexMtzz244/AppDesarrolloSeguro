# SC-LAB-004 · Comparativa antes / después de la remediación SAST + DAST

Fecha del reanálisis: 2026-10-16
Antes: commit `2864ebd`, analizado el 2026-10-13 ([informe original](SC-LAB-004-sast-dast.md)).
Después: commit `24f2bc2` (correcciones de `3bf13d3` y `24f2bc2`).
Evidencia del reanálisis: [`SC-LAB-004/retest/`](SC-LAB-004/retest/) — [bitácora](SC-LAB-004/retest/00-bitacora.md), logs, salidas crudas e informes.

## 1. Objetivo y método

El análisis original encontró hallazgos con SAST y DAST, y después se aplicaron correcciones. Este documento
comprueba con evidencia nueva qué cambió. No basta con leer el diff: se repitieron las mismas herramientas, con
los mismos parámetros, contra el código y la aplicación actuales, y se compararon los resultados uno por uno.

| Paso | Antes (`2864ebd`) | Después (`24f2bc2`) | Mismas condiciones |
|---|---|---|---|
| Semgrep `--config auto` y 10 rulesets | Sí | Sí | Sí: copia limpia por `git archive`, mismo contenedor |
| `pnpm audit` | Sí | Sí, y además `--prod --audit-level=high` (el comando que ahora usa CI) | Sí |
| gitleaks sobre el historial | Sí | Sí | Sí: mismo `.gitleaks.toml`, aunque la configuración cambió entre una corrida y otra (ver §2.3) |
| ZAP baseline web y API | Sí | Sí | Sí: `next dev` y API en modo desarrollo |
| ZAP API scan (OpenAPI) | Sí | Sí | Sí |
| ZAP full scan web | Sí | **No completado** | Docker Desktop dejó de responder a mitad del escaneo (§6) |
| ZAP API scan autenticado | Sí (extra) | No repetido | — |
| Pruebas manuales negativas | Sí | Sí, los mismos casos | Sí |
| CSP en build de producción | No | Sí (`next build` + `next start` + navegador) | Prueba nueva, necesaria por la CSP |

## 2. SAST

### 2.1 Semgrep

| Métrica | Antes | Después |
|---|---|---|
| Reglas / archivos (`auto`) | 258 / 144 | 258 / 147 |
| Hallazgos totales | **27** | **3** |
| ERROR | 3 | 2 |
| WARNING | 21 | 0 |
| MEDIUM | 3 | 1 |

Los dos escaneos (`auto` y rulesets) volvieron a coincidir exactamente
([`semgrep-auto.txt`](SC-LAB-004/retest/sast/semgrep-auto.txt), [`semgrep-rulesets.txt`](SC-LAB-004/retest/sast/semgrep-rulesets.txt)).

| Hallazgo original | Cantidad | Cambio aplicado | Después | Estado |
|---|---|---|---|---|
| `gcm-no-tag-length` en `mfa.service.ts` | 1 | `authTagLength: 16` en `createDecipheriv` (`3bf13d3`) | 0 | **Corregido** |
| `github-actions-mutable-action-tag` en `ci.yml` y `cve-scan.yml` | 21 | Cada `uses:` fijado por SHA con la versión en comentario (`24f2bc2`) | 0 | **Corregido** |
| `pnpm-block-exotic-sub-dependencies` | 1 | `blockExoticSubdeps: true` | 0 | **Corregido** |
| `pnpm-trust-policy` | 1 | `trustPolicy: no-downgrade` (excepción para `semver@6.3.1`) | 0 | **Corregido** |
| `pnpm-missing-minimum-release-age` | 1 | `minimumReleaseAge: 1440` (1 día) | 1 | **Parcial**: la regla sigue saltando porque pide como mínimo `10080` (7 días) |
| `missing-user` en `apps/api/Dockerfile` y `apps/web/Dockerfile` | 2 | Ninguno | 2 | **Aceptado**: es la etapa `desarrollo`; la etapa `produccion` sí usa `USER node` |

Lo que el reescaneo **no** demuestra: 0 hallazgos en `.github/` o en `identidad/` significa que esas reglas ya no
coinciden, no que el módulo sea seguro.

### 2.2 Dependencias (`pnpm audit`)

| Severidad | Antes | Después |
|---|---|---|
| Critical | 3 | **0** |
| High | 18 | **2** |
| Moderate | 22 | **0** |
| Low | 2 | **0** |
| **Total** | **45** | **2** |

Fuente: [`pnpm-audit.json`](SC-LAB-004/retest/sast/pnpm-audit.json), [`02c-pnpm-audit.log`](SC-LAB-004/retest/logs/02c-pnpm-audit.log).

Qué se hizo: vitest 2 → 4 (elimina `tinypool`, las 3 críticas), `nodemailer` 6 → 10, `next` → 15.5.28,
`file-type` → 21, y *overrides* para `multer`, `postcss`, `sharp`, `vite`, `js-yaml`, `source-map-js` y
`postcss-selector-parser`. Con esto desaparecieron las high de código de producción que el informe original
señalaba como prioritarias: `multer` (procesa las subidas) y `nodemailer`.

Quedan dos, ambas sin versión corregida que se pueda alcanzar hoy:

| Paquete | Ruta | Observación |
|---|---|---|
| `braces` (GHSA-vfj7-8cjw-p6xm) | `eslint-config-next → … → micromatch → braces` | Solo desarrollo (linter). Sin parche publicado. |
| `deepmerge-ts` (GHSA-ggr8-5vv4-36mx) | `@prisma/client → prisma → @prisma/config → deepmerge-ts` | **Ver abajo.** |

**Hallazgo nuevo sobre CI.** El comentario de `ci.yml` dice que `deepmerge-ts` es de desarrollo y que
`--prod` lo deja fuera. El reanálisis muestra lo contrario: `pnpm audit --prod --audit-level=high` **sí lo
reporta y termina con código 1**, porque llega a través de `@prisma/client`, que es dependencia de producción
([`02d-pnpm-audit-prod-high.log`](SC-LAB-004/retest/logs/02d-pnpm-audit-prod-high.log)). Si CI usa el mismo
lockfile, el job "Auditoría de dependencias" sigue en rojo. Opciones: actualizar Prisma cuando `@prisma/config`
publique la corrección, o registrar la excepción con `auditConfig.ignoreGhsas` y su justificación (la CLI de
Prisma no procesa entrada del usuario en tiempo de ejecución).

### 2.3 Secretos (gitleaks)

| | Antes | Después |
|---|---|---|
| Coincidencias | 10 | 4 |
| Secretos reales | 0 | 0 |

Fuente: [`gitleaks.json`](SC-LAB-004/retest/sast/gitleaks.json) (con `--redact`).

La baja no viene de borrar nada. Las 4 coincidencias de `ci.yml` desaparecieron porque `.gitleaks.toml`
(commit `d69d37b`) ahora permite explícitamente solo las dos credenciales efímeras de los contenedores de CI;
las 2 del commit `f4722e7` ya no existen en el historial actual. Las 4 que quedan son plantillas sin valor:
`$claveApp`, `$claveBd`, `${POSTGRES_APP_PASSWORD}` y `CAPTCHA_SECRETO=` vacío. Siguen siendo falsos positivos.

## 3. DAST

### 3.1 Escaneos ZAP

| Escaneo | Antes PASS / WARN / FAIL | Después PASS / WARN / FAIL |
|---|---|---|
| Baseline web `:3000` | 59 / 8 / 0 | 59 / 8 / 0 |
| Baseline API `/api/docs` | 61 / 6 / 0 | 60 / 7 / 0 |
| API scan OpenAPI (79 URLs) | 119 / 0 / 0 | 119 / 0 / 0 |
| Full scan web | 137 / 5 / 0 | No completado (§6) |

Que los totales de la web sigan en 8 WARN no quiere decir que nada haya cambiado: salieron unas alertas y
entraron otras. El detalle importa más que el número.

### 3.2 Alertas de la web, una por una

Informe: [`zap-baseline-web.md`](SC-LAB-004/retest/dast/zap-baseline-web.md).

| Alerta | Antes | Después (`next dev`) | Producción (`next start`) | Lectura |
|---|---|---|---|---|
| 10038 CSP Header Not Set (Medium) | 3 instancias | **PASS** | Cabecera presente | **Corregido.** CSP con nonce por petición en `apps/web/src/middleware.ts` |
| 90004 COOP ausente | 2 | **PASS** | `same-origin` | **Corregido** (`next.config.mjs`) |
| 90004 CORP ausente | 5 | **PASS** | `same-origin` | **Corregido** (`next.config.mjs`) |
| 90004 COEP ausente | 2 | 2 | Ausente | Sin cambio. Endurecimiento opcional |
| 10055 CSP: Wildcard Directive (Medium) | — | **Nuevo**, 5 | No aplica | Por `connect-src … ws:`, que solo se añade en desarrollo para el refresco en caliente |
| 10055 CSP: script-src unsafe-eval (Medium) | — | **Nuevo**, 5 | No aplica | `'unsafe-eval'` solo se añade en desarrollo |
| 10110 Dangerous JS Functions, 2 Private IP Disclosure, 10027 Suspicious Comments | Sí | Sí | — | Ruido de los chunks de `next dev`, igual que antes |
| 10044 Big Redirect | 2 | 2 | — | Informativo, igual que antes |

Las dos alertas nuevas son consecuencia directa de haber añadido la CSP: antes no había política que
evaluar. Como el escaneo se hizo contra `next dev`, se comprobó aparte la política que sirve la build de
producción ([`06d-cabeceras-produccion.log`](SC-LAB-004/retest/logs/06d-cabeceras-produccion.log)):

```
default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…';
style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
connect-src 'self' http://localhost:3001; frame-ancestors 'none'; object-src 'none';
base-uri 'self'; form-action 'self'
```

- Sin `'unsafe-eval'` ni `ws:`: las dos alertas nuevas no aplican en producción.
- El nonce cambia en cada petición; 35 etiquetas del HTML lo llevan y no hay ningún `<script>` sin él.
- En navegador ([`06e-navegador-csp.log`](SC-LAB-004/retest/logs/06e-navegador-csp.log)) React hidrata,
  el script de tema se ejecuta (la clase `dark` aparece en `<html>`) y la consola no muestra violaciones
  de CSP. La CSP no rompió la aplicación.
- Concesión que queda: `style-src-attr 'unsafe-inline'`, necesaria porque React emite atributos `style`.
  Permite estilos en atributos, no scripts; el riesgo residual es inyección de CSS, no XSS.

### 3.3 Alertas de la API

Informe: [`zap-baseline-api.md`](SC-LAB-004/retest/dast/zap-baseline-api.md).

| Alerta | Antes | Después | Lectura |
|---|---|---|---|
| 10055 CSP wildcard y `style-src 'unsafe-inline'` en `/api/docs` | Sí | Sí | Sin cambio. Limitado a Swagger UI, que no se publica en producción. Aceptado |
| 10063 Permissions-Policy, 10096 Timestamp, 90004 COEP | Sí | Sí | Sin cambio |
| 10003 Vulnerable JS Library (Low) | — | **Nuevo** | DOMPurify 3.4.13 dentro de `swagger-ui-bundle.js` |

El 10003 **no es una regresión**: `swagger-ui-dist@5.32.13` es la misma versión en los dos commits (lockfile sin
cambios en ese paquete). Lo que cambió es la base de datos de Retire.js de ZAP, que ya conoce CVE-2026-109344
y CVE-2026-109345 (corregidos en DOMPurify 3.4.16). Solo afecta a Swagger UI, que existe solo fuera de
producción. Se resuelve cuando `@nestjs/swagger` traiga una versión nueva de `swagger-ui-dist`.

El API scan activo dio el mismo resultado que antes: 119 PASS, con 40012 (XSS reflejado) y 40018 (SQLi) en
PASS. Igual que en el original, la mayoría de rutas responden 401/403 sin sesión, así que esto vale como "no se
encontró", no como "no existe".

### 3.4 Pruebas manuales negativas

Log: [`05b-pruebas-manuales.log`](SC-LAB-004/retest/logs/05b-pruebas-manuales.log).

| Prueba | Antes | Después |
|---|---|---|
| XSS como correo en login y en recuperación | 400 | 400 |
| Payload en `?next=` / `?error=` de `/ingresar` | 200, escapado | 200, el payload no aparece literal en el HTML |
| `' OR '1'='1` como correo | 400 | 400 |
| `x'; DROP TABLE usuarios;--` como contraseña | 401 | 401 |
| IDOR: A lee el perfil de B / B el de A / A modifica el teléfono de B | 403 / 403 / 403 | 403 / 403 / 403 |
| Sin sesión: `/perfiles/{id}`, `/auth/yo`, `/usuarios` | 401 | 401 |
| Estudiante pide `/usuarios`, `/auditoria` | 403 | 403 |
| Estudiante pide `/decisiones` (intencional) | 200 | 200 |
| Preflight CORS desde `http://evil.example` | 204 sin ACAO | 204 sin ACAO |
| Cookie `sc_sesion` | `HttpOnly`, sin `Secure` en http | Igual |

16 de 16 casos con el resultado esperado, idénticos a los del análisis original. Esto es relevante porque el
commit de remediación subió versiones mayores (`nodemailer` 6 → 10, vitest 2 → 4) y cambió el *layout* raíz de
la web: no rompió ni la validación ni la autorización.

## 4. Resumen

| Área | Antes | Después | Resultado |
|---|---|---|---|
| Semgrep | 27 hallazgos | 3 | 24 corregidos; 1 parcial; 2 aceptados |
| `pnpm audit` | 45 (3 critical, 18 high) | 2 high | Producción limpia salvo `deepmerge-ts` vía Prisma |
| `pnpm audit --prod --audit-level=high` | — | **Falla** | El job de CI sigue en rojo |
| gitleaks | 10 falsos positivos | 4 falsos positivos | Sin secretos reales en ningún caso |
| CSP web | Ausente | Presente, con nonce, verificada en producción | Corregido |
| COOP / CORP web | Ausentes | Presentes | Corregido |
| XSS / SQLi / IDOR (ZAP + manual) | No encontrados | No encontrados | Sin regresiones |

### Pendientes que siguen abiertos

1. **`deepmerge-ts` rompe `pnpm audit --prod` en CI.** Corregir el comentario de `ci.yml` y decidir entre
   actualizar o registrar la excepción.
2. `minimumReleaseAge` a `10080` (7 días) si se quiere cumplir la regla de Semgrep; 1 día es una decisión
   válida, pero debería quedar documentada como tal.
3. Los *overrides* de `package.json` usan `>=` sin tope (`"multer": ">=2.4.0"`, `"postcss": ">=8.5.23"`…). Si
   se regenera el lockfile pueden saltar a una versión mayor incompatible. Más seguro: `^2.4.0`, `^8.5.23`.
4. Etapa `desarrollo` de los Dockerfiles como root (riesgo aceptado, sin cambio).
5. COEP en la web (opcional).
6. Swagger UI con DOMPurify vulnerable: esperar a `@nestjs/swagger`; no afecta a producción.
7. Repetir el full scan web, idealmente contra la build de producción y con sesión, y el API scan autenticado.
8. Ampliar el IDOR a profesor y jefe de carrera (pendiente del informe original, sin cambio).
9. `docker-compose.yml` sigue apuntando a `quay.io/minio/*` (pendiente del informe original, sin cambio).

## 5. Conclusión

Las correcciones atacaron justo lo que el análisis señaló, y el reescaneo lo confirma con números: 27 → 3 en
Semgrep, 45 → 2 en dependencias, y la web pasó de no tener CSP a tener una política estricta con nonce que
funciona en producción. Ninguna corrección rompió la validación de entrada ni el control de acceso.

También hay que decir lo que no mejoró o salió distinto de lo esperado. La auditoría de CI que se pretendía
dejar en verde sigue fallando por una dependencia que se creía de desarrollo y no lo es. Además, ZAP
reportó alertas nuevas: las de la CSP salen del modo desarrollo, y la de Swagger se debe a un CVE publicado
después del primer análisis. Por eso vale la pena repetir el análisis, aunque las correcciones parezcan
evidentes en el diff: el resultado depende del código, del entorno en que se escanea y de la fecha.

## 6. Límites de este reanálisis

- **Full scan web no completado.** A los ~28 minutos el motor de Docker Desktop dejó de responder (`500` en la
  API del engine) y el contenedor de ZAP no generó informe. Se decidió no repetirlo. La comparación de la web
  se apoya en el baseline, las pruebas manuales y la verificación en producción. En el original, el full scan
  solo añadió el PASS de 40012/40018 sobre 13 endpoints.
- Por lo anterior, la comparación DAST de la web es **pasiva + manual**: el baseline observa respuestas pero no
  envía payloads, y la parte activa la cubren las 16 pruebas manuales y el API scan (solo API).
- El API scan autenticado del original no se repitió.
- Los escaneos ZAP se hicieron, como en el original, contra `next dev`; por eso se añadió la comprobación de
  la build de producción con `curl` y navegador, no con ZAP.
- El estado real del job de CI no se consultó en GitHub; la conclusión sobre el job sale de ejecutar el
  mismo comando en local con el mismo lockfile.

## 7. Qué cabría esperar del full scan (estimación, no evidencia)

Esta sección **no contiene resultados de ningún escaneo**. Es una inferencia a partir de lo que sí se midió,
y sirve solo para orientar una futura repetición. No debe citarse como resultado.

| Alerta del full scan original | Expectativa | En qué se apoya |
|---|---|---|
| 10038 CSP Header Not Set | Debería desaparecer | El baseline web ya la da en PASS y la cabecera se verificó con curl |
| 90004 COOP y CORP | Deberían desaparecer | Baseline en PASS y cabeceras presentes. COEP seguiría |
| 40012 XSS reflejado, 40018 SQLi | Probablemente PASS | Pruebas manuales con los mismos payloads dan 400/401 y el payload no se refleja; el API scan ya da PASS |
| 10055 (CSP wildcard y `unsafe-eval`) | Aparecerían si se escanea `next dev` | El baseline las muestra, y son solo de desarrollo |
| 10110, 2, 10027 (ruido de `next dev`) | Seguirían | Aparecen igual en el baseline |

Lo que **no** se puede inferir: si el rastreo activo llegaría a rutas que el baseline no vio, ni si alguna regla
activa distinta de XSS y SQLi (inclusión de archivos, inyección de comandos, etc.) encontraría algo.
Para cerrar esa duda hay que correr el escaneo.

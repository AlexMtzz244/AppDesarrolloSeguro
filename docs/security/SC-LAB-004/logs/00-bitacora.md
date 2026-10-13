# Bitacora SC-LAB-004

- 07:44:46 | Creada estructura de carpetas; Paso 1 entorno (git 2.49, node 22.19, pnpm 10.28.1, py 3.13.3, docker 29.8, compose 5.5.1; 151 archivos rastreados; HEAD 2864ebd) | log: 01-entorno.log
- 07:44:46 | Iniciado Docker Desktop (Start-Process) | log: -
- 07:55:29 | Infra docker compose (exit 0) | log: 03a-docker-infra.log
- 07:56:38 | db:deploy + db:seed (exit 0) | log: 03c-db-deploy-seed.log
- 08:09:00 | Reconstruido dist de packages/contracts (artefacto gitignored) por TS2322 en API (exit 0) | log: 03d-contracts-build.log
- 08:11:14 | pnpm audit texto (exit 1) | log: 02d-pnpm-audit.log
- 08:11:21 | pnpm audit --json (exit 1) | log: 02d-pnpm-audit.log
- 08:12:42 | Semgrep --config auto (exit 137) | log: 02-semgrep-scan-auto.log
- 08:12 | Semgrep --config auto intento 1 colgado 14 min (conexion HTTPS en CLOSE_WAIT mientras competia con docker pull), matado con docker kill (exit 137) | 02-semgrep-scan-auto-intento1-colgado.log
- 08:13:07 | docker pull de imagenes semgrep, gitleaks, zap, curl (exit 0) | log: 02a-semgrep-pull.log
- 08:13:25 | gitleaks detect (historial git, --redact) (exit 1) | log: 02e-gitleaks.log
- 08:13:49 | Verificacion app (exit 0) | log: 03-levantar-app.log
- 08:13 | Servicios arriba: web 3000 (PID 17460), API 3001 (PID 25012); pnpm dev en tarea bg bhxd52zh3 (script dev.ps1); infra Docker existente healthy (compose.yml pide quay.io/minio que da 401: se reutilizaron contenedores chainguard ya creados) | 03-levantar-app.log, 03a, 03b
- 08:14:29 | Semgrep --config auto (exit 137) | log: 02-semgrep-scan-auto.log
- 08:35 | Semgrep sobre /src (bind mount del repo) se cuelga: semgrep-core en estado D (d_alloc_parallel) en el montaje de Docker Desktop (node_modules/.next). Solucion: copia limpia de archivos rastreados (git archive HEAD excluyendo docs/security) montada como /src | 02-semgrep-scan-auto-intento1-colgado.log
- 08:42:07 | Semgrep --config auto sobre copia limpia (exit 0) | log: 02-semgrep-scan-auto.log
- 08:43:37 | Semgrep con rulesets explicitos (exit 0) | log: 02b-semgrep-scan-rulesets.log
- 08:43:59 | Generado resumen-semgrep.md | log: -
- 08:46:29 | Pruebas manuales paso 5 (exit 0) | log: 05-pruebas-manuales.log
- 08:48:13 | Pruebas manuales paso 5 (exit 7); intento 1 fallo por quoting de JSON en PS5.1 (400 en login), corregido con --data-binary @archivo | log: 05-pruebas-manuales.log
- 08:49:21 | Pruebas manuales paso 5 reintento (intento 2 se corto: API reinicio por nest --watch tras 'File change detected'; exit 0) | log: 05-pruebas-manuales.log
- 08:50:08 | ZAP zap-baseline-web (exit 0) | log: 04a-zap-baseline-web.log
- 08:52:37 | Capturas en vivo (05,06,12,14) con playwright-core+Edge (exit 0) | log: 06a-capturas-vivas.log
- 08:52:44 | ZAP zap-baseline-api (exit 0) | log: 04b-zap-baseline-api.log
- 08:54:29 | ZAP zap-api-scan (exit 0) | log: 04c-zap-api-scan.log
- 08:55:18 | Capturas estaticas 01-04,13,15-17,07,08 (exit 0) | log: 06b-capturas-estaticas.log
- 09:20:08 | ZAP zap-full-web (exit 0) | log: 04d-zap-full-web.log
- 09:40:34 | ZAP API scan autenticado como estudiante.a (extra) (exit 0) | log: 04e-zap-api-scan-autenticado.log

## Notas y cierre
- Las lineas "Pruebas manuales paso 5 (exit 0/7)" de 08:46 y 08:48 corresponden a intentos 1 y 2 (ver *-intento1-fallido-quoting.log y *-intento2-api-reiniciada.log); el log valido es 05-pruebas-manuales.log.
- Otro actor (usuario u otro agente) creo la rama security/sc-lab-004-sast-dast y commiteo evidencias parciales (08ae6fd) durante el laboratorio; este ejecutor no hizo git add/commit/push ni checkout.
- nest --watch reinicio la API varias veces ('File change detected') sin cambios hechos por este ejecutor; PID API actual 29224 (antes 25012 y 10088). Web PID 17460. Raiz `pnpm dev` PID 2940.
- pnpm dev corre como tarea en segundo plano bhxd52zh3 (script scratchpad dev.ps1, salida en logs/03b-pnpm-dev.log). Infra Docker securecampus-* healthy.
- Contenedores cil-* y kind_bouman: NO son de este ejecutor.
- No se uso el MCP de Playwright (no encontro Chrome): capturas con playwright-core + Edge headless (logs 06a, 06b). No se levanto http.server.
- Extra: ZAP API scan autenticado como estudiante.a -> logs/04e-zap-api-scan-autenticado.log, dast/zap-api-scan-auth.*

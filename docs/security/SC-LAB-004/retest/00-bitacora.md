# Bitacora del reanalisis SC-LAB-004 (despues de 24f2bc2)

Fecha: 2026-10-16 · Commit analizado: `24f2bc2` (rama `security/sc-lab-004-sast-dast`)

- 22:19 | Copia limpia de lo rastreado (`git archive HEAD`, sin `docs/security`): 154 archivos | -
- 22:19 | `pnpm install --frozen-lockfile` (exit 0) | logs/01-pnpm-install.log
- 22:20 | Semgrep `--config auto` sobre la copia limpia (exit 0; 258 reglas, 147 archivos, 3 hallazgos) | logs/02a-semgrep-auto.log
- 22:22 | `pnpm audit` texto y `--json` (exit 1; 2 high) | logs/02c-pnpm-audit.log
- 22:22 | `pnpm audit --prod --audit-level=high`, el mismo comando del job de CI (exit 1; 1 high) | logs/02d-pnpm-audit-prod-high.log
- 22:22 | gitleaks `detect --redact` con `.gitleaks.toml` sobre el historial (19 commits; exit 1; 4 coincidencias) | logs/02e-gitleaks.log
- 22:23 | Semgrep con los 10 rulesets explicitos (exit 0; 154 reglas, 147 archivos, 3 hallazgos) | logs/02b-semgrep-rulesets.log
- 22:23 | Preparar app, intento 1: fallo porque el `.env` no estaba cargado en la terminal (SETUP.md paso 4) | logs/03a-preparar-app-intento1-sin-env.log
- 22:23 | `db:deploy` + `db:seed` con `.env` cargado (exit 0) | logs/03b-db-deploy-seed.log
- 22:24 | `pnpm dev`: web :3000 y API :3001 respondiendo 200 | logs/03c-pnpm-dev.log
- 22:24 | Cabeceras HTTP de web (next dev) y API | logs/05a-cabeceras-dev.log
- 22:25 | ZAP baseline web (exit 0; PASS 59, WARN 8, FAIL 0) | logs/04a-zap-baseline-web.log
- 22:26 | Pruebas manuales negativas: 16 casos, 16 con el resultado esperado | logs/05b-pruebas-manuales.log
- 22:30 | ZAP baseline API (exit 0; PASS 60, WARN 7, FAIL 0) | logs/04b-zap-baseline-api.log
- 22:32 | ZAP API scan guiado por OpenAPI (exit 0; PASS 119, WARN 0, FAIL 0) | logs/04c-zap-api-scan.log
- 22:32 | ZAP full scan web (`-m 5 -T 30`): **interrumpido**. Hacia las 23:00 el motor de Docker Desktop dejo de responder (`500 Internal Server Error` en `/containers/json`); el contenedor no produjo informe. Se decidio no repetirlo | logs/04d-zap-full-web.log
- 23:08 | `next build`, intento 1: fallo al prerenderizar `/404` porque el `.env` fija `NODE_ENV=development` | logs/06a-next-build-intento1-node-env-dev.log
- 23:09 | `next build` sin `NODE_ENV` heredado (exit 0) | logs/06b-next-build.log
- 23:10 | `next start` (build de produccion): cabeceras, nonce por peticion y scripts con nonce | logs/06d-cabeceras-produccion.log
- 23:11 | Navegador headless contra la build de produccion: hidratacion, script de tema y errores de CSP | logs/06e-navegador-csp.log
- 23:12 | Servidores detenidos | -

## Notas

- Las cookies de sesion de las pruebas manuales se guardaron en un directorio temporal que se borro al terminar; los logs no las incluyen.
- Se busco cada valor sensible del `.env` en toda esta carpeta: ninguno aparece. La unica coincidencia fue `S3_ACCESS_KEY_ID`, cuyo valor es el nombre del proyecto, no un secreto.
- Los informes de ZAP de la API incluyen un `zap.yaml` generado por el propio contenedor.

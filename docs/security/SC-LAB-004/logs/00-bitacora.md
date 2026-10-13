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

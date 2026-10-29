# Indice de capturas SC-LAB-004

Todas las capturas son PNG a 1440x900 (fullPage cuando el contenido es largo; los informes HTML de ZAP solo muestran la parte superior). Las paginas `_html/` son renders sencillos de logs y resumenes, generados a partir de los logs indicados. Capturadas con playwright-core 1.63 + Microsoft Edge headless (el MCP de Playwright no encontro Chrome).

| Archivo | Que muestra | Origen |
|---|---|---|
| 01-semgrep-consola.png | Comando y resumen final de `semgrep scan --config auto` (27 hallazgos, 258 reglas, 144 archivos) | logs/02-semgrep-scan-auto.log |
| 02-semgrep-hallazgos.png | Tabla renderizada de resumen-semgrep.md (27 hallazgos sin duplicados) | sast/resumen-semgrep.md (de sast/semgrep-auto.json y semgrep-rulesets.json) |
| 03-sca-secretos.png | pnpm audit (45 vulns: 3 critical, 18 high, 22 moderate, 2 low; se listan critical/high) y gitleaks (10 hallazgos redactados) | logs/02d-pnpm-audit.log, logs/02e-gitleaks.log, sast/pnpm-audit.json, sast/gitleaks.json |
| 04-docker-servicios.png | `docker compose ps -a` con servicios healthy y comprobaciones HTTP | logs/03-levantar-app.log |
| 05-app-web-ingresar.png | Aplicacion web en http://localhost:3000 (pagina de ingreso) | logs/06a-capturas-vivas.log |
| 06-api-openapi.png | Swagger UI en http://localhost:3001/api/docs | logs/06a-capturas-vivas.log |
| 07-zap-baseline-web.png | Informe ZAP baseline web (parte superior) | dast/zap-baseline-web.html, logs/04a-zap-baseline-web.log |
| 08-zap-baseline-api.png | Informe ZAP baseline API (parte superior) | dast/zap-baseline-api.html, logs/04b-zap-baseline-api.log |
| 09-zap-api-scan.png | Informe ZAP API scan activo OpenAPI, sin sesion (parte superior) | dast/zap-api-scan.html, logs/04c-zap-api-scan.log |
| 10-zap-full-web.png | Informe ZAP full scan web (parte superior) | dast/zap-full-web.html, logs/04d-zap-full-web.log |
| 11-zap-consola-full.png | Lineas PASS/WARN/FAIL de la consola del full scan web | logs/04d-zap-full-web.log |
| 12-xss-manual.png | Payload `<script>alert(1)</script>` en el formulario de ingreso tras enviar: no se ejecuta, solo aparece "Correo electronico invalido" | logs/06a-capturas-vivas.log |
| 12a-xss-formulario-relleno.png | Formulario con el payload antes de enviar | logs/06a-capturas-vivas.log |
| 12b-xss-query-ingresar.png | Pagina de ingreso con payloads XSS en la query (next, error, q): no se ejecuta ni se refleja | logs/06a-capturas-vivas.log |
| 12c-xss-recuperar.png | Payload en la pagina de recuperacion | logs/06a-capturas-vivas.log |
| 13-idor-403.png | estudiante.a pide perfil de estudiante.b: 403; sin sesion: 401; escalada vertical: 403 | logs/05-pruebas-manuales.log |
| 14-panel-autenticado.png | Panel tras iniciar sesion como estudiante.a | logs/06a-capturas-vivas.log |
| 14b-panel-perfil.png | Mi perfil de estudiante.a | logs/06a-capturas-vivas.log |
| 14c-panel-usuarios-estudiante-denegado.png | Panel de usuarios con rol estudiante (la API responde 403) | logs/06a-capturas-vivas.log |
| 15-cabeceras-http.png | Cabeceras de respuesta de web (:3000) y API (:3001) | logs/05-pruebas-manuales.log |
| 16-sqli-manual.png | Pruebas manuales de inyeccion SQL (login y parametros) con codigos HTTP | logs/05-pruebas-manuales.log |
| 17-xss-curl.png | Pruebas XSS con curl contra API y web (codigos y verificacion de reflejo) | logs/05-pruebas-manuales.log |
| 18-zap-api-scan-consola.png | Lineas PASS/WARN/FAIL de la consola del API scan (40012 y 40018 en PASS) | logs/04c-zap-api-scan.log |

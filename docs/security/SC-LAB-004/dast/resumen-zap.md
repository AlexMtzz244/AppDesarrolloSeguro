# Resumen ZAP (SC-LAB-004)

## Baseline pasivo web (http://host.docker.internal:3000)

Consola: PASS=59  WARN=8 (new=8, inprog=0)  FAIL=0 (new=0, inprog=0)  INFO=0  IGNORE=0
Codigo de salida: 0

| pluginId | Alerta | Riesgo (confianza) | Instancias | URL de ejemplo |
|---|---|---|---|---|
| 10038 | Content Security Policy (CSP) Header Not Set | Medium (High) | 3 | `http://host.docker.internal:3000` |
| 10044 | Big Redirect Detected (Potential Sensitive Information Leak) | Low (Medium) | 2 | `http://host.docker.internal:3000` |
| 90004 | Cross-Origin-Embedder-Policy Header Missing or Invalid | Low (Medium) | 2 | `http://host.docker.internal:3000` |
| 90004 | Cross-Origin-Opener-Policy Header Missing or Invalid | Low (Medium) | 2 | `http://host.docker.internal:3000` |
| 90004 | Cross-Origin-Resource-Policy Header Missing or Invalid | Low (Medium) | 5 | `http://host.docker.internal:3000` |
| 10110 | Dangerous JS Functions | Low (Low) | 4 | `http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js` |
| 2 | Private IP Disclosure | Low (Medium) | 1 | `http://host.docker.internal:3000/_next/static/chunks/app/layout.js` |
| 10027 | Information Disclosure - Suspicious Comments | Informational (Medium) | 10 | `http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js` |
| 10109 | Modern Web Application | Informational (Medium) | 2 | `http://host.docker.internal:3000` |
| 10049 | Non-Storable Content | Informational (Medium) | 5 | `http://host.docker.internal:3000` |
| 10049 | Storable but Non-Cacheable Content | Informational (Medium) | 1 | `http://host.docker.internal:3000/robots.txt` |

- Cross Site Scripting (Reflected) [40012]: sin alerta en el informe; consola: no aparece en la salida de consola (regla no ejecutada en este tipo de escaneo)
- SQL Injection [40018]: sin alerta en el informe; consola: no aparece en la salida de consola (regla no ejecutada en este tipo de escaneo)

## Baseline pasivo API (http://host.docker.internal:3001/api/docs)

Consola: PASS=61  WARN=6 (new=6, inprog=0)  FAIL=0 (new=0, inprog=0)  INFO=0  IGNORE=0
Codigo de salida: 0

| pluginId | Alerta | Riesgo (confianza) | Instancias | URL de ejemplo |
|---|---|---|---|---|
| 10055 | CSP: Wildcard Directive | Medium (High) | 1 | `http://host.docker.internal:3001/api/docs` |
| 10055 | CSP: style-src unsafe-inline | Medium (High) | 1 | `http://host.docker.internal:3001/api/docs` |
| 90004 | Cross-Origin-Embedder-Policy Header Missing or Invalid | Low (Medium) | 1 | `http://host.docker.internal:3001/api/docs` |
| 10063 | Permissions Policy Header Not Set | Low (Medium) | 4 | `http://host.docker.internal:3001/api/docs` |
| 10096 | Timestamp Disclosure - Unix | Low (Low) | 5 | `http://host.docker.internal:3001/api/docs/swagger-ui-standalone-preset.js` |
| 10109 | Modern Web Application | Informational (Medium) | 1 | `http://host.docker.internal:3001/api/docs` |
| 10049 | Storable and Cacheable Content | Informational (Medium) | 5 | `http://host.docker.internal:3001/` |
| 10049 | Storable but Non-Cacheable Content | Informational (Medium) | 4 | `http://host.docker.internal:3001/api/docs/favicon-16x16.png` |

- Cross Site Scripting (Reflected) [40012]: sin alerta en el informe; consola: no aparece en la salida de consola (regla no ejecutada en este tipo de escaneo)
- SQL Injection [40018]: sin alerta en el informe; consola: no aparece en la salida de consola (regla no ejecutada en este tipo de escaneo)

## API scan activo OpenAPI (http://host.docker.internal:3001/api/docs-json)

Consola: PASS=119  WARN=0 (new=0, inprog=0)  FAIL=0 (new=0, inprog=0)  INFO=0  IGNORE=0
Codigo de salida: 0

| pluginId | Alerta | Riesgo (confianza) | Instancias | URL de ejemplo |
|---|---|---|---|---|
| 100000 | A Client Error response code was returned by the server | Informational (High) | 211 | `http://host.docker.internal:3001/api/auth/sesiones/id` |
| 10049 | Non-Storable Content | Informational (Medium) | 5 | `http://host.docker.internal:3001/api/auditoria` |
| 10049 | Storable and Cacheable Content | Informational (Medium) | 1 | `http://host.docker.internal:3001/api/docs-json` |

- Cross Site Scripting (Reflected) [40012]: sin alerta en el informe; consola: PASS
- SQL Injection [40018]: sin alerta en el informe; consola: PASS

## Full scan activo web (http://host.docker.internal:3000, -m 5 -T 30)

Consola: PASS=137  WARN=5 (new=5, inprog=0)  FAIL=0 (new=0, inprog=0)  INFO=0  IGNORE=0
Codigo de salida: 0

| pluginId | Alerta | Riesgo (confianza) | Instancias | URL de ejemplo |
|---|---|---|---|---|
| 10038 | Content Security Policy (CSP) Header Not Set | Medium (High) | 2 | `http://host.docker.internal:3000/panel` |
| 10044 | Big Redirect Detected (Potential Sensitive Information Leak) | Low (Medium) | 2 | `http://host.docker.internal:3000` |
| 90004 | Cross-Origin-Embedder-Policy Header Missing or Invalid | Low (Medium) | 1 | `http://host.docker.internal:3000/panel` |
| 90004 | Cross-Origin-Opener-Policy Header Missing or Invalid | Low (Medium) | 1 | `http://host.docker.internal:3000/panel` |
| 90004 | Cross-Origin-Resource-Policy Header Missing or Invalid | Low (Medium) | 5 | `http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js` |
| 10110 | Dangerous JS Functions | Low (Low) | 4 | `http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js` |
| 2 | Private IP Disclosure | Low (Medium) | 1 | `http://host.docker.internal:3000/_next/static/chunks/app/layout.js` |
| 10027 | Information Disclosure - Suspicious Comments | Informational (Medium) | 10 | `http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js` |
| 10109 | Modern Web Application | Informational (Medium) | 2 | `http://host.docker.internal:3000` |
| 10049 | Non-Storable Content | Informational (Medium) | 5 | `http://host.docker.internal:3000` |
| 10049 | Storable but Non-Cacheable Content | Informational (Medium) | 1 | `http://host.docker.internal:3000/robots.txt` |
| 10104 | User Agent Fuzzer | Informational (Medium) | 5 | `http://host.docker.internal:3000` |

- Cross Site Scripting (Reflected) [40012]: sin alerta en el informe; consola: PASS
- SQL Injection [40018]: sin alerta en el informe; consola: PASS


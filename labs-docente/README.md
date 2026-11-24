# Material del docente (SC-LAB-007, 008 y 009)

Demo Flask del docente, descomprimida sin modificar. Cada carpeta es un ZIP distinto y crece sobre la anterior
(007 → 008 agrega móvil y Docker → 009 agrega Bandit y el pipeline). El código de la app está en `apps/` y `packages/`.

Los workflows de estas carpetas no se ejecutan: GitHub solo lee `.github/workflows/` de la raíz.

La evidencia de haberlos ejecutado (pruebas, Bandit, pip-audit, imagen, contenedor) está en el repositorio de
documentación: `proyDesSeguro`, `docs/security/SC-LAB-007-008-evidencias/zip-docente/` y `SC-LAB-009-evidencias/zip-docente/`.

Observación: `validar_calificacion` acepta `"1e2"` (lo interpreta como 100 con `Decimal`). SecureCampus ya lo rechaza.

## CI
`.github/workflows/sc-lab-009-docente.yml` (raíz del repo) ejecuta el pipeline del ZIP de SC-LAB-009, solo al empujar a la rama
`claude/project-thread-gad54w`. Es una copia con tres cambios: carpeta de trabajo `labs-docente/SC-LAB-009`, `trivy-action@v0.33.1`
(la etiqueta `0.33.1` del ZIP ya no existe) y `version: latest` de Trivy (el v0.65.0 que fija la acción no se instaló).
Resultado: `security` verde; `container` rojo por 5 vulnerabilidades HIGH con corrección (msgpack, setuptools, urllib3).
Si esta rama se fusiona, conviene decidir si ese workflow se queda o se borra.

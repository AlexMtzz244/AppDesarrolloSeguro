# Material del docente (SC-LAB-007, 008 y 009)

Demo Flask del docente, descomprimida sin modificar. Cada carpeta es un ZIP distinto y crece sobre la anterior
(007 → 008 agrega móvil y Docker → 009 agrega Bandit y el pipeline). El código de la app está en `apps/` y `packages/`.

Los workflows de estas carpetas no se ejecutan: GitHub solo lee `.github/workflows/` de la raíz.

La evidencia de haberlos ejecutado (pruebas, Bandit, pip-audit, imagen, contenedor) está en el repositorio de
documentación: `proyDesSeguro`, `docs/security/SC-LAB-007-008-evidencias/zip-docente/` y `SC-LAB-009-evidencias/zip-docente/`.

Observación: `validar_calificacion` acepta `"1e2"` (lo interpreta como 100 con `Decimal`). SecureCampus ya lo rechaza.

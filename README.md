# SecureCampus

Sistema web académico desarrollado como proyecto del curso **Desarrollo Seguro**. SecureCampus
gestiona perfiles, calificaciones, documentos, solicitudes, usuarios, roles/permisos y registros de
auditoría para tres tipos de usuario: estudiantes, profesores y administradores.

El objetivo del proyecto no es únicamente que el sistema funcione, sino que **proteja la información
y las operaciones sensibles desde el diseño**, aplicando el análisis de seguridad antes de la
implementación.

## Equipo

| Integrante | Matrícula |
|---|---|
| Cesar Adan De La Cruz Moctezuma | _(completar)_ |
| Diego Salazar Reyes | _(completar)_ |
| Juan Pablo Castillo Angeles | _(completar)_ |
| Alejandro Martínez | _(completar)_ |

## Datos del curso

| | |
|---|---|
| **Curso** | Desarrollo Seguro |
| **Docente** | Isc. Marelis Carrillo Lara |
| **Ciclo** | Septiembre 2026 |

## Roles del sistema

- **Estudiante** — consulta su perfil, sus calificaciones, sus documentos y sus solicitudes.
- **Profesor** — consulta los grupos que tiene asignados y captura calificaciones de esos grupos.
- **Administrador** — administra usuarios, roles y permisos, y consulta logs. Algunas operaciones
  académicas requieren autorización específica adicional.

## Estructura del repositorio

```
proyDesSeguro/
├── README.md
└── docs/
    └── security/
        └── SC-LAB-001-analisis-inicial.md
```

## Evidencias

| Práctica | Entregable | Estado |
|---|---|---|
| **SC-LAB-001** — Identificación inicial de activos, amenazas, vulnerabilidades, ataques, impactos, riesgos y controles | [docs/security/SC-LAB-001-analisis-inicial.md](docs/security/SC-LAB-001-analisis-inicial.md) | Entregado |

## Convenciones de trabajo

- Documentación en español, en formato Markdown, dentro de `docs/`.
- Los análisis de seguridad viven en `docs/security/` con el identificador de la práctica en el
  nombre del archivo.
- Antes de cada commit: `git status`, `git diff`, `git add`, `git diff --staged`.
- Mensajes de commit con prefijo de tipo, por ejemplo:
  `docs: agregar analisis inicial de seguridad SC-LAB-001`.

# SecureCampus

Sistema web académico desarrollado como proyecto del curso **Desarrollo
Seguro**. Gestiona perfiles, calificaciones, documentos, solicitudes, usuarios,
roles/permisos, grupos, asignaciones docentes, notificaciones y auditoría.

El objetivo del proyecto no es únicamente que el sistema funcione, sino que
**proteja la información y las operaciones sensibles desde el diseño**. Los
casos negativos son requisitos de producto: un flujo no está terminado hasta
que sus accesos no autorizados y sus abusos previsibles se rechazan **y se
prueban**.

## Equipo

| Integrante | Matrícula |
|---|---|
| Cesar Adan De La Cruz Moctezuma | _(completar)_ |
| Diego Salazar Reyes | _(completar)_ |
| Juan Pablo Castillo Angeles | _(completar)_ |
| Alejandro Martínez | _(completar)_ |

| | |
|---|---|
| **Curso** | Desarrollo Seguro |
| **Docente** | Isc. Marelis Carrillo Lara |
| **Ciclo** | Septiembre 2026 |

---

## La idea que atraviesa todo el proyecto

De [SC-LAB-001 §1](docs/security/SC-LAB-001-analisis-inicial.md):

> En los cuatro roles el alcance no está definido por el rol solamente, sino
> por la **relación entre el usuario y el recurso concreto** (mi perfil, mi
> grupo, mi documento). Un sistema que verifique únicamente el rol y no esa
> relación quedará expuesto, aunque la autenticación funcione perfectamente.

Todo el diseño del servidor sale de ahí. Y su corolario, descubierto al
analizar al jefe de carrera: **si un control se apoya en un dato, ese dato
hereda la criticidad del control**.

## Roles

- **Estudiante** — su perfil, sus calificaciones, sus documentos, sus solicitudes.
- **Profesor** — los grupos con **asignación docente vigente** a su nombre, y
  los alumnos inscritos en ellos. No basta el rol: hace falta la relación.
- **Jefe de carrera** — grupos y asignaciones docentes **de su propio
  programa**. *(Rol agregado por el equipo; no estaba en el escenario original
  del manual.)*
- **Administrador** — usuarios, roles, permisos y consulta de auditoría, con
  mínimo privilegio. **No** captura calificaciones.

Que el administrador no pueda calificar y que el jefe no pueda hacerlo con la
misma cuenta no es un descuido: es la separación de funciones que impide
encadenar el ataque del escenario 5.

---

## Arranque

### Requisitos

- Node.js ≥ 20.11 · pnpm ≥ 9 · **Docker Desktop**
- `gitleaks` (opcional en local, obligatorio en CI): `winget install gitleaks`

### Pasos

```bash
pnpm install

cp .env.example .env
# Genera los secretos y complétalos en .env:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

docker compose up -d

pnpm --filter api db:deploy    # migraciones
pnpm --filter api db:seed      # datos de desarrollo

pnpm dev
```

| Servicio | URL |
|---|---|
| Aplicación web | http://localhost:3000 |
| API | http://localhost:3001 |
| OpenAPI | http://localhost:3001/api/docs |
| Mailpit (correo local) | http://localhost:8025 |
| MinIO (consola) | http://localhost:9001 |

> La aplicación **se niega a arrancar** si falta una variable crítica. Es
> deliberado (RNFS-052): un valor por defecto silencioso en una variable de
> seguridad es peor que no arrancar.

### Credenciales de desarrollo

Contraseña para todas: `SemillaDesarrollo!2026`

| Correo | Rol |
|---|---|
| `admin@securecampus.edu.mx` | Administrador |
| `jefe.isc@securecampus.edu.mx` | Jefe de carrera (ISC) |
| `profesor@securecampus.edu.mx` | Profesor |
| `estudiante.a@securecampus.edu.mx` | Estudiante |
| `estudiante.b@securecampus.edu.mx` | Estudiante |

> **Son credenciales de desarrollo, documentadas públicamente.** El arranque en
> producción con datos semilla presentes falla de forma explícita (RNFS-058).
>
> Hay dos estudiantes a propósito: sin dos cuentas del mismo rol no se puede
> comprobar que A no alcanza los datos de B.

---

## Comandos

```bash
pnpm lint          # ESLint
pnpm typecheck     # Tipos en todo el monorepo
pnpm test          # Unitarias y estructurales
pnpm test:int      # Integración: las 13 pruebas negativas obligatorias
pnpm e2e           # Playwright
pnpm secrets:scan  # gitleaks sobre el historial completo
pnpm sbom          # Inventario de dependencias (CycloneDX)
```

---

## Estructura

```
proyDesSeguro/
├── apps/api/              NestJS · Prisma · autorización, auditoría, dominio
├── apps/web/              Next.js App Router · Tailwind · Radix
├── packages/contracts/    Permisos y esquemas Zod compartidos
├── infra/postgres/init/   Rol de aplicación con privilegio mínimo
└── docs/
    ├── security/          SC-LAB-001..003 y SC-SRS-001
    ├── adr/               ADR-001..008
    ├── DECISIONES-PENDIENTES.md
    └── OPERACION.md
```

### Dónde están los controles principales

| Control | Archivo |
|---|---|
| Deny by default | [politica.guard.ts](apps/api/src/autorizacion/politica.guard.ts) |
| Relación actor↔recurso | [relaciones.ts](apps/api/src/autorizacion/relaciones.ts) |
| Separación de funciones | [permisos.ts](packages/contracts/src/permisos.ts) |
| Auditoría atómica | [auditoria.service.ts](apps/api/src/auditoria/auditoria.service.ts) |
| Bitácora inmutable | [migración 2](apps/api/prisma/migrations/20260921000002_auditoria_append_only/migration.sql) |
| Sesión opaca y revocable | [sesion.service.ts](apps/api/src/identidad/sesion.service.ts) |
| RF-010 reescrito | [recuperacion.service.ts](apps/api/src/identidad/recuperacion.service.ts) |
| Asignación versionada | [asignaciones.service.ts](apps/api/src/academico/asignaciones.service.ts) |
| Alertas detectivas | [alertas.service.ts](apps/api/src/alertas/alertas.service.ts) |
| Entrega privada de documentos | [documentos.service.ts](apps/api/src/documentos/documentos.service.ts) |

---

## Documentación

### Análisis previo a la implementación

| Práctica | Pregunta que responde | Documento |
|---|---|---|
| **SC-LAB-001** | ¿Qué puede salir mal? | [Análisis inicial](docs/security/SC-LAB-001-analisis-inicial.md) |
| **SC-LAB-002** | ¿En qué fase se actúa? | [Mapa Secure SDLC](docs/security/SC-LAB-002-secure-sdlc-map.md) |
| **SC-LAB-003** | ¿Qué cuesta descubrirlo tarde? | [Costo y Shift Left](docs/security/SC-LAB-003-shift-left-analysis.md) |
| **SC-SRS-001** | ¿Qué debe hacer, y qué no debe permitir? | [Requisitos](docs/security/SC-SRS-001-requisitos-aplicacion.md) |

### Decisiones de arquitectura

| ADR | Tema |
|---|---|
| [001](docs/adr/ADR-001-autorizacion-por-relacion.md) | Autorización por relación y *deny by default* |
| [002](docs/adr/ADR-002-sesion-opaca.md) | Sesión opaca en cookie, no JWT |
| [003](docs/adr/ADR-003-auditoria-append-only.md) | Auditoría append-only y atómica |
| [004](docs/adr/ADR-004-argon2-y-cifrado-totp.md) | Argon2id y cifrado del secreto TOTP |
| [005](docs/adr/ADR-005-monorepo-y-frontera.md) | Monorepo y frontera web↔api |
| [006](docs/adr/ADR-006-asignacion-docente-versionada.md) | Asignación docente versionada |
| [007](docs/adr/ADR-007-entrega-privada-documentos.md) | Entrega privada de documentos |
| [008](docs/adr/ADR-008-alertas-y-umbrales.md) | Alertas y umbrales |

### Operación

- [**Decisiones pendientes**](docs/DECISIONES-PENDIENTES.md) — once decisiones
  que corresponden a la institución, no al equipo. Tres bloquean
  funcionalidad hoy.
- [**Operación e incidentes**](docs/OPERACION.md) — SLA, respuesta, respaldos,
  endurecimiento.

---

## Pruebas negativas obligatorias

Las 13 del prompt maestro, con dónde se verifican:

| # | Qué comprueba | Archivo |
|---|---|---|
| 1 | Estudiante A no alcanza los datos de B → 403 y evento | `autorizacion.int.spec.ts` |
| 2 | Profesor en grupo ajeno o periodo cerrado → 403, sin mutación | `academico.int.spec.ts` |
| 3 | Calificación publicada no se edita sin flujo de corrección | `academico.int.spec.ts` |
| 4 | Jefe fuera de su programa, choque de aula, periodo cerrado | `academico.int.spec.ts` |
| 5 | Asignación creada/revertida queda reconstruible | `academico.int.spec.ts` |
| 6 | Cliente altera rol / permiso / ID → 403 | `autorizacion.int.spec.ts` |
| 7 | Límite de intentos, sin enumerar, latencia uniforme | `identidad.int.spec.ts` |
| 8 | Enlace de recuperación reutilizado, vencido o sustituido | `identidad.int.spec.ts` |
| 9 | Ejecutable renombrado, tamaño, cuota, URL directa | `documentos.int.spec.ts` |
| 10 | Mutación y auditoría atómicas | `auditoria.int.spec.ts` |
| 11 | Rotación de sesión; cambio de contraseña revoca todas | `identidad.int.spec.ts` |
| 12 | Auditoría rechaza UPDATE/DELETE/TRUNCATE | `auditoria.int.spec.ts` |
| 13 | Escaneo de secretos y auditoría de dependencias | `.github/workflows/ci.yml` |

Más dos **pruebas estructurales**, que son las que impiden la regresión
silenciosa:

- **Toda ruta declara su política** — la build falla si alguien agrega un
  endpoint sin ella (`politicas-declaradas.spec.ts`).
- **La matriz de permisos respeta la separación de funciones** y toda
  combinación leer+modificar está declarada como intencional
  (`separacion-funciones.spec.ts`).

---

## Convenciones

- Documentación en español, en `docs/`. Los análisis de seguridad en
  `docs/security/` con el identificador de la práctica en el nombre.
- Antes de cada commit: `git status`, `git diff`, `git add`, `git diff --staged`.
- Mensajes con prefijo de tipo: `docs: agregar analisis inicial SC-LAB-001`.
- **Nunca** commitear `.env`. El hook de pre-commit lo bloquea, y CI vuelve a
  escanear sobre el historial completo por si alguien usó `--no-verify`.

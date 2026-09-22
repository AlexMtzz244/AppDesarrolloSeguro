# Decisiones pendientes de aprobación

> **Ninguna de estas decisiones corresponde al equipo de desarrollo.** Todas
> están implementadas como configuración administrable con un valor por
> defecto seguro, y todas requieren aprobación antes de un despliegue
> productivo.

El criterio es el de [SC-LAB-002 §6.3](security/SC-LAB-002-secure-sdlc-map.md):
**si la respuesta está en el reglamento institucional, la define una persona y
el sistema solo la aplica**. Codificar un valor inventado no lo convierte en
decidido — lo convierte en invisible, que es peor.

Por eso este archivo existe: convierte once omisiones silenciosas en once
campos vacíos que alguien tiene que llenar. Es Shift Left en su forma más
barata, exactamente como lo describe SC-LAB-003 §3: *"no es una herramienta ni
un proceso nuevo, es un campo obligatorio en un formato que ya usamos"*.

---

## D-01 · Catálogo de solicitudes, estados, responsables y SLA

| | |
|---|---|
| **Aprueba** | Servicios escolares |
| **Dónde vive** | Tablas `tipo_solicitud` y `estado_solicitud` |
| **Valor por defecto** | **Vacío.** No se siembra ningún tipo |
| **Efecto hoy** | No se puede crear ninguna solicitud |

El sistema arranca sin poder crear solicitudes, y eso es correcto. Sembrar
tipos plausibles —"constancia de estudios", "baja temporal"— sería inventar
reglas académicas que nadie aprobó. La pantalla de solicitudes dice
explícitamente que el catálogo está pendiente, en vez de mostrar un formulario
que no lleva a ninguna parte.

## D-02 · Campos editables del perfil y proceso de corrección

| | |
|---|---|
| **Aprueba** | Servicios escolares |
| **Dónde vive** | `esquemaActualizarPerfil` + parámetro `perfil.campos_editables` |
| **Valor por defecto** | Solo `telefono` |

Nombre, apellidos y matrícula **no** son editables por el titular: son datos
que la institución asigna, y permitir cambiarlos convertiría el perfil en una
vía de suplantación. Falta definir el proceso por el que un estudiante solicita
corregir un dato erróneo.

## D-03 · Escala de calificaciones y reglas de publicación/corrección

| | |
|---|---|
| **Aprueba** | Dirección académica |
| **Dónde vive** | `esquemaValorCalificacion` + `CHECK` en la base |
| **Valor por defecto** | 0–100, dos decimales |

**No se codifica ninguna regla de aprobación, redondeo ni ponderación.** El
sistema guarda el valor que el profesor captura y no opina sobre si aprueba.
Falta definir: calificación mínima aprobatoria, redondeo, ponderación de
parciales y si existe un plazo máximo para corregir una nota publicada.

## D-04 · Catálogo de documentos, formatos, tamaño máximo y cuota

| | |
|---|---|
| **Aprueba** | Servicios escolares |
| **Dónde vive** | Tabla `tipo_documento` + `DOCUMENTO_*` en `.env` |
| **Valor por defecto** | PDF/JPG/PNG · 10 MB por archivo · 100 MB por usuario |

Los valores por defecto son conservadores a propósito. Ampliarlos después es
barato; reducirlos cuando ya hay archivos subidos es el proyecto de migración
que SC-LAB-003 §5 describe.

## D-05 · Umbrales de rate limit, bloqueo, CAPTCHA, inactividad y anomalías

| | |
|---|---|
| **Aprueba** | Seguridad informática |
| **Dónde vive** | `LOGIN_*` y `ALERTA_*` en `.env` |
| **Valor por defecto** | 5 intentos/15 min por cuenta · 20/15 min por IP · inactividad 30 min |

**Estos valores no están calibrados contra tráfico real.** Un umbral demasiado
bajo bloquea usuarios legítimos; uno demasiado alto no detiene nada. Y un
umbral de alerta mal puesto produce ruido, que lleva a desactivar la alerta —
la forma habitual en que estos controles mueren.

Requiere un periodo de observación antes de fijarlos.

## D-06 · Proveedor de MFA y recuperación del segundo factor

| | |
|---|---|
| **Aprueba** | Seguridad informática |
| **Dónde vive** | `MfaService` + `CAPTCHA_PROVEEDOR` |
| **Valor por defecto** | TOTP propio · 10 códigos de recuperación de un solo uso |

Falta definir el procedimiento cuando alguien pierde su dispositivo **y** sus
códigos de recuperación. Hoy no hay ninguno, y esa ausencia es deliberada: un
procedimiento de rescate mal diseñado es la vía preferida para saltarse el
segundo factor. Debe definirse con verificación de identidad presencial o
equivalente.

`CAPTCHA_PROVEEDOR=ninguno` **no arranca en producción**: la validación de
coherencia del entorno lo rechaza.

## D-07 · Autoridad superior para cambios retroactivos

| | |
|---|---|
| **Aprueba** | Dirección académica |
| **Dónde vive** | Permiso `periodo:modificar-retroactivo` |
| **Valor por defecto** | **Sin designar.** El flujo está bloqueado |

Ninguna cuenta tiene este permiso en la matriz sembrada, así que ningún cambio
sobre un periodo cerrado es posible. El sistema no inventa una jerarquía que no
existe.

Falta designar quién autoriza, con qué vigencia y bajo qué procedimiento
documentado.

## D-08 · Matriz final rol–permiso–operación y frecuencia de revisión

| | |
|---|---|
| **Aprueba** | Dirección académica + Seguridad informática |
| **Dónde vive** | `MATRIZ_ROL_PERMISOS` en `packages/contracts` |
| **Valor por defecto** | La de SC-SRS-001 §6 · revisión semestral (182 días) |

La matriz sembrada refleja el análisis del equipo, no una decisión
institucional. Dos propiedades que **no deben perderse** al revisarla:

- `asignacion-docente:crear` y `calificacion:crear` no coinciden en ninguna
  columna (separación de funciones, RNFS-007).
- El administrador no tiene permisos académicos operativos: administrar el
  sistema no es operar académicamente.

Una prueba automatizada verifica ambas en cada build.

## D-09 · Retención y eliminación de datos, y requisitos legales

| | |
|---|---|
| **Aprueba** | Jurídico |
| **Dónde vive** | Parámetro `auditoria.retencion_dias` |
| **Valor por defecto** | 200 días de auditoría · sin borrado automático |

El mínimo es un semestre completo, porque el fraude del escenario 5 se detecta
tarde por naturaleza. Falta definir la retención de documentos y de datos
personales tras la baja de un estudiante, con la normativa aplicable.

La purga, cuando se defina, la ejecutará el rol propietario en una ventana
documentada — **nunca la aplicación**, que no tiene permiso de borrado sobre la
bitácora (RNFS-031).

## D-10 · Volumen, concurrencia, disponibilidad, RTO, RPO, presupuesto y plataforma

| | |
|---|---|
| **Aprueba** | Dirección de TI |
| **Valor por defecto** | Sin compromiso de SLA · despliegue de desarrollo |

Sin estas cifras no se puede dimensionar la infraestructura ni comprometer
tiempos de recuperación. Afecta directamente a la estrategia de respaldo de
`docs/OPERACION.md`.

## D-11 · Procedimiento de incidentes, navegadores soportados e identidad visual

| | |
|---|---|
| **Aprueba** | Dirección de TI |
| **Valor por defecto** | Procedimiento base en `docs/OPERACION.md` · últimas dos versiones de navegadores |

El procedimiento base está escrito pero **no ha sido aprobado ni ensayado**.
SC-LAB-003 §6 insiste en que debe existir *antes* de necesitarlo: el día del
incidente no hay tiempo de decidir quién decide.

---

## Resumen para quien tenga que aprobarlas

| ID | Decisión | Aprueba | Bloquea algo hoy |
|---|---|---|---|
| D-01 | Catálogo de solicitudes | Servicios escolares | **Sí** — no se crean solicitudes |
| D-02 | Campos editables del perfil | Servicios escolares | No |
| D-03 | Escala y reglas de calificación | Dirección académica | No |
| D-04 | Documentos: formatos, tamaño, cuota | Servicios escolares | No |
| D-05 | Umbrales de límite y alertas | Seguridad informática | No |
| D-06 | MFA y recuperación del 2.º factor | Seguridad informática | **Sí** en producción |
| D-07 | Autoridad para cambios retroactivos | Dirección académica | **Sí** — flujo bloqueado |
| D-08 | Matriz rol–permiso definitiva | Académica + Seguridad | No |
| D-09 | Retención y requisitos legales | Jurídico | No |
| D-10 | Volumen, SLA, RTO, RPO, plataforma | Dirección de TI | **Sí** para desplegar |
| D-11 | Incidentes, navegadores, identidad | Dirección de TI | No |

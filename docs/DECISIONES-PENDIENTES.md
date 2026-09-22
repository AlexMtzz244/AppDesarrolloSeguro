# Decisiones pendientes de aprobación

> **Ninguna de estas decisiones corresponde al equipo de desarrollo.** Todas
> están implementadas como configuración administrable con una **propuesta
> concreta del equipo**, y todas requieren firma antes de un despliegue
> productivo.

## Cómo se resolvió la tensión de fondo

La regla de [SC-LAB-002 §6.3](security/SC-LAB-002-secure-sdlc-map.md) es
clara: *si la respuesta está en el reglamento institucional, la define una
persona y el sistema solo la aplica*. Y SC-SRS-001 §8 añade que **codificar un
valor inventado no lo convierte en decidido, lo convierte en invisible, que es
peor**.

La primera lectura de eso fue no sembrar nada. El resultado: tres funciones
bloqueadas que nadie podía probar ni criticar, y una decisión que seguía sin
tomarse porque no había nada concreto sobre la mesa.

La lectura correcta es que **el problema nunca fue que alguien decidiera: fue
que la decisión quedara invisible**. Es exactamente el argumento del escenario
5 — contra un actor que opera dentro de sus atribuciones la prevención tiene
poco margen, y lo que queda es que el acto sea *visible, atribuible e
irreversible*.

Así que se aplica el mismo patrón a la configuración:

| Propiedad | Cómo se consigue |
|---|---|
| **Visible** | `/panel/decisiones` la ve cualquier usuario autenticado, no solo administradores |
| **Atribuible** | Al firmar se registra quién aprueba y cuándo, en la bitácora append-only |
| **Exigible** | El arranque en producción **falla** mientras una decisión bloqueante siga sin firma |

Ese último punto es lo que impide que la propuesta se convierta en el valor
invisible que §8 prohíbe. **Un valor que bloquea el despliegue no se puede
ignorar.**

Tres decisiones bloquean producción: **D-06**, **D-07** y **D-10**. No son
todas a propósito — marcarlas todas volvería el arranque imposible y alguien
terminaría quitando la comprobación entera. Un control que estorba se acaba
desactivando.

Este archivo es Shift Left en su forma más barata, tal como lo describe
SC-LAB-003 §3: *"no es una herramienta ni un proceso nuevo, es un campo
obligatorio en un formato que ya usamos"*.

---

## D-01 · Catálogo de solicitudes, estados, responsables y SLA

| | |
|---|---|
| **Aprueba** | Servicios escolares |
| **Dónde vive** | Tablas `tipo_solicitud` y `estado_solicitud` |
| **Propuesta** | Tres trámites genéricos, flujo común, SLA 120 h |
| **Estado** | Sembrado **sin firma** |

### Qué se propone

| Tipo | Por qué este y no otro |
|---|---|
| `constancia-estudios` | Existe en cualquier institución. No define requisitos ni criterios de procedencia: solo abre el canal |
| `revision-calificacion` | **Cubre un hueco que nadie había nombrado**: el flujo de corrección de calificaciones no tenía punto de entrada documentado, así que toda corrección aparecía en la bitácora sin causa registrada |
| `correccion-datos-perfil` | **Cubre el hueco de D-02**: no existía vía para pedir corregir nombre o matrícula, datos que a propósito no son editables por el titular |

Flujo: `recibida → en revisión → resuelta / rechazada`.

Deliberadamente **no** modela etapas internas de ninguna área. Inventarlas
sería describir un proceso administrativo que nadie nos contó — ahí sí estaría
la regla académica inventada.

### Qué falta decidir

Si estos tres trámites son los correctos, si 120 horas hábiles es un SLA
realista, y qué área es responsable de cada uno.

## D-02 · Campos editables del perfil y proceso de corrección

| | |
|---|---|
| **Aprueba** | Servicios escolares |
| **Dónde vive** | `esquemaActualizarPerfil` + parámetro `perfil.campos_editables` |
| **Propuesta** | Solo `telefono` editable · corrección vía solicitud |

Nombre, apellidos y matrícula **no** son editables por el titular: son datos
que la institución asigna, y permitir cambiarlos convertiría el perfil en una
vía de suplantación.

El hueco que esta decisión dejaba abierto —*"¿y si el dato está mal?"*— lo
cierra el tipo de solicitud `correccion-datos-perfil` propuesto en D-01: da el
canal, con responsable y rastro, sin abrir el campo.

### Qué falta decidir

Qué otros campos podría editar el titular, y quién resuelve las solicitudes de
corrección.

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
| **Propuesta** | TOTP propio · 10 códigos de un solo uso · restablecimiento presencial con doble aprobación |
| **Bloquea producción** | **Sí** |

### Qué se propone para el caso difícil

Perdido el dispositivo **y** los códigos de recuperación:

1. Solicitud **presencial** con identificación oficial.
2. **Dos** aprobaciones administrativas, de cuentas distintas.
3. El restablecimiento **no otorga acceso**: solo borra la credencial TOTP
   para que el titular vuelva a enrolarse desde su propio dispositivo.
4. Queda auditado y se notifica al titular.

El punto 3 es el que importa. Un procedimiento de rescate que devolviera
acceso sería la vía preferida para saltarse el segundo factor — más cómoda que
atacar el TOTP. Así, lo peor que consigue quien lo abuse es *dejar sin MFA* a
una cuenta, no *entrar* en ella.

El punto 2 aplica la misma lógica que D-07: ninguna cuenta individual completa
la operación.

### Qué falta decidir

Quién verifica la identidad presencialmente, qué documento se acepta, y si
`CAPTCHA_PROVEEDOR` será Turnstile, reCAPTCHA u otro. Con `ninguno`, la
aplicación **no arranca en producción**.

## D-07 · Autoridad superior para cambios retroactivos

| | |
|---|---|
| **Aprueba** | Dirección académica |
| **Dónde vive** | Rol `autoridad-academica` + par incompatible en `PARES_INCOMPATIBLES` |
| **Propuesta** | Partir el permiso en dos, no designar a una persona |
| **Bloquea producción** | **Sí** |

### La pregunta estaba mal planteada

D-07 preguntaba *"¿quién es la autoridad superior?"*. Responderla designando a
alguien con `periodo:modificar-retroactivo` habría creado **una cuenta capaz
de alterar el pasado por sí sola** — precisamente la concentración de poder
que el escenario 5 identifica como el riesgo, y con el agravante de que allí
el actor al menos tenía que encadenar dos operaciones.

### Qué se propone en su lugar

Dos permisos declarados **incompatibles** por RNFS-007:

| Permiso | Quién lo tiene | Qué hace |
|---|---|---|
| `periodo:autorizar-retroactivo` | `autoridad-academica` | **Concede** la autorización. No puede usarla |
| `periodo:modificar-retroactivo` | `administrador` | **Ejecuta** el cambio. No puede concederse la autorización |

La consecuencia: **alterar un periodo cerrado exige forzosamente dos cuentas
distintas y dos motivos escritos.** Ninguna persona completa el flujo sola.

Además: la autorización es de un solo uso, vence en 24 h (máximo 72), emite
**alerta crítica inmediata**, y es visible para cualquiera que pueda leer
periodos — una autorización que solo ve quien la concedió no la revisa nadie.

Es el mismo razonamiento que el escenario 5 aplica al jefe de carrera: no se
le quita su función legítima, se le quita la posibilidad de **encadenarla**.

### Qué falta decidir

Solo una cosa, y es la que corresponde a la institución: **quién ocupa el rol
`autoridad-academica`**. El mecanismo ya no depende de esa respuesta para ser
seguro.

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

| ID | Decisión | Aprueba | Estado |
|---|---|---|---|
| D-01 | Catálogo de solicitudes | Servicios escolares | Propuesto, sin firma |
| D-02 | Campos editables del perfil | Servicios escolares | No |
| D-03 | Escala y reglas de calificación | Dirección académica | No |
| D-04 | Documentos: formatos, tamaño, cuota | Servicios escolares | No |
| D-05 | Umbrales de límite y alertas | Seguridad informática | No |
| D-06 | MFA y recuperación del 2.º factor | Seguridad informática | **Bloquea producción** |
| D-07 | Autoridad para cambios retroactivos | Dirección académica | **Bloquea producción** |
| D-08 | Matriz rol–permiso definitiva | Académica + Seguridad | No |
| D-09 | Retención y requisitos legales | Jurídico | No |
| D-10 | Volumen, SLA, RTO, RPO, plataforma | Dirección de TI | **Bloquea producción** |
| D-11 | Incidentes, navegadores, identidad | Dirección de TI | No |

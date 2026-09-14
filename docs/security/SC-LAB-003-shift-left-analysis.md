# SC-LAB-003 — Costo de corrección y Shift Left

| | |
|---|---|
| **Proyecto** | SecureCampus |
| **Curso** | Desarrollo Seguro |
| **Práctica** | SC-LAB-003 |
| **Versión** | 1.0 |
| **Fecha** | 14 de septiembre de 2026 |

## Integrantes del equipo

| Integrante | Matrícula |
|---|---|
| Cesar Adan De La Cruz Moctezuma | _(completar)_ |
| Diego Salazar Reyes | _(completar)_ |
| Juan Pablo Castillo Angeles | _(completar)_ |
| Alejandro Martínez | _(completar)_ |

---

## 1. Objetivo y alcance

En [SC-LAB-001](SC-LAB-001-analisis-inicial.md) identificamos *qué puede salir mal*. En
[SC-LAB-002](SC-LAB-002-secure-sdlc-map.md) decidimos *en qué fase actuar*. Esta práctica responde
la pregunta que queda: **¿qué cambia según el momento en que descubrimos el problema?**

La diferencia con SC-LAB-002 es importante y no es obvia. Allí mapeamos dónde *debería* estar cada
control. Aquí analizamos el caso real —el control no se puso a tiempo— y medimos el **retrabajo**:
cuántos artefactos, decisiones, pruebas, despliegues y personas hay que tocar para corregirlo según
dónde aparezca el hallazgo.

El resultado que buscamos no es una lista de buenas intenciones sino un criterio para decidir **qué
mover a la izquierda**, sabiendo que no todo se puede ni conviene adelantar.

---

## 2. Modelo conceptual

### 2.1 Costo cualitativo, sin multiplicadores

El manual es explícito en que **no se usarán multiplicadores universales de costo**, y lo adoptamos
deliberadamente. La regla popular "corregir en producción cuesta cien veces más" proviene de
estudios antiguos, sobre proyectos en cascada, y se cita como si fuera una ley. En un proyecto como
SecureCampus —equipo pequeño, despliegue continuo— ese número no significa nada.

Lo que sí es estable es la **dirección** del fenómeno y su causa: mientras más tarde se descubre, más
artefactos existen construidos **sobre** la decisión defectuosa, y todos ellos entran en el
retrabajo. Por eso razonamos por inventario de artefactos afectados y no por factores:

| Artefacto afectado | Qué implica tocarlo |
|---|---|
| **Requisito / criterio de aceptación** | Reescribir una línea y validarla con quien conoce la regla de negocio. |
| **Diseño y modelo de datos** | Revisar decisiones que ya condicionaron otras; posible migración de esquema. |
| **Código** | Modificar cada punto que se apoyó en el diseño anterior; el número crece con el tiempo. |
| **Pruebas** | Reescribir las que validaban el comportamiento viejo, que ahora pasan en verde sobre algo incorrecto. |
| **Datos en producción** | Migrar, corregir o purgar lo ya almacenado. Es el primer artefacto **no reversible por código**. |
| **Terceros: personas** | Notificar a usuarios afectados, coordinar con dirección, responder ante la normativa. Aquí el costo deja de ser técnico. |
| **Reputación y cumplimiento** | No se "corrige": se gestiona. No vuelve al estado anterior. |

El salto de costo más grande no está entre dos fases de desarrollo, sino en el momento en que el
retrabajo **deja de ser solo código**. Mientras el problema vive en requisitos, diseño o código, el
equipo lo resuelve solo. En cuanto toca datos reales o usuarios reales, entran actores que el equipo
no controla y tiempos que no decide.

### 2.2 Origen ≠ descubrimiento

Es la distinción central de la práctica y la fuente habitual de conclusiones equivocadas:

- **Origen** — la fase donde se **introdujo** la omisión o el defecto. Es un hecho del pasado y no
  cambia. Es lo que hay que corregir en el proceso.
- **Descubrimiento** — la fase donde **nos enteramos**. Es lo que determina el costo del retrabajo,
  y es lo que Shift Left busca adelantar.

Casi todos nuestros hallazgos se **originan en Requisitos o Diseño** y se **descubren en Pruebas o
Producción**. Esa brecha es exactamente el problema que estudiamos: no se trata de cometer menos
errores —eso no es una estrategia— sino de **acortar la distancia entre origen y descubrimiento**.

La confusión práctica es atribuir el defecto a quien lo encontró o a la fase donde se manifestó.
Decir "es un bug de desarrollo" porque apareció al probar el código lleva a la corrección
equivocada: se parcha la línea, el requisito sigue mal escrito, y la siguiente historia de usuario
que dependa de ese requisito vuelve a producir el mismo hueco.

### 2.3 Qué es y qué no es Shift Left

**Shift Left es** mover determinadas actividades de seguridad a etapas más tempranas **y mantener la
seguridad durante todo el ciclo**. Las dos mitades de esa frase importan igual.

**Shift Left no es** "hacer toda la seguridad al inicio". Esa lectura es un error que además se
contradice a sí mismo: vaciar las fases finales es justo lo contrario del Secure SDLC que definimos
en SC-LAB-002 (§2). Hay riesgos —el caso C de esta práctica es el ejemplo— que **no existen** cuando
desarrollamos y que ninguna actividad temprana puede detectar, porque no hay nada que detectar
todavía.

---

## 3. Caso guiado · RF-010, recuperación de contraseña

> **RF-010.** *"SecureCampus deberá permitir al usuario recuperar su contraseña."* El enlace generado
> dura **7 días** y **puede reutilizarse** varias veces.

| Pregunta | Respuesta del equipo |
|---|---|
| **¿Dónde se originó principalmente la omisión?** | En **Requisitos**. RF-010 describe una capacidad funcional ("permitir recuperar") sin ninguna condición de seguridad: no dice cuánto vive el enlace, ni cuántos usos admite, ni qué pasa con las sesiones activas al cambiar la contraseña, ni cómo se responde ante un correo inexistente. Los 7 días y la reutilización no fueron una mala decisión de alguien: fueron **valores por defecto que nadie decidió**, elegidos por quien implementó porque el requisito no daba ninguna guía. El origen es la omisión en el requisito, no el criterio del desarrollador. |
| **¿Dónde podría descubrirse?** | En **Requisitos**, si existiera una plantilla de historia de usuario que obligue a declarar vigencia y unicidad de todo token (es lo que proponemos mover a la izquierda). En **Diseño**, en una sesión de modelado de amenazas, al preguntar "¿y si alguien más lee ese correo?". En **Desarrollo**, en revisión de código, si el revisor pregunta por qué el token no se invalida al usarse. En **Pruebas**, con un caso negativo que use el mismo enlace dos veces. En **Producción**, de la peor manera: por un reporte de cuenta comprometida, o nunca. Que sea descubrible en cinco momentos distintos es justamente el argumento: el más barato está disponible y no se está usando. |
| **¿Qué artefactos habría que cambiar si se descubre en pruebas?** | El **requisito RF-010** (reescribirlo con sus condiciones); el **diseño del token** (de un valor persistente y reutilizable a uno de un solo uso, con vigencia corta, almacenado como hash y con invalidación explícita); el **modelo de datos** (campos de estado, uso y expiración, más migración de los tokens ya emitidos); el **código** del flujo completo, incluidas la plantilla del correo y la respuesta al usuario; las **pruebas existentes**, que validaban el comportamiento viejo y por tanto pasan en verde sobre algo incorrecto; la **documentación** del flujo. Aun así es un escenario **contenido**: todo el retrabajo es del equipo, no hay usuarios reales afectados y no hay nada que notificar. Esa es la diferencia con descubrirlo en producción. |
| **¿Qué requisitos / criterios de seguridad faltaron?** | (a) **Vigencia corta** — el enlace expira en 15–30 minutos, no en 7 días. (b) **Un solo uso** — se invalida al consumirse, y también al emitirse uno nuevo. (c) **Token imprevisible y no almacenado en claro** — generado con un CSPRNG y guardado como hash, para que un volcado de la base no entregue enlaces válidos. (d) **Respuesta uniforme** — el mismo mensaje exista o no la cuenta, para no convertir el formulario en un enumerador de correos válidos. (e) **Límite de solicitudes** por cuenta y por origen. (f) **Invalidar todas las sesiones activas** al completar el cambio — sin esto, el atacante que ya entró conserva su sesión aunque la víctima recupere su contraseña. (g) **Notificar al titular** por un canal que el proceso no controla, tanto al solicitar como al completar. |
| **¿Qué moverían a la izquierda?** | La **definición de la política de tokens de un solo uso como requisito transversal**, no como detalle de RF-010. En concreto: una plantilla de historia de usuario que, para toda funcionalidad que emita un token o enlace de acceso, obligue a declarar vigencia, número de usos, efecto sobre las sesiones activas y comportamiento ante entrada inválida — con el campo sin poder quedar vacío. Y un caso negativo estándar en la suite ("reutilizar un enlace ya consumido → rechazado") ejecutándose en CI desde la primera historia que emita tokens. |

**Análisis.** RF-010 es el mejor ejemplo del proyecto de algo que **cumple su requisito funcional y
es inseguro al mismo tiempo**. Si alguien prueba el flujo, funciona: el usuario recibe su enlace,
entra y cambia su contraseña. Todo criterio de aceptación escrito se satisface. El problema no es
que el sistema haga algo mal, es que hace **de más** —permite siete días y usos ilimitados— y ese
exceso nunca fue evaluado porque nadie escribió cuál era el límite.

De ahí la conclusión operativa: la seguridad rara vez aparece como una función que falta; aparece
como una **condición que nadie acotó**. Una plantilla de requisitos que obligue a declarar límites no
evita todos los errores, pero convierte la omisión silenciosa en un campo vacío visible que alguien
tiene que llenar antes de que la historia pase a desarrollo. Es Shift Left en su forma más barata:
no es una herramienta ni un proceso nuevo, es un campo obligatorio en un formato que ya usamos.

Conviene notar cuál de los criterios faltantes es el más caro de agregar tarde: **invalidar las
sesiones activas** (f). Los otros seis se resuelven dentro del flujo de recuperación; ese exige que
el sistema sepa enumerar y revocar las sesiones de un usuario, lo que es una decisión de
arquitectura de sesión — la misma que SC-LAB-001 (§5.4) señaló como estructural. Seis son locales;
el séptimo atraviesa el sistema.

---

## 4. Reto integral · tres situaciones

| Caso | Origen | Descubrimiento | Retrabajo / impacto | Actividad Shift Left | Control posterior |
|---|---|---|---|---|---|
| **A · Administrador** | **Requisitos.** El requisito dice "consultar calificaciones" sin declarar que consultar y modificar son permisos distintos, ni quién tiene cada uno. La ambigüedad se resuelve al final, cuando el modelo ya se construyó sobre la lectura permisiva. | **Requisitos (tardío) o Pruebas.** Aparece al aclarar la regla con el área académica, o cuando alguien prueba que un perfil de solo consulta puede escribir. En el peor caso, en Operación, al auditar una calificación modificada por quien no debía. | **Alto y estructural.** No es agregar una validación: es **partir un permiso en dos** dentro del modelo de autorización. Hay que revisar cada endpoint que hoy responde a "puede ver calificaciones", separar lectura de escritura, migrar las asignaciones de rol existentes decidiendo una por una a qué lado van, reescribir las pruebas y auditar qué se modificó bajo la regla ambigua. Es el escenario 4 de SC-LAB-001 materializado. | **Plantilla de requisitos por operación, no por recurso.** Toda historia que toque un recurso declara explícitamente quién puede *leer*, quién *crear*, quién *modificar* y quién *borrar*, en una tabla que no admite celdas vacías. "Acceso a calificaciones" deja de ser una respuesta admisible. Complemento: modelado de amenazas en Diseño con la pregunta "¿qué pasa si este rol además escribe?". | Bitácora *append-only* de cambios de calificación con autor y valor anterior, y revisión periódica de asignaciones de permisos con revocación al término del nombramiento. Alerta cuando una cuenta de perfil consultivo ejecute una escritura. |
| **B · Upload** | **Requisitos.** Se acepta "el usuario sube archivos" sin definir tipo, tamaño, nombre ni almacenamiento. Igual que en RF-010, los valores los terminó eligiendo la implementación por omisión, no por decisión. | **Pruebas o Producción.** En pruebas, si alguien intenta subir un ejecutable renombrado. En producción, cuando el disco se llena, cuando un antivirus marca un archivo servido desde nuestro dominio, o cuando alguien descubre que las rutas son adivinables. | **Alto y creciente con el tiempo**, porque es el único de los tres que acumula **datos reales**. Hay que mover los archivos ya subidos fuera del directorio público, renombrarlos con identificadores opacos conservando el nombre original como metadato, reescribir la ruta de entrega, actualizar cada enlace ya emitido, escanear retroactivamente lo almacenado y —si las rutas eran públicas— revisar los accesos en los logs y valorar la notificación. Ver la escalera completa en §5. | **Definir la política de archivos antes de la primera subida:** lista blanca de formatos verificada por contenido y no por extensión, tamaño máximo, cuota por usuario, nombres de almacenamiento desligados de la matrícula y almacén fuera del directorio público. Son seis líneas de criterio de aceptación escritas cuando el almacén está **vacío**, que es la única ventana en que este control es barato. | Antivirus en la ruta de cuarentena y **reescaneo periódico del almacén**, porque un archivo limpio hoy puede reconocerse como malicioso mañana. Monitoreo de consumo y de descargas anómalas; alerta ante ráfagas de 403 en el endpoint de entrega. |
| **C · Dependencia** | **Ninguna fase nuestra.** Es la diferencia clave del caso: al incorporar la biblioteca no existía vulnerabilidad conocida, así que **no hubo omisión del equipo** al elegirla. Lo que sí se originó en Diseño/Desarrollo es la ausencia de un **proceso de vigilancia continua** — y también el uso de esa dependencia sin aislamiento ni mínimo privilegio. | **Operación**, y tarde: **2 meses** después de publicado el CVE. Ese retraso sí es responsabilidad nuestra, y es la única variable sobre la que podíamos actuar. | **Variable en el parche, alto en la incertidumbre.** Actualizar la biblioteca puede ser trivial o puede implicar un cambio incompatible que obligue a tocar el código que la usa. Lo costoso es lo otro: durante 2 meses el sistema estuvo expuesto a un exploit público, y hay que **asumir compromiso** — revisar los logs de ese periodo, determinar si fue explotada y, si no hay trazabilidad suficiente, no poder descartarlo. Esa duda es el daño real y no se corrige actualizando. | **No previene el CVE** (§6) — prepara la capacidad de responder: inventario/SBOM de dependencias con versiones fijadas, análisis automático **en cada build y también de forma programada** sobre lo ya desplegado, política de actualización con SLA por severidad, pipeline capaz de desplegar un parche en horas, y mínimo privilegio para acotar el alcance si llega a explotarse. | Monitoreo continuo de avisos de seguridad, alertas del proveedor, ventana de mantenimiento preacordada para parches críticos y un procedimiento de respuesta a incidentes escrito **antes** de necesitarlo. Es el escenario donde el control posterior *es* el control principal. |

### Justificación · Caso A

Lo que hace caro a este caso no es el volumen de código sino que la ambigüedad **ya se propagó**.
Cuando el requisito dice "consultar" sin acotar, cada desarrollador que lo lee elige una
interpretación, y para cuando se aclara hay decisiones tomadas en el modelo de datos, en los roles
asignados y en las pruebas que confirman el comportamiento permisivo. Corregirlo obliga a revisar
todas esas interpretaciones una por una.

Es también el caso que mejor muestra por qué un requisito ambiguo es **peor que uno ausente**: si
falta, alguien pregunta; si es ambiguo, cada quien lo completa en silencio y de forma distinta, y
nadie detecta el desacuerdo hasta que los artefactos ya no coinciden. La actividad Shift Left que
proponemos —declarar permisos por operación, sin celdas vacías— ataca exactamente eso: convierte la
ambigüedad en una pregunta que alguien tiene que responder antes de codificar.

### Justificación · Caso B

Es el único de los tres donde el retrabajo **crece solo con el paso del tiempo**, aunque nadie toque
el código. Cada día que el sistema opera se suman archivos al almacén, y el costo de migrar es
proporcional a lo que ya hay. En requisitos el control es gratuito porque el almacén está vacío; en
producción se convierte en un proyecto de migración con verificación caso por caso.

Y tiene un componente que ninguna migración resuelve: si las rutas fueron públicas y predecibles,
no hay forma de saber con certeza qué se descargó. Se puede cerrar el hueco hacia adelante, pero el
pasado queda como duda permanente — el mismo argumento de irreversibilidad que SC-LAB-001 usó para
los datos personales y SC-LAB-002 para el token expuesto.

### Justificación · Caso C

Este caso está en la práctica para romper una conclusión demasiado cómoda. Después de analizar A y B
la lectura fácil sería "todo se resuelve adelantando actividades". C demuestra que no: aquí **el
equipo hizo bien su trabajo** en su momento y el problema apareció igual, 8 meses después, sin que
ninguna revisión de requisitos, diseño o código pudiera haberlo anticipado. Lo que no existe no se
puede analizar.

Lo que sí era nuestro son los 2 meses de retraso en detectarlo. Ahí está la lección: cuando no se
puede reducir la probabilidad de que aparezca un problema, se reduce el **tiempo de exposición**, y
eso se logra con vigilancia continua, no con análisis temprano. Es la razón de que Shift Left
incluya explícitamente "y mantener la seguridad durante todo el ciclo": sin esa segunda mitad, el
caso C no lo cubre nadie.

---

## 5. Escalera de costo cualitativa · Caso B (upload)

Elegimos el caso B porque es el que mejor muestra la acumulación de artefactos, y en particular el
salto que ocurre cuando el retrabajo deja de ser código y pasa a ser **datos reales**.

| Momento | ¿Qué habría que corregir / revisar? | Costo / retrabajo |
|---|---|---|
| **Requisitos** | Agregar al criterio de aceptación de la historia: formatos permitidos verificados por contenido, tamaño máximo, cuota por usuario, nombres de almacenamiento opacos y almacén fuera del directorio público. Validarlo con quien conoce las necesidades del área. | **Bajo.** Es texto. No hay código, no hay diseño, no hay archivos. Seis líneas y una conversación de quince minutos. Además es el único momento en que el control se puede definir sin negociar con nada de lo ya construido. |
| **Diseño** | Rehacer la decisión de dónde y cómo se guardan los archivos: mover el almacén fuera de la raíz pública, definir el endpoint de entrega mediada, el esquema de metadatos (nombre original, propietario, tipo real, tamaño) y el flujo de cuarentena y análisis. | **Bajo–Medio.** Sigue siendo trabajo en papel, pero ya arrastra: cambia el modelo de datos y puede afectar decisiones adyacentes (cómo se enlazan los documentos desde el perfil, cómo se generan las constancias). Aun así, nada se ha construido todavía sobre ello. |
| **Desarrollo** | Reescribir el módulo de subida y crear el de entrega: validación por *magic bytes*, límites, generación de nombres opacos, endpoint con verificación de propiedad, cabeceras `Content-Disposition: attachment` y `nosniff`. Ajustar cada punto del código que ya construía URLs públicas hacia los archivos. | **Medio.** Es un módulo completo, no un parche, y el número de puntos a tocar depende de cuánto código ya asumió la ruta pública. Todavía es retrabajo **solo del equipo**: se hace en una rama, se revisa y se integra sin afectar a nadie externo. |
| **Pruebas** | Todo lo anterior, más: reescribir las pruebas que validaban el comportamiento viejo —que hoy pasan en verde sobre un diseño incorrecto—, agregar los casos negativos y volver a ejecutar las pruebas de los módulos que consumen documentos. Se pierde el tiempo ya invertido en validar el flujo anterior. | **Medio–Alto.** Aparece el primer costo de **trabajo desechado**: no solo hay que hacer lo correcto, hay que deshacer lo que ya se dio por bueno. Además presiona el calendario, porque en pruebas ya hay una fecha comprometida y este cambio no estaba estimado. |
| **Producción** | Todo lo anterior, más: **migrar los archivos ya subidos** a la nueva ubicación con nombres nuevos, manteniendo la trazabilidad de cada uno con su propietario; actualizar o invalidar los enlaces ya emitidos y compartidos; escanear retroactivamente el almacén buscando lo que la validación ausente dejó entrar; revisar los logs de acceso del periodo para estimar qué se descargó; decidir si procede notificar a los titulares y a la institución; coordinar una ventana de mantenimiento. | **Alto, y cualitativamente distinto.** El salto no es de esfuerzo sino de **naturaleza**: por primera vez el retrabajo incluye datos reales de personas reales y decisiones que no toma el equipo. Y contiene una parte que no se corrige: si las rutas fueron públicas, **no se puede determinar con certeza qué se descargó**. Se cierra el hueco hacia adelante; el pasado queda como duda permanente. |

**Lectura de la escalera.** El costo no crece de forma suave y pareja entre fases; crece a saltos, y
los saltos están donde cambia **quién** participa en la corrección:

1. De Requisitos a Desarrollo el retrabajo es **del equipo y reversible**: se cambia texto, diseño y
   código, y nadie fuera se entera.
2. En Pruebas aparece el **trabajo desechado** y la presión de calendario, pero el problema sigue
   siendo interno.
3. En Producción entran **datos reales, usuarios reales y terceros** —dirección, normativa de
   protección de datos— y una parte del daño deja de ser corregible.

Por eso decimos que la escalera no mide horas de programación: mide **cuánta gente y cuántos
artefactos fuera del código hay que involucrar**. Esa es la variable que Shift Left reduce, y es
también la razón por la que el consejo "agrégalo después" es razonable para un antivirus y
desastroso para la ruta de almacenamiento.

---

## 6. Pregunta con truco conceptual · Dependencias

> **¿Puede Shift Left ayudar con una vulnerabilidad que todavía no existía públicamente cuando
> desarrollamos?**

**No puede prevenirla, y afirmar lo contrario sería deshonesto.** Ninguna actividad temprana detecta
algo que no existe: la biblioteca estaba limpia al incorporarla, no había CVE que buscar, y ninguna
revisión de código, modelado de amenazas o escaneo del día del despliegue podía encontrarlo. Si el
criterio de éxito fuera "que no aparezca la vulnerabilidad", Shift Left pierde y no hay discusión.

**Pero ese no es el criterio correcto**, y ahí está el truco de la pregunta. El daño del caso C no
fueron los 8 meses hasta que apareció el CVE —eso no estaba en nuestras manos— sino los **2 meses
hasta que lo detectamos**, que sí lo estaban. Shift Left no actúa sobre la aparición del problema;
actúa sobre nuestra **capacidad de reaccionar** cuando aparezca. Y esa capacidad se construye antes,
no se improvisa el día del incidente.

### Qué sí puede prepararse desde antes

| Preparación temprana | Qué habilita el día del CVE |
|---|---|
| **Inventario / SBOM de dependencias**, con versiones exactas, incluidas las transitivas. | Responder en minutos a *"¿usamos esa biblioteca, en qué versión y dónde?"*. Sin inventario, esa pregunta se contesta revisando el código a mano mientras el exploit ya es público. |
| **Versiones fijadas** (*lockfile* versionado) y builds reproducibles. | Saber con certeza qué corre en producción, y que actualizar sea un cambio de una línea revisable en vez de una sorpresa. |
| **Análisis de dependencias automatizado**, en cada build **y de forma programada sobre lo ya desplegado**. | Es lo que habría convertido 2 meses en días. La segunda mitad es la decisiva: un escaneo que solo corre al construir no detecta nada en un módulo que nadie está tocando. |
| **Política de actualización con SLA por severidad** (p. ej. crítica ≤ 72 h), acordada de antemano. | Evitar la discusión sobre si conviene parchar ahora, justo cuando no hay tiempo para discutirlo. La decisión ya está tomada. |
| **Pipeline con pruebas automatizadas y despliegue rápido.** | Poder parchar en horas con confianza. Un equipo sin pruebas no parcha rápido aunque quiera: teme romper algo y la actualización se posterga. |
| **Mínimo privilegio y aislamiento** del componente que usa la dependencia. | Acotar el alcance si la vulnerabilidad se explota antes del parche. No evita la explotación; limita hasta dónde llega. |
| **Registro y retención de logs suficientes**, definidos desde el diseño. | Poder **determinar** si fue explotada durante la ventana de exposición. Sin esto no se puede afirmar que hubo intrusión, pero tampoco descartarla — y la duda es el daño que no se corrige. |
| **Procedimiento de respuesta a incidentes escrito.** | Saber quién decide, quién comunica y en qué orden, sin improvisar bajo presión. |

### La distinción que resuelve la pregunta

Conviene enunciarla con precisión, porque es la respuesta completa:

- **El problema no se previene.** La probabilidad de que aparezca un CVE en una dependencia no
  depende de nosotros.
- **El tiempo de exposición sí se reduce.** De 2 meses a días, y eso es enteramente decisión nuestra.
- **El alcance del daño también.** Mínimo privilegio y aislamiento determinan hasta dónde llega una
  explotación exitosa.
- **La capacidad de saber qué pasó se decide antes o no existe.** Los logs que no se configuraron no
  se pueden consultar retroactivamente. Es el punto más fácil de pasar por alto y el único
  literalmente irrecuperable.

En una frase: **Shift Left no adelanta el hallazgo de lo que aún no existe; adelanta la preparación
para cuando exista.** Y es la prueba más clara de que Shift Left no significa "toda la seguridad al
inicio", porque aquí la mitad del valor —el escaneo programado, el monitoreo, la respuesta— vive en
Operación.

---

## 7. Reflexión

### 7.1 ¿Shift Left elimina la necesidad de seguridad en operación?

No, y el caso C es la demostración directa. Una vulnerabilidad que no existía al desarrollar no
puede ser detectada por ninguna actividad temprana, por buena que sea. Si el equipo hubiera hecho
todo a la izquierda impecablemente y hubiera dado por cerrada la seguridad al desplegar, el CVE
habría vivido en producción indefinidamente.

Hay además categorías completas de riesgo que **solo son observables en operación**:

- **El abuso de un usuario legítimamente autorizado** (escenario 5 de SC-LAB-001: el jefe de carrera
  que se asigna un grupo). No hay código defectuoso que encontrar — cada control responde
  correctamente. Solo la bitácora revisada y la alerta lo detectan.
- **Los ataques en curso**: las ráfagas de intentos de autenticación, la enumeración de
  identificadores. El control preventivo los detiene; solo la detección nos dice que están pasando.
- **Los permisos que se acumulan** en cuentas cuyos titulares cambiaron de función. Ningún análisis
  de diseño ve eso; lo ve la revisión periódica de asignaciones.
- **La erosión del entorno**: una configuración que alguien relajó para resolver una urgencia y
  nadie revirtió.

La formulación correcta es que Shift Left **redistribuye** el esfuerzo, no lo elimina. Adelanta lo
adelantable para que en operación quede lo que solo ahí puede verse, en vez de que la operación
cargue además con los errores estructurales que debieron resolverse en diseño. Un equipo desbordado
atendiendo IDORs en producción no tiene tiempo de revisar bitácoras — y esa, no el ahorro de horas,
es la razón de fondo para mover cosas a la izquierda.

### 7.2 ¿Por qué una funcionalidad puede cumplir su requisito funcional y seguir siendo insegura?

Porque el requisito funcional describe **lo que el sistema debe hacer**, y la seguridad se trata en
buena medida de **lo que el sistema no debe hacer**. Un requisito se verifica con un caso positivo;
la seguridad se verifica con casos negativos, que nadie escribe si no se declararon.

RF-010 lo ilustra sin ambigüedad: *"permitir al usuario recuperar su contraseña"* se cumple al cien
por ciento. El usuario lo pide, recibe el enlace, entra y cambia su contraseña. Toda prueba funcional
pasa. Y sin embargo el enlace vive 7 días y se puede reusar, porque el requisito nunca dijo *hasta
cuándo* ni *cuántas veces* — y **cumplir de más también es cumplir**.

El mismo patrón atraviesa todos nuestros casos, y es notable lo consistente que resulta:

| Requisito funcional | Se cumple | Lo que nadie acotó |
|---|---|---|
| "Permitir recuperar la contraseña" | ✔ | Vigencia, número de usos, sesiones activas |
| "Permitir consultar calificaciones" | ✔ | *De quién*, y si consultar incluye modificar |
| "Permitir subir archivos" | ✔ | Tipo, tamaño, nombre, dónde se guardan |
| "Permitir ver el perfil" | ✔ | Que sea **tu** perfil |

En los cuatro, la funcionalidad es correcta y **el límite está ausente**. Por eso decimos que la
seguridad rara vez se manifiesta como una función faltante: se manifiesta como una **condición que
nadie escribió**, y un sistema que hace más de lo necesario no falla ninguna prueba funcional. Es
también la razón por la que las pruebas negativas son el complemento indispensable de las
funcionales: son las únicas que preguntan *"¿y esto que no debería poder hacerse, se puede?"*.

### 7.3 ¿Qué decisión de su equipo habría sido más barata de corregir antes?

**El modelo de autorización basado en la relación usuario↔recurso** — la decisión que en SC-LAB-001
(§5.4) ya habíamos señalado como estructural y que SC-LAB-002 confirmó al ver que su control
principal cae en Diseño y que es el riesgo que atraviesa más fases.

La comparación de costos es directa. Definido **en requisitos y diseño**, es una decisión: las
consultas se escriben desde el principio como *"dame este recurso **para este solicitante**"*, y a
partir de ahí el control es gratuito porque la estructura no admite la alternativa. Corregido **en
producción**, hay que revisar cada acceso a datos del sistema, migrar el modelo de permisos, decidir
caso por caso a qué lado va cada asignación existente, reescribir las pruebas, auditar qué se
consultó o modificó bajo la regla anterior y —si hubo exposición de datos personales— evaluar la
notificación. Y basta olvidar un acceso para que el hueco siga abierto, con el agravante de que la
suite en verde produce la impresión contraria.

Lo decisivo no es la cantidad de trabajo, sino que **el costo de este control crece con el tamaño del
sistema, no con el tiempo**. Un rate limiting cuesta lo mismo hoy que en un año: se pone delante de
un endpoint. La autorización por recurso cuesta proporcionalmente a cuántas consultas existan cuando
se decida implementarla — y ese número solo sube.

Ese es el criterio que usamos para decidir qué mover a la izquierda, y es más útil que "adelantar
todo": **se adelanta lo que se vuelve más caro conforme el sistema crece; se puede posponer lo que
cuesta igual siempre.** Bajo esa regla van primero la autorización, el esquema de permisos, la
política de sesión y la ruta de almacenamiento de archivos. El rate limiting, el antivirus y las
cabeceras de seguridad pueden esperar sin penalización.

Hoy SecureCampus no tiene una sola línea de código escrita. Es, literalmente, el momento más barato
que existirá para tomar estas decisiones, y es la razón de que estas tres prácticas se hayan hecho
antes de implementar.

---

## 8. Autoevaluación contra la rúbrica

| Criterio | Pts | Dónde se cubre |
|---|---|---|
| Distingue origen vs. descubrimiento | 20 | §2.2 define la distinción; §3 la aplica al caso guiado; la tabla de §4 la separa en columnas para los tres casos, incluido el C, donde el origen **no** es una fase nuestra. |
| Analiza retrabajo / costo cualitativo | 25 | §2.1 establece el modelo por artefactos afectados y descarta explícitamente los multiplicadores; §5 desarrolla la escalera de cinco momentos para el caso B e identifica dónde están los saltos reales de costo. |
| Propone Shift Left correctamente | 25 | §2.3 delimita qué es y qué no es; cada caso de §4 tiene su actividad Shift Left concreta; §6 muestra el límite del concepto; §7.3 da el criterio para decidir qué adelantar. |
| Analiza dependencia y operación continua | 15 | §4 caso C; §6 completa con las ocho preparaciones tempranas y la distinción prevención / tiempo de exposición / alcance / capacidad de saber; §7.1 argumenta por qué la operación no desaparece. |
| GitHub + claridad / reflexión | 15 | Archivo en la ruta exigida `docs/security/SC-LAB-003-shift-left-analysis.md`, commit propio siguiendo el flujo `git status → git diff → git add → git diff --staged → git commit → git push`, y §7 con las tres preguntas de reflexión. |

---

## 9. Criterios de aceptación

- [x] Se distingue el origen del descubrimiento en el caso guiado y en los tres casos del reto *(§2.2, §3 y §4)*.
- [x] El análisis de costo es cualitativo y **no** usa multiplicadores universales *(§2.1 y §5)*.
- [x] Las cinco preguntas del caso guiado RF-010 están respondidas *(§3)*.
- [x] La escalera de costo cubre los cinco momentos, de Requisitos a Producción *(§5)*.
- [x] Se responde la pregunta con truco sin afirmar que Shift Left previene un CVE futuro *(§6)*.
- [x] El archivo está en la ruta solicitada y el commit describe la evidencia.

# SC-LAB-001 — Identificación inicial de activos, amenazas, vulnerabilidades, ataques, impactos, riesgos y controles

| | |
|---|---|
| **Proyecto** | SecureCampus |
| **Curso** | Desarrollo Seguro |
| **Práctica** | SC-LAB-001 |
| **Versión** | 1.0 |
| **Fecha** | 10 de septiembre de 2026 |

## Integrantes del equipo

| Integrante | Matrícula |
|---|---|
| Cesar Adan De La Cruz Moctezuma | _(completar)_ |
| Diego Salazar Reyes | _(completar)_ |
| Juan Pablo Castillo Angeles | _(completar)_ |
| Alejandro Martínez | _(completar)_ |

---

## 1. Alcance y sistema analizado

SecureCampus es un sistema web académico que gestionará perfiles, calificaciones, documentos,
solicitudes, usuarios, roles/permisos y registros de auditoría. El análisis de este laboratorio es
**previo a la implementación**: se realiza sobre el comportamiento esperado del sistema, con el fin
de que los controles identificados se incorporen desde los requisitos y el diseño, y no como
correcciones posteriores.

Roles considerados:

| Rol | Alcance previsto |
|---|---|
| **Estudiante** | Consulta *su* perfil, *sus* calificaciones, *sus* documentos y *sus* solicitudes. |
| **Profesor** | Consulta los grupos que le fueron asignados y captura calificaciones **de esos grupos**. |
| **Administrador** | Administra usuarios, roles y permisos, y consulta logs. Algunas operaciones académicas requieren autorización específica adicional. |

Observación que atraviesa todo el análisis: en los tres roles el alcance no está definido por el
rol solamente, sino por la **relación entre el usuario y el recurso concreto** (mi perfil, mi grupo,
mi documento). Un sistema que verifique únicamente el rol y no esa relación quedará expuesto,
aunque la autenticación funcione perfectamente.

---

## 2. Marco conceptual

| Concepto | Pregunta guía | Definición operativa que usamos en este análisis |
|---|---|---|
| **Activo** | ¿Qué información, servicio o capacidad tiene valor y debemos proteger? | Aquello cuya pérdida, alteración o divulgación causaría un daño real a la institución o a las personas. Incluye datos, pero también capacidades (por ejemplo, poder confiar en una calificación). |
| **Amenaza** | ¿Qué situación o actor podría causar daño? | El *quién* o el *qué* con potencial de dañar. Existe fuera del sistema y no se elimina: se gestiona. |
| **Vulnerabilidad** | ¿Qué debilidad podría facilitar el daño? | El *dónde falla* nuestro sistema. Es una propiedad nuestra, no del atacante, y por eso sí está bajo nuestro control. |
| **Ataque** | ¿Qué acción concreta podría explotar la debilidad? | El *cómo*: la secuencia concreta de pasos con la que una amenaza aprovecha una vulnerabilidad. |
| **Impacto** | ¿Qué consecuencia tendría si ocurre? | El daño resultante, medido en confidencialidad, integridad, disponibilidad, cumplimiento normativo y reputación. |
| **Riesgo** | ¿Qué combinación de posibilidad e impacto debemos gestionar? | Probabilidad × impacto. Es lo que se prioriza; no todo riesgo se elimina, algunos se reducen o se aceptan de forma consciente. |
| **Control** | ¿Qué medida previene, detecta o corrige el problema? | La medida concreta que actúa **sobre la vulnerabilidad** (no sobre la amenaza). Se clasifica en preventivo, detectivo o correctivo. |

---

## 3. Actividad guiada: consulta de perfiles

> **Caso.** María inicia sesión con el perfil 125. Al observar la URL, cambia manualmente
> `/perfil/125` por `/perfil/126`. El sistema devuelve información de otro estudiante.

| Elemento | Respuesta del equipo | Justificación |
|---|---|---|
| **Activo** | Datos personales y académicos contenidos en el perfil del estudiante (nombre, matrícula, correo, programa, historial). | Es información personal identificable bajo resguardo de la institución. Su valor está en la **confidencialidad**: no pierde utilidad si se altera, pierde valor si se divulga. |
| **Amenaza** | Usuario legítimo y autenticado que actúa fuera del alcance que le corresponde (insider oportunista, sin herramientas ni conocimientos especiales). | La amenaza más probable aquí no es un atacante externo: es un usuario válido con curiosidad. Cualquier estudiante con una cuenta activa es un origen potencial. |
| **Vulnerabilidad** | Ausencia de verificación de autorización a nivel de objeto: el sistema toma el identificador de la URL y devuelve el registro sin comprobar que pertenezca al usuario de la sesión (*IDOR / Broken Object Level Authorization*). | El sistema confunde "estar autenticado" con "estar autorizado para este registro". Autenticó a María correctamente y luego confió en un parámetro que ella controla por completo. |
| **Ataque** | Manipulación directa del identificador en la URL, y su enumeración secuencial (`126`, `127`, `128`…) de forma manual o con un script para extraer el padrón completo. | El identificador es numérico y consecutivo, así que el ataque escala de un registro a toda la base sin requerir esfuerzo adicional. Es reproducible desde el navegador, sin herramientas. |
| **Impacto** | Fuga de datos personales de todo el padrón estudiantil; incumplimiento de la normativa de protección de datos personales; pérdida de confianza de estudiantes y familias; posible sanción a la institución. | El impacto no se limita al registro 126: la enumeración convierte una fuga puntual en una fuga masiva. Además es un daño **irreversible**, porque un dato divulgado no se puede "des-divulgar". |
| **Riesgo** | **Alto.** Probabilidad alta (explotación trivial, descubrimiento accidental, sin barrera técnica) × impacto alto (datos personales de toda la población estudiantil). | Un riesgo se prioriza por la combinación de ambos factores, y aquí los dos son altos. Es el primer riesgo que debe cerrarse: nada más en el módulo de perfiles importa mientras esto siga abierto. |
| **Control** | **Preventivo:** verificar en el servidor, en cada petición, que el recurso solicitado pertenece al usuario de la sesión (o que su rol lo habilita explícitamente); aplicar *deny by default*. **Preventivo complementario:** sustituir los identificadores secuenciales por identificadores opacos (UUID). **Detectivo:** registrar en el log cada acceso denegado y alertar ante ráfagas de intentos fallidos de un mismo usuario. | El control principal actúa sobre la vulnerabilidad real (la falta de verificación), no sobre el síntoma. Los UUID por sí solos **no son un control suficiente**: dificultan la enumeración pero no impiden el acceso si alguien conoce el identificador — son defensa en profundidad, nunca el reemplazo de la verificación. El log no previene el acceso, pero permite detectarlo y responder. |

---

## 4. Matriz de escenarios

### Escenario 1 — Calificaciones

> **Caso.** Un profesor accede al endpoint de captura de calificaciones enviando el identificador de
> un grupo que **no** tiene asignado, y registra una nota. En una variante del mismo problema,
> modifica una calificación ya publicada y no queda rastro del valor anterior.

| Elemento | Análisis |
|---|---|
| **Activo** | Las calificaciones: el registro académico oficial de cada estudiante. Su valor está principalmente en la **integridad** — una calificación sirve solo si se puede confiar en que es la que el profesor asignó. |
| **Amenaza** | Profesor que actúa fuera de sus grupos asignados (por error o de forma deliberada); usuario interno presionado o sobornado para modificar una nota; cuenta de profesor comprometida y usada por un tercero. |
| **Vulnerabilidad** | (a) La autorización se decide únicamente por el **rol** ("es profesor") y no por la **relación** profesor↔grupo, de modo que cualquier profesor puede escribir sobre cualquier grupo. (b) No existe bitácora inmutable de cambios: las modificaciones sobrescriben el valor sin conservar el anterior. (c) No hay separación entre capturar una calificación y publicarla en firme. |
| **Ataque** | Envío directo de una petición de captura con un `grupo_id` ajeno (manipulando el formulario o llamando al endpoint fuera de la interfaz); modificación posterior de una nota publicada aprovechando que el cambio no deja rastro atribuible. |
| **Impacto** | Alteración del historial académico; titulaciones o becas otorgadas sobre información falsa; imposibilidad de determinar quién hizo el cambio y cuál era el valor original (pérdida de **no repudio**); invalidez de un periodo completo si el alcance no se puede acotar; daño reputacional grave para la institución. |
| **Riesgo** | **Alto.** Probabilidad media (requiere una cuenta de profesor válida, lo que reduce el número de actores posibles) × impacto muy alto (compromete la validez del registro académico y es difícil de revertir sin evidencia del estado previo). |
| **Control** | **Preventivo:** validar en el servidor, en cada operación de escritura, que el grupo pertenece a la asignación vigente del profesor en el periodo en curso. **Preventivo:** separar los estados *borrador* y *publicado*; una vez publicada, la calificación solo se modifica mediante un flujo de corrección con autorización del administrador y motivo obligatorio. **Detectivo:** historial de cambios append-only que registre autor, fecha, valor anterior y valor nuevo. **Detectivo:** notificar al estudiante cuando una calificación suya cambie después de publicada. |

**Justificación del control.** El control central ataca la vulnerabilidad (a): la autorización debe
depender de la relación profesor↔grupo↔periodo, no del rol. Ese es el mismo error conceptual del
caso de María, aplicado a una operación de escritura, donde el daño es mayor porque afecta la
integridad y no solo la confidencialidad. Los controles detectivos existen porque en este escenario
la amenaza puede provenir de un usuario **legítimamente autorizado** sobre ese grupo: contra ese
caso la prevención no alcanza y lo que queda es la trazabilidad. La notificación al estudiante
convierte al afectado en un detector adicional, independiente del propio sistema.

---

### Escenario 2 — Documentos

> **Caso.** Los documentos (constancias, actas, comprobantes, identificaciones) se sirven desde una
> ruta pública predecible del tipo `/uploads/constancia_2026_125.pdf`, accesible sin verificación.
> En sentido inverso, un estudiante sube un archivo ejecutable renombrado como `.pdf`.

| Elemento | Análisis |
|---|---|
| **Activo** | Los documentos académicos y personales de estudiantes y profesores, y la **disponibilidad e integridad del propio servidor** que los almacena. |
| **Amenaza** | Usuario autenticado que accede a documentos ajenos; atacante externo que descubre la ruta pública sin necesidad de cuenta; usuario que sube contenido malicioso para comprometer el servidor o a quien descargue el archivo. |
| **Vulnerabilidad** | (a) Los archivos se sirven directamente por el servidor web desde un directorio público, sin pasar por ninguna comprobación de autorización de la aplicación. (b) Los nombres son predecibles y contienen la matrícula. (c) La validación del tipo de archivo se hace por extensión y no por contenido real. (d) No hay límite de tamaño ni de cantidad por usuario. |
| **Ataque** | Acceso directo a la URL del documento sin sesión válida, y adivinación de nombres a partir de la matrícula; subida de un archivo con doble extensión o con contenido ejecutable disfrazado; carga masiva de archivos grandes para agotar el almacenamiento. |
| **Impacto** | Divulgación de documentos oficiales y de identificaciones (riesgo de suplantación de identidad); posible ejecución de código en el servidor o infección de quien descarga; caída del servicio por saturación del almacenamiento; incumplimiento de la normativa de protección de datos. |
| **Riesgo** | **Alto.** Probabilidad alta (la ruta pública no requiere ni siquiera una cuenta y los nombres son deducibles) × impacto alto (documentos oficiales e identificaciones son directamente utilizables para suplantación). |
| **Control** | **Preventivo:** almacenar los archivos **fuera** del directorio público y entregarlos siempre a través de un endpoint de la aplicación que verifique la propiedad del documento antes de responder. **Preventivo:** generar los nombres de almacenamiento con identificadores aleatorios, desligados de la matrícula, conservando el nombre original solo como metadato. **Preventivo:** validar el tipo real por contenido (*magic bytes*), con una lista blanca de formatos permitidos, y analizar con antivirus antes de aceptar. **Preventivo:** imponer límite de tamaño y cuota por usuario. **Correctivo:** servir las descargas con `Content-Disposition: attachment` y cabeceras que impidan la interpretación del contenido por el navegador. |

**Justificación del control.** La vulnerabilidad de fondo es la misma que en los dos escenarios
anteriores — un recurso accesible sin verificar quién lo pide — pero aquí es peor, porque el
servidor web entrega el archivo **antes** de que la aplicación intervenga: no hay ningún punto donde
se pueda comprobar la sesión. Por eso el control no es "agregar una validación", sino **cambiar la
ruta de entrega**: mientras el archivo sea alcanzable directamente, cualquier verificación añadida
en la aplicación es evitable. La validación por contenido y no por extensión responde a que la
extensión es un dato que el atacante controla; confiar en ella es repetir el error de confiar en el
identificador de la URL.

---

### Escenario 3 — Autenticación

> **Caso.** El formulario de acceso admite intentos ilimitados. Un atacante prueba de forma
> automatizada listas de correos institucionales con contraseñas filtradas de otros servicios
> (*credential stuffing*). En una segunda vía, tras un inicio de sesión exitoso el sistema conserva
> el mismo identificador de sesión que había asignado antes de autenticar.

| Elemento | Análisis |
|---|---|
| **Activo** | Las credenciales de los usuarios y la sesión autenticada. Es un **activo habilitador**: quien lo compromete obtiene el acceso legítimo a todos los demás activos que ese usuario puede alcanzar. |
| **Amenaza** | Atacante externo automatizado (fuerza bruta, credential stuffing); atacante que obtiene el identificador de sesión de un usuario (red no confiable, XSS, sesión fijada previamente); usuario que reutiliza en SecureCampus una contraseña ya filtrada en otro servicio. |
| **Vulnerabilidad** | (a) Sin límite de intentos ni bloqueo progresivo. (b) Sin segundo factor, ni siquiera para administradores. (c) Contraseñas almacenadas con hash rápido o sin *salt*. (d) Cookie de sesión sin `HttpOnly`, `Secure` ni `SameSite`. (e) El identificador de sesión no se regenera al autenticar (fijación de sesión). (f) Mensajes de error que distinguen "usuario inexistente" de "contraseña incorrecta" y permiten enumerar cuentas válidas. |
| **Ataque** | Automatización de miles de intentos contra el endpoint de acceso; enumeración previa de correos válidos aprovechando los mensajes diferenciados; reutilización de un identificador de sesión inducido antes del login; robo de la cookie en tránsito o vía script. |
| **Impacto** | Toma de control de cuentas; si la cuenta comprometida es de administrador, control de usuarios, roles, permisos y logs, es decir, compromiso total del sistema; suplantación de identidad con actos atribuibles a la víctima; el daño se propaga a todos los escenarios anteriores. |
| **Riesgo** | **Crítico.** Probabilidad alta (ataques automatizados constantes, y la reutilización de contraseñas es la norma) × impacto máximo (el compromiso de una cuenta administrativa anula todos los demás controles del sistema). |
| **Control** | **Preventivo:** limitar la tasa de intentos por cuenta y por origen, con retardo progresivo y CAPTCHA tras varios fallos. **Preventivo:** almacenar contraseñas con un algoritmo de derivación lento y adaptable (Argon2id o bcrypt) con *salt* por usuario. **Preventivo:** exigir MFA a administradores y profesores, y ofrecerlo a estudiantes. **Preventivo:** política de contraseñas por longitud mínima y contraste contra listas de contraseñas filtradas, sin exigir rotación periódica arbitraria. **Preventivo:** regenerar el identificador de sesión en cada inicio de sesión y en cada cambio de privilegio; cookies con `HttpOnly`, `Secure` y `SameSite`; expiración por inactividad. **Preventivo:** mensaje de error genérico e idéntico para credenciales inválidas, con tiempo de respuesta uniforme. **Detectivo:** registrar y alertar accesos exitosos desde ubicaciones o dispositivos no habituales, y notificarlos al titular. |

**Justificación del control.** Este escenario se prioriza como crítico porque la autenticación es la
puerta de la que dependen los controles de todos los demás escenarios: una verificación de
propiedad impecable no sirve de nada si el atacante entra **como el dueño**. Los controles se
reparten en dos frentes distintos porque hay dos vulnerabilidades distintas: los del primer frente
(rate limiting, hashing lento, MFA, política de contraseñas) elevan el costo de *adivinar* la
credencial; los del segundo (regeneración de sesión, atributos de cookie, expiración) impiden
*reutilizar* una sesión sin conocer la credencial. Atender solo uno deja el otro camino abierto. La
decisión de no forzar rotación periódica de contraseñas es deliberada: la evidencia actual indica
que empuja a los usuarios a variaciones predecibles y debilita el conjunto; es preferible invertir
ese esfuerzo en MFA.

---

### Escenario 4 — Roles y permisos *(elección del equipo)*

> **Caso.** La interfaz oculta el menú de administración a los estudiantes, pero el endpoint
> `/admin/usuarios` sigue respondiendo a cualquier sesión autenticada que lo invoque directamente.
> En una segunda vía, el rol viaja en un campo del cliente (formulario, `localStorage` o un token
> cuya firma no se verifica) y puede alterarse antes de enviarlo.

| Elemento | Análisis |
|---|---|
| **Activo** | El modelo de autorización: la asignación de roles y permisos y su aplicación efectiva. Es un **metaactivo** — no es información académica en sí, pero es lo que determina quién puede tocar toda la demás. |
| **Amenaza** | Usuario autenticado con privilegios bajos que busca ampliarlos (escalada vertical); usuario que accede a recursos de otro usuario de su mismo nivel (escalada horizontal); administrador que otorga permisos excesivos sin revisión; cuenta con permisos heredados de un cargo que la persona ya no ocupa. |
| **Vulnerabilidad** | (a) El control de acceso se aplica solo en la interfaz: se ocultan los elementos del menú, pero los endpoints no verifican nada. (b) El rol se toma de un valor enviado por el cliente en lugar de derivarse de la sesión en el servidor. (c) Permisos por defecto amplios y ausencia de *deny by default* en endpoints nuevos. (d) No hay revisión periódica ni caducidad de las asignaciones. (e) Los cambios de rol no quedan registrados. |
| **Ataque** | Invocación directa de rutas administrativas descubiertas en el código del cliente o por fuerza bruta de rutas; modificación del campo de rol antes de enviar la petición; alteración de la carga útil de un token cuya firma no se valida; uso de permisos residuales de un rol anterior que nunca fue revocado. |
| **Impacto** | Control total del sistema: alta o modificación de usuarios, otorgamiento de privilegios permanentes al atacante, alteración de calificaciones y, sobre todo, **borrado o manipulación de los logs**, lo que destruye la evidencia del propio ataque y hace imposible reconstruir lo ocurrido. |
| **Riesgo** | **Crítico.** Probabilidad media-alta (basta con inspeccionar el código del cliente, algo que cualquier estudiante de la carrera puede hacer) × impacto máximo (compromete todos los demás activos y elimina la capacidad de investigarlo). |
| **Control** | **Preventivo:** aplicar la autorización **en el servidor, en cada endpoint**, sin excepción; la interfaz solo mejora la experiencia y nunca se considera un control de seguridad. **Preventivo:** *deny by default* — un endpoint sin regla explícita se rechaza, de modo que olvidar la regla falle del lado seguro. **Preventivo:** derivar el rol y los permisos de la sesión del lado del servidor, o de un token cuya firma se verifica en cada petición; nunca del cliente. **Preventivo:** mínimo privilegio, con permisos granulares por operación en lugar de roles amplios, y separación de funciones para las operaciones académicas sensibles (quien administra usuarios no captura calificaciones). **Detectivo:** registrar todo cambio de rol o permiso en un log append-only, con autor, fecha y valores anterior y nuevo, almacenado fuera del alcance de escritura de la aplicación. **Correctivo:** revisión periódica de asignaciones y revocación automática al término de un nombramiento o periodo. |

**Justificación del control.** Este escenario se eligió porque es la **causa raíz común** de los tres
anteriores y del caso guiado: en todos ellos el fallo es el mismo — la autorización se asume, se
delega al cliente o se resuelve con el rol en lugar de con la relación usuario↔recurso. Resolverlo
como un componente transversal del servidor, en vez de repetir comprobaciones dispersas por cada
módulo, es lo que evita que la próxima función que se agregue vuelva a introducir el mismo hueco.
El *deny by default* es el que más valor aporta a largo plazo, porque protege contra el olvido, que
es el modo real en que estos fallos aparecen en producción. El log append-only y fuera del alcance
de la aplicación responde al impacto específico de este escenario: si el atacante alcanza el
privilegio administrativo, la bitácora es lo único que queda, y solo sirve si él no puede editarla.

---

### Resumen de la matriz

| # | Escenario | Activo | Vulnerabilidad principal | Riesgo | Control principal |
|---|---|---|---|---|---|
| 0 | Perfiles *(guiado)* | Datos personales del estudiante | Sin verificación de propiedad del objeto (IDOR) | Alto | Verificar propiedad del recurso en el servidor en cada petición |
| 1 | Calificaciones | Registro académico (integridad) | Autorización por rol y no por relación profesor↔grupo | Alto | Validar la asignación vigente + historial de cambios append-only |
| 2 | Documentos | Documentos oficiales y el servidor | Archivos servidos por ruta pública predecible | Alto | Entrega mediada por la aplicación desde almacenamiento privado |
| 3 | Autenticación | Credenciales y sesión | Sin límite de intentos, sin MFA, sesión no regenerada | Crítico | Rate limiting + Argon2/bcrypt + MFA + regeneración de sesión |
| 4 | Roles y permisos | Modelo de autorización | Control de acceso aplicado solo en la interfaz | Crítico | Autorización en el servidor por endpoint, *deny by default* |

**Orden de atención propuesto:** 3 → 4 → 1 → 2 → 0. Los dos escenarios críticos van primero porque
comprometen los controles de todos los demás: sin una autenticación sólida y una autorización
aplicada en el servidor, los controles de calificaciones, documentos y perfiles pueden evadirse
entrando como un usuario que sí está autorizado.

---

## 5. Preguntas de reflexión

### 5.1 ¿Una amenaza y una vulnerabilidad son lo mismo? Explica con un ejemplo de SecureCampus.

No. La **amenaza** es el actor o la situación con potencial de causar daño; la **vulnerabilidad** es
la debilidad de nuestro sistema que le permitiría lograrlo.

En el caso de María: la **amenaza** es cualquier estudiante autenticado con curiosidad por ver
información ajena — esa amenaza existe siempre, en cualquier universidad, y no podemos eliminarla,
porque implicaría eliminar a los usuarios. La **vulnerabilidad** es que el endpoint de perfiles
devuelve el registro sin comprobar que pertenezca a quien lo pide; esa sí es nuestra, y sí podemos
corregirla con unas líneas de verificación.

La distinción tiene una consecuencia práctica directa: **los controles se diseñan contra las
vulnerabilidades, no contra las amenazas**. Si el equipo se enfoca en "evitar que los estudiantes
sean curiosos" no llegará a ninguna medida implementable; si se enfoca en "verificar la propiedad
del recurso" cierra el problema para toda amenaza que intente la misma vía.

### 5.2 ¿Puede existir una vulnerabilidad aunque todavía nadie la haya explotado?

Sí, y es el caso más común. La vulnerabilidad es una **propiedad del sistema**, no un evento: existe
desde el momento en que se escribe el código defectuoso, no desde que alguien la aprovecha.

Si SecureCampus se despliega mañana con el fallo de perfiles y nadie cambia nunca la URL, el sistema
es exactamente igual de vulnerable que si mil personas lo hicieran. Lo que cambia con la explotación
no es la vulnerabilidad, es el **impacto materializado**; y lo que cambia con el paso del tiempo es
la **probabilidad**, que solo crece: más usuarios, más exposición, más posibilidades de
descubrimiento accidental.

De ahí que "nunca nos ha pasado nada" no sea evidencia de que el sistema sea seguro — es evidencia
de que aún no lo hemos comprobado. Es también el argumento de fondo del laboratorio: analizamos
SecureCampus **antes** de construirlo, cuando todavía no hay explotación posible, precisamente
porque es cuando corregirlo cuesta menos.

### 5.3 ¿Un usuario autenticado está automáticamente autorizado para cualquier recurso?

No, y confundir ambas cosas es el error exacto del caso guiado.

- **Autenticación** responde a *¿quién eres?* — María demostró ser María.
- **Autorización** responde a *¿qué puedes hacer con este recurso concreto?* — y María solo puede
  ver el perfil 125.

El sistema del caso guiado ejecutó bien el primer paso y omitió el segundo: una vez que reconoció a
María, trató cualquier petición suya como válida. La autorización, además, no se resuelve solo con
el rol: debe evaluarse **por recurso y por operación**, considerando la relación entre el usuario y
ese objeto en particular. Por eso el profesor del escenario 1 es legítimamente profesor y aun así no
debe poder escribir en un grupo que no le fue asignado: el rol es correcto, la relación no.

La autorización, además, tiene que verificarse **en cada petición y en el servidor**. Comprobarla
una sola vez al iniciar sesión, o solo en la interfaz, equivale a no comprobarla — como muestra el
escenario 4, donde ocultar el menú no impide invocar el endpoint.

### 5.4 ¿Qué control de los propuestos debería definirse desde requisitos o diseño? ¿Por qué?

El **modelo de autorización basado en la relación usuario↔recurso**, junto con el esquema de roles y
permisos y la política de sesión.

La razón es estructural, no de preferencia. Un control como el rate limiting o el análisis antivirus
de las subidas puede añadirse después: se coloca delante de un endpoint ya existente y el resto del
sistema no se entera. En cambio, la autorización por recurso determina **cómo se consulta cada dato**:
si las consultas se escribieron como "dame el perfil 126", agregar la verificación más tarde obliga
a revisar y reescribir cada acceso a datos del sistema, y basta con olvidar uno para que el hueco
siga abierto. Añadido al final, el control depende de la disciplina de quien lo aplique; definido
desde el diseño, es la estructura la que lo garantiza.

Lo mismo aplica al esquema de permisos: si se diseña con roles amplios ("profesor puede todo lo de
profesor"), pasar después a permisos granulares exige rehacer el modelo de datos. Y a la política de
sesión: cambiar el manejo de sesiones en un sistema en producción implica invalidar las sesiones
activas de todos los usuarios.

En una frase: **estos controles no son una capa que se agrega, son una decisión de arquitectura**, y
por eso pertenecen a los requisitos. Es también el motivo por el que el costo de corregirlos crece
tanto con el tiempo — es más barato escribirlos bien ahora, cuando SecureCampus todavía no tiene una
sola línea de código, que rediseñarlos con el sistema en operación.

### 5.5 ¿Qué activo consideran más crítico y por qué?

Distinguimos dos respuestas, porque la pregunta admite dos lecturas y ambas importan:

**Por valor institucional: las calificaciones.** Son el activo cuya integridad sostiene la razón de
ser de la institución. Un dato personal filtrado es un daño grave, pero el título académico sigue
siendo válido; una calificación alterada sin rastro invalida la certificación misma, que es lo único
que la universidad realmente emite. Además su daño es especialmente difícil de revertir: si no hay
bitácora del valor anterior, no existe forma de saber cuál era la nota correcta ni cuántos registros
fueron tocados, y la duda contamina el periodo completo.

**Por prioridad de defensa: las credenciales y el modelo de autorización.** Son activos habilitadores
— no valen por sí mismos, pero quien los controla alcanza todos los demás. De poco sirve blindar las
calificaciones si el atacante entra con una cuenta de administrador válida y, además, borra los logs
que probarían lo ocurrido.

Por eso el orden de atención de la sección 4 empieza por autenticación y roles: **se protege primero
lo que habilita el acceso a lo más valioso**, aunque lo más valioso sea otra cosa.

---

## 6. Cierre

> **Pregunta de salida.** ¿Qué protegerías primero en SecureCampus y qué podría impedir que ese
> activo permanezca seguro?

Protegeríamos primero el **acceso**: la autenticación y el modelo de autorización aplicado en el
servidor. Es la única capa cuyo fallo anula automáticamente todas las demás, y es también la más
cara de corregir después, porque atraviesa cada consulta del sistema.

Lo que podría impedir que siga seguro no es principalmente un atacante más hábil, sino nuestras
propias decisiones a lo largo del proyecto:

- **El olvido al crecer.** Cada endpoint nuevo es una oportunidad de omitir la verificación. Se
  mitiga con *deny by default*: si nadie declaró una regla, la petición se rechaza, y el olvido
  falla del lado seguro en lugar de abrir un hueco silencioso.
- **La confianza en el cliente.** Ocultar un botón, validar por extensión o leer el rol de un campo
  del formulario se sienten como controles y no lo son: todo lo que viaja desde el navegador es
  editable por el usuario.
- **Los permisos que se acumulan.** Los roles se otorgan y casi nunca se revocan. Sin revisión
  periódica ni caducidad, con el tiempo demasiadas cuentas terminan pudiendo demasiado.
- **La pérdida de trazabilidad.** Contra un usuario legítimamente autorizado que abusa de su
  permiso, la prevención no alcanza. Si además los logs son alterables por la propia aplicación, un
  ataque con privilegios administrativos se vuelve invisible.
- **Tratar la seguridad como una fase final.** Es el riesgo mayor: dejarla para "cuando funcione"
  garantiza que los controles estructurales de la sección 5.4 ya no quepan sin rediseñar.

---

## 7. Criterios de aceptación

- [x] La matriz contiene mínimo cuatro escenarios distintos *(cuatro del reto, más la actividad guiada)*.
- [x] Cada fila distingue activo, amenaza, vulnerabilidad, ataque, impacto y control *(se agrega riesgo)*.
- [x] Los controles son coherentes con el problema descrito *(cada bloque incluye su justificación)*.
- [x] Las decisiones están justificadas, no solo enumeradas.
- [ ] La evidencia está versionada y visible en el repositorio del equipo *(pendiente: commit y push)*.

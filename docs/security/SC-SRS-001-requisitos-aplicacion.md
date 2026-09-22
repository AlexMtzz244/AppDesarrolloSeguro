# SC-SRS-001 — Especificación de requisitos de SecureCampus

| | |
|---|---|
| **Proyecto** | SecureCampus |
| **Curso** | Desarrollo Seguro |
| **Documento** | SC-SRS-001 |
| **Versión** | 1.0 |
| **Fecha** | 21 de septiembre de 2026 |
| **Estado** | Base para implementación |

## Integrantes del equipo

| Integrante | Matrícula |
|---|---|
| Cesar Adan De La Cruz Moctezuma | _(completar)_ |
| Diego Salazar Reyes | _(completar)_ |
| Juan Pablo Castillo Angeles | _(completar)_ |
| Alejandro Martínez | _(completar)_ |

---

## 1. Propósito y relación con las prácticas anteriores

Las tres prácticas previas responden preguntas distintas y ninguna produce todavía algo contra lo
cual programar:

- [SC-LAB-001](SC-LAB-001-analisis-inicial.md) respondió **qué puede salir mal**.
- [SC-LAB-002](SC-LAB-002-secure-sdlc-map.md) respondió **en qué fase se actúa**.
- [SC-LAB-003](SC-LAB-003-shift-left-analysis.md) respondió **qué cuesta descubrirlo tarde**.

Este documento responde la cuarta: **qué debe hacer exactamente el sistema, y qué no debe
permitir**. Es la pieza que convierte un análisis en requisitos verificables, y es deliberadamente
el último artefacto que se escribe antes de la primera línea de código — el momento que SC-LAB-003
§7.3 identificó como el más barato que existirá para tomar estas decisiones.

### 1.1 Regla de redacción que adoptamos

SC-LAB-003 §7.2 dejó un hallazgo que aquí se convierte en regla de formato obligatoria: la
inseguridad **casi nunca aparece como una función faltante, sino como una condición que nadie
acotó**. RF-010 cumplía su requisito funcional al cien por ciento y aun así el enlace vivía siete
días y se podía reutilizar, porque el requisito nunca dijo *hasta cuándo* ni *cuántas veces*.

Por lo tanto, en este documento:

1. Todo requisito que **emita un token o enlace** declara vigencia, número de usos y efecto sobre
   las sesiones activas.
2. Todo requisito que **exponga un recurso** declara de quién es y qué relación habilita el acceso.
3. Todo requisito que **acepte un archivo** declara tipo, tamaño, cuota y destino de almacenamiento.
4. Todo requisito que **permita una operación** declara la operación concreta —leer, crear,
   modificar, publicar, corregir, administrar, auditar— y no un verbo genérico como "gestionar".
5. **Ningún campo queda vacío.** Un campo vacío es una decisión no tomada, y lo que no se decide lo
   termina eligiendo la implementación por omisión. Cuando la decisión corresponde a la institución
   y no al equipo, el campo se llena con un valor por defecto seguro marcado `TODO` en §8, nunca con
   una regla académica inventada.

### 1.2 Convención de identificadores

| Prefijo | Significado |
|---|---|
| `RF-xxx` | Requisito funcional — lo que el sistema debe hacer. |
| `RNFS-xxx` | Requisito no funcional de seguridad — la condición que acota a un RF. Cada uno trae su **caso negativo**, que es lo que se automatiza como prueba. |

La distinción importa porque se verifican de forma distinta: un `RF` se comprueba con un caso
positivo; un `RNFS` **solo** se comprueba con un caso negativo, y los casos negativos no se escriben
solos si no se declararon antes.

---

## 2. Actores y alcance

| Actor | Alcance | Restricción que lo define |
|---|---|---|
| **Estudiante** | Su perfil, sus calificaciones, sus documentos, sus solicitudes. | La relación de propiedad. Nunca un recurso ajeno, ni aunque conozca el identificador. |
| **Profesor** | Los grupos asignados a él **en el periodo vigente** y los alumnos inscritos en ellos. | La asignación docente vigente, no el rol. |
| **Jefe de carrera** | Grupos, horarios y asignaciones docentes **de su propio programa**. | La adscripción a un programa. Nunca alcance global. |
| **Administrador** | Usuarios, roles, permisos y consulta de auditoría, con mínimo privilegio. | Las acciones académicas sensibles exigen permiso explícito y motivo. |
| **Sistema** | Antivirus, alertas, respaldos, notificaciones y tareas programadas. | Identidades técnicas de privilegio mínimo, sin privilegios funcionales implícitos. |

**Principio transversal que gobierna toda la especificación** (SC-LAB-001 §1): el alcance no lo
define el rol, lo define la **relación entre el usuario y el recurso concreto**. Un sistema que
verifique solo el rol queda expuesto aunque la autenticación sea impecable.

Y su corolario, que SC-LAB-001 §5.5 descubrió al analizar al jefe de carrera: **si un control se
apoya en un dato, ese dato hereda la criticidad del control**. Por eso la asignación docente no es
un dato administrativo más, sino un activo protegido (RF-032, RNFS-030).

---

## 3. Requisitos funcionales

### 3.1 Identidad, sesión y recuperación

| ID | Requisito |
|---|---|
| **RF-001** | El sistema debe autenticar al usuario con correo institucional y contraseña. |
| **RF-002** | El sistema debe cerrar la sesión a petición del usuario y revocarla del lado del servidor, no solo borrar la cookie en el navegador. |
| **RF-003** | El sistema debe exigir un segundo factor TOTP a administrador, profesor y jefe de carrera, y ofrecerlo como opcional al estudiante. |
| **RF-004** | El sistema debe permitir dar de alta y desactivar el segundo factor, y emitir códigos de recuperación de un solo uso. |
| **RF-005** | El sistema debe permitir al usuario cambiar su contraseña estando autenticado. |
| **RF-006** | El sistema debe permitir al usuario consultar sus sesiones activas y revocar cualquiera de ellas individualmente. |
| **RF-010** | El sistema debe permitir al usuario recuperar el acceso a su cuenta sin intervención de un administrador. *(Reescrito en §5.)* |

### 3.2 Perfiles y usuarios

| ID | Requisito |
|---|---|
| **RF-011** | El estudiante debe poder consultar su propio perfil. |
| **RF-012** | El estudiante debe poder modificar únicamente los campos de su perfil que la política institucional habilite. El conjunto es configurable (§8, D-02). |
| **RF-013** | El administrador debe poder crear, activar y desactivar usuarios. |
| **RF-014** | El administrador debe poder consultar el estado de un usuario y sus asignaciones de rol con su vigencia. |
| **RF-015** | El sistema debe registrar en auditoría todo cambio sobre un perfil o un usuario, con autor, antes y después. |

### 3.3 Programas, periodos, grupos y asignación docente

| ID | Requisito |
|---|---|
| **RF-020** | El sistema debe mantener un catálogo de programas académicos, y cada jefe de carrera debe estar adscrito a uno. |
| **RF-021** | El sistema debe mantener periodos con fecha de apertura, fecha de cierre y estado (abierto / cerrado). |
| **RF-022** | El sistema debe mantener un catálogo de materias y de aulas. |
| **RF-023** | El jefe de carrera debe poder crear grupos de su propio programa, indicando materia, periodo, horario y aula. |
| **RF-024** | El jefe de carrera debe poder consultar los grupos de su propio programa. |
| **RF-025** | El sistema debe registrar la inscripción de estudiantes a grupos. |
| **RF-030** | El jefe de carrera debe poder asignar un profesor a un grupo para un periodo, indicando motivo. |
| **RF-031** | El sistema debe conservar la asignación docente como **historial versionado** con vigencia (desde / hasta), autor, motivo y número de versión. |
| **RF-032** | El sistema debe registrar en auditoría toda alta, cambio y reversión de asignación docente, con el valor anterior y el nuevo. |
| **RF-033** | El sistema debe permitir modificar un periodo cerrado únicamente mediante un flujo de autorización extraordinaria con motivo obligatorio. |

### 3.4 Calificaciones

| ID | Requisito |
|---|---|
| **RF-040** | El estudiante debe poder consultar sus propias calificaciones. |
| **RF-041** | El profesor debe poder consultar las calificaciones de los alumnos inscritos en los grupos que tiene asignados en el periodo vigente. |
| **RF-042** | El profesor debe poder capturar calificaciones en estado *borrador* para esos mismos alumnos. |
| **RF-043** | El profesor debe poder publicar una calificación en borrador, con lo que pasa a estado *publicado*. |
| **RF-044** | El sistema debe permitir corregir una calificación publicada únicamente mediante un flujo de corrección con permiso explícito y motivo obligatorio, dejándola en estado *corregido*. |
| **RF-045** | El sistema debe conservar todas las versiones de una calificación, con autor, fecha, valor anterior y valor nuevo. |
| **RF-046** | El sistema debe notificar al estudiante cuando una calificación suya cambie después de publicada. |

### 3.5 Documentos

| ID | Requisito |
|---|---|
| **RF-050** | El usuario debe poder subir documentos desde los flujos y tipos autorizados. |
| **RF-051** | El titular debe poder consultar y descargar sus propios documentos. |
| **RF-052** | Los roles con relación explícita sobre el titular deben poder descargar el documento; las descargas administrativas exigen motivo. |
| **RF-053** | El sistema debe analizar cada documento con antivirus antes de ponerlo a disposición, manteniéndolo en cuarentena entretanto. |
| **RF-054** | El sistema debe reanalizar periódicamente el almacén con firmas actualizadas. |
| **RF-055** | El sistema debe registrar cada descarga y cada denegación con solicitante, titular, documento, resultado y motivo. |

### 3.6 Solicitudes

| ID | Requisito |
|---|---|
| **RF-060** | El usuario debe poder crear una solicitud de alguno de los tipos del catálogo configurable. |
| **RF-061** | El usuario debe poder consultar y dar seguimiento únicamente a sus propias solicitudes. |
| **RF-062** | El sistema debe mantener el historial de estados de cada solicitud, con responsable y fecha. |
| **RF-063** | El catálogo de tipos, estados, responsables y SLA debe ser configurable por el administrador y **no estar codificado en el programa**. |

### 3.7 Administración, auditoría, alertas y notificaciones

| ID | Requisito |
|---|---|
| **RF-070** | El administrador debe poder crear roles y asignar permisos granulares por operación. |
| **RF-071** | Toda asignación de rol o permiso debe tener vigencia, motivo, autor y fecha de revisión. |
| **RF-072** | El sistema debe revocar automáticamente las asignaciones cuya vigencia termine. |
| **RF-080** | Los perfiles autorizados deben poder consultar la auditoría con filtros, paginación y exportación controlada. |
| **RF-081** | La interfaz y la API de auditoría **no deben ofrecer** ninguna operación de edición o borrado. |
| **RF-090** | El sistema debe generar alertas ante: ráfagas de 403 o enumeración; descargas masivas; acceso exitoso desde dispositivo o ubicación inusual; volumen anormal de correcciones; captura inmediata por un profesor recién asignado; asignación creada y revertida poco después; y cambios de privilegio. |
| **RF-091** | El sistema debe notificar al titular los cambios de calificación publicada y los accesos inusuales, con reintentos e idempotencia. |

---

## 4. Requisitos no funcionales de seguridad

Cada uno se acota con su caso negativo, que es el que se automatiza. La última columna enlaza con la
prueba obligatoria correspondiente del prompt maestro de desarrollo.

### 4.1 Autorización — el eje del sistema

| ID | Condición | Caso negativo (prueba) | Prueba |
|---|---|---|---|
| **RNFS-001** | La autorización se resuelve **en el servidor, en cada petición y para cada operación**. La interfaz puede ocultar opciones por experiencia de usuario, pero nunca decide. | Invocar directamente un endpoint cuya opción de menú está oculta → 403. | 6 |
| **RNFS-002** | *Deny by default*: toda ruta sin política declarada responde 403. | Registrar una ruta sin política y comprobar que responde 403, no 200. La build falla si existe. | — |
| **RNFS-003** | El rol y los permisos del actor se derivan **siempre** de la sesión del servidor; nunca del cuerpo, query, cabecera o cookie. | Enviar `rol=administrador` en la petición → se ignora y se evalúa con el rol real → 403. | 6 |
| **RNFS-004** | Los permisos son granulares por operación. Un permiso de lectura nunca habilita escritura. | Cuenta con `calificacion:leer` intenta `POST` → 403. | 6 |
| **RNFS-005** | Los identificadores públicos son opacos (UUID/ULID) y **no se tratan como control de acceso**. | Conocer el identificador de un recurso ajeno no basta: la petición → 403. | 1 |
| **RNFS-006** | Un 403 nunca revela si el recurso existe. La respuesta es idéntica para recurso inexistente y recurso ajeno. | Pedir un ID inexistente y un ID ajeno → misma respuesta, mismo código. | 1 |
| **RNFS-007** | Separación de funciones: una misma cuenta no puede tener a la vez permiso de asignación docente y de captura de calificaciones. | Asignar ambos permisos a una cuenta → la asignación se rechaza. | 4 |

### 4.2 Autenticación y sesión

| ID | Condición | Caso negativo (prueba) | Prueba |
|---|---|---|---|
| **RNFS-010** | Las contraseñas se almacenan con Argon2id, salt único por usuario y parámetros configurables. Nunca en texto plano ni con hash rápido. | Inspeccionar la base tras crear un usuario: no aparece la contraseña ni un hash rápido. | — |
| **RNFS-011** | La sesión es un valor opaco de al menos 32 bytes generado con CSPRNG, del que se almacena **solo el hash**. No es un JWT legible ni modificable por el cliente. | Alterar la cookie de sesión → sesión inválida, 401. | 6 |
| **RNFS-012** | La cookie de sesión lleva `HttpOnly`, `Secure` y `SameSite`, y expira por inactividad. | Leer `document.cookie` desde el navegador → la cookie de sesión no aparece. | — |
| **RNFS-013** | El identificador de sesión se regenera en cada autenticación y en cada elevación de privilegio. | Comparar el identificador antes y después del login → son distintos. | 11 |
| **RNFS-014** | El cambio exitoso de contraseña revoca **todas** las sesiones activas del usuario. | Cambiar la contraseña con una segunda sesión abierta → la segunda queda inválida. | 11 |
| **RNFS-015** | Los intentos se limitan por cuenta **y** por origen en ventana deslizante, con retardo progresivo y CAPTCHA tras el umbral. El límite se repite en el borde. | 100 intentos en 10 minutos → bloqueo en el umbral y alerta. Un intento por cuenta sobre muchas cuentas → lo detiene el límite por origen. | 7 |
| **RNFS-016** | Las credenciales inválidas producen el mismo mensaje, el mismo código y una latencia equiparable, exista o no la cuenta. | Comparar respuesta y tiempo entre usuario inexistente y contraseña incorrecta → indistinguibles. | 7 |
| **RNFS-017** | El secreto TOTP se cifra en reposo y los códigos de recuperación se almacenan hasheados. El alta y la baja quedan auditadas. | Volcar la tabla de credenciales → el secreto no es utilizable tal cual. | — |

### 4.3 Recuperación de cuenta

| ID | Condición | Caso negativo (prueba) | Prueba |
|---|---|---|---|
| **RNFS-020** | La solicitud de recuperación responde siempre lo mismo, exista o no la cuenta. | Solicitar con un correo inexistente → respuesta idéntica a la de un correo válido. | 8 |
| **RNFS-021** | El token se genera con CSPRNG y se almacena **solo como hash**. | Volcar la tabla de tokens → no se puede reconstruir un enlace válido. | 8 |
| **RNFS-022** | El token expira entre 15 y 30 minutos (configurable, §8 D-06). | Usar un enlace vencido → rechazo con el mensaje genérico. | 8 |
| **RNFS-023** | El token es de **un solo uso**, y emitir uno nuevo invalida el anterior. | Reutilizar un enlace consumido, y usar el anterior tras pedir otro → rechazo en ambos casos. | 8 |
| **RNFS-024** | El token nunca aparece en logs, trazas ni mensajes de error. | Buscar el token en los logs tras un flujo completo → no aparece. | — |
| **RNFS-025** | Al completarse se revocan todas las sesiones y se notifica al titular por un canal que no depende del enlace. | Completar la recuperación con otra sesión abierta → queda inválida, y llega la notificación. | 11 |

### 4.4 Auditoría

| ID | Condición | Caso negativo (prueba) | Prueba |
|---|---|---|---|
| **RNFS-030** | Toda mutación sensible y su evento de auditoría ocurren en la **misma transacción**. Si una falla, ninguna persiste. | Forzar un fallo tras la mutación → ni el cambio ni el evento quedan escritos. | 10 |
| **RNFS-031** | La identidad de aplicación tiene permiso de **inserción y lectura, nunca de actualización ni borrado** sobre el almacén de auditoría. | `UPDATE` o `DELETE` sobre la bitácora con el rol de aplicación → la base lo rechaza. | 12 |
| **RNFS-032** | Cada evento registra actor, acción, tipo y ID de recurso, antes, después, resultado, motivo, fecha sincronizada, IP/origen, user agent y correlation ID. | Ejecutar una mutación y verificar que el evento trae los doce campos poblados. | 10 |
| **RNFS-033** | Los accesos **denegados** también se registran, no solo los exitosos. | Provocar un 403 → aparece el evento con resultado denegado. | 1 |

### 4.5 Documentos

| ID | Condición | Caso negativo (prueba) | Prueba |
|---|---|---|---|
| **RNFS-040** | Los documentos se guardan en almacenamiento privado; **nunca** en una ruta estática pública. | Solicitar la URL del objeto directamente al almacén → inaccesible. | 9 |
| **RNFS-041** | La clave de almacenamiento es aleatoria y desligada de la matrícula; el nombre original queda solo como metadato. | Intentar deducir la clave a partir de la matrícula → no existe correspondencia. | 9 |
| **RNFS-042** | El endpoint de descarga **autoriza antes de obtener el objeto**, no después. | Pedir un documento ajeno → 403 sin que el objeto llegue a leerse. | 1 |
| **RNFS-043** | La respuesta de descarga lleva `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff`. | Inspeccionar las cabeceras de una descarga → ambas presentes. | — |
| **RNFS-044** | El tipo se valida por **contenido real (magic bytes) con lista blanca**, nunca por extensión. | Subir un ejecutable renombrado a `.pdf` → rechazado. | 9 |
| **RNFS-045** | Se imponen tamaño máximo por archivo y cuota por usuario, ambos configurables (§8 D-04). | Subir un archivo sobredimensionado, y agotar la cuota → rechazo en ambos casos. | 9 |
| **RNFS-046** | Todo documento pasa por cuarentena y análisis antivirus antes de estar disponible, y se reanaliza periódicamente. | Un archivo marcado por el antivirus nunca se entrega. | 9 |

### 4.6 Despliegue, operación y cadena de suministro

| ID | Condición | Caso negativo (prueba) | Prueba |
|---|---|---|---|
| **RNFS-050** | Las respuestas de error en producción no exponen trazas, SQL, secretos, rutas internas ni la existencia de recursos. | Provocar un error interno → respuesta genérica sin detalle. | — |
| **RNFS-051** | HTTPS obligatorio con HSTS, cabeceras de seguridad, CORS por lista blanca y protección CSRF cuando la cookie cruza orígenes. | Petición desde un origen no listado → rechazada. | — |
| **RNFS-052** | Los secretos se inyectan por variables de entorno o gestor de secretos. Si falta una variable crítica, la aplicación **falla al arrancar** en vez de usar un valor por defecto. | Arrancar sin una variable obligatoria → la aplicación no inicia y lo dice. | 13 |
| **RNFS-053** | El escaneo de secretos corre en pre-commit y en CI sobre el **historial completo**. | Intentar commitear una credencial de prueba → el hook aborta; si se omite con `--no-verify`, CI falla. | 13 |
| **RNFS-054** | CI falla ante una dependencia con vulnerabilidad crítica, y existe un análisis **programado** sobre lo ya desplegado. | Introducir una dependencia vulnerable conocida → la build falla. | 13 |
| **RNFS-055** | Se genera un SBOM en cada build y el lockfile está versionado. | El artefacto de SBOM existe y lista las dependencias con versión exacta. | 13 |
| **RNFS-056** | Los relojes de los servidores están sincronizados; sin ello las marcas de tiempo de la bitácora no son defendibles. | *(verificación operativa, no automatizable en CI)* | — |
| **RNFS-057** | Cada ambiente usa credenciales distintas, y los servicios corren con privilegio mínimo. | Las credenciales de desarrollo no funcionan contra otro ambiente. | — |
| **RNFS-058** | Los datos semilla son explícitamente de desarrollo y el arranque en producción los rechaza. | Arrancar en modo producción con semillas presentes → la aplicación se niega. | — |

### 4.7 Interfaz

| ID | Condición | Caso negativo (prueba) |
|---|---|---|
| **RNFS-060** | La interfaz cumple WCAG 2.2 AA: etiquetas asociadas, errores vinculados al campo, foco manejado, contraste suficiente. | Recorrer los formularios solo con teclado y con lector de pantalla. |
| **RNFS-061** | Toda operación remota expone estado de carga, éxito, error y reintento. | Provocar un fallo de red → la interfaz lo muestra y ofrece reintentar. |
| **RNFS-062** | Las acciones sensibles piden confirmación y, donde corresponde, **motivo obligatorio**. | Intentar corregir una calificación sin motivo → el formulario lo impide y el servidor también. |
| **RNFS-063** | Ocultar un elemento de navegación **no se considera un control**; el endpoint vuelve a verificar. | Cubierto por RNFS-001. |

---

## 5. RF-010 reescrito

El requisito original —*"SecureCampus deberá permitir al usuario recuperar su contraseña"*— es el
caso guiado de SC-LAB-003 §3 y el ejemplo del proyecto de algo que **cumple su requisito funcional y
es inseguro al mismo tiempo**. Se reescribe incorporando los siete criterios que allí se
identificaron como faltantes:

> **RF-010.** El sistema debe permitir al usuario recuperar el acceso a su cuenta mediante un enlace
> enviado a su correo institucional, bajo las siguientes condiciones:

| Condición | Valor | RNFS |
|---|---|---|
| Respuesta a la solicitud | Idéntica exista o no la cuenta | RNFS-020 |
| Generación del token | CSPRNG, almacenado solo como hash | RNFS-021 |
| Vigencia | 15–30 minutos, configurable | RNFS-022 |
| Número de usos | Exactamente uno; emitir otro invalida el anterior | RNFS-023 |
| Presencia en logs | Nunca | RNFS-024 |
| Efecto sobre sesiones activas | Al completarse, **todas** se revocan | RNFS-025 |
| Notificación al titular | Al solicitar y al completar, por un canal independiente del enlace | RNFS-025 |
| Límite de solicitudes | Por cuenta y por origen | RNFS-015 |

La diferencia con el requisito original no es que agregue funciones: es que **ninguna condición
queda sin declarar**. Ese es el patrón que §1.1 impone al resto del documento.

---

## 6. Matriz rol–permiso–operación (inicial, parametrizable)

Los permisos se nombran `recurso:operacion`. La matriz siguiente es el **estado inicial sembrado**,
no una regla fija: el administrador puede modificarla, y su versión definitiva debe aprobarse antes
de producción (§8, D-08).

| Permiso | Estudiante | Profesor | Jefe de carrera | Administrador |
|---|:---:|:---:|:---:|:---:|
| `perfil:leer` (propio) | ✔ | ✔ | ✔ | ✔ |
| `perfil:modificar` (propio, campos habilitados) | ✔ | ✔ | ✔ | ✔ |
| `usuario:leer` | — | — | — | ✔ |
| `usuario:crear` · `usuario:modificar` | — | — | — | ✔ |
| `rol:administrar` | — | — | — | ✔ |
| `programa:leer` | — | — | ✔ (el suyo) | ✔ |
| `grupo:leer` | — | ✔ (asignados) | ✔ (su programa) | ✔ |
| `grupo:crear` · `grupo:modificar` | — | — | ✔ (su programa) | — |
| `asignacion-docente:crear` | — | — | ✔ (su programa) | — |
| `periodo:modificar-retroactivo` | — | — | — | ✔ (con autorización y motivo) |
| `calificacion:leer` | ✔ (propias) | ✔ (sus grupos) | — | — |
| `calificacion:crear` · `calificacion:publicar` | — | ✔ (sus grupos, periodo vigente) | — | — |
| `calificacion:corregir` | — | — | — | ✔ (con motivo) |
| `documento:leer` | ✔ (propios) | — | — | ✔ (con motivo, auditado) |
| `documento:crear` | ✔ | ✔ | ✔ | ✔ |
| `solicitud:crear` · `solicitud:leer` | ✔ (propias) | ✔ (propias) | ✔ (propias) | ✔ |
| `auditoria:consultar` | — | — | — | ✔ |

**Dos lecturas obligatorias de esta matriz.** La primera: un ✔ nunca significa "sobre cualquier
recurso" — significa "sobre los recursos con los que el actor tiene la relación indicada entre
paréntesis", y esa relación se resuelve **en el servidor**. La segunda: `asignacion-docente:crear` y
`calificacion:crear` **no coinciden en ninguna columna**, y eso no es casualidad sino la separación
de funciones de RNFS-007, que impide encadenar el ataque del escenario 5 de SC-LAB-001.

Nótese también que el administrador **no** tiene `calificacion:crear` ni `grupo:crear`. Administrar
el sistema no es lo mismo que operar académicamente, y confundirlo es exactamente el caso A de
SC-LAB-003 §4.

---

## 7. Trazabilidad

Cada requisito de seguridad viene de un escenario analizado, tiene una fase de control asignada y
termina en una prueba automatizada. Esta tabla es la que permite responder *"¿por qué existe este
código?"* sin recurrir a la memoria de nadie.

| RNFS | Escenario SC-LAB-001 | Fase principal (SC-LAB-002) | Prueba obligatoria |
|---|---|---|---|
| RNFS-001 … 004 | Esc. 4 — Roles y permisos | Diseño | 6 |
| RNFS-005, 006 | Esc. 0 — Perfiles (caso de María) | Diseño | 1 |
| RNFS-007 | Esc. 5 — Asignación docente | Requisitos | 4 |
| RNFS-010 … 013 | Esc. 3 — Autenticación | Requisitos / Diseño | 7, 11 |
| RNFS-014, 025 | Esc. 3 + SC-LAB-003 §3 (f) | Diseño | 11 |
| RNFS-015, 016 | Esc. 3 — Autenticación | Requisitos + Despliegue (borde) | 7 |
| RNFS-020 … 024 | SC-LAB-003 §3 — RF-010 | Requisitos | 8 |
| RNFS-030 … 033 | Esc. 1 y 5 — Integridad y trazabilidad | Desarrollo + Despliegue | 10, 12 |
| RNFS-040 … 046 | Esc. 2 — Documentos | Diseño + Despliegue | 9 |
| RNFS-050, 051 | Esc. 0 y 4 | Despliegue | — |
| RNFS-052 … 055 | Esc. B (token en commit) + SC-LAB-003 §4 caso C | Desarrollo + Pruebas + Operación | 13 |
| RNFS-056 … 058 | Esc. 5 y C | Despliegue | — |
| RNFS-060 … 063 | Esc. 4 (la interfaz no es un control) | Desarrollo | 6 |

Las pruebas obligatorias 2, 3 y 5 se cubren por la combinación de RNFS-001, RNFS-004, RNFS-007 y
RNFS-030 aplicadas al módulo de calificaciones: no tienen un RNFS propio porque **no introducen una
condición nueva**, sino que son la misma condición aplicada al activo de mayor valor.

---

## 8. Decisiones pendientes

Estas once decisiones corresponden a la institución, no al equipo de desarrollo. Se implementan como
**configuración administrable con un valor por defecto seguro**, nunca como una regla académica
inventada dentro del código. Todas requieren aprobación antes de un despliegue productivo.

| ID | Decisión pendiente | Valor por defecto seguro | Quién aprueba |
|---|---|---|---|
| **D-01** | Catálogo de solicitudes, estados, responsables y SLA | Catálogo vacío; no se crea ningún tipo por omisión | Servicios escolares |
| **D-02** | Campos editables del perfil y proceso de corrección | Ninguno editable por el estudiante hasta que se habilite | Servicios escolares |
| **D-03** | Escala de calificaciones y reglas de publicación y corrección | Escala 0–100, publicación manual, corrección solo con motivo | Dirección académica |
| **D-04** | Catálogo de documentos, formatos, tamaño máximo y cuota | PDF/JPG/PNG, 10 MB por archivo, 100 MB por usuario | Servicios escolares |
| **D-05** | Umbrales de rate limit, bloqueo, CAPTCHA, inactividad y anomalías | 5 intentos / 15 min por cuenta, 20 / 15 min por IP, inactividad 30 min | Seguridad informática |
| **D-06** | Proveedor de MFA y recuperación del segundo factor | TOTP propio, 10 códigos de recuperación de un solo uso | Seguridad informática |
| **D-07** | Autoridad superior para cambios retroactivos | Ninguna configurada; el flujo queda bloqueado hasta designarla | Dirección académica |
| **D-08** | Matriz final rol–permiso–operación y frecuencia de revisión | La de §6, revisión semestral | Dirección académica + Seguridad |
| **D-09** | Retención y eliminación de datos, y requisitos legales aplicables | Auditoría un semestre mínimo; sin borrado automático | Jurídico |
| **D-10** | Volumen, concurrencia, disponibilidad, RTO, RPO, presupuesto y plataforma | Sin compromiso de SLA; despliegue de desarrollo | Dirección de TI |
| **D-11** | Procedimiento de incidentes, navegadores soportados e identidad visual | Procedimiento base en `docs/OPERACION.md`; últimas dos versiones de navegadores | Dirección de TI |

El criterio de fondo es el de SC-LAB-002 §6.3: **si la respuesta está en el reglamento
institucional, la define una persona y el sistema solo la aplica**. Codificar un valor inventado no
lo convierte en decidido — lo convierte en invisible, que es peor.

---

## 9. Criterios de aceptación del documento

- [x] Cada requisito funcional tiene identificador estable y verificable.
- [x] Cada requisito de seguridad declara su condición **y su caso negativo**.
- [x] Ningún requisito que emita token, exponga recurso o acepte archivo deja una condición sin acotar.
- [x] RF-010 está reescrito con los siete criterios de SC-LAB-003 §3.
- [x] La matriz rol–permiso–operación existe y está marcada como parametrizable.
- [x] Existe trazabilidad de cada RNFS a su escenario, su fase y su prueba automatizada.
- [x] Las decisiones institucionales están declaradas como pendientes, no inventadas.

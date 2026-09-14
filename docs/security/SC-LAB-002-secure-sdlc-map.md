# SC-LAB-002 — Mapa de seguridad a lo largo del SDLC

| | |
|---|---|
| **Proyecto** | SecureCampus |
| **Curso** | Desarrollo Seguro |
| **Práctica** | SC-LAB-002 |
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

## 1. Alcance y continuidad con SC-LAB-001

En [SC-LAB-001](SC-LAB-001-analisis-inicial.md) respondimos *qué puede salir mal* en SecureCampus:
identificamos activos, amenazas, vulnerabilidades, ataques, impactos, riesgos y controles para seis
escenarios. Ese análisis terminó con una lista de controles, pero sin una respuesta a la pregunta
que sigue: **¿en qué momento del ciclo de vida se implementa cada uno?**

Este laboratorio responde eso. No introduce riesgos nuevos —salvo uno, el manejo de secretos en el
repositorio, que no habíamos considerado— sino que toma los mismos escenarios y los distribuye a lo
largo de Requisitos, Diseño, Desarrollo, Pruebas, Despliegue y Operación/Mantenimiento.

Seguimos la regla de trabajo que indica el manual: **no buscamos una única fase correcta**. Un mismo
riesgo casi siempre necesita controles en varias fases, y precisamente los escenarios donde una sola
fase parecía suficiente resultaron ser los peor entendidos. La pregunta útil no es "¿en qué fase
va esto?" sino "¿qué parte del problema resuelve cada fase, y qué queda sin resolver si me salto
alguna?".

Una observación que atraviesa todo el mapa y que ya venía de SC-LAB-001: la mayoría de nuestras
vulnerabilidades son fallas de **autorización**, no de autenticación. Eso tiene una consecuencia
directa sobre las fases: la autorización por relación usuario↔recurso es una decisión de
**Requisitos y Diseño**, mientras que la autenticación robusta se puede reforzar bastante más tarde
sin rehacer el sistema. Esa asimetría es lo que el mapa hace visible.

---

## 2. Marco conceptual

El manual pide distinguir cuatro conceptos que en la práctica se usan como sinónimos y no lo son.
Los separamos por la pregunta que responde cada uno:

| Concepto | Pregunta que responde | Definición operativa | Ejemplo en SecureCampus |
|---|---|---|---|
| **Secure SDLC** | ¿Cómo organizamos el proceso completo? | El **proceso**: integrar actividades de seguridad en *todas* las fases del ciclo de vida, cada una con su entregable verificable, en lugar de concentrarlas en una auditoría final. Es el marco que contiene a los otros tres. | Que existan criterios de seguridad en cada historia de usuario, modelado de amenazas en diseño, revisión de código, pruebas de autorización, despliegue endurecido y monitoreo en operación — todo, no una parte. |
| **Security by Design** | ¿Cómo se decide la arquitectura? | Una **decisión de diseño**: la seguridad se construye dentro de la estructura del sistema, de modo que el comportamiento inseguro no sea representable, en vez de agregarse como una capa que se puede olvidar. | Que el acceso a datos pase obligatoriamente por una capa que recibe *quién pide* junto con *qué pide*. Un desarrollador no puede escribir "dame el perfil 126" a secas porque la función no acepta esa firma. |
| **Security by Default** | ¿Cómo se comporta si nadie configura nada? | Un **valor por omisión**: la configuración de fábrica es la segura, y relajarla exige una acción explícita y justificada. Protege contra el olvido, no contra el atacante. | *Deny by default*: un endpoint nuevo sin regla de autorización declarada devuelve 403, no 200. También: cookies con `HttpOnly`/`Secure`/`SameSite` de origen, MFA activo para administradores desde el alta. |
| **Shift Left** | ¿Cuándo ejecutamos la actividad? | Un **movimiento temporal**: adelantar actividades de seguridad a fases más tempranas y baratas. No significa "hacer toda la seguridad al inicio", significa "no dejar para pruebas lo que se puede resolver en requisitos". | Escribir el criterio de aceptación *"un estudiante que solicita un perfil ajeno recibe 403"* en la historia de usuario, y automatizar esa prueba en CI — en vez de descubrir el IDOR en la auditoría previa a producción. |

**Dónde se confunden.** *By Design* y *by Default* se mezclan porque ambos suenan a "viene de
fábrica", pero actúan sobre cosas distintas: **by design** cambia lo que el sistema *puede* hacer
(la estructura no admite el acceso sin verificación), **by default** cambia lo que el sistema *hace
si nadie decide nada* (la estructura sí admitiría configurarlo mal, pero de origen está bien). Por
eso *deny by default* es un excelente ejemplo del segundo y no del primero: un endpoint mal escrito
podría seguir abriéndose si alguien declara la regla equivocada; lo que el default garantiza es que
**el olvido** —no la mala decisión— falle del lado seguro.

*Secure SDLC* y *Shift Left* se confunden porque los dos hablan de fases. La diferencia es de
alcance: Secure SDLC dice **"en todas"**, Shift Left dice **"lo antes posible, sin abandonar las
últimas"**. Shift Left mal entendido —"toda la seguridad al inicio"— es justamente lo contrario de
Secure SDLC, porque vacía las fases finales.

---

## 3. Actividad guiada · Calificaciones

> **Caso.** Un estudiante autenticado puede cambiar `/calificaciones/125` por `/calificaciones/126`
> y consultar calificaciones ajenas.

Es el mismo fallo del caso de María en SC-LAB-001 (§3), ahora sobre el módulo de calificaciones:
el sistema autentica correctamente y después confía en un identificador que el usuario controla.

| Fase | ¿Qué debería hacerse? | Control / evidencia |
|---|---|---|
| **Requisitos** | Escribir el alcance como una **regla de negocio explícita y verificable**: "un estudiante consulta únicamente las calificaciones asociadas a su propia matrícula; cualquier otra solicitud se rechaza con 403". Definir también qué roles sí pueden ver calificaciones ajenas y bajo qué relación (profesor del grupo, en el periodo vigente). | Criterio de aceptación de seguridad en la historia de usuario, con su caso negativo redactado. Evidencia: la historia en el backlog contiene el caso "acceso a matrícula ajena → 403". |
| **Diseño** | Decidir que el acceso a calificaciones se resuelve por la **relación usuario↔recurso** y no por el rol. Modelar la consulta como *"dame las calificaciones de este alumno **para este solicitante**"*, de modo que no exista una firma que permita pedir un registro sin decir quién lo pide. Sustituir identificadores secuenciales por identificadores opacos como defensa en profundidad. | Diagrama de flujo de autorización y modelo de datos con la relación explícita. Decisión de arquitectura registrada (ADR). Evidencia: el diseño no contiene ningún camino de lectura que omita el contexto del solicitante. |
| **Desarrollo** | Implementar la verificación **en el servidor y en cada petición**, dentro de la capa de acceso a datos y no en cada controlador. Aplicar *deny by default*. Prohibir en revisión de código cualquier consulta que reciba un identificador del cliente y lo use sin filtrar por el usuario de la sesión. | Código de la capa de autorización + checklist de revisión de PR con el punto "¿esta consulta filtra por el usuario de la sesión?". Evidencia: el PR con la verificación y su revisión aprobada. |
| **Pruebas** | Escribir pruebas automatizadas del **caso negativo**, no solo del feliz: el estudiante A pide las calificaciones de B y debe recibir 403. Incluir la variante de enumeración (recorrer un rango de identificadores) y la prueba del rol profesor sobre un grupo ajeno. Integrarlas al pipeline para que un futuro cambio que rompa la regla haga fallar la build. | Suite de pruebas de autorización en CI. Evidencia: el reporte del pipeline mostrando las pruebas negativas en verde, y la build roja cuando se desactiva la verificación a propósito. |
| **Despliegue** | Endurecer el entorno para que un fallo no se amplifique: errores genéricos sin trazas ni detalles de la consulta, desactivar el modo depuración, HTTPS obligatorio con HSTS, cabeceras de seguridad, y separación real entre datos de prueba y datos reales. Verificar que la configuración de producción no relaje la política de autorización. | Configuración de producción versionada (infraestructura como código) y checklist de endurecimiento firmado. Evidencia: el archivo de configuración en el repositorio y el resultado del escaneo de configuración. |
| **Operación / Mantenimiento** | Registrar cada acceso denegado y **alertar ante ráfagas** de 403 de un mismo usuario o de un mismo origen — es la firma de alguien enumerando. Revisar periódicamente los logs, mantener la suite de pruebas viva cuando el módulo cambie, y definir un procedimiento de respuesta si se confirma una fuga. | Log append-only de accesos denegados, regla de alerta configurada y bitácora de revisión. Evidencia: captura de la alerta disparándose en una prueba controlada. |

**Justificación.** Las seis fases atacan el mismo riesgo pero ninguna lo cierra sola, y es fácil ver
qué queda abierto si se omite cada una. Sin **Requisitos** no hay contra qué probar: nadie puede
verificar una regla que nunca se escribió. Sin **Diseño** la verificación se vuelve una línea que
hay que recordar en cada consulta nueva, y basta un olvido para reabrir el hueco — es exactamente el
argumento de la sección 5.4 de SC-LAB-001. Sin **Desarrollo** no hay control real, solo intención.
Sin **Pruebas** el control existe hoy y desaparece en el siguiente refactor sin que nadie lo note.
Sin **Despliegue** un error cualquiera filtra información que ayuda al atacante. Y sin **Operación**
nunca sabremos si alguien lo intentó: la prevención dice *no*, pero solo la detección nos dice
*cuántas veces*.

El punto de mayor retorno es **Diseño**, porque es el único que hace que las demás fases tengan
poco trabajo: si la firma de la consulta exige el contexto del solicitante, el desarrollador no
puede equivocarse aunque quiera, y las pruebas confirman en lugar de descubrir.

---

## 4. Reto por equipo

Para cada escenario indicamos las seis fases y marcamos explícitamente el **control temprano** y el
**control posterior** que pide el manual.

### Escenario A · Documentos

> Un estudiante intenta descargar el documento de otro usuario modificando un identificador.
> *(Continúa el escenario 2 de SC-LAB-001.)*

| Fase | Actividad de seguridad |
|---|---|
| **Requisitos** | 🟢 **Control temprano.** Definir la propiedad del documento como regla: "un documento pertenece a un titular; solo el titular y los roles con relación explícita (jefe de carrera de su programa, administrador con motivo registrado) pueden descargarlo". Definir formatos permitidos, tamaño máximo y cuota por usuario, y prohibir por escrito que los archivos vivan en un directorio público. |
| **Diseño** | Diseñar la **entrega mediada**: los archivos se almacenan fuera del directorio público y se sirven por un endpoint de la aplicación que verifica la propiedad antes de responder. Nombres de almacenamiento aleatorios y desligados de la matrícula, con el nombre original guardado solo como metadato. |
| **Desarrollo** | Implementar el endpoint con verificación de propiedad, validación del tipo real por *magic bytes* (no por extensión), límite de tamaño y cuota. Cabeceras `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff` en la respuesta. |
| **Pruebas** | Pruebas negativas: descargar el documento de otro usuario (403), acceder a la ruta de almacenamiento directamente (404 o no accesible), subir un ejecutable renombrado a `.pdf` (rechazado), subir un archivo por encima del límite (rechazado), agotar la cuota (rechazado). |
| **Despliegue** | Verificar que el servidor web **no** expone el directorio de almacenamiento (sin *directory listing*, sin ruta estática hacia él), permisos de sistema de archivos restrictivos y antivirus activo en la ruta de cuarentena de subidas. |
| **Operación** | 🔵 **Control posterior.** Log de descargas con titular, solicitante y resultado; alerta ante descargas masivas o ráfagas de 403 desde una misma cuenta. Reescaneo periódico del almacén con firmas antivirus actualizadas, porque un archivo limpio hoy puede ser reconocido como malicioso mañana. |

**Justificación.** Este escenario obliga a separar dos fases que suelen tratarse como una. El control
principal —almacenar fuera del directorio público— es una decisión de **Diseño**, pero solo se hace
efectiva en **Despliegue**: si el servidor web sigue publicando esa carpeta, la aplicación puede
tener la verificación más estricta del mundo y el archivo se entrega igual, **antes** de que el
código intervenga. Es el caso más claro de que un control de código puede ser anulado por una
configuración de infraestructura. El reescaneo en operación responde a algo que ninguna fase
temprana puede resolver: el archivo no cambia, cambia lo que sabemos sobre él.

---

### Escenario B · Token en un commit

> Un desarrollador intenta incluir un token dentro de un commit.

Es el único escenario del reto que no estaba en la matriz de SC-LAB-001, porque allí analizamos el
sistema y aquí el activo en riesgo está en **nuestro proceso de trabajo**, no en el producto.

| Fase | Actividad de seguridad |
|---|---|
| **Requisitos** | 🟢 **Control temprano.** Definir la política de gestión de secretos antes de escribir código: ningún secreto vive en el repositorio; la configuración sensible se inyecta por variables de entorno o por un gestor de secretos; cada entorno tiene credenciales propias; todo secreto tiene un responsable y un procedimiento de rotación documentado. |
| **Diseño** | Diseñar la configuración para que el secreto **no tenga dónde alojarse** en el código: separar configuración de código, publicar un `.env.example` con nombres de variable y valores vacíos, y hacer que la aplicación falle al arrancar si falta una variable obligatoria (fallo ruidoso en vez de un valor por defecto silencioso). |
| **Desarrollo** | 🟢 **Control temprano.** `.gitignore` con `.env` y equivalentes desde el primer commit. **Hook de pre-commit** que escanea el *staging area* en busca de patrones de secretos y aborta el commit. Revisión de código con el punto explícito "¿este PR agrega alguna credencial?". |
| **Pruebas** | Escaneo de secretos como paso obligatorio del pipeline, ejecutado **sobre el historial completo** y no solo sobre el último commit, porque el hook local se puede omitir con `--no-verify` y no todos los integrantes lo tendrán instalado. La build falla si detecta algo. |
| **Despliegue** | Los secretos de producción se cargan desde el gestor de secretos de la plataforma y **nunca** se imprimen en los logs del despliegue. Permisos mínimos en cada token (un token de solo lectura no sirve para escribir) y caducidad corta por defecto. |
| **Operación** | 🔵 **Control posterior.** Monitoreo de uso anómalo de cada token, rotación periódica programada, alertas del servicio de *secret scanning* del proveedor de Git, y **procedimiento de respuesta a exposición**: rotar primero, limpiar el historial después. |

**Justificación.** Este escenario es el que mejor ilustra la diferencia entre prevenir y remediar,
porque aquí **la remediación no deshace el daño**. Si el token llegó a un repositorio remoto, se
debe asumir comprometido: reescribir el historial con `filter-repo` o `BFG` borra el objeto de
nuestro repositorio, pero no de los clones que otros ya tienen, ni de los *forks*, ni de las cachés
del proveedor, ni de los bots que escanean GitHub en tiempo real. El único control que realmente
cierra el problema es **rotar el secreto**, y la limpieza del historial es higiene posterior. Es el
mismo argumento de irreversibilidad que en SC-LAB-001 usamos para los datos personales: *un dato
divulgado no se puede des-divulgar*.

Por eso el control temprano aquí vale desproporcionadamente más que en cualquier otro escenario:
un hook de pre-commit cuesta minutos y evita una rotación de emergencia. Y por eso duplicamos la
verificación en CI: el hook vive en la máquina del desarrollador, que es exactamente donde no
tenemos garantía de que esté instalado.

---

### Escenario C · Profesor sobre un grupo no asignado

> Un profesor intenta modificar calificaciones de un grupo no asignado.
> *(Continúa el escenario 1 de SC-LAB-001.)*

| Fase | Actividad de seguridad |
|---|---|
| **Requisitos** | 🟢 **Control temprano.** Escribir la regla de negocio completa, incluyendo la dimensión temporal: "un profesor captura calificaciones únicamente de los grupos que tiene asignados **en el periodo vigente**". Definir los estados *borrador* y *publicado*, y que una calificación publicada solo se corrige con autorización del administrador y motivo obligatorio. |
| **Diseño** | Modelar la relación **profesor↔grupo↔periodo** como la fuente de la decisión de autorización, no el rol. Diseñar el historial de cambios como *append-only* (se agregan versiones, no se sobrescribe) y la máquina de estados borrador→publicado→corregido. Definir la separación de funciones: quien asigna profesores no captura calificaciones. |
| **Desarrollo** | Implementar la validación de la asignación vigente en **cada operación de escritura**, del lado del servidor. Escribir el registro de auditoría en la misma transacción que el cambio, para que no pueda existir un cambio sin su entrada de bitácora. |
| **Pruebas** | Pruebas negativas: profesor sobre grupo ajeno (403), profesor sobre grupo propio pero de un periodo cerrado (403), modificación de una calificación publicada sin flujo de corrección (403), y prueba de que **todo** cambio exitoso deja su registro en la bitácora. |
| **Despliegue** | La bitácora se escribe en un almacén al que la aplicación tiene permiso de **inserción pero no de actualización ni borrado**. Copias de respaldo con retención definida. Sincronización horaria de los servidores, sin la cual las marcas de tiempo de la bitácora no son defendibles. |
| **Operación** | 🔵 **Control posterior.** Notificar al estudiante cuando una calificación suya cambie después de publicada — convierte al afectado en un detector independiente del sistema. Revisión periódica de la bitácora de correcciones y alerta ante patrones anómalos (muchas correcciones de un mismo profesor, o correcciones fuera de las fechas del calendario académico). |

**Justificación.** El control preventivo de este escenario tiene una **dependencia externa** que ya
habíamos identificado en SC-LAB-001: validar "el grupo pertenece a la asignación vigente del
profesor" solo es confiable si el registro de asignación es íntegro. Esa dependencia es justamente
lo que el escenario E de esta práctica desarrolla. Dicho de otro modo: el control de C vive en
Desarrollo, pero **su confiabilidad vive en la fase de Operación de E**, y ningún mapa por fases que
analice los escenarios de forma aislada lo hace visible.

La notificación al estudiante es el control posterior de mayor valor por su costo: es una fase de
Operación, se implementa en dos días, y es el único control que funciona cuando el atacante está
formalmente autorizado.

---

### Escenario D · 100 intentos fallidos en 10 minutos

> Una cuenta registra 100 intentos fallidos de autenticación en 10 minutos.
> *(Continúa el escenario 3 de SC-LAB-001.)*

| Fase | Actividad de seguridad |
|---|---|
| **Requisitos** | 🟢 **Control temprano.** Definir la política de autenticación como requisito medible: umbral de intentos por cuenta y por origen, retardo progresivo, ventana de bloqueo, mensaje de error genérico e idéntico para cualquier credencial inválida, MFA obligatorio para administradores y jefes de carrera, y política de contraseñas por longitud con contraste contra listas filtradas. |
| **Diseño** | Diseñar la autenticación como un componente con estado propio (contador por cuenta y por IP, ventana deslizante) y decidir el algoritmo de hash lento y adaptable (Argon2id o bcrypt) con *salt* por usuario. Diseñar la regeneración del identificador de sesión en cada autenticación y en cada cambio de privilegio. |
| **Desarrollo** | Implementar rate limiting, retardo progresivo y CAPTCHA tras varios fallos; respuesta de error uniforme **y de tiempo uniforme**, para no filtrar por latencia qué cuentas existen; cookies con `HttpOnly`, `Secure` y `SameSite`; expiración por inactividad. |
| **Pruebas** | Simular los 100 intentos y verificar que el bloqueo se activa en el umbral definido; comprobar que el mensaje y el tiempo de respuesta son idénticos para usuario inexistente y para contraseña incorrecta; verificar que el identificador de sesión cambia tras el login; probar que un usuario legítimo no queda bloqueado por un error honesto (falsos positivos). |
| **Despliegue** | Rate limiting **también en el borde** (WAF o proxy inverso), porque el límite por cuenta no detiene una distribución del ataque entre miles de cuentas. Registrar la IP real detrás del proxy — sin esto, todos los intentos parecen venir del mismo origen y el límite por IP es inútil. |
| **Operación** | 🔵 **Control posterior.** Alertar en tiempo real ante el patrón de ráfaga, notificar al titular de la cuenta los accesos exitosos desde dispositivos o ubicaciones no habituales, y mantener un procedimiento de respuesta: bloquear el origen, forzar el cambio de contraseña de las cuentas tocadas, revisar qué hizo la sesión si algún intento tuvo éxito. |

**Justificación.** Este escenario es el mejor ejemplo de la distinción **preventivo vs. detectivo
según la fase**. El rate limiting es preventivo y se decide en Requisitos; la alerta por ráfaga es
detectiva y vive en Operación — y son controles distintos, no el mismo visto dos veces: el primero
detiene los intentos, el segundo nos dice que **alguien nos está atacando ahora**, información que
el bloqueo silencioso no entrega.

También es el escenario donde el control de Despliegue no es un detalle de configuración sino parte
del control mismo. Cien intentos contra una cuenta son visibles; el mismo atacante repartiendo un
intento por cuenta sobre diez mil cuentas (*password spraying*) no dispara ningún contador por
cuenta, y solo el límite por origen en el borde lo alcanza. Es la razón por la que este riesgo
necesita controles en fases que a primera vista parecían ajenas al problema.

---

### Escenario E · Alta de grupos y asignación docente *(extensión del equipo)*

> El jefe de carrera modifica la asignación profesor↔grupo, sin registro del cambio y sin
> restricción de periodo. *(Continúa el escenario 5 de SC-LAB-001.)*

| Fase | Actividad de seguridad |
|---|---|
| **Requisitos** | 🟢 **Control temprano.** Declarar que la asignación docente es un **activo del que depende un control** y no un dato administrativo más. Definir que el alcance del jefe de carrera se limita a su propio programa, que el periodo se cierra en una fecha y que después solo se modifica con autorización superior y motivo obligatorio. Definir la separación de funciones respecto a la captura de calificaciones. |
| **Diseño** | Modelar la asignación con **versiones y vigencia** (desde/hasta) en vez de un campo actualizable, de modo que la historia sea parte del modelo de datos y no un añadido. Diseñar el cierre de periodo como una máquina de estados y el alcance del jefe como una restricción por programa, no global. |
| **Desarrollo** | Implementar la bitácora *append-only* de altas y cambios con autor, fecha, valor anterior y valor nuevo, escrita en la misma transacción que el cambio. Validar choques de horario, aula y carga docente al guardar. Impedir que la misma cuenta asigne profesores y capture calificaciones. |
| **Pruebas** | Verificar que ningún cambio de asignación puede completarse sin su entrada en bitácora; que un jefe no alcanza grupos de otro programa; que un cambio sobre un periodo cerrado se rechaza sin autorización; y que una cuenta con ambos permisos es rechazada por la regla de separación de funciones. |
| **Despliegue** | Bitácora en almacén de solo inserción, fuera del alcance de escritura de la aplicación. Reloj sincronizado. Respaldos con retención suficiente para cubrir un semestre completo, porque el fraude de este escenario se detecta tarde por naturaleza. |
| **Operación** | 🔵 **Control posterior — y control principal del escenario.** Alertar cuando un profesor recién asignado capture calificaciones de forma inmediata, y cuando una asignación se revierta poco después de crearse. Revisión periódica de la bitácora de asignaciones contra el calendario académico. |

**Justificación — por qué aquí el control principal cae en Operación.** En todos los demás
escenarios el control de mayor peso está en Requisitos o Diseño. Este es la excepción, y la razón es
la que ya identificamos en SC-LAB-001: el ataque **no rompe ningún control, los usa**. El jefe de
carrera asignándose un grupo está haciendo literalmente su trabajo; la verificación del escenario C
consulta la asignación, encuentra que sí existe y responde correctamente que sí está autorizado.
Cada control individual funciona y el resultado sigue siendo fraudulento.

Contra un actor que opera dentro de sus atribuciones formales, la prevención tiene poco margen sin
quitarle su función legítima. Lo que queda es que el paso intermedio sea **visible, atribuible e
irreversible en el registro** — y eso es detección, no prevención. Los dos controles preventivos que
sí aplican (separación de funciones y cierre de periodo) no le quitan al jefe su trabajo: le quitan
la posibilidad de **encadenarlo** con la captura de calificaciones y de aplicarlo sobre el pasado.

Esto no contradice el Shift Left, lo matiza: la *decisión* de auditar se toma en Requisitos, el
mecanismo se construye en Diseño y Desarrollo, pero **el control solo actúa en Operación**, cuando
alguien lee la bitácora o cuando la alerta se dispara. Una bitácora que nadie revisa no es un
control, es un archivo.

---

## 5. Clasificación conceptual

Cinco decisiones del mapa, clasificadas según el concepto que mejor las representa. Incluimos más de
las dos que pide el manual para cubrir los cuatro conceptos y, sobre todo, para contrastar pares que
se confunden entre sí.

| # | Decisión | Concepto | Justificación |
|---|---|---|---|
| **1** | El acceso a datos pasa obligatoriamente por una capa que recibe *quién pide* junto con *qué pide*; no existe una firma de consulta que acepte solo el identificador. | **Security by Design** | No es una validación agregada: es la **estructura** la que impide expresar el acceso inseguro. Un desarrollador no puede omitir la verificación porque el código no compila sin el contexto del solicitante. Si fuera *by default*, el acceso sin verificar seguiría siendo escribible y solo estaría desactivado de origen — la diferencia es entre *no se puede* y *viene apagado*. |
| **2** | Un endpoint sin regla de autorización declarada responde 403 (*deny by default*). | **Security by Default** | El sistema **sí admite** configurar mal un endpoint; lo que garantiza el default es que la **ausencia de decisión** caiga del lado seguro. Protege contra el olvido, que es el modo real en que estos fallos llegan a producción, no contra una decisión equivocada. Por eso es *by default* y no *by design*. |
| **3** | El criterio de aceptación *"estudiante que pide perfil ajeno → 403"* se escribe en la historia de usuario y se automatiza como prueba en CI. | **Shift Left** | La actividad —verificar la autorización— existía ya, pero ocurría en la auditoría previa a producción. Lo que cambia es **cuándo**: se mueve a Requisitos y Pruebas tempranas. No añade un control nuevo, adelanta uno existente al momento en que corregirlo cuesta una línea en vez de un rediseño. |
| **4** | Existen actividades de seguridad con entregable verificable en las seis fases, incluidas Despliegue y Operación, y ninguna se considera opcional. | **Secure SDLC** | Es el **marco de proceso**, no una medida técnica: lo que se afirma es que la seguridad es una responsabilidad continua del ciclo de vida. Nótese que es lo que impide que el punto 3 degenere: Shift Left adelanta actividades, Secure SDLC garantiza que adelantarlas no signifique **vaciar** las fases finales. |
| **5** | La bitácora de asignaciones docentes se escribe en un almacén de solo inserción, fuera del alcance de escritura de la aplicación. | **Security by Design** (con efecto en Operación) | La propiedad que buscamos —que el registro no pueda alterarse— no se obtiene programando "no borres los logs", sino **quitando el permiso de borrado**, que es una decisión estructural de diseño y despliegue. Es también el ejemplo de que un control *by design* puede tener su utilidad concentrada en una fase tardía: el diseño lo hace confiable, la operación lo hace útil. |

---

## 6. Reflexión

### 6.1 ¿Qué riesgo de SC-LAB-001 necesitó controles en más fases?

El **modelo de autorización** (escenario 4 de SC-LAB-001: roles y permisos), y por una razón que no
es de volumen sino de naturaleza: es la **causa raíz común** de los demás escenarios. Los escenarios
0, 1, 2 y 5 son manifestaciones del mismo error —la autorización se asume, se delega al cliente o se
resuelve con el rol en vez de con la relación usuario↔recurso— aplicado a activos distintos. Un
riesgo transversal necesita controles transversales.

Su recorrido cubre las seis fases sin que ninguna sea prescindible: se **define** en Requisitos (qué
puede hacer cada rol sobre qué recurso), se **estructura** en Diseño (la relación, no el rol, decide),
se **implementa** en Desarrollo (servidor, cada endpoint, *deny by default*), se **verifica** en
Pruebas (casos negativos por rol y por relación), se **protege** en Despliegue (la bitácora de
cambios de permisos fuera del alcance de la aplicación) y se **mantiene** en Operación (revisión
periódica y revocación al término de un nombramiento).

La autenticación (escenario 3) le sigue de cerca y tiene un contraste útil: también recorre las seis
fases, pero sus controles son **más añadibles**. Se puede poner rate limiting delante de un endpoint
existente sin tocar el resto del sistema; no se puede agregar autorización por recurso sin revisar
cada consulta escrita. Esa diferencia —no cuántas fases toca, sino cuánto cuesta llegar tarde— es
la que realmente ordena las prioridades, y es el tema de SC-LAB-003.

### 6.2 ¿Qué habría ocurrido si el equipo hubiera esperado hasta pruebas?

Depende del control, y esa diferencia es el hallazgo:

- Para el **rate limiting** (D), casi nada. Se agrega en pruebas, se despliega y funciona. Es un
  control periférico: se coloca delante de un endpoint y el resto del sistema no se entera.
- Para la **autorización por recurso** (guiado, A, C), el resultado es distinto. En pruebas ya
  existen decenas de consultas escritas como "dame el registro 126". Corregirlo obliga a revisar
  **cada acceso a datos del sistema**, y basta olvidar uno para que el hueco siga abierto — con el
  agravante de que la suite en verde produce la impresión de que está cerrado.
- Para los **documentos** (A), el problema escala fuera del código: ya hay archivos almacenados con
  nombres predecibles en una ruta pública. No basta cambiar la ruta de entrega, hay que **migrar lo
  ya subido** y asumir que lo que estuvo expuesto pudo haberse descargado.
- Para el **token en un commit** (B), esperar a pruebas es directamente inútil: el secreto ya está
  en el historial y ya debe rotarse. Descubrirlo tarde no cambia la corrección, cambia el **tiempo
  de exposición**, que es lo único que estaba en juego.
- Para la **bitácora** (C, E), es el peor caso: no es que sea caro implementarla tarde, es que **no
  existe registro del periodo anterior**. La información que necesitaríamos para investigar ya no se
  generó y no hay forma de recuperarla.

La lección es que "esperar hasta pruebas" no tiene un costo uniforme. Barato para los controles que
se añaden delante, caro para los que atraviesan la arquitectura, e **irrecuperable** para los que
producen evidencia: rate limiting y antivirus se pueden posponer; autorización por recurso y
bitácoras, no.

### 6.3 ¿Qué control depende de una regla de negocio y cuál puede automatizarse?

| Depende de una regla de negocio | Automatizable |
|---|---|
| **Quién puede ver qué.** Que un profesor solo capture calificaciones de *sus* grupos *en el periodo vigente* no se deduce del código: alguien de la institución debe decidirlo, y cambia con el reglamento. | **Escaneo de secretos** en pre-commit y CI. Un token tiene una forma reconocible; no hay que preguntarle a nadie si debe estar ahí. |
| **El alcance del jefe de carrera.** Que se limite a su programa y no sea global es una decisión organizativa. Un sistema en otra universidad podría definirlo distinto y seguiría siendo correcto. | **Análisis de dependencias** contra bases de vulnerabilidades conocidas. La respuesta es objetiva y verificable sin contexto institucional. |
| **La separación de funciones.** Que quien asigna profesores no capture calificaciones es una decisión de control interno. Técnicamente nada lo impide; lo impide el reglamento. | **Análisis estático y cabeceras de seguridad.** Detectar consultas sin filtro de sesión, `HttpOnly` ausente o el modo depuración activo en producción son verificaciones mecánicas. |
| **Qué es un cambio "retroactivo" y quién lo autoriza.** Requiere un calendario académico y una jerarquía definidos fuera del sistema. | **Ejecución de la prueba negativa.** Una vez que la regla existe ("perfil ajeno → 403"), verificarla en cada build es puramente mecánico. |

La frontera está en **quién conoce la respuesta correcta**. Si la respuesta está en el reglamento
institucional, la regla la define una persona y el sistema solo la aplica; si la respuesta es la
misma en cualquier universidad, se automatiza.

Hay un matiz que conviene no perder: la regla de negocio se **define** manualmente, pero una vez
escrita su **verificación se automatiza**. "Un profesor solo captura en sus grupos" es una decisión
humana; comprobar en cada build que el sistema la respeta es una prueba automática. Confundir ambas
lleva a dos errores opuestos: creer que una herramienta puede decidir la política, o creer que una
política escrita se verifica sola.

---

## 7. Trazabilidad SC-LAB-001 → SC-LAB-002

| # | Escenario de SC-LAB-001 | Riesgo | Fase del control principal | Fase del control complementario indispensable |
|---|---|---|---|---|
| 0 | Perfiles *(guiado)* | Alto | Diseño — acceso por relación usuario↔recurso | Pruebas — caso negativo automatizado en CI |
| 1 | Calificaciones | Alto | Diseño — relación profesor↔grupo↔periodo | Operación — bitácora y aviso al estudiante |
| 2 | Documentos | Alto | Diseño — entrega mediada desde almacén privado | Despliegue — el servidor web no publica la carpeta |
| 3 | Autenticación | Crítico | Requisitos — política de intentos, MFA y contraseñas | Despliegue — rate limiting en el borde |
| 4 | Roles y permisos | Crítico | Diseño — autorización en servidor, *deny by default* | Las seis; es el riesgo transversal (§6.1) |
| 5 | Asignación docente | Alto | **Operación** — bitácora revisada y alertas | Requisitos — alcance por programa y cierre de periodo |
| — | Token en un commit *(nuevo)* | Alto | Desarrollo — hook de pre-commit y `.gitignore` | Operación — rotación del secreto expuesto |

Dos lecturas que deja la tabla. La primera: **Diseño concentra la mayoría de los controles
principales**, lo que confirma la conclusión de SC-LAB-001 (§5.4) de que estos controles son
decisiones de arquitectura y no capas que se agregan. La segunda: la columna de la derecha muestra
que **ningún control principal se sostiene solo**, y que su complemento suele vivir en una fase
alejada — el de Documentos depende de Despliegue, el de Calificaciones de Operación. Un mapa que
solo registrara la fase principal daría una falsa sensación de cobertura.

---

## 8. Criterios de aceptación

- [x] El mapa cubre las seis fases *(actividad guiada §3 y los cinco escenarios del reto §4)*.
- [x] Los controles corresponden al escenario y no son frases genéricas *(cada fase indica la acción concreta y su evidencia verificable)*.
- [x] Se distingue autenticación de autorización cuando aplica *(§1 y escenarios C y D: D atiende la autenticación, C la autorización, y el §6.1 explica por qué sus costos de corrección difieren)*.
- [x] El archivo está en la ruta solicitada: `docs/security/SC-LAB-002-secure-sdlc-map.md`.
- [x] El commit describe la evidencia y sigue el flujo `git status → git diff → git add → git diff --staged → git commit → git push`.

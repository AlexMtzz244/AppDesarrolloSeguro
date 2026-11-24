# SC-LAB-007 · Evidencias y reflexión

Ejecutado el 2026-11-24 en `http://127.0.0.1:5000` con Microsoft Edge. Código
tal como se entregó en `SC-LAB-007_Guia_Interactiva.zip`, sin cambios en `src/`
ni en `tests/`.

## Resultados (experiencias A–D)

Salida completa: [`experiencias_guiadas.txt`](evidencias/experiencias_guiadas.txt).

| Caso | Acción | Esperado | Obtenido | Captura |
|---|---|---|---|---|
| — | GET 3/10 sin sesión | 401 | 401 | — |
| A3 | Ana, GET 3/10 (su grupo) | 200 | 200 | [01](evidencias/capturas/01_rest_get_200.png) |
| A4 | Ana, GET 4/20 (grupo ajeno) | 403 | 403 | [02](evidencias/capturas/02_rest_get_403.png) |
| B2–B3 | Ana, PUT 3/10 = 88.50 y GET de comprobación | 200 | 200 | [03](evidencias/capturas/03_rest_put_verificado.png) |
| B4 | Ana, PUT 4/20 | 403 | 403 | — |
| B5 | Ana, PUT 3/10 = 150 | 400 | 400 | [04](evidencias/capturas/04_rest_put_400.png) |
| C3 | Eli, GET 3/10 (la suya) | 200 | 200 | — |
| C4 | Eli, GET 4/20 (la de Paz) | 403 | 403 | — |
| C5 | Eli, PUT 3/10 (la suya) | 403 | 403 | [05](evidencias/capturas/05_estudiante_put_403.png) |
| D1 | Eli, GraphQL 3/10 | 200 | 200 | [06](evidencias/capturas/06_graphql_200.png) |
| D2 | Eli, GraphQL 4/20 | 403 | 403 | [07](evidencias/capturas/07_graphql_403.png) |
| D3 | Eli, GraphQL pidiendo solo `grade` | 200 | 200, solo `grade` | [08](evidencias/capturas/08_graphql_campos.png) |

Pruebas: **18 aprobadas** ([`pytest_final.txt`](evidencias/pytest_final.txt),
[captura](evidencias/capturas/09_pytest.png)). Dependencias: `pip_audit` sin
vulnerabilidades conocidas ([`pip_audit.txt`](evidencias/pip_audit.txt)).

## Preguntas de las experiencias

**A. ¿Qué cambia entre ambas solicitudes? ¿Por qué no basta la autenticación?**
La sesión es la misma; cambia el recurso. Ana imparte el grupo 10, no el 20. La
autenticación dice quién es; que pueda ver 4/20 depende de su relación con ese
grupo, y el servidor la comprueba en cada petición.

**C. ¿Por qué ser dueña de una calificación no autoriza a cambiarla?** Leer y
modificar son permisos distintos. Eli es la titular del dato, pero asignarlo
corresponde a quien imparte el grupo.

## Reflexión

1. **¿Qué significan 200, 400, 401 y 403?** 200: se procesó. 400: la entrada no
   es válida (calificación 150). 401: no hay sesión válida. 403: hay sesión,
   pero no permiso.
2. **¿Iniciar sesión es tener autorización?** No. Iniciar sesión comprueba la
   identidad; la autorización decide si esa identidad puede hacer esta acción
   sobre este recurso. Ana inició sesión y aun así recibió 403 en 4/20.
3. **¿Por qué no debe bastar cambiar los identificadores?** Porque el cliente
   controla los IDs de la URL. Si el servidor confiara en ellos, cualquiera
   recorrería las calificaciones de los demás (IDOR).
4. **¿Qué cambia entre REST y GraphQL?** En REST la ruta identifica el recurso y
   la respuesta es fija; en GraphQL la consulta elige recurso y campos, y la
   respuesta llega en `data` o `errors`. La regla de permisos es la misma.
5. **¿Y si GraphQL omitiera los permisos?** Sería una puerta lateral: REST
   negaría 4/20 y GraphQL lo entregaría. El control vale lo que su vía más débil.

## Observación sobre el código entregado

En `src/app.py`, `graphql_endpoint` reasigna en cada petición
`schema.get_type('Query').fields['grade'].resolve` sobre un `schema` compartido,
y ese resolver captura al usuario de la petición. El servidor de Flask atiende
en varios hilos: con dos peticiones simultáneas, una podría ejecutarse con el
resolver, y por tanto con los permisos, de la otra. Es una conclusión de leer el
código; no se reprodujo. No se corrigió porque la guía pide consultar a la
profesora antes de modificar el código. Corrección propuesta: un resolver fijo
que reciba el usuario por `context_value`.

## Relación con la aplicación SecureCampus

La app principal (NestJS) ya aplica lo equivalente en REST: permisos por
relación, códigos 200/400/401/403 y defensa CSRF por origen
(`apps/api/src/autorizacion/origen.guard.ts`,
`apps/api/test/sc-lab-007-008.int.spec.ts`). No expone GraphQL.

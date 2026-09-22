# ADR-007 — Entrega privada de documentos y flujo de cuarentena

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 21 de septiembre de 2026 |
| **Requisitos** | RF-050 a RF-055, RNFS-040 a RNFS-046 |
| **Origen** | SC-LAB-001 escenario 2 · SC-LAB-002 escenario A · SC-LAB-003 §5 |

## Contexto

SC-LAB-001 escenario 2 llega a una conclusión que condiciona todo el diseño:

> "el servidor web entrega el archivo **antes** de que la aplicación
> intervenga: no hay ningún punto donde se pueda comprobar la sesión. Por eso
> el control no es 'agregar una validación', sino **cambiar la ruta de
> entrega**: mientras el archivo sea alcanzable directamente, cualquier
> verificación añadida en la aplicación es evitable."

Y SC-LAB-003 §5 lo analiza como el escenario más caro de corregir tarde, por
ser el único que **acumula datos reales**: en requisitos el control es gratuito
porque el almacén está vacío; en producción se convierte en un proyecto de
migración con una parte que no se corrige —si las rutas fueron públicas, no hay
forma de saber qué se descargó.

## Decisión

### Almacenamiento privado, sin URLs prefirmadas

Bucket privado en MinIO (S3-compatible). `AlmacenamientoService` **no genera
URLs prefirmadas**, y eso es deliberado: una URL prefirmada es un permiso que
viaja por su cuenta. Quien la reciba puede reenviarla, y el archivo sale del
sistema sin volver a pasar por ninguna verificación.

Todo el contenido se sirve por *streaming* a través del endpoint de la API.

### Autorizar antes de leer

El orden en `descargar` es: la política resuelve la relación → el servicio
registra la descarga → **entonces** se lee el objeto. Si se leyera primero, un
fallo posterior en la verificación ya habría sacado el archivo del almacén.

### Claves de objeto aleatorias

32 bytes aleatorios, sin matrícula, sin nombre de archivo, sin tipo. El fallo
original era `/uploads/constancia_2026_125.pdf`; una prueba de integración
verifica que ninguna clave contenga la matrícula de su titular.

El nombre original sobrevive solo como metadato, y se sanea antes de ponerlo
en la cabecera `Content-Disposition`: lo eligió quien subió el archivo, y una
comilla sin filtrar permitiría inyectar cabeceras.

### Tipo real por magic bytes

`file-type` sobre el contenido, con lista blanca. La extensión y el
`Content-Type` los controla quien sube el archivo; confiar en ellos es el mismo
error que confiar en el identificador de la URL.

Cuando lo declarado no coincide con lo real, la discrepancia se registra en la
bitácora aunque el archivo se rechace: es señal de que alguien lo renombró a
propósito.

### Cuarentena, y `error-analisis` no es limpio

Todo archivo entra al bucket de cuarentena, se analiza con ClamAV y solo se
mueve al definitivo si el veredicto es `limpio`.

Si el antivirus no responde, el veredicto es `error-analisis` y el documento
**no se entrega**. Tratar el fallo como "limpio" convertiría una caída del
servicio en una vía para colar cualquier archivo. Es *deny by default* aplicado
al contenido.

### Reescaneo periódico

Un trabajo diario reanaliza los documentos **ya marcados como limpios**, que es
justamente el punto: SC-LAB-002 escenario A lo formula como "el archivo no
cambia, cambia lo que sabemos sobre él".

El reescaneo **no** marca los documentos como pendientes por adelantado. Solo
cambia el estado si el veredicto cambia. Lo contrario dejaría el expediente de
todo el mundo inaccesible cada madrugada, convirtiendo un control de seguridad
en una denegación de servicio contra los usuarios legítimos.

## Consecuencias

**A favor.** No existe ninguna ruta que entregue un archivo sin pasar por la
autorización. Cada descarga y cada denegación quedan registradas con
solicitante, titular, documento, resultado y motivo.

**En contra.** La API transporta todo el contenido, así que el ancho de banda
pasa por ella. Es el precio directo de no emitir URLs que escapen al control, y
se asume conscientemente.

**Configurable, no inventado.** Formatos, tamaño máximo y cuota son D-04, con
valores por defecto seguros pendientes de aprobación por servicios escolares.

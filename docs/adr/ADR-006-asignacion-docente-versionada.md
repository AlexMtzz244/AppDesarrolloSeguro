# ADR-006 — Asignación docente versionada y cierre de periodo

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 21 de septiembre de 2026 |
| **Requisitos** | RF-030 a RF-033, RNFS-007 |
| **Origen** | SC-LAB-001 escenario 5 · SC-LAB-002 escenario E |

## Contexto

Esta ADR responde al escenario más difícil del análisis, y conviene citarlo
entero porque su dificultad es de naturaleza, no de grado:

> "El jefe (o quien controle su cuenta) se asigna como profesor del grupo
> `ISC-601`, entra al módulo de calificaciones —donde la verificación del
> escenario 1 **responde correctamente que sí está autorizado**—, modifica las
> notas y revierte la asignación. El sistema queda en un estado final
> consistente y sin rastro del paso intermedio."

El ataque **no rompe ningún control: los usa**. Cada verificación individual
responde bien y el resultado sigue siendo fraudulento, porque el dato sobre el
que se apoya la verificación es manipulable.

De ahí la regla que SC-LAB-001 §5.5 deriva y que gobierna esta ADR: **si un
control se apoya en un dato, ese dato hereda la criticidad del control**.

## Decisión

### La asignación es un historial, no un campo

No existe `grupo.profesorId`. Existe `AsignacionDocente` con `version`,
`desdeEl`, `hastaEl`, `autorId` y `motivo`. Cambiar de profesor **cierra** la
vigencia actual y **abre** una fila nueva; nunca sobrescribe.

`AsignacionesService` no tiene método `actualizar`. La ausencia es la decisión.

Un índice único parcial garantiza una sola asignación vigente por grupo: sin
él, una condición de carrera podría dejar dos abiertas, y "el grupo pertenece a
la asignación vigente del profesor" dejaría de significar algo.

### Separación de funciones, evaluada al asignar

`PARES_INCOMPATIBLES` declara que `asignacion-docente:crear` no puede coexistir
con `calificacion:crear`, `:publicar` ni `:corregir`. Se evalúa **al otorgar el
permiso**, no al usarlo, y sobre los permisos **acumulados** del usuario: dos
roles inocuos por separado pueden sumar la combinación prohibida, y ese es el
camino por el que estas cosas se cuelan.

Se añade una comprobación directa: el jefe no puede asignarse a sí mismo.

### Cierre de periodo como máquina de estados

`Periodo.estado` es `abierto` o `cerrado`, con una restricción `CHECK` que
impide el estado ambiguo "cerrado sin constancia de cuándo". Un cambio
retroactivo exige `AutorizacionExtraordinaria`: una entidad con vigencia y de
un solo uso, no una bandera en la petición.

La diferencia importa. Una bandera la marca quien hace el cambio; una
autorización la concede alguien más, deja rastro y caduca.

**D-07 está pendiente**: mientras dirección académica no designe a la autoridad
superior, ninguna cuenta tiene `periodo:modificar-retroactivo` en la matriz
sembrada, y el flujo queda bloqueado. Es el valor por defecto seguro: no se
inventa una jerarquía que no existe.

## Consecuencias

**Lo que sí resuelve.** La separación de funciones y el cierre de periodo son
los dos controles preventivos que aplican sin quitarle al jefe su función
legítima: le quitan la posibilidad de **encadenarla** con la captura de
calificaciones y de aplicarla sobre el pasado.

**Lo que no resuelve, y hay que decirlo.** Un jefe que asigna a un cómplice
sigue siendo posible, porque asignar profesores es literalmente su trabajo.
Contra eso solo queda la detección — ver ADR-008. Como concluye SC-LAB-002
escenario E, este es el único escenario donde **el control principal vive en
Operación**, al revés que en todo el resto del sistema.

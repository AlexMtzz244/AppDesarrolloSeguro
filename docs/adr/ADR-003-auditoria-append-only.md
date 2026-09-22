# ADR-003 — Auditoría append-only en la misma transacción

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 21 de septiembre de 2026 |
| **Requisitos** | RNFS-030 a RNFS-033, RF-081 |
| **Origen** | SC-LAB-001 escenarios 1, 4 y 5 · SC-LAB-002 escenarios C y E |

## Contexto

SC-LAB-001 escenario 4 describe el impacto que más teme del compromiso de una
cuenta administrativa:

> "**borrado o manipulación de los logs**, lo que destruye la evidencia del
> propio ataque y hace imposible reconstruir lo ocurrido."

Y su control: "log append-only, con autor, fecha y valores anterior y nuevo,
**almacenado fuera del alcance de escritura de la aplicación**".

A eso se suma el requisito de atomicidad: una mutación sin su evento deja un
cambio sin rastro, y un evento sin su mutación describe algo que no ocurrió.

## Decisión

### La atomicidad se impone por la firma

```ts
async registrar(tx: ClienteTransaccion, datos: DatosEvento): Promise<void>
```

`ClienteTransaccion` solo se obtiene dentro de `prisma.$transaction(...)`. No
existe forma de escribir un evento fuera de una transacción: no es una
convención que haya que recordar, es que el código no compila de otra manera.

Para los eventos que **no** acompañan a una mutación —accesos denegados,
intentos fallidos— hay un método con nombre distinto,
`registrarFueraDeMutacion`. El nombre es deliberadamente incómodo: si se
llamara igual, sería cómodo usarlo por descuido junto a una mutación.

### La inmutabilidad se impone en la base

Tres capas independientes:

| Capa | Qué cubre | Qué no cubre |
|---|---|---|
| La API no expone POST/PATCH/DELETE sobre auditoría | El uso normal | A quien tenga acceso a la base |
| `REVOKE UPDATE, DELETE, TRUNCATE` al rol de aplicación | **Es el control real.** Postgres niega antes de ejecutar | Al rol propietario |
| Triggers `BEFORE UPDATE/DELETE/TRUNCATE` | Consolas de soporte, migraciones mal escritas | Se pueden borrar con el propietario |

El `REVOKE` no protege contra el propietario; el trigger se puede quitar con el
propietario. Juntas, ambas cubren los dos casos.

El trigger de `TRUNCATE` es aparte porque `TRUNCATE` no dispara triggers
`FOR EACH ROW`: sin él, una sola sentencia borraría la bitácora completa
esquivando las otras dos reglas.

### Separación de credenciales

La aplicación se conecta con `DATABASE_URL` (rol restringido) y las migraciones
con `DATABASE_URL_MIGRACIONES` (propietario). Si la app pudiera migrar, podría
revertir el `REVOKE` que la limita.

## Alternativas descartadas

**Almacén físicamente separado** (otra base, un servicio de logs). Es lo que
sugiere la lectura literal de "fuera del alcance de la aplicación", y lo
descartamos porque **rompería la atomicidad**: un evento en otro sistema no
participa de la transacción de la mutación, y entonces sí podría existir un
cambio sin bitácora. Preferimos garantizar la atomicidad y conseguir la
inmutabilidad con permisos. La separación queda como trabajo futuro mediante
replicación de solo lectura hacia un almacén externo.

**Solo el trigger.** Se puede eliminar con privilegios suficientes, que es
exactamente el escenario contra el que este control existe.

## Consecuencias

**A favor.** Nunca hay un cambio sin bitácora ni una bitácora sin cambio. El
rol de aplicación no puede alterar la evidencia ni aunque el código se
comprometa. La prueba negativa 12 lo verifica en cada build.

**En contra.** La bitácora crece sin borrado. La retención mínima es de un
semestre (D-09) y la purga, cuando se defina, la ejecutará el rol propietario
en una ventana de mantenimiento documentada, nunca la aplicación.

**Operativo.** Las pruebas de integración necesitan truncar la tabla con el rol
propietario. Que haga falta esa excepción es, en sí mismo, evidencia de que el
control está activo.

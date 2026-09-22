# ADR-001 — Autorización por relación usuario↔recurso, con *deny by default*

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 21 de septiembre de 2026 |
| **Requisitos** | RNFS-001, RNFS-002, RNFS-003, RNFS-004, RNFS-005 |
| **Origen** | SC-LAB-001 §3, §5.4 · SC-LAB-002 §5 dec. 1 y 2 · SC-LAB-003 §7.3 |

## Contexto

Las tres prácticas previas llegan, por caminos distintos, a la misma
conclusión sobre este control:

- SC-LAB-001 §5.4 lo señala como el control que **debe** definirse desde
  requisitos, porque "determina cómo se consulta cada dato".
- SC-LAB-002 §6.1 lo identifica como el riesgo que necesita controles en **las
  seis fases**, por ser la causa raíz común de los demás escenarios.
- SC-LAB-003 §7.3 lo elige como la decisión que habría sido más barata de
  corregir antes, con un criterio preciso: **su costo crece con el tamaño del
  sistema, no con el tiempo**.

El error concreto que hay que evitar aparece en los cuatro escenarios
analizados: la autorización se asume, se delega al cliente, o se resuelve con
el rol en lugar de con la relación entre el usuario y el recurso concreto.

## Decisión

Adoptamos tres reglas que se refuerzan entre sí.

### 1. La firma de la consulta exige el actor

Ninguna función que recupere un recurso protegido acepta solo un
identificador. El resolvedor recibe `ContextoRelacion`, que incluye el actor
resuelto desde la sesión:

```ts
export type ResolvedorRelacion = (ctx: ContextoRelacion) => Promise<DecisionRelacion>;
```

En `PerfilesService` no existe `obtenerPorId(id)`; existe
`obtenerPropio(usuarioId)`, donde `usuarioId` sale de la sesión. La diferencia
no es de estilo: con la primera firma, tarde o temprano algún controlador la
llama con el parámetro de la ruta.

Esto es *security by design* según la clasificación de SC-LAB-002 §5: la
estructura impide expresar el acceso inseguro.

### 2. Deny by default en el guard global

`PoliticaGuard` se registra como `APP_GUARD`. Una ruta sin `@Politica(...)`
responde **403**, no 200.

Es *security by default*, no *by design*: el sistema sí admite que alguien
declare la política equivocada. Lo que el default garantiza es que **el
olvido** —no la mala decisión— caiga del lado seguro.

Además, una prueba estructural (`politicas-declaradas.spec.ts`) recorre el
registro de rutas y falla la build si alguna carece de política. El guard evita
el hueco; la prueba evita que nadie se entere.

### 3. El actor se recalcula en cada petición

`Actor` se construye desde la sesión almacenada en servidor, y los permisos se
recalculan con filtro de vigencia en cada llamada. Nada del cuerpo, la query,
las cabeceras ni la cookie influye en la decisión.

El efecto secundario que más vale: una asignación de rol vencida deja de
aplicar sin que ningún proceso de limpieza tenga que ejecutarse.

## Alternativas descartadas

**Guard por controlador.** Protege contra decisiones equivocadas pero no contra
el olvido, que es el caso común. Un guard que hay que recordar poner es un
guard que algún día no se pone.

**Permisos en el token.** Evitaría la consulta por petición, pero la
revocación dejaría de ser inmediata: un permiso quitado seguiría funcionando
hasta que el token expirara. Un índice parcial sobre `asignacion_rol` hace la
consulta barata; un permiso revocado que sigue vivo no tiene arreglo barato.

**Autorización por rol.** Es lo que analizamos y descartamos: "el profesor del
escenario 1 es legítimamente profesor y aun así no debe poder escribir en un
grupo que no le fue asignado: el rol es correcto, la relación no"
(SC-LAB-001 §5.3).

## Consecuencias

**A favor.** Cada endpoint declara qué permiso exige y qué relación resuelve,
legible en una línea. Una ruta nueva nace protegida. La prueba estructural
convierte el olvido en una build roja.

**En contra.** Cada petición autenticada hace una consulta de permisos y, casi
siempre, otra de relación. Se mitiga con índices parciales, y es un costo
aceptable: cachear en el cliente reintroduciría exactamente la vulnerabilidad
(b) del escenario 4.

**Lo que no resuelve.** La autorización correcta puede apoyarse en un dato
manipulable. Es el escenario 5 de SC-LAB-001: el ataque no rompe este control,
lo usa. Por eso existe ADR-006 (asignación versionada) y por eso hay alertas
detectivas — ver ADR-008.

# ADR-002 — Sesión opaca en cookie, no JWT

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 21 de septiembre de 2026 |
| **Requisitos** | RNFS-011 a RNFS-014 |
| **Origen** | SC-LAB-001 escenario 3 · SC-LAB-003 §3, criterio (f) |

## Contexto

SC-LAB-003 §3 analiza los siete criterios que faltaban en RF-010 y señala cuál
es el más caro de agregar tarde:

> "Conviene notar cuál de los criterios faltantes es el más caro de agregar
> tarde: **invalidar las sesiones activas** (f). Los otros seis se resuelven
> dentro del flujo de recuperación; ese exige que el sistema sepa enumerar y
> revocar las sesiones de un usuario, lo que es una decisión de arquitectura de
> sesión."

Esa frase decide esta ADR antes de discutir nada más.

## Decisión

La sesión es un valor aleatorio de 32 bytes sin significado, entregado en una
cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Del token se almacena **solo el
hash SHA-256**.

Se implementan tres capacidades que un token autocontenido no permite:

1. **Revocación individual** (RF-006) — el usuario cierra una sesión concreta.
2. **Revocación global** (RNFS-014) — el cambio de contraseña avanza
   `usuario.sesionesValidasDesde`, invalidando todas las sesiones emitidas
   antes sin recorrerlas una por una.
3. **Rotación** (RNFS-013) — no existe ninguna ruta de código que reutilice un
   identificador previo, así que la fijación de sesión no es representable.

Se usa SHA-256 y no Argon2 porque el token tiene 256 bits de entropía real: no
hay nada que adivinar por fuerza bruta, y Argon2 solo añadiría latencia a cada
petición.

## Alternativas descartadas

**JWT firmado.** Evita la consulta por petición, pero **no se puede revocar**
sin montar de todos modos una lista de revocación en servidor — es decir, sin
reinventar la sesión con más piezas. Y el criterio (f) es innegociable.

**JWT corto + refresh token.** Reduce la ventana de exposición a minutos, pero
sigue habiendo una ventana. Contra un intruso ya dentro, "cierra en cinco
minutos" no es lo mismo que "cierra ahora".

## Consecuencias

**A favor.** Revocación inmediata y real. Un XSS no roba la sesión (`HttpOnly`).
Un volcado de la base no entrega sesiones utilizables. `SameSite=Lax` da
protección CSRF para POST entre sitios sin romper el retorno desde el enlace
de recuperación.

**En contra.** Una consulta a Postgres por petición autenticada, mitigada con
un índice parcial sobre sesiones activas. La escritura de `ultimaActividadEl`
se agrupa con granularidad de un minuto: la ventana de inactividad es de
decenas de minutos, así que un minuto de imprecisión no debilita el control.

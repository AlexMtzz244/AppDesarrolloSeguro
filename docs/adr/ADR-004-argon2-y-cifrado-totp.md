# ADR-004 — Argon2id para contraseñas, AES-256-GCM para el secreto TOTP

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 21 de septiembre de 2026 |
| **Requisitos** | RNFS-010, RNFS-016, RNFS-017 |
| **Origen** | SC-LAB-001 escenario 3 |

## Decisión

**Contraseñas: Argon2id** vía `@node-rs/argon2`, con parámetros configurables
(`ARGON2_MEMORIA_KIB`, `ARGON2_ITERACIONES`, `ARGON2_PARALELISMO`).

Se elige `@node-rs/argon2` sobre `argon2` por una razón práctica: el primero
trae binarios precompilados y el segundo compila con node-gyp, que es
justamente donde falla en las máquinas Windows del equipo. Una dependencia que
no instala termina sustituida por una peor.

**Política de contraseñas:** mínimo 12 caracteres, **sin** clases obligatorias
de caracteres y **sin** rotación periódica.

- Sin clases: producen contraseñas como `Password1!` —que cumple toda regla y
  está en cualquier diccionario— y penalizan las frases largas, que son más
  fuertes.
- Sin rotación: SC-LAB-001 §4 lo argumenta como decisión deliberada, "la
  evidencia actual indica que empuja a los usuarios a variaciones predecibles y
  debilita el conjunto; es preferible invertir ese esfuerzo en MFA".

**Señuelo de latencia.** Cuando el correo no corresponde a ninguna cuenta se
verifica contra un hash precalculado. Sin esto, responder a un correo
inexistente sería instantáneo y responder a uno válido tardaría lo que tarda
Argon2 — una diferencia de cientos de milisegundos que basta para enumerar
cuentas midiendo tiempos. Se combina con un piso de latencia uniforme
(`LOGIN_LATENCIA_MINIMA_MS`).

**Secreto TOTP: AES-256-GCM.** Se elige GCM y no CBC porque es cifrado
autenticado: si alguien altera el texto cifrado en la base, el descifrado falla
en vez de producir un secreto distinto y silenciosamente incorrecto.

Los códigos de recuperación de MFA se almacenan **hasheados**, como
contraseñas, porque eso son: quien los tenga puede saltarse el segundo factor.

## Consecuencias

Cada intento de login cuesta una derivación Argon2 completa, exista o no la
cuenta. Es caro a propósito, y por eso el límite de intentos se evalúa **antes**
de tocar la base: sin ese orden, un ataque automatizado convertiría nuestro
propio control en una vía de denegación de servicio.

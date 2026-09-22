# ADR-005 — Monorepo pnpm y frontera web↔api

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 21 de septiembre de 2026 |
| **Origen** | Prompt maestro SC-PROMPT-001, sección STACK OBLIGATORIO |

## Decisión

Monorepo con `pnpm workspaces`: `apps/web`, `apps/api` y **un solo** paquete
compartido, `packages/contracts`.

El prompt maestro pide packages compartidos "cuando reduzcan duplicación real".
Bajo ese criterio se descartaron paquetes de `tsconfig` y `eslint-config`: dos
aplicaciones no justifican la indirección, y un `tsconfig.base.json` en la raíz
cumple lo mismo.

### Qué comparte `contracts`, y qué no

Comparte **formas de datos**: el catálogo de permisos, los esquemas Zod de cada
operación, los tipos de respuesta. El formulario del navegador y el DTO del
servidor validan con la misma regla, lo que evita la divergencia clásica en la
que el cliente acepta algo que el servidor rechaza, o peor, al revés.

**No comparte confianza.** El servidor vuelve a validar exactamente lo mismo,
porque todo lo que viene del navegador es editable por el usuario. La
validación del cliente es cortesía; la del servidor es el control.

El mismo principio aplica al catálogo de permisos: el frontend lo conoce para
decidir qué dibuja, y eso no autoriza nada (RNFS-063).

### Sistema de módulos

`contracts` emite CommonJS. NestJS es considerablemente más estable en CJS, y
Next.js consume ambos formatos sin problema. Es una decisión de robustez
operativa, no de preferencia.

## Consecuencias

Un cambio en el vocabulario de permisos rompe la compilación de ambas
aplicaciones a la vez, que es el comportamiento deseado: un permiso renombrado
en el servidor y olvidado en el cliente produciría un menú que muestra opciones
que siempre devuelven 403.

# syntax=docker/dockerfile:1

# Imagen de la API.
#
# El detalle de seguridad es el usuario no-root de la etapa final: si alguien
# logra ejecucion de codigo en el contenedor, no la obtiene como root. Es
# minimo privilegio aplicado al proceso, la misma idea que el rol restringido
# de Postgres.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS desarrollo
# En desarrollo el codigo llega por volumen; aqui solo viven las dependencias.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
# `postinstall` de la API ejecuta `prisma generate`, que necesita el esquema.
COPY apps/api/prisma ./apps/api/prisma/
# `contracts` se compila en su propio `postinstall` (tsc), asi que necesita su
# codigo y el tsconfig base ANTES de `pnpm install`; con solo package.json
# la instalacion falla con TS5058 (SC-LAB-009).
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @securecampus/contracts build && pnpm --filter api db:generar
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "dev"]

FROM base AS construccion
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
# `postinstall` de la API ejecuta `prisma generate`, que necesita el esquema.
COPY apps/api/prisma ./apps/api/prisma/
# `contracts` se compila en su propio `postinstall` (tsc), asi que necesita su
# codigo y el tsconfig base ANTES de `pnpm install`; con solo package.json
# la instalacion falla con TS5058 (SC-LAB-009).
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts/
RUN pnpm install --frozen-lockfile
COPY . .
# Poda a dependencias de produccion. `pnpm prune --prod` NO sirve en este
# monorepo: solo considera las dependencias del paquete raiz (que no tiene) y
# deja node_modules vacio. Reinstalar con --prod si conserva lo de produccion,
# incluido el cliente de Prisma ya generado. `--filter "api..."` limita la
# instalacion a la API y sus dependencias internas: sin el, la imagen de la API
# cargaba tambien Next.js y las demas dependencias de la web (1,2 GB en lugar de
# 0,5 GB). `CI=true` evita la confirmacion
# interactiva (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY) y `--ignore-scripts` el
# `prepare` raiz (husky), que ya no existe sin devDependencies.
RUN pnpm --filter @securecampus/contracts build \
 && pnpm --filter api db:generar \
 && pnpm --filter api build \
 && CI=true pnpm install --frozen-lockfile --prod --ignore-scripts --filter "api..."

FROM node:22-bookworm-slim AS produccion
ENV NODE_ENV=production
# La imagen solo ejecuta `node`; npm y npx no se usan en tiempo de ejecucion y
# traen sus propias dependencias (brace-expansion, pacote, picomatch, sigstore...)
# con CVE de severidad alta que Trivy reporta en la imagen. Quitarlos elimina
# esas alertas y deja menos herramientas para quien logre ejecutar codigo (SC-LAB-009).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
WORKDIR /app
COPY --from=construccion /app/node_modules ./node_modules
COPY --from=construccion /app/apps/api/dist ./apps/api/dist
COPY --from=construccion /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=construccion /app/apps/api/prisma ./apps/api/prisma
# El enlace de workspace `@securecampus/contracts` apunta a esta carpeta y Node
# resuelve el paquete por su package.json (`main`): sin el, la API no arranca con
# "Cannot find module '@securecampus/contracts'" (SC-LAB-009).
COPY --from=construccion /app/packages/contracts/package.json ./packages/contracts/package.json
# contracts importa `zod`: su propio node_modules (enlace al almacen de pnpm) tambien
# tiene que viajar.
COPY --from=construccion /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=construccion /app/packages/contracts/dist ./packages/contracts/dist
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

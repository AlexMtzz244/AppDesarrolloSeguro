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
COPY packages/contracts/package.json ./packages/contracts/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @securecampus/contracts build && pnpm --filter api db:generar
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "dev"]

FROM base AS construccion
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @securecampus/contracts build \
 && pnpm --filter api db:generar \
 && pnpm --filter api build \
 && pnpm prune --prod

FROM node:22-bookworm-slim AS produccion
ENV NODE_ENV=production
WORKDIR /app
COPY --from=construccion /app/node_modules ./node_modules
COPY --from=construccion /app/apps/api/dist ./apps/api/dist
COPY --from=construccion /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=construccion /app/apps/api/prisma ./apps/api/prisma
COPY --from=construccion /app/packages/contracts/dist ./packages/contracts/dist
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

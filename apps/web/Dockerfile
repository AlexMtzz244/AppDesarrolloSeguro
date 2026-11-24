# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS desarrollo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
# `contracts` se compila en su propio `postinstall` (tsc), asi que necesita su
# codigo y el tsconfig base ANTES de `pnpm install`; con solo package.json
# la instalacion falla con TS5058 (SC-LAB-009).
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @securecampus/contracts build
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "dev"]

FROM base AS construccion
# NEXT_PUBLIC_* se incrusta en el JavaScript del navegador al compilar: si no se
# recibe aqui, la imagen de produccion apuntaria a localhost:3001.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
# `contracts` se compila en su propio `postinstall` (tsc), asi que necesita su
# codigo y el tsconfig base ANTES de `pnpm install`; con solo package.json
# la instalacion falla con TS5058 (SC-LAB-009).
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @securecampus/contracts build && pnpm --filter web build

FROM node:22-bookworm-slim AS produccion
ENV NODE_ENV=production
# La imagen solo ejecuta `node`; npm y npx no se usan en tiempo de ejecucion y
# traen sus propias dependencias (brace-expansion, pacote, picomatch, sigstore...)
# con CVE de severidad alta que Trivy reporta en la imagen. Quitarlos elimina
# esas alertas y deja menos herramientas para quien logre ejecutar codigo (SC-LAB-009).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
WORKDIR /app
COPY --from=construccion /app/apps/web/.next ./apps/web/.next
COPY --from=construccion /app/apps/web/public ./apps/web/public
COPY --from=construccion /app/apps/web/package.json ./apps/web/
COPY --from=construccion /app/node_modules ./node_modules
# `next` y sus dependencias se enlazan desde el node_modules DE LA WEB, no desde
# el de la raiz; sin esta copia el contenedor no encuentra Next.js (SC-LAB-009).
COPY --from=construccion /app/apps/web/node_modules ./apps/web/node_modules
USER node
EXPOSE 3000
# Se invoca el JavaScript de Next con `node`: `.bin/next` es un script de shell y
# el entrypoint de la imagen de Node lo ejecutaria con `node`, que no lo entiende.
CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web"]

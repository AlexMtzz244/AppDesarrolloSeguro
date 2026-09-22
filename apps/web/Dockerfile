# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS desarrollo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @securecampus/contracts build
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "dev"]

FROM base AS construccion
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @securecampus/contracts build && pnpm --filter web build

FROM node:22-bookworm-slim AS produccion
ENV NODE_ENV=production
WORKDIR /app
COPY --from=construccion /app/apps/web/.next ./apps/web/.next
COPY --from=construccion /app/apps/web/public ./apps/web/public
COPY --from=construccion /app/apps/web/package.json ./apps/web/
COPY --from=construccion /app/node_modules ./node_modules
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "apps/web"]

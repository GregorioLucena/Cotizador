# syntax=docker/dockerfile:1

# Imagen de la web (testing / production). Contexto: raíz del monorepo.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @cotizador/shared build \
  && pnpm --filter @cotizador/web build

FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup -S cotizador \
  && adduser -S cotizador -G cotizador

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

RUN chown -R cotizador:cotizador /app
USER cotizador

EXPOSE 3000
CMD ["node", "apps/web/server.js"]

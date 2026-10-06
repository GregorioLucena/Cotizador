# syntax=docker/dockerfile:1

# Imagen de la API (testing / production). Contexto: raíz del monorepo.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
RUN pnpm install --frozen-lockfile
COPY . .
# Re-enlaza workspaces tras copiar el código fuente.
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @cotizador/shared build \
  && pnpm --filter @cotizador/database build \
  && pnpm --filter @cotizador/api build

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      postgresql-client \
    && addgroup -S cotizador \
    && adduser -S cotizador -G cotizador

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 \
    CHROMIUM_PATH=/usr/bin/chromium-browser \
    PORT=3001

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/

RUN corepack enable \
  && pnpm install --frozen-lockfile --prod \
  && rm -rf /root/.local /root/.cache

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY scripts/docker-entrypoint-api.sh ./scripts/docker-entrypoint-api.sh

RUN chmod +x ./scripts/docker-entrypoint-api.sh \
  && mkdir -p /app/uploads \
  && chown -R cotizador:cotizador /app

USER cotizador
EXPOSE 3001
ENTRYPOINT ["sh", "/app/scripts/docker-entrypoint-api.sh"]

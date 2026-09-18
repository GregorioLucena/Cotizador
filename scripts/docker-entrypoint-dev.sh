#!/bin/sh
set -e
pnpm install --frozen-lockfile || pnpm install
pnpm run build:packages
exec "$@"

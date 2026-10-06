#!/bin/sh
set -e

# Host de Postgres: en Compose es "postgres"; en PaaS suele venir por POSTGRES_HOST / DATABASE_HOST.
DB_HOST="${POSTGRES_HOST:-${DATABASE_HOST:-postgres}}"
DB_USER="${POSTGRES_USER:-cotizador}"

echo "Esperando PostgreSQL en ${DB_HOST}..."
until pg_isready -h "${DB_HOST}" -U "${DB_USER}" > /dev/null 2>&1; do
  sleep 1
done

echo "Ejecutando migraciones..."
node /app/packages/database/dist/run-migrations.js

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Ejecutando semilla..."
  node /app/packages/database/dist/seeds/run-seed.js
fi

echo "Iniciando API..."
cd /app/apps/api
exec node dist/main.js

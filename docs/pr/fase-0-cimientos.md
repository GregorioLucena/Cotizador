# PR: Fase 0 — Cimientos del monorepo

**Rama sugerida:** `feature/fase-0-cimientos`  
**Base:** `testing`  
**Alcance:** roadmap fase 0 (`docs/02-roadmap-sdd.md`)

> Arranque del repo: el primer push puede ir a `master` y a `testing` con el mismo commit de
> cimientos. A partir de ahi, cada entrega nace de `testing` y abre PR hacia `testing`.

## Summary

- Scaffold del monorepo pnpm (`apps/api`, `apps/web`, `packages/shared`, `packages/database`).
- Docker Compose de desarrollo con PostgreSQL 16, `.env.development.example` y scripts de raiz.
- Paquete compartido: errores tipados, `OrgContext`, permisos del MVP y paginacion Zod.
- Migracion inicial con `uuid-ossp`, `pg_trgm`, `unaccent` y tablas globales (verticales, monedas, permisos, perfiles, usuarios).
- Seed idempotente: permisos, perfiles, monedas, verticales y superadmin de plataforma.
- API NestJS con TypeORM (`synchronize: false`), filtro global de errores y `GET /api/salud`.
- Web Next.js con identidad de mostrador (landing + login placeholder; auth real en fase 1).

## Test plan

- [ ] `nvm use 22` (o Node 22+)
- [ ] `pnpm install`
- [ ] Copiar `.env.development.example` → `.env.development`
- [ ] `pnpm docker:db`
- [ ] `pnpm db:migrate`
- [ ] `pnpm db:seed`
- [ ] `pnpm typecheck`
- [ ] `pnpm dev:api` → `GET http://localhost:3001/api/salud` responde `{ data: { estado, baseDatos, ... } }`
- [ ] `pnpm dev:web` → landing en `http://localhost:3000` y `/login` visible

## Fuera de este PR

Autenticacion, organizaciones, catalogo y cotizaciones (fases 1+ / specs 000–011).

# PR: Spec 000 — Plataforma y organizaciones

**Rama:** `feature/spec-000-plataforma-organizaciones`  
**Base:** `testing`  
**Spec:** `docs/specs/000-plataforma-organizaciones.md`

## Resumen

Implementa el ámbito plataforma: catálogos de verticales y monedas, alta transaccional de
organizaciones con provisionamiento del pack de vertical, edición/estado (con revocación de
sesiones al inactivar), usuario administrador inicial y métricas agregadas básicas. UI mínima bajo
`/plataforma/organizaciones`.

## Entregables

### API (`apps/api/src/organizaciones/`)
- `ProvisionamientoService`: sucursal principal, unidades, definiciones, categorías, lista General,
  configuración de cotización y plantilla con identidad
- CRUD organizaciones + `POST .../usuario-inicial` + `GET /plataforma/metricas`
- `GET /verticales` y `GET /monedas` (autenticados; activos)

### Web
- `/plataforma/organizaciones` listado
- `/plataforma/organizaciones/nueva` alta
- `/plataforma/organizaciones/:id` detalle (provisionamiento, usuarios, admin inicial, inactivar)
- `/plataforma/organizaciones/:id/editar` edición (vertical bloqueado)
- Enlace desde `/panel` si `contexto.ambito === PLATAFORMA`

### Docs
- Spec 000 → «En implementacion»
- Roadmap fase 1 actualizado

## Cómo probar

```powershell
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Login plataforma (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) → panel → Administrar organizaciones
→ Nueva organización.

## Checklist

- [x] Provisionamiento atómico (todo o nada)
- [x] Códigos `ORGANIZACION_*` del catálogo en conflictos y reglas
- [x] `ListaPrecio` sin columna `codigo` (alineado a entidad/migración)
- [x] Detalle / edición UI (admin inicial, inactivar/reactivar)
- [ ] Pruebas de integración HTTP listadas en la spec
- [ ] Métricas UI (API lista)

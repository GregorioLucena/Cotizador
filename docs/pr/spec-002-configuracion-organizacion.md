# PR: Spec 002 — Configuración de la organización

**Rama:** `feature/spec-002-configuracion-organizacion`  
**Base:** `testing`  
**Spec:** `docs/specs/002-configuracion-organizacion.md`

## Resumen

Configuración desde el ámbito organización: identidad, logo, monedas/umbrales/IA, sucursales y
configuración de cotización.

## Entregables

- Shared: schemas y errores de configuración/sucursales/logo
- API: `GET/PATCH /configuracion-organizacion`, logo POST/DELETE, CRUD sucursales, GET/PATCH cotización
- Almacenamiento local de logos en `uploads/` (servido en `/api/uploads`)
- Web: hub `/configuracion` + identidad, sucursales, cotización

## Cómo probar

1. Entrar como admin de organización (`admin@demo.local` o usuario inicial creado en 000)
2. Panel → Configuración
3. Editar identidad, crear sucursal, ajustar cotización

## Checklist

- [x] Filtrado por `organizacionId` del contexto
- [x] Permisos en servicio
- [x] Typecheck
- [ ] Pruebas de integración HTTP pendientes en la spec

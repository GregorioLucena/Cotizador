# PR: Spec 001 — Usuarios, perfiles y sesiones

**Rama:** `feature/spec-001-usuarios-perfiles`  
**Base:** `testing`  
**Spec:** `docs/specs/001-usuarios-perfiles.md`

## Resumen

Implementa autenticación (login, refresh con rotación, logout), construcción de `OrgContext`,
cambio/restablecimiento de contraseña, administración de usuarios de la organización, listado de
perfiles y pantallas de acceso / cambio obligatorio / panel.

## Entregables

### Shared
- Política y generador de contraseña temporal + tests
- Evaluación de permisos con comodín + tests
- Schemas Zod de auth/usuarios
- Factories de error alineadas a `docs/08-catalogo-errores.md` (`AUTH_*`, `USUARIO_*`)

### Database
- Entidades `Organizacion`, `Sucursal`, `Sesion`, `UsuarioSucursal`
- Migración `1782100000000-AuthSesionesYOrganizaciones`
- Seed: organización demo + admin `admin@demo.local` (además del superadmin de plataforma)

### API
- Guard global con rutas `@Publico` y bloqueo `AUTH_CAMBIO_PASSWORD_REQUERIDO`
- `POST/GET` auth según spec
- `GET/POST/PATCH` usuarios y `GET` perfiles
- Esquema de organización/sucursal mínimo (provisionamiento completo queda en spec 000)

### Web
- `/acceso`, `/acceso/cambiar-password`, `/panel`
- `/login` redirige a `/acceso`
- ABM completo de usuarios en UI (`/configuracion/usuarios*`) **diferido** a un PR de interfaz;
  el backend ya está disponible

## Cómo probar

```powershell
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Credenciales demo (organización):
- `admin@demo.local` / valor de `SEED_DEMO_ADMIN_PASSWORD` (por defecto igual a `SEED_ADMIN_PASSWORD`)

Credenciales plataforma:
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`

Flujo: login → cambio obligatorio de contraseña → panel.

## Checklist de revisión

- [x] Filtrado por `organizacionId` en administración de usuarios
- [x] Permisos verificados en servicios
- [x] Documentación / roadmap actualizados en esta rama
- [x] `pnpm typecheck` y `pnpm test` (shared) en verde
- [ ] ABM web de usuarios (diferido)
- [ ] Pruebas de integración HTTP pendientes (listadas en la spec)

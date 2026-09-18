# Convenciones de implementación

Este documento fija cómo se escribe el código del monorepo `cotizador`. Complementa
`docs/06-diseno-tecnico.md` (fuente de verdad de arquitectura, datos y contratos) y
`docs/11-arquitectura-monorepo.md` (estructura física). Si algo aquí contradice el diseño técnico,
prevalece el diseño técnico.

Stack de referencia (versiones en `decisions/0009-stack-tecnologico.md`):

| Pieza | Valor |
|-------|-------|
| Monorepo | pnpm workspaces, paquetes `@cotizador/{api,web,database,shared}` |
| API | NestJS ^11.1.6 |
| ORM | TypeORM ^0.3.26, `synchronize: false` siempre |
| Base de datos | PostgreSQL 16 con `pg_trgm` y `unaccent` |
| Web | Next.js ^15.5.4, React ^19.1.1, Tailwind CSS ^4.1.13 |
| Estado de servidor | TanStack Query ^5.90.2 |
| Validación | Zod ^3.25.76 en `@cotizador/shared` (sin class-validator ni DTO de Nest) |
| HTTP en web | `fetch` nativo |
| Pruebas | Vitest |
| Lenguaje | TypeScript ^5.9.2, `strict: true` |
| Formato | Prettier: `semi: true`, `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100` |

---

## Nomenclatura

### Dominio

Los nombres del glosario (`docs/01-glosario.md`) son obligatorios en código, tablas, endpoints,
permisos y textos de interfaz:

| Concepto | Nombre correcto | Nunca |
|----------|-----------------|-------|
| Negocio que contrata | `Organizacion` | tenant, empresa, cliente |
| Quien pide por WhatsApp | `Cliente` | comprador, contacto, cliente final |
| Unidad del catálogo | `Item` | producto |

Identificadores (variables, tipos, archivos, códigos de error, permisos) van **sin tildes**. La prosa
de documentación y los mensajes al usuario van **con tildes**.

### Archivos y símbolos

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Módulo Nest | kebab-case en carpeta | `apps/api/src/catalogo/` |
| Clase de servicio | PascalCase + `Service` | `MarcasService` |
| Esquema Zod | camelCase + `Schema` | `crearMarcaSchema` |
| Permiso | `modulo.recurso.accion` | `catalogo.maestras.administrar` |
| Código de error | UPPER_SNAKE_CASE | `MARCA_NO_ENCONTRADA` |
| Tabla | snake_case plural en español | `cotizacion_lineas` |
| Entidad TypeORM | PascalCase singular | `CotizacionLinea` |
| Columna / propiedad | camelCase | `organizacionId` |
| Ruta HTTP | plural kebab-case bajo `/api` | `/api/listas-precio` |

### Imports

Orden: dependencias externas, paquetes `@cotizador/*`, alias de la app (`@/*` solo en web), rutas
relativas. Los imports de solo tipo usan `import type`.

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Marca } from '@cotizador/database';
import { crearMarcaSchema, requirePermission, PERMISOS } from '@cotizador/shared';
import type { OrgContext } from '@cotizador/shared';
```

---

## Anatomía de un módulo backend

Cada dominio en `apps/api/src` sigue la misma forma (detalle en `docs/11-arquitectura-monorepo.md`):

```text
apps/api/src/catalogo/
├── catalogo.module.ts
├── marcas.controller.ts
├── marcas.service.ts
├── marcas.rules.ts          # opcional: reglas puras
├── categorias.controller.ts
├── categorias.service.ts
└── marcas.service.spec.ts
```

### Controlador delgado

El controlador no contiene lógica: declara la ruta, recibe `@OrgCtx() ctx` y `@Body() body: unknown`,
delega al servicio y envuelve el resultado en `{ data }`.

```typescript
@Controller('marcas')
export class MarcasController {
  constructor(private readonly marcasService: MarcasService) {}

  @Post()
  async crear(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.marcasService.crear(ctx, body);
    return { data };
  }

  @Patch(':id')
  async actualizar(
    @OrgCtx() ctx: OrgContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = await this.marcasService.actualizar(ctx, id, body);
    return { data };
  }
}
```

El mismo patrón aplica a categorías:

```typescript
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  async crear(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.categoriasService.crear(ctx, body);
    return { data };
  }
}
```

Reglas del controlador:

1. No accede a repositorios ni a `DataSource`.
2. No calcula, no filtra por organización y no evalúa reglas de negocio.
3. No tipa el cuerpo con una clase DTO de Nest. El cuerpo llega como `unknown`.
4. No usa class-validator. La forma se valida en el servicio con Zod de `@cotizador/shared`.
5. Los permisos se verifican también en el servicio (el decorador o guard del controlador, si existe,
   es una ayuda, no el control de acceso definitivo).

### Servicio

El servicio es el único lugar donde se aplican permisos, filtrado por `organizacionId`, validación
Zod, reglas de dominio y persistencia. Recibe `OrgContext` como primer parámetro. Nunca acepta
`organizacionId` desde el cuerpo ni desde la query.

---

## Orden obligatorio en servicios

Todo método público de un servicio sigue esta secuencia. El orden no es estilístico: cada paso
protege al siguiente. Definido en `docs/06-diseno-tecnico.md`.

```typescript
async crear(ctx: OrgContext, input: unknown) {
  // 1. Permiso — antes de tocar datos
  requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_ADMINISTRAR);

  // 2. Validación de forma — entrada como unknown, esquema Zod compartido
  const parsed = crearMarcaSchema.parse(input);

  // 3. Pertenencia y existencia — referencias contra ctx.organizacionId
  //    (si hubiera referencias; un identificador ajeno → no encontrado)

  // 4. Reglas de negocio — unicidad, invariantes, transiciones
  await this.assertNombreDisponible(ctx, parsed.nombre);

  // 5. Persistencia — organizacionId y auditoría desde el contexto, nunca desde la entrada
  return this.repo.save({
    ...parsed,
    organizacionId: ctx.organizacionId!,
    estadoRegistro: 'ACTIVO',
    createdById: ctx.usuarioId,
    updatedById: ctx.usuarioId,
  });
}
```

| Paso | Qué hace | Qué prohíbe |
|------|----------|-------------|
| 1. Permiso | `requirePermission(ctx, codigo)` | Consultar o mutar sin autorización |
| 2. Forma | `schema.parse(input)` sobre `unknown` | Confiar en el tipado del controlador |
| 3. Pertenencia | Verificar cada `*Id` contra `ctx.organizacionId` | Aceptar referencias ajenas (responden 404) |
| 4. Reglas | Unicidad, estado, invariantes del dominio | Persistir datos incoherentes |
| 5. Persistencia | Guardar con `organizacionId` y autoría del contexto | Tomar `organizacionId` del body |

Exigencias adicionales:

- Si `ctx.organizacionId` es nulo (usuario de ámbito `PLATAFORMA`), los servicios de dominio lanzan
  `CONTEXTO_ORGANIZACION_REQUERIDO` antes del paso 3.
- En actualizaciones, el filtro `organizacionId = ctx.organizacionId` va en el `WHERE`, no en una
  comprobación posterior en memoria.
- Un registro de otra organización se responde como no encontrado (`RECURSO_NO_ENCONTRADO` o el código
  específico del recurso), nunca como prohibido.

---

## Validación Zod

### Dónde viven los esquemas

Todos los esquemas viven en `packages/shared/src/schemas/`. Backend y frontend consumen el mismo
objeto. Los tipos se derivan con `z.infer`; no se declaran tipos paralelos que puedan divergir.

### Convención de nombres

| Operación | Nombre del esquema | Ejemplo |
|-----------|--------------------|---------|
| Alta | `crearXSchema` | `crearItemSchema`, `crearMarcaSchema` |
| Edición parcial | `actualizarXSchema` | `actualizarItemSchema`, `actualizarCategoriaSchema` |
| Consulta / filtros | `listarXQuerySchema` o `buscarXQuerySchema` | `buscarItemsQuerySchema` |
| Acción de dominio | verbo + recurso + `Schema` | `aprobarCotizacionSchema` |

```typescript
// packages/shared/src/schemas/marca.schema.ts
import { z } from 'zod';

export const crearMarcaSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
});

export const actualizarMarcaSchema = crearMarcaSchema.partial().extend({
  estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
});

export type CrearMarcaInput = z.infer<typeof crearMarcaSchema>;
export type ActualizarMarcaInput = z.infer<typeof actualizarMarcaSchema>;
```

### Reglas

1. No se usan DTO de NestJS ni decoradores de class-validator.
2. El controlador pasa `body: unknown`; el servicio hace `.parse()` (o un pipe genérico que aplique el
   esquema y devuelva el tipo inferido).
3. Un fallo de Zod se traduce a `VALIDACION_FALLIDA` (HTTP 400) con `details` de los issues.
4. Los atributos dinámicos del item se validan con un esquema construido en tiempo de ejecución a
   partir de las definiciones activas de la organización (ver `specs/004-catalogo-items.md`).
5. La salida del proveedor de IA se valida con un esquema estricto que **rechaza campos no
   declarados**, en particular cualquier importe.

---

## Manejo de errores

### Forma de la respuesta

Toda respuesta de error sigue el contrato de `docs/06-diseno-tecnico.md`:

```json
{
  "error": {
    "code": "MARCA_NO_ENCONTRADA",
    "message": "No se encontró la marca indicada.",
    "details": null
  }
}
```

Los códigos viven en `@cotizador/shared` y están catalogados en `docs/08-catalogo-errores.md`. El
mensaje al usuario lleva tildes; el código no.

### Jerarquía de clases

```typescript
// packages/shared/src/errors/ (forma conceptual)
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError { /* HTTP 404 */ }
export class ForbiddenError extends AppError { /* HTTP 403 */ }
export class UnauthorizedError extends AppError { /* HTTP 401 */ }
export class ConflictError extends AppError { /* HTTP 409 */ }
export class ValidationError extends AppError { /* HTTP 400 */ }
export class BusinessRuleError extends AppError { /* HTTP 422 */ }
export class ExternalServiceError extends AppError { /* HTTP 502 */ }
```

Los servicios lanzan subclases de `AppError` (o fábricas tipadas por código). Nunca lanzan errores
genéricos de Nest (`NotFoundException`, etc.) para reglas de dominio: el filtro global es quien
traduce `AppError` al JSON del contrato.

### Filtro global

Un filtro global en `apps/api` captura:

| Origen | Traducción |
|--------|------------|
| `AppError` | `{ error: { code, message, details } }` con el `httpStatus` del error |
| `ZodError` | `VALIDACION_FALLIDA`, HTTP 400, `details` con issues |
| Error no controlado | Código genérico de servidor, sin filtrar datos internos al cliente |

Códigos HTTP canónicos (alineados con el diseño técnico):

| HTTP | Uso |
|------|-----|
| 400 | Forma inválida (`VALIDACION_FALLIDA` y errores de atributo de forma) |
| 401 | Sin autenticación o token expirado |
| 403 | Autenticado sin el permiso requerido (`SIN_PERMISO`) |
| 404 | No existe, o existe en otra organización |
| 409 | Conflicto de unicidad o estado incompatible de recurso |
| 422 | Regla de negocio incumplida |
| 502 | Fallo de servicio externo (IA, PDF) |

---

## Consultas y paginación

### Listados

Parámetros de consulta estándar: `page`, `limit`, `search`, `estadoRegistro`, más filtros del
recurso. Respuesta paginada:

```json
{
  "data": {
    "items": [],
    "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
  }
}
```

### Filtrado por organización

Toda consulta de lectura o escritura sobre datos de organización incluye
`organizacionId = ctx.organizacionId` **antes** de cualquier otro criterio. Los índices de tablas con
volumen empiezan por `organizacionId`.

### Búsqueda

La búsqueda de catálogo normaliza el texto con la función pura de `@cotizador/shared` (la misma que
indexa `textoBusqueda`) y usa `pg_trgm`. No se inventa una normalización distinta en el servicio.

### Lecturas complejas

Si el `QueryBuilder` no cabe cómodo en el servicio, se extrae a `*.queries.ts`. Ese archivo solo lee;
no escribe.

---

## Transacciones

1. Toda operación que muta más de una tabla de forma atómica usa una transacción de TypeORM
   (`dataSource.transaction` o `queryRunner`).
2. Los eventos de cotización (`cotizacion_eventos`) se insertan **dentro de la misma transacción**
   que cambia el estado o las líneas (ver `decisions/0011-auditoria-y-trazabilidad.md`).
3. La asignación de folio incrementa `secuencias_folio` con bloqueo de fila dentro de la transacción
   que crea la cotización.
4. La regeneración de `textoBusqueda` por cambio de maestra ocurre en la misma transacción del
   cambio, salvo el caso de regeneración masiva diferida documentado en la spec de items.
5. No se hace trabajo de red (llamadas a IA, render de PDF) dentro de una transacción abierta de
   base de datos: se orquesta fuera y se persiste el resultado después.

---

## Importes decimales

Según `decisions/0005-motor-de-precios.md` y el diseño técnico:

| Aspecto | Convención |
|---------|------------|
| Almacenamiento | `numeric(18,4)` importes; `numeric(18,6)` tasas; `numeric(5,4)` confianza |
| Transporte API | **Cadena decimal**, nunca número de punto flotante: `"1234.5600"` |
| Cálculo | Aritmética decimal en el motor puro de `@cotizador/shared` |
| Origen | Catálogo y reglas; **nunca** la salida del modelo de lenguaje |
| Redondeo | Una sola vez al final de línea y del total, con config de la organización |
| Congelamiento | Al aprobar se copian precio, descuento, regla, impuesto y tasa; no cambian después |

En entidades TypeORM, los campos monetarios usan transformadores que leen y escriben `string`. En la
web, el formateo visible pasa por helpers de `lib/formato.ts`; el recálculo en pantalla usa
`calcularCotizacion` de shared.

---

## Convenciones frontend

La web (`apps/web`) no contiene reglas de negocio finales. Si una regla se necesita en la interfaz,
vive en `@cotizador/shared`.

### Estructura

- Rutas delgadas en `src/app` (App Router, route groups `(auth)` y `(app)`).
- Lógica de pantalla en `src/modules/<dominio>/` con `api.ts`, `hooks.ts`, `tipos.ts` y
  `components/`.
- Componentes compartidos en `src/components/{ui,layout,forms,data-display,feedback}`.

### Datos y HTTP

1. Toda llamada HTTP pasa por `lib/api-client.ts` (`fetch` nativo). Ese es el único lugar que conoce
   la URL de la API, cookies y el refresco ante 401.
2. El estado de servidor se gestiona con TanStack Query. No se duplica en estado local.
3. Los formularios validan con los mismos esquemas Zod de `@cotizador/shared`.
4. Los totales del borrador en edición salen de `calcularCotizacion`, no de un cálculo ad hoc en el
   componente.
5. Ocultar un botón según permisos es ayuda de UX; el control real está en el servicio de la API.
6. `apps/web` **no** importa `@cotizador/database`.

### Estilos

Tailwind CSS 4 con tokens en `@theme inline` dentro de `globals.css`. Composición de clases con
`clsx` + `tailwind-merge` (`lib/cn.ts`).

---

## Pruebas

Vitest cubre lo exacto y sin infraestructura:

| Qué | Dónde |
|-----|-------|
| Motor de precios (casos de tabla del ADR 0005) | `packages/shared/src/precios` |
| Normalización de texto y medidas | `packages/shared/src/texto` |
| Evaluación de permisos con comodín | `packages/shared/src/permissions` |
| Reglas puras `*.rules.ts` | `apps/api` junto al módulo |

Obligatorio por módulo con datos de organización: prueba de aislamiento (usuario de organización A
intenta leer/modificar un registro de B → no encontrado). Es condición de cierre de la spec
(`decisions/0001-multi-tenancy-por-organizacion.md`).

Ninguna prueba del motor de precios puede requerir base de datos, red ni contenedor.

Scripts desde la raíz: `pnpm test`, `pnpm typecheck`, `pnpm lint`.

---

## Migraciones

1. `synchronize: false` en todos los entornos. Sin excepciones.
2. Todo cambio de esquema es un archivo de migración en `packages/database/src/migrations/`, con
   `up` y `down` revisables.
3. Extensiones (`pg_trgm`, `unaccent`), índices GIN/`gin_trgm_ops` e índices compuestos que empiezan
   por `organizacionId` se escriben en SQL dentro de la migración; no se “derivan” solos de la
   entidad.
4. Generación: `pnpm db:migration:generate -- <nombre>`; aplicación: `pnpm db:migrate`; revertir:
   `pnpm db:migration:revert`.
5. Las semillas viven en `packages/database/src/seeds/` y son idempotentes. Los packs de vertical no
   ramifican lógica de negocio: materializan datos.

---

## Checklist de PR

Antes de solicitar revisión, además del checklist de `docs/10-convenciones-git-y-calidad.md`,
verificar:

### Obligatorios (API)

- [ ] Toda consulta filtra por `organizacionId` del `OrgContext`, nunca del body/query.
- [ ] Un identificador ajeno responde 404 (código de no encontrado), nunca 403.
- [ ] Ningún importe proviene de la salida del proveedor de IA.
- [ ] Permisos verificados en el servicio con el código `modulo.recurso.accion`.
- [ ] Métodos de servicio siguen el orden: permiso → Zod → pertenencia → reglas → persistencia.

### Contratos y estructura

- [ ] Esquemas nuevos/cambiados en `@cotizador/shared` (`crearXSchema` / `actualizarXSchema`).
- [ ] Sin DTO de Nest ni class-validator.
- [ ] Códigos de error nuevos registrados en `docs/08-catalogo-errores.md` y en shared.
- [ ] Grafo de dependencias respetado: web no importa database; shared no hace I/O.
- [ ] Controladores solo delegan y devuelven `{ data }`.

### Datos y calidad

- [ ] Migración con `down` si cambió el esquema; `synchronize` no activado.
- [ ] Importes como cadena decimal en API; aritmética decimal en shared.
- [ ] Sin borrado físico de datos de negocio.
- [ ] Eventos de cotización en la misma transacción que el cambio de estado.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` en verde.
- [ ] Documentación afectada actualizada en la misma PR.
- [ ] Prettier aplicado (`semi`, `singleQuote`, `trailingComma: 'all'`, `printWidth: 100`).

## Documentos relacionados

- `docs/06-diseno-tecnico.md` — arquitectura, datos, API y reglas críticas.
- `docs/08-catalogo-errores.md` — códigos, HTTP y mensajes al usuario.
- `docs/10-convenciones-git-y-calidad.md` — ramas, commits y revisión.
- `docs/11-arquitectura-monorepo.md` — carpetas, alias e imports.
- `decisions/0001-multi-tenancy-por-organizacion.md` — aislamiento.
- `decisions/0005-motor-de-precios.md` — importes y motor puro.
- `decisions/0009-stack-tecnologico.md` — versiones.
- `decisions/0010-monorepo-y-paquetes.md` — grafo de paquetes.

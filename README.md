# Cotizador

Plataforma web multi-organizacion que convierte un mensaje informal de WhatsApp en una cotizacion
formal: la IA interpreta el pedido, el catalogo pone los precios y una persona aprueba antes de que
salga al cliente.

Sirve a rubros distintos con la misma base: ferreterias, casas de repuestos, concesionarios y
distribuidoras. Lo que cambia entre un rubro y otro es configuracion, no codigo.

> **La IA propone. El catalogo cotiza. La persona aprueba.**

---

## Estado del proyecto

Fase 0 (cimientos) implementada localmente: monorepo pnpm, Postgres, migracion inicial, seed,
API con `/api/salud` y web con landing/login placeholder.

**Siguiente paso:** crear el repositorio remoto y abrir el PR `feature/fase-0-cimientos`.
Despues: fase 1 (auth + organizaciones).

---

## Como trabajamos

Este proyecto usa desarrollo dirigido por especificacion. La carpeta `docs/` es la **fuente de
verdad** del producto: antes de implementar un modulo debe existir su especificacion con reglas de
negocio, datos requeridos y criterios de aceptacion verificables.

```text
Especificar  →  Revisar reglas y criterios  →  Diseñar datos  →  Implementar  →  Verificar  →  Cerrar
```

Si el codigo y la documentacion difieren, se corrige el que este equivocado, en el mismo pull request.
El detalle del flujo, el estado de cada modulo y las fases estan en `docs/02-roadmap-sdd.md`.

---

## Documentacion

### Producto y alcance

| Documento | Que contiene |
|-----------|--------------|
| `docs/00-vision.md` | Que construimos, para quien y la regla de oro del producto |
| `docs/01-glosario.md` | Vocabulario del dominio y nomenclatura obligatoria |
| `docs/02-roadmap-sdd.md` | Flujo de trabajo, fases y estado de cada modulo |
| `docs/05-alcance-mvp.md` | Que entra y que no entra en la primera version |

### Diseño

| Documento | Que contiene |
|-----------|--------------|
| `docs/03-verticales-y-packs.md` | Contenido de cada pack de vertical y como agregar uno nuevo |
| `docs/04-flujo-precotizacion.md` | Pipeline de cinco etapas con detalle de datos y modos de fallo |
| `docs/06-diseno-tecnico.md` | Arquitectura, modelo de datos, seguridad y contratos de API |
| `docs/09-guia-ux-ui.md` | Sistema visual, navegacion y patrones de interfaz |

### Implementacion

| Documento | Que contiene |
|-----------|--------------|
| `docs/07-convenciones-implementacion.md` | Como se escribe el codigo en este proyecto |
| `docs/08-catalogo-errores.md` | Codigos de error, mensajes y cuando ocurren |
| `docs/10-convenciones-git-y-calidad.md` | Ramas, commits, revision y calidad |
| `docs/11-arquitectura-monorepo.md` | Estructura fisica, scripts y dependencias permitidas |
| `docs/12-infraestructura-docker.md` | Entornos, variables y puesta en marcha local |

### Decisiones de arquitectura

| ADR | Decision |
|-----|----------|
| `docs/decisions/0001-multi-tenancy-por-organizacion.md` | Aislamiento por columna de organizacion |
| `docs/decisions/0002-catalogo-generico-por-vertical.md` | Atributos JSON validados y packs de vertical |
| `docs/decisions/0003-pipeline-precotizacion.md` | Cinco etapas separadas y auditables |
| `docs/decisions/0004-proveedor-de-ia-abstraido.md` | Proveedor de IA intercambiable |
| `docs/decisions/0005-motor-de-precios.md` | Calculo determinista y puro |
| `docs/decisions/0006-plantillas-de-documento.md` | Plantillas declarativas, sin HTML libre |
| `docs/decisions/0007-estrategia-de-matching.md` | Resolucion por alias y similitud textual |
| `docs/decisions/0008-moneda-base-y-presentacion.md` | Moneda de calculo y tasa congelada |
| `docs/decisions/0009-stack-tecnologico.md` | Eleccion del stack |
| `docs/decisions/0010-monorepo-y-paquetes.md` | Estructura de paquetes y dependencias |
| `docs/decisions/0011-auditoria-y-trazabilidad.md` | Estados, anulacion y bitacora de eventos |
| `docs/decisions/0012-infraestructura-y-entornos.md` | Docker, entornos y despliegue |

### Especificaciones por modulo

| Spec | Modulo |
|------|--------|
| `docs/specs/000-plataforma-organizaciones.md` | Registro y provisionamiento de organizaciones |
| `docs/specs/001-usuarios-perfiles.md` | Autenticacion, permisos, usuarios y sesiones |
| `docs/specs/002-configuracion-organizacion.md` | Datos, sucursales, monedas y configuracion |
| `docs/specs/003-maestras-catalogo.md` | Unidades, categorias, marcas y atributos |
| `docs/specs/004-catalogo-items.md` | Items, alias, compatibilidades y busqueda |
| `docs/specs/005-importacion-catalogo.md` | Importacion desde Excel y CSV |
| `docs/specs/006-listas-precios-reglas.md` | Listas, precios, descuentos y tasas |
| `docs/specs/007-clientes.md` | Clientes que solicitan cotizaciones |
| `docs/specs/008-precotizacion-ia.md` | Generacion del borrador con IA |
| `docs/specs/009-revision-aprobacion.md` | Revision humana, aprobacion y entrega |
| `docs/specs/010-plantillas-documento.md` | Plantilla configurable y PDF |
| `docs/specs/011-historial-y-metricas.md` | Historial, estados finales y metricas |

---

## Stack

| Capa | Tecnologia |
|------|-----------|
| Monorepo | pnpm workspaces |
| Interfaz | Next.js con App Router, React, Tailwind CSS, TanStack Query |
| API | NestJS |
| Datos | PostgreSQL con pg_trgm y unaccent, TypeORM con migraciones explicitas |
| Validacion | Zod, compartida entre interfaz y API |
| Documentos | Renderizado en el servidor a PDF |
| Entornos | Docker Compose |

Detalle y versiones en `docs/decisions/0009-stack-tecnologico.md`.

---

## Estructura

```text
cotizador/
├── apps/
│   ├── api/          NestJS: modulos por dominio
│   └── web/          Next.js: interfaz
├── packages/
│   ├── database/     Entidades, migraciones, semillas y packs de vertical
│   └── shared/       Schemas Zod, tipos, permisos, errores y motor de precios
└── docs/             Fuente de verdad del producto
```

Detalle en `docs/11-arquitectura-monorepo.md`.

---

## Puesta en marcha

Requiere Node 22, pnpm y Docker. Los pasos detallados estan en `docs/12-infraestructura-docker.md`.

```bash
pnpm install
cp .env.development.example .env.development
pnpm docker:db          # levanta PostgreSQL
pnpm db:migrate         # aplica migraciones
pnpm db:seed            # permisos, perfiles y superadmin
pnpm dev                # API y interfaz en paralelo
```

---

## Reglas que no se negocian

1. Ningun importe de una cotizacion proviene de la salida de un modelo de lenguaje.
2. Ninguna cotizacion se entrega sin aprobacion humana registrada.
3. Ninguna consulta devuelve datos de otra organizacion.
4. Las cotizaciones y sus eventos no se borran fisicamente.
5. Una cotizacion aprobada no cambia de valor nunca.
6. Ninguna regla de negocio ramifica por vertical.

# Arquitectura del monorepo

Este documento describe la estructura fisica del repositorio: que carpetas existen, que vive en cada
una, como se llaman los scripts, que puede importar cada paquete y como se organiza un modulo. La
decision que lo sustenta esta en `decisions/0010-monorepo-y-paquetes.md`; el stack y sus versiones, en
`decisions/0009-stack-tecnologico.md`.

## Vision general

```text
+---------------------------------------------------------------+
|                      apps/web (Next.js)                       |
|  App Router, React Query, Tailwind, sin acceso a base de datos |
+-------------------------------+-------------------------------+
                                | HTTP, JSON, token de acceso
+-------------------------------v-------------------------------+
|                      apps/api (NestJS)                        |
|  Controladores, servicios, guards, permisos, transacciones    |
+-------------------------------+-------------------------------+
                                | TypeORM
+-------------------------------v-------------------------------+
|            packages/database  +  PostgreSQL 16                |
+---------------------------------------------------------------+

       packages/shared  ->  esquemas Zod, tipos, permisos,
                            errores, motor de precios, texto
                            (lo consumen web, api y database)
```

## Arbol de carpetas

```text
cotizador/
├── apps/
│   ├── api/                              # @cotizador/api — NestJS 11
│   │   ├── src/
│   │   │   ├── main.ts                   # arranque, cookie-parser, CORS, prefijo /api
│   │   │   ├── app.module.ts             # composicion de modulos y origen de datos
│   │   │   ├── auth/                     # login, refresco, sesiones, cierre de sesion
│   │   │   ├── plataforma/               # administracion de organizaciones (ambito PLATAFORMA)
│   │   │   ├── organizaciones/           # datos de la organizacion, sucursales, provisionamiento
│   │   │   ├── usuarios/                 # usuarios, perfiles y asignacion de sucursales
│   │   │   ├── catalogo/                 # items, categorias, marcas, unidades, atributos, alias
│   │   │   ├── importacion/              # carga desde Excel o CSV, simulacion e informe de errores
│   │   │   ├── precios/                  # listas, precios por item, reglas de descuento, tasas
│   │   │   ├── clientes/                 # clientes que solicitan cotizaciones
│   │   │   ├── solicitudes/              # captura del texto y sus interpretaciones
│   │   │   ├── ia/                       # implementaciones de ProveedorIa y seleccion por entorno
│   │   │   ├── resolucion/               # cascada de estrategias contra el catalogo
│   │   │   ├── cotizaciones/             # borrador, edicion, aprobacion, estados, eventos
│   │   │   ├── documentos/               # GeneradorPdf, texto para WhatsApp, archivos generados
│   │   │   ├── plantillas/               # configuracion declarativa del documento
│   │   │   ├── metricas/                 # consultas sobre la bitacora de eventos
│   │   │   ├── salud/                    # endpoint de salud para los healthchecks
│   │   │   └── common/
│   │   │       ├── contexto/             # construccion y acceso al OrgContext
│   │   │       ├── guards/               # autenticacion, permisos, ambito de sucursal
│   │   │       ├── decorators/           # @Permisos, @Contexto, @Publico
│   │   │       ├── pipes/                # ZodValidationPipe
│   │   │       ├── filters/              # traduccion de errores al catalogo de codigos
│   │   │       ├── interceptors/         # forma de la respuesta, tiempos, transacciones
│   │   │       └── database/             # modulo de conexion sobre @cotizador/database
│   │   ├── test/                         # pruebas de integracion, incluidas las de aislamiento
│   │   ├── Dockerfile                    # imagen de produccion, instala chromium
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── package.json
│   │
│   └── web/                              # @cotizador/web — Next.js 15
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx            # layout raiz, proveedores globales
│       │   │   ├── globals.css           # Tailwind y tokens con @theme inline
│       │   │   ├── (auth)/               # route group sin barra de navegacion
│       │   │   │   ├── layout.tsx
│       │   │   │   └── login/page.tsx
│       │   │   └── (app)/                # route group autenticado
│       │   │       ├── layout.tsx        # cabecera, navegacion, selector de sucursal
│       │   │       ├── page.tsx          # inicio
│       │   │       ├── cotizaciones/     # listado, nueva, detalle, revision del borrador
│       │   │       ├── catalogo/         # items, categorias, marcas, unidades, atributos
│       │   │       ├── importacion/
│       │   │       ├── precios/          # listas, precios, reglas, tasas de cambio
│       │   │       ├── clientes/
│       │   │       ├── metricas/
│       │   │       ├── configuracion/    # organizacion, sucursales, usuarios, plantilla
│       │   │       └── plataforma/       # solo para usuarios de ambito PLATAFORMA
│       │   ├── components/
│       │   │   ├── ui/                   # boton, campo, tabla, dialogo, insignia
│       │   │   ├── layout/               # AppShell, cabecera, navegacion
│       │   │   ├── forms/                # campos conectados a esquemas Zod
│       │   │   ├── data-display/         # tarjetas, semaforo de linea, estados vacios
│       │   │   └── feedback/             # carga, errores, confirmaciones, avisos
│       │   ├── lib/
│       │   │   ├── api-client.ts         # fetch nativo, cookies, manejo de 401 y refresco
│       │   │   ├── query-client.ts       # configuracion de React Query
│       │   │   ├── sesion.ts             # contexto de usuario y organizacion en el navegador
│       │   │   ├── permisos.ts           # evaluacion de permisos para mostrar u ocultar
│       │   │   ├── formato.ts            # formato de importes, fechas y cantidades
│       │   │   └── cn.ts                 # clsx + tailwind-merge
│       │   └── modules/                  # logica de pantalla agrupada por dominio
│       │       ├── cotizaciones/
│       │       │   ├── api.ts            # llamadas a la API de este dominio
│       │       │   ├── hooks.ts          # hooks de React Query
│       │       │   ├── components/       # componentes especificos del dominio
│       │       │   └── tipos.ts          # tipos de pantalla, no contratos
│       │       ├── catalogo/
│       │       ├── precios/
│       │       └── clientes/
│       ├── Dockerfile
│       ├── eslint.config.mjs
│       ├── next.config.mjs
│       ├── postcss.config.mjs
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── database/                         # @cotizador/database
│   │   ├── src/
│   │   │   ├── index.ts                  # exportaciones publicas del paquete
│   │   │   ├── data-source.ts            # origen de datos TypeORM, synchronize: false
│   │   │   ├── run-migrations.ts         # ejecutable usado por el entrypoint
│   │   │   ├── entities/
│   │   │   │   ├── base.entity.ts        # createdAt, updatedAt, createdById, updatedById
│   │   │   │   ├── organizacion.entity.ts
│   │   │   │   ├── sucursal.entity.ts
│   │   │   │   ├── usuario.entity.ts
│   │   │   │   ├── perfil.entity.ts
│   │   │   │   ├── item.entity.ts
│   │   │   │   ├── item-alias.entity.ts
│   │   │   │   ├── item-aplicacion.entity.ts
│   │   │   │   ├── definicion-atributo.entity.ts
│   │   │   │   ├── lista-precios.entity.ts
│   │   │   │   ├── precio-item.entity.ts
│   │   │   │   ├── regla-descuento.entity.ts
│   │   │   │   ├── tasa-cambio.entity.ts
│   │   │   │   ├── cliente.entity.ts
│   │   │   │   ├── solicitud.entity.ts
│   │   │   │   ├── interpretacion-solicitud.entity.ts
│   │   │   │   ├── cotizacion.entity.ts
│   │   │   │   ├── cotizacion-linea.entity.ts
│   │   │   │   ├── cotizacion-linea-candidato.entity.ts
│   │   │   │   ├── cotizacion-evento.entity.ts
│   │   │   │   ├── plantilla-documento.entity.ts
│   │   │   │   └── documento-generado.entity.ts
│   │   │   ├── migrations/               # una migracion por cambio, nombradas con marca de tiempo
│   │   │   └── seeds/
│   │   │       ├── run-seed.ts           # ejecutable idempotente usado por el entrypoint
│   │   │       ├── plataforma/           # monedas, perfiles, permisos, verticales, admin inicial
│   │   │       └── verticales/           # packs de vertical, ver ADR 0002
│   │   │           ├── ferreteria.ts
│   │   │           ├── repuestos.ts
│   │   │           ├── automotriz.ts
│   │   │           └── generico.ts
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── package.json
│   │
│   └── shared/                           # @cotizador/shared — sin entrada ni salida
│       ├── src/
│       │   ├── index.ts
│       │   ├── schemas/                  # esquemas Zod por dominio, fuente de los tipos
│       │   │   ├── organizacion.schema.ts
│       │   │   ├── usuario.schema.ts
│       │   │   ├── item.schema.ts
│       │   │   ├── atributos.schema.ts   # constructor dinamico desde las definiciones
│       │   │   ├── precios.schema.ts
│       │   │   ├── cliente.schema.ts
│       │   │   ├── solicitud.schema.ts
│       │   │   ├── extraccion-ia.schema.ts  # estricto, rechaza importes
│       │   │   ├── cotizacion.schema.ts
│       │   │   └── plantilla.schema.ts
│       │   ├── types/                    # tipos derivados y contratos de interfaz
│       │   │   ├── org-context.ts
│       │   │   ├── proveedor-ia.ts
│       │   │   ├── generador-pdf.ts
│       │   │   └── paginacion.ts
│       │   ├── permissions/              # catalogo de codigos y evaluacion con comodin
│       │   ├── errors/                   # catalogo de codigos de error y clases base
│       │   ├── precios/                  # motor de precios puro y sus pruebas
│       │   │   ├── calcular-cotizacion.ts
│       │   │   ├── seleccionar-regla.ts
│       │   │   ├── redondeo.ts
│       │   │   └── calcular-cotizacion.test.ts
│       │   └── texto/                    # normalizacion, medidas y fracciones
│       │       ├── normalizar.ts
│       │       ├── medidas.ts
│       │       └── normalizar.test.ts
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       └── package.json
│
├── scripts/
│   ├── docker-entrypoint-dev.sh          # instala, compila paquetes internos y arranca
│   └── docker-entrypoint-api.sh          # espera, migra, semilla condicional y arranca
│
├── docs/
│   ├── 00-vision.md
│   ├── 01-glosario.md
│   ├── 05-alcance-mvp.md
│   ├── 10-convenciones-git-y-calidad.md
│   ├── 11-arquitectura-monorepo.md
│   ├── 12-infraestructura-docker.md
│   ├── decisions/                        # ADR numerados
│   └── specs/                            # especificaciones funcionales
│
├── .cursor/rules/                        # reglas operativas del agente
├── .env.development.example              # plantilla versionada de variables
├── .npmrc                                # node-linker=hoisted
├── pnpm-workspace.yaml
├── pnpm-lock.yaml                        # se versiona siempre
├── package.json                          # raiz del monorepo, scripts y Prettier
├── prettier.config.mjs
├── tsconfig.base.json
├── docker-compose.dev.yml
├── docker-compose.yml
├── Dockerfile.dev
├── .dockerignore
└── README.md
```

## Responsabilidades por paquete

| Paquete | Hace | No hace |
|---------|------|---------|
| `apps/web` | Interfaz, formularios, cache de datos, llamadas HTTP, recalculo inmediato con el motor compartido | Reglas de negocio finales, SQL, decision de permisos, acceso a base de datos |
| `apps/api` | Contratos REST, autenticacion, autorizacion, servicios, transacciones, orquestacion del pipeline | Renderizar la interfaz de usuario |
| `packages/database` | Entidades, migraciones, semillas, origen de datos | Reglas de negocio, controladores |
| `packages/shared` | Esquemas, tipos, permisos, errores, motor de precios, normalizacion | Entrada y salida, framework, acceso a `process.env` |

## Grafo de dependencias permitido

| Paquete | Puede importar | No puede importar |
|---------|----------------|-------------------|
| `apps/web` | `@cotizador/shared` | `@cotizador/database`, `apps/api` |
| `apps/api` | `@cotizador/shared`, `@cotizador/database` | `apps/web` |
| `@cotizador/database` | `@cotizador/shared` | `apps/api`, `apps/web` |
| `@cotizador/shared` | Nada del proyecto | Todo lo demas |

Las dependencias internas se declaran con `workspace:*`. Un paquete solo puede importar lo que figura en
sus `dependencies`, de modo que un import prohibido falla al compilar. La justificacion completa esta en
`decisions/0010-monorepo-y-paquetes.md`.

## Alias de TypeScript

| Alias | Resuelve a | Disponible en |
|-------|------------|---------------|
| `@cotizador/shared` | `packages/shared/dist` via `exports` del paquete | `apps/api`, `apps/web`, `packages/database` |
| `@cotizador/database` | `packages/database/dist` via `exports` del paquete | `apps/api` |
| `@/*` | `apps/web/src/*` | Solo `apps/web` |

Reglas:

1. Los paquetes internos se consumen por su nombre, nunca por una ruta relativa hacia sus fuentes y
   nunca con un alias de TypeScript apuntando a `src`. Asi el consumo es identico al de un paquete
   publicado y el empaquetado de produccion coincide con el de desarrollo.
2. `@/*` es exclusivo de la web. El backend no define alias propios: usa rutas relativas dentro de un
   modulo y los nombres de paquete para lo compartido.
3. No se admiten rutas relativas profundas del estilo `../../../lib/permisos`. Si aparece una, el archivo
   esta en el lugar equivocado o falta un alias.

Ejemplo de orden de imports:

```typescript
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Cotizacion, CotizacionEvento } from '@cotizador/database';
import { calcularCotizacion, cotizacionAprobarSchema } from '@cotizador/shared';
import type { OrgContext } from '@cotizador/shared';

import { CotizacionesRules } from './cotizaciones.rules';
```

Orden: dependencias externas, paquetes internos del monorepo, alias de la aplicacion, rutas relativas.
Los imports de solo tipo se marcan con `import type`.

## Scripts de la raiz

Todos se ejecutan desde la raiz del monorepo. Los que necesitan variables de entorno las cargan con
`dotenv-cli` desde `.env.development`.

| Script | Accion |
|--------|--------|
| `pnpm dev` | Levanta PostgreSQL en Docker y arranca la API y la web en paralelo en la maquina local |
| `pnpm dev:api` | Solo la API, con el modo observador de NestJS |
| `pnpm dev:web` | Solo la web, con Turbopack |
| `pnpm build` | Compila los paquetes internos y luego las dos aplicaciones |
| `pnpm build:packages` | Compila `@cotizador/shared` y despues `@cotizador/database` |
| `pnpm typecheck` | Comprueba tipos en los cuatro paquetes, sin emitir salida |
| `pnpm lint` | ESLint sobre `apps/web` |
| `pnpm format` | Prettier en modo escritura sobre `apps/**` y `packages/**` |
| `pnpm test` | Vitest sobre las reglas puras y el motor de precios |
| `pnpm db:migrate` | Ejecuta las migraciones pendientes |
| `pnpm db:migration:generate` | Genera una migracion comparando entidades contra el esquema actual |
| `pnpm db:migration:revert` | Revierte la ultima migracion aplicada |
| `pnpm db:seed` | Ejecuta la semilla idempotente de plataforma |
| `pnpm docker:db` | Levanta solo el contenedor de PostgreSQL |
| `pnpm docker:dev` | Levanta el stack completo en contenedores con el perfil `full` |
| `pnpm docker:down` | Detiene los contenedores de desarrollo y la red |
| `pnpm docker:logs` | Sigue la salida de los contenedores de desarrollo |

Notas:

- `pnpm build:packages` respeta el orden del grafo: `shared` primero, porque `database` depende de el.
- `pnpm dev:api` compila los paquetes internos antes de arrancar, de modo que la API nunca corre contra
  un `dist` obsoleto.
- `pnpm db:migration:generate` requiere un nombre y no se ejecuta contra una base de datos con datos que
  no se puedan perder si la migracion resulta incorrecta.
- Para trabajar sobre un paquete concreto se usa el filtro de pnpm:

```bash
pnpm --filter @cotizador/api dev
pnpm --filter @cotizador/shared test
pnpm --filter @cotizador/database build
```

## Anatomia de un modulo backend

Cada dominio de `apps/api/src` tiene la misma forma. La uniformidad es el objetivo: quien abre un modulo
que no conoce sabe de antemano en que archivo esta cada cosa.

```text
apps/api/src/cotizaciones/
├── cotizaciones.module.ts       # declara controlador, servicios y entidades del modulo
├── cotizaciones.controller.ts   # rutas HTTP, permisos declarados, validacion con Zod
├── cotizaciones.service.ts      # orquestacion, transacciones, acceso a repositorios
├── cotizaciones.rules.ts        # reglas puras del dominio, sin base de datos
├── cotizaciones.queries.ts      # consultas de lectura complejas (opcional)
└── cotizaciones.service.spec.ts # pruebas, incluida la de aislamiento por organizacion
```

| Archivo | Responsabilidad | Prohibido |
|---------|-----------------|-----------|
| `*.module.ts` | Composicion: que controlador, que servicios, que entidades registra | Contener logica |
| `*.controller.ts` | Ruta, metodo, codigo de permiso, validacion del cuerpo con el esquema de `@cotizador/shared`, obtencion del `OrgContext` y llamada al servicio | Acceder a repositorios, calcular, decidir reglas |
| `*.service.ts` | Reglas de aplicacion, transacciones, filtrado por `organizacionId`, registro de eventos | Conocer HTTP, leer cabeceras, construir respuestas |
| `*.rules.ts` | Funciones puras: transiciones de estado validas, condiciones de aprobacion, validaciones de dominio | Recibir un repositorio, leer el reloj, hacer entrada o salida |
| `*.queries.ts` | Consultas de lectura con `QueryBuilder` que no encajan en el servicio | Escribir |

Reglas transversales:

1. El servicio recibe el `OrgContext` como primer parametro y lo usa para filtrar. Nunca acepta
   `organizacionId` desde el cuerpo de la peticion.
2. La verificacion de permisos ocurre en el servicio, no solo en el controlador.
3. Todo lo que puede ser una funcion pura vive en `*.rules.ts` y tiene prueba unitaria. Si la regla
   tambien la necesita la web, no vive aqui: vive en `@cotizador/shared`.
4. Las operaciones que cambian el estado de una cotizacion registran su evento dentro de la misma
   transaccion, segun `decisions/0011-auditoria-y-trazabilidad.md`.

## Anatomia de un modulo frontend

La web separa las rutas de la logica de pantalla. Las rutas viven en `src/app` y son delgadas: componen
y delegan. El dominio vive en `src/modules`.

```text
apps/web/src/modules/cotizaciones/
├── api.ts                       # funciones que llaman a la API con apiFetch
├── hooks.ts                     # useQuery y useMutation, claves de cache e invalidacion
├── tipos.ts                     # tipos de pantalla; los contratos vienen de @cotizador/shared
└── components/
    ├── TablaLineasBorrador.tsx
    ├── SemaforoLinea.tsx
    ├── SelectorCandidatos.tsx
    └── ResumenTotales.tsx
```

```text
apps/web/src/app/(app)/cotizaciones/
├── page.tsx                     # listado con filtros
├── nueva/page.tsx               # captura del mensaje del cliente
└── [id]/
    ├── page.tsx                 # detalle
    └── revision/page.tsx        # revision del borrador antes de aprobar
```

Reglas:

1. Una pagina de `src/app` compone componentes y hooks; no contiene llamadas `fetch` sueltas ni reglas
   de negocio.
2. Las llamadas a la API pasan siempre por `lib/api-client.ts`, que es el unico lugar que conoce la
   direccion de la API, las cookies y el refresco del token.
3. El estado de servidor se gestiona con React Query. No se duplica en un estado local.
4. Los totales que se muestran mientras el operador edita salen de `calcularCotizacion` de
   `@cotizador/shared`, no de un calculo escrito en el componente.
5. Los componentes compartidos por dos o mas pantallas suben a `src/components`; los especificos de un
   dominio se quedan en `src/modules/<dominio>/components`.
6. Las propiedades se tipan con `type <Componente>Props` y se exportan con nombre, salvo las paginas de
   Next.js, que exportan por defecto por convencion del framework.
7. Ocultar un boton segun los permisos es una ayuda de interfaz, no un control de acceso. La decision
   real la toma el servicio en la API.

## Documentos relacionados

- `decisions/0009-stack-tecnologico.md` — tecnologias y versiones.
- `decisions/0010-monorepo-y-paquetes.md` — por que esta estructura.
- `docs/12-infraestructura-docker.md` — como se ejecuta todo esto.
- `docs/10-convenciones-git-y-calidad.md` — como se integra un cambio.
- `docs/06-diseno-tecnico.md` — modelo de datos y contratos.

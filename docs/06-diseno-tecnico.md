# Diseño tecnico

Documento maestro de diseño del MVP v1. Define la arquitectura, el modelo de datos, el modelo de
seguridad y los contratos de API. Cuando una especificacion refinada o un ADR posterior contradiga
algo de aqui, prevalece la especificacion o el ADR.

## Referencias

- `00-vision.md` — que construimos y la regla de oro.
- `05-alcance-mvp.md` — que entra en esta version.
- `decisions/0001-multi-tenancy-por-organizacion.md` — aislamiento entre organizaciones.
- `decisions/0002-catalogo-generico-por-vertical.md` — atributos y packs de vertical.
- `decisions/0003-pipeline-precotizacion.md` — etapas de generacion del borrador.
- `decisions/0005-motor-de-precios.md` — calculo de importes.
- `decisions/0007-estrategia-de-matching.md` — resolucion de items.
- `decisions/0011-auditoria-y-trazabilidad.md` — estados, anulacion y eventos.

---

## Arquitectura en capas

```text
┌──────────────────────────────────────────────────────────────┐
│  apps/web — Next.js App Router                               │
│  Interfaz. Sin logica de negocio. Recalculo con @cotizador/   │
│  shared. Estado de servidor con TanStack Query.              │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTP JSON, /api, Bearer + cookie
┌───────────────────────────▼──────────────────────────────────┐
│  apps/api — NestJS                                            │
│  Controladores delgados. Servicios con la logica. Guard de    │
│  autenticacion. Filtro global de errores.                     │
│  Adaptadores: ProveedorIa, GeneradorPdf, Almacenamiento.      │
└──────────┬─────────────────────────────────┬─────────────────┘
           │                                 │
┌──────────▼──────────────┐   ┌──────────────▼─────────────────┐
│ @cotizador/database     │   │ @cotizador/shared              │
│ Entidades TypeORM,      │   │ Schemas Zod, tipos, permisos,   │
│ migraciones, seeds,     │   │ errores, motor de precios puro, │
│ packs de vertical       │   │ normalizacion de texto          │
└──────────┬──────────────┘   └────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│  PostgreSQL 16 — pg_trgm, unaccent, JSONB, numeric          │
└─────────────────────────────────────────────────────────────┘
```

### Reglas arquitectonicas

1. `apps/web` no contiene reglas de negocio. Si una regla se necesita en la interfaz, vive en
   `@cotizador/shared` y se consume desde ambos lados.
2. `apps/web` no importa `@cotizador/database` nunca. No conoce entidades ni el ORM.
3. Los controladores no contienen logica: validan la ruta, extraen el contexto y delegan al servicio.
4. Los servicios son los unicos que aplican permisos, filtran por organizacion y validan con Zod.
5. TypeORM opera con `synchronize: false`. Todo cambio de esquema es una migracion explicita.
6. Los adaptadores externos (IA, PDF, almacenamiento de archivos) se consumen a traves de una interfaz
   definida en `@cotizador/shared` y se registran por configuracion. Ningun servicio de dominio importa
   un SDK de terceros.
7. Las reglas de negocio complejas se extraen a funciones puras en `*.rules.ts` o en
   `@cotizador/shared`, para poder probarlas sin base de datos.

---

## Orden obligatorio en cada metodo de servicio

Todo metodo publico de un servicio sigue esta secuencia. El orden no es estilistico: cada paso protege
al siguiente.

```typescript
async crear(ctx: OrgContext, input: unknown) {
  requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_CREAR);   // 1. permiso
  const parsed = crearItemSchema.parse(input);              // 2. forma de los datos
  await this.assertPertenece(ctx, parsed.categoriaId);      // 3. tenant y existencia
  await this.assertSkuDisponible(ctx, parsed.sku);          // 4. reglas de negocio
  return this.repo.save({ ...parsed, organizacionId: ctx.organizacionId, /* auditoria */ });
}
```

1. **Permiso.** Antes de tocar datos.
2. **Validacion de forma.** Con el esquema Zod compartido. La entrada llega como `unknown`.
3. **Pertenencia y existencia.** Toda referencia por identificador se verifica contra
   `ctx.organizacionId`. Una referencia ajena se responde como no encontrada.
4. **Reglas de negocio.** Unicidad, transiciones de estado, invariantes del dominio.
5. **Persistencia.** Con auditoria (`createdById` o `updatedById`) y `organizacionId` tomado del
   contexto, nunca de la entrada.

---

## Multi-tenancy

| Capa | Mecanismo |
|------|-----------|
| Base de datos | Columna `organizacionId uuid NOT NULL` en toda tabla de datos de organizacion |
| Transporte | Token de acceso firmado que contiene el contexto completo |
| Peticion | `OrgContext` construido por el guard y expuesto con el decorador `@OrgCtx()` |
| Servicio | Filtrado explicito por `ctx.organizacionId` en toda consulta |
| Sub ambito | `sucursalId` validado contra `ctx.sucursalIds` con `requireSucursalAccess` |

```typescript
// @cotizador/shared/types
export type OrgContext = {
  usuarioId: string;
  organizacionId: string | null;   // null solo para usuarios de plataforma
  ambito: 'PLATAFORMA' | 'ORGANIZACION';
  sucursalIds: string[];
  sucursalActivaId?: string;
  permisos: string[];
  sesionId: string;
};
```

Un usuario de plataforma tiene `organizacionId` nulo y `ambito` `PLATAFORMA`. Puede administrar
organizaciones y crear sus usuarios, pero **no** opera cotizaciones: los servicios de dominio exigen
`ctx.organizacionId` no nulo y responden error de contexto si falta.

---

## Autenticacion

| Decision | Valor |
|----------|-------|
| Token de acceso | JWT firmado, 15 minutos, enviado en `Authorization: Bearer` |
| Token de refresco | Opaco y aleatorio, en cookie `HttpOnly` con ruta `/api/auth`, 7 dias |
| Almacenamiento del refresco | Hash SHA-256 en la tabla `sesiones`, nunca el valor en claro |
| Contraseñas | bcrypt con 12 rondas |
| Revocacion | Marcando la sesion como revocada; el cierre de sesion revoca la sesion actual |
| Rotacion | Cada refresco emite un token nuevo y revoca el anterior |
| Contexto | Se recalcula en cada login y refresco, no se hereda del token anterior |

El guard de autenticacion es global; las rutas publicas se marcan con `@Public()` (login, refresco,
salud del servicio).

Flujo de login: se valida la entrada, se busca el usuario activo por correo, se compara la contraseña,
se cargan perfiles, permisos y sucursales, se crea la sesion, se firma el token de acceso y se
establece la cookie de refresco.

---

## Autorizacion

Los permisos se identifican con codigos `modulo.recurso.accion` y viajan dentro del token. No se
consulta la base de datos por permisos en cada peticion; se recalculan al autenticar y al refrescar.

La evaluacion admite comodin: un permiso `catalogo.*` concedido satisface `catalogo.items.crear`.

### Catalogo de permisos del MVP

| Codigo | Descripcion |
|--------|-------------|
| `plataforma.organizaciones.ver` | Listar y ver organizaciones |
| `plataforma.organizaciones.crear` | Registrar una organizacion y provisionarla |
| `plataforma.organizaciones.editar` | Editar datos y estado de una organizacion |
| `plataforma.usuarios.administrar` | Crear el usuario administrador inicial de una organizacion |
| `plataforma.metricas.ver` | Ver metricas agregadas de la plataforma |
| `configuracion.organizacion.ver` | Ver la configuracion de la organizacion |
| `configuracion.organizacion.administrar` | Editar datos, monedas, umbrales y configuracion de cotizacion |
| `configuracion.sucursales.ver` | Ver sucursales |
| `configuracion.sucursales.administrar` | Crear y editar sucursales |
| `seguridad.usuarios.ver` | Ver usuarios de la organizacion |
| `seguridad.usuarios.crear` | Crear usuarios |
| `seguridad.usuarios.editar` | Editar usuarios, perfiles y accesos |
| `seguridad.usuarios.restablecer_clave` | Forzar el cambio de contraseña de un usuario |
| `catalogo.maestras.ver` | Ver categorias, marcas, unidades y definiciones de atributo |
| `catalogo.maestras.administrar` | Administrar categorias, marcas, unidades y definiciones de atributo |
| `catalogo.items.ver` | Ver y buscar items |
| `catalogo.items.crear` | Crear items |
| `catalogo.items.editar` | Editar e inactivar items |
| `catalogo.items.importar` | Importar catalogo, precios y alias desde archivo |
| `catalogo.alias.administrar` | Crear, editar y depurar alias |
| `precios.listas.ver` | Ver listas y precios |
| `precios.listas.administrar` | Administrar listas y precios de items |
| `precios.reglas.administrar` | Administrar reglas de descuento |
| `precios.tasas.administrar` | Actualizar tasas de cambio |
| `clientes.ver` | Ver clientes |
| `clientes.crear` | Crear clientes |
| `clientes.editar` | Editar clientes |
| `cotizaciones.ver` | Ver cotizaciones e historial |
| `cotizaciones.crear` | Capturar solicitudes y generar borradores |
| `cotizaciones.editar` | Editar lineas de un borrador |
| `cotizaciones.sobrescribir_precio` | Sobrescribir manualmente el precio de una linea |
| `cotizaciones.aprobar` | Aprobar una cotizacion |
| `cotizaciones.generar_documento` | Generar el PDF y el texto de entrega |
| `cotizaciones.registrar_resultado` | Marcar ganada o perdida |
| `cotizaciones.anular` | Anular una cotizacion con motivo |
| `plantillas.ver` | Ver plantillas de documento |
| `plantillas.administrar` | Editar la plantilla de documento |
| `reportes.ver` | Ver metricas e informes de la organizacion |

### Perfiles semilla

| Perfil | Ambito | Permisos |
|--------|--------|----------|
| `Superadmin Plataforma` | `PLATAFORMA` | `plataforma.*` mas lectura de metricas |
| `Administrador Organizacion` | `ORGANIZACION` | `configuracion.*`, `seguridad.*`, `catalogo.*`, `precios.*`, `clientes.*`, `cotizaciones.*`, `plantillas.*`, `reportes.ver` |
| `Cotizador` | `ORGANIZACION` | `catalogo.items.ver`, `catalogo.maestras.ver`, `catalogo.alias.administrar`, `precios.listas.ver`, `clientes.*`, `cotizaciones.ver`, `cotizaciones.crear`, `cotizaciones.editar`, `cotizaciones.aprobar`, `cotizaciones.generar_documento`, `cotizaciones.registrar_resultado`, `reportes.ver` |

El perfil `Cotizador` **no** puede administrar precios, reglas, usuarios ni plantillas, ni sobrescribir
manualmente un precio. Esa separacion es el motivo de tener dos perfiles por organizacion.

---

## Convenciones de base de datos

| Aspecto | Convencion |
|---------|-----------|
| Nombre de tabla | snake_case, plural, en español: `items`, `cotizacion_lineas` |
| Clase de entidad | PascalCase singular en español: `Item`, `CotizacionLinea` |
| Columna | camelCase, tal como lo genera TypeORM: `organizacionId`, `estadoRegistro` |
| Clave primaria | `uuid` generado por la base de datos |
| Enumerados | Tipo `enum` de PostgreSQL, valores en UPPER_SNAKE_CASE |
| Importes | `numeric(18,4)`; tasas `numeric(18,6)`; confianza `numeric(5,4)` |
| Cantidades | `numeric(18,4)` |
| Fechas de auditoria | `createdAt`, `updatedAt` gestionadas por el ORM |
| Autoria | `createdById`, `updatedById` como `uuid` sin clave foranea |
| Baja de configuracion | `estadoRegistro` con valores `ACTIVO` e `INACTIVO` |
| Baja transaccional | `anulado`, `anuladoAt`, `anuladoById`, `motivoAnulacion` |
| Datos flexibles | `jsonb` con validacion Zod en la aplicacion |
| Borrado fisico | Prohibido en datos de negocio |
| Indices de tenant | Todo indice de consulta frecuente comienza por `organizacionId` |

---

## Modelo de datos

### Tablas globales de plataforma

Sin columna de organizacion.

**`verticales`** — catalogo de rubros disponibles.
`id`, `codigo` (`FERRETERIA`, `REPUESTOS`, `AUTOMOTRIZ`, `GENERICO`), `nombre`, `descripcion`,
`estadoRegistro`.

**`monedas`** — catalogo de monedas.
`id`, `codigoIso`, `nombre`, `simbolo`, `decimales`, `estadoRegistro`.

**`perfiles`** — conjuntos de permisos.
`id`, `nombre`, `codigo`, `ambito` (`PLATAFORMA` | `ORGANIZACION`), `descripcion`, `esSistema`,
`estadoRegistro`.

**`permisos`** — catalogo de permisos.
`id`, `codigo`, `modulo`, `descripcion`.

**`perfil_permisos`** — relacion.
`id`, `perfilId`, `permisoId`. Unico por par.

### Organizacion y seguridad

**`organizaciones`**
`id`, `nombre`, `razonSocial`, `identificacionFiscal`, `verticalId`, `telefono`, `email`, `direccion`,
`logoUrl`, `monedaBaseId`, `monedaPresentacionId` (nulable), `zonaHoraria`, `locale`,
`usaIa` (booleano), `umbralAutomatico numeric(5,4)`, `umbralDescarte numeric(5,4)`, `notasInternas`,
`estadoRegistro`, auditoria.
Unico: `nombre`. Unico parcial: `identificacionFiscal` cuando no es nulo.

**`sucursales`**
`id`, `organizacionId`, `nombre`, `codigo`, `direccion`, `telefono`, `esPrincipal`, `estadoRegistro`,
auditoria. Unico: (`organizacionId`, `nombre`).

**`usuarios`**
`id`, `organizacionId` (nulable para plataforma), `nombreCompleto`, `email`, `passwordHash`,
`telefono`, `debeCambiarPassword`, `ultimoAccesoAt`, `estadoRegistro`, auditoria.
Unico: `email`.

**`usuario_perfiles`** — `id`, `usuarioId`, `perfilId`. Unico por par.

**`usuario_sucursales`** — `id`, `usuarioId`, `sucursalId`. Unico por par.

**`sesiones`**
`id`, `usuarioId`, `refreshTokenHash`, `expiraAt`, `revocadaAt`, `userAgent`, `ip`, `createdAt`.
Indice por `refreshTokenHash`.

### Configuracion de la organizacion

**`configuraciones_cotizacion`** — una fila por organizacion.
`id`, `organizacionId`, `vigenciaHorasPredeterminada` (48), `aplicaImpuesto`,
`porcentajeImpuesto numeric(9,4)`, `preciosIncluyenImpuesto`, `decimalesRedondeo`,
`modoRedondeo` (`NORMAL` | `ARRIBA` | `ABAJO`), `mostrarDescuentoDetallado`,
`permiteSobrescribirPrecio`, `listaPrecioPredeterminadaId`, auditoria.
Unico: `organizacionId`.

**`definiciones_atributo`**
`id`, `organizacionId`, `codigo`, `etiqueta`, `tipoDato` (`TEXTO` | `NUMERO` | `ENTERO` | `BOOLEANO` |
`LISTA` | `RANGO_ANIO`), `opciones jsonb`, `unidadSugerida`, `requerido`, `usarEnBusqueda`, `orden`,
`estadoRegistro`, auditoria. Unico: (`organizacionId`, `codigo`).

**`unidades_medida`**
`id`, `organizacionId`, `codigo`, `nombre`, `permiteDecimales`, `estadoRegistro`, auditoria.
Unico: (`organizacionId`, `codigo`).

**`categorias`**
`id`, `organizacionId`, `nombre`, `categoriaPadreId` (nulable, un solo nivel), `orden`,
`estadoRegistro`, auditoria. Unico: (`organizacionId`, `categoriaPadreId`, `nombre`).

**`marcas`**
`id`, `organizacionId`, `nombre`, `estadoRegistro`, auditoria. Unico: (`organizacionId`, `nombre`).

### Catalogo

**`items`**
`id`, `organizacionId`, `sku` (nulable), `nombre`, `descripcion`, `categoriaId` (nulable),
`marcaId` (nulable), `unidadMedidaId`, `tipoItem` (`FUNGIBLE` | `SERIALIZADO` | `SERVICIO`),
`atributos jsonb`, `textoBusqueda` (derivada, normalizada), `controlaStock`,
`stockAproximado numeric(18,4)` (nulable), `estadoRegistro`, auditoria.
Unico parcial: (`organizacionId`, `sku`) cuando `sku` no es nulo.
Indices: GIN trigram sobre `textoBusqueda`; GIN sobre `atributos`;
(`organizacionId`, `estadoRegistro`); (`organizacionId`, `categoriaId`).

**`item_alias`**
`id`, `organizacionId`, `itemId`, `alias`, `normalizado`, `origen` (`MANUAL` | `APRENDIDO` |
`IMPORTADO`), `vecesUsado`, `estadoRegistro`, auditoria.
Unico: (`itemId`, `normalizado`). Indice GIN trigram sobre `normalizado` con `organizacionId`.

**`item_aplicaciones`** — compatibilidades.
`id`, `organizacionId`, `itemId`, `datos jsonb`, `textoNormalizado`, `estadoRegistro`, auditoria.
Indice GIN trigram sobre `textoNormalizado`.

**`terminos_no_resueltos`** — insumo para curar el catalogo.
`id`, `organizacionId`, `textoNormalizado`, `ejemploOriginal`, `vecesVisto`, `ultimaVezAt`,
`resueltoConItemId` (nulable), `estadoRegistro`. Unico: (`organizacionId`, `textoNormalizado`).

**`importaciones_catalogo`**
`id`, `organizacionId`, `tipo` (`ITEMS` | `PRECIOS` | `ALIAS`), `nombreArchivo`, `mapeoColumnas jsonb`,
`estado` (`CARGADA` | `VALIDADA` | `CONFIRMADA` | `FALLIDA` | `CANCELADA`), `filasTotales`,
`filasValidas`, `filasConError`, `erroresDetalle jsonb`, `resumen jsonb`, auditoria.

### Precios

**`listas_precio`**
`id`, `organizacionId`, `nombre`, `codigo`, `monedaId`, `esPredeterminada`, `vigenciaDesde`,
`vigenciaHasta`, `estadoRegistro`, auditoria. Unico: (`organizacionId`, `codigo`).

**`precios_item`**
`id`, `organizacionId`, `listaPrecioId`, `itemId`, `precio numeric(18,4)`, `estadoRegistro`, auditoria.
Unico: (`listaPrecioId`, `itemId`).

**`reglas_descuento`**
`id`, `organizacionId`, `listaPrecioId` (nulable, nulo aplica a todas), `nombre`,
`ambito` (`ITEM` | `CATEGORIA` | `MARCA` | `GLOBAL`), `referenciaId` (nulable segun ambito),
`cantidadMinima numeric(18,4)`, `cantidadMaxima` (nulable), `tipoDescuento` (`PORCENTAJE` |
`MONTO_FIJO` | `PRECIO_FIJO`), `valor numeric(18,4)`, `prioridad`, `vigenciaDesde`, `vigenciaHasta`,
`estadoRegistro`, auditoria.

**`tasas_cambio`**
`id`, `organizacionId`, `monedaOrigenId`, `monedaDestinoId`, `valor numeric(18,6)`, `fechaVigencia`,
`fuente` (`MANUAL` | `AUTOMATICA`), `estadoRegistro`, auditoria.
Unico: (`organizacionId`, `monedaOrigenId`, `monedaDestinoId`, `fechaVigencia`).

### Clientes

**`clientes`**
`id`, `organizacionId`, `nombre`, `telefonoWhatsapp`, `email`, `identificacionFiscal`,
`listaPrecioId` (nulable, si es nulo se usa la predeterminada), `direccion`, `notas`,
`estadoRegistro`, auditoria.
Unico parcial: (`organizacionId`, `telefonoWhatsapp`) cuando no es nulo.

### Solicitud e interpretacion

**`solicitudes`**
`id`, `organizacionId`, `sucursalId` (nulable), `clienteId` (nulable), `canal` (`WHATSAPP_PEGADO` |
`MANUAL` | `API`), `textoOriginal`, `textoNormalizado`, `estado` (`PENDIENTE` | `INTERPRETADA` |
`FALLIDA`), `recibidaAt`, auditoria.

**`interpretaciones_solicitud`**
`id`, `organizacionId`, `solicitudId`, `proveedor`, `modelo`, `versionPrompt`, `exito`,
`resultado jsonb`, `advertencias jsonb`, `errorCodigo`, `errorDetalle`, `latenciaMs`,
`tokensEntrada`, `tokensSalida`, `costoEstimado numeric(18,6)`, `createdAt`, `createdById`.

### Cotizacion

**`secuencias_folio`** — numeracion por organizacion.
`id`, `organizacionId`, `ultimoNumero`. Unico: `organizacionId`. Se incrementa con bloqueo de fila
dentro de la transaccion que crea la cotizacion.

**`cotizaciones`**
`id`, `organizacionId`, `sucursalId`, `folioNumero`, `folio` (texto ya formateado),
`solicitudId` (nulable), `clienteId` (nulable), `nombreClienteLibre`, `telefonoClienteLibre`,
`listaPrecioId`, `monedaBaseId`, `monedaPresentacionId` (nulable), `tasaAplicada numeric(18,6)`,
`tasaFecha`, `estado` (`BORRADOR` | `APROBADA` | `ENVIADA` | `GANADA` | `PERDIDA` | `VENCIDA` |
`ANULADA`), `vigenciaHasta`, `subtotal`, `descuentoTotal`, `impuestoTotal`, `total`,
`totalPresentacion` (nulable), `porcentajeImpuestoAplicado`, `textoCondiciones`, `textoPie`,
`observaciones`, `aprobadaPorId`, `aprobadaAt`, `enviadaAt`, `resultadoAt`, `motivoPerdida`,
`anulado`, `anuladoAt`, `anuladoById`, `motivoAnulacion`, `cotizacionOrigenId` (nulable, para
duplicados), auditoria.
Unico: (`organizacionId`, `folioNumero`).
Indices: (`organizacionId`, `estado`, `createdAt`); (`organizacionId`, `clienteId`).

**`cotizacion_lineas`**
`id`, `organizacionId`, `cotizacionId`, `orden`, `textoSolicitado`, `itemId` (nulable),
`descripcion` (congelada al aprobar), `sku` (congelado), `atributosCongelados jsonb` (congelado
al aprobar; el PDF lee de aquí), `marcaCongelada` (congelada), `unidadMedidaId`, `cantidad numeric(18,4)`,
`precioLista numeric(18,4)`, `precioUnitario numeric(18,4)`, `reglaDescuentoId` (nulable),
`descuentoMonto numeric(18,4)`, `descuentoPorcentaje numeric(9,4)`, `precioSobrescrito` (booleano),
`motivoSobrescritura`, `subtotal`, `total`,
`estadoResolucion` (`RESUELTA_AUTOMATICA` | `RESUELTA_MANUAL` | `SUGERIDA_REVISAR` |
`NO_ENCONTRADA` | `AGREGADA_MANUAL`), `confianza numeric(5,4)`,
`origenMatch` (`SKU` | `ALIAS_EXACTO` | `ALIAS_SIMILITUD` | `TEXTO_SIMILITUD` | `ATRIBUTO` |
`MANUAL`), `notas`, auditoria.

**`cotizacion_linea_candidatos`**
`id`, `organizacionId`, `cotizacionLineaId`, `itemId`, `puntaje numeric(5,4)`, `origenMatch`, `orden`.

**`cotizacion_eventos`** — bitacora inmutable.
`id`, `organizacionId`, `cotizacionId`, `tipo`, `descripcion`, `datos jsonb`, `usuarioId`, `createdAt`.
Tipos: `CREADA`, `INTERPRETADA`, `LINEA_CORREGIDA`, `LINEA_AGREGADA`, `LINEA_ELIMINADA`,
`PRECIO_SOBRESCRITO`, `ALIAS_APRENDIDO`, `RECALCULADA`, `APROBADA`, `DOCUMENTO_GENERADO`, `ENVIADA`,
`MARCADA_GANADA`, `MARCADA_PERDIDA`, `VENCIDA`, `ANULADA`, `DUPLICADA`.
Solo se inserta. Nunca se actualiza ni se elimina.

### Documento

**`plantillas_documento`**
`id`, `organizacionId`, `nombre`, `esPredeterminada`, `version`, `configuracion jsonb`,
`estadoRegistro`, auditoria.

**`documentos_generados`**
`id`, `organizacionId`, `cotizacionId`, `plantillaId`, `plantillaVersion`, `formato` (`PDF`),
`rutaArchivo`, `hashContenido`, `tamanoBytes`, `generadoPorId`, `createdAt`.

---

## Convenciones de API

### Formato

| Aspecto | Convencion |
|---------|-----------|
| Prefijo | `/api` |
| Recursos | Plural en español y kebab-case: `/api/listas-precio` |
| Respuesta exitosa | `{ "data": ... }` |
| Respuesta paginada | `{ "data": { "items": [...], "meta": { "page", "limit", "total", "totalPages" } } }` |
| Error | `{ "error": { "code": "...", "message": "...", "details": ... } }` |
| Importes | Cadenas decimales, no numeros: `"1234.5600"` |
| Fechas | ISO 8601 en UTC |
| Consulta de listado | `page`, `limit`, `search`, `estadoRegistro`, mas filtros del recurso |

### Codigos de estado

| Codigo | Uso |
|--------|-----|
| 200 | Lectura y actualizacion correctas |
| 201 | Creacion correcta |
| 400 | Entrada invalida segun el esquema |
| 401 | Sin autenticacion o token expirado |
| 403 | Autenticado sin el permiso requerido |
| 404 | No existe, o existe en otra organizacion |
| 409 | Conflicto de unicidad o estado incompatible |
| 422 | Regla de negocio incumplida |
| 502 | Fallo de un servicio externo (IA, generacion de PDF) |

### Endpoints principales

#### Autenticacion

| Metodo | Ruta | Permiso |
|--------|------|---------|
| POST | `/api/auth/login` | publico |
| POST | `/api/auth/refresh` | publico con cookie |
| POST | `/api/auth/logout` | autenticado |
| GET | `/api/auth/perfil` | autenticado |
| POST | `/api/auth/cambiar-password` | autenticado |
| POST | `/api/auth/sucursal-activa` | autenticado |

#### Plataforma

| Metodo | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/organizaciones` | `plataforma.organizaciones.ver` |
| POST | `/api/organizaciones` | `plataforma.organizaciones.crear` |
| GET | `/api/organizaciones/:id` | `plataforma.organizaciones.ver` |
| PATCH | `/api/organizaciones/:id` | `plataforma.organizaciones.editar` |
| POST | `/api/organizaciones/:id/usuario-inicial` | `plataforma.usuarios.administrar` |
| GET | `/api/verticales` | autenticado |
| GET | `/api/monedas` | autenticado |

#### Catalogo

| Metodo | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/items` | `catalogo.items.ver` |
| GET | `/api/items/buscar?q=` | `catalogo.items.ver` |
| POST | `/api/items` | `catalogo.items.crear` |
| PATCH | `/api/items/:id` | `catalogo.items.editar` |
| POST | `/api/items/:id/alias` | `catalogo.alias.administrar` |
| DELETE | `/api/items/:id/alias/:aliasId` | `catalogo.alias.administrar` |
| GET | `/api/items/:id/aplicaciones` | `catalogo.items.ver` |
| POST | `/api/items/:id/aplicaciones` | `catalogo.items.editar` |
| GET | `/api/terminos-no-resueltos` | `catalogo.items.ver` |
| GET/POST/PATCH | `/api/categorias`, `/api/marcas`, `/api/unidades-medida`, `/api/definiciones-atributo` | `catalogo.maestras.*` |
| POST | `/api/importaciones` | `catalogo.items.importar` |
| POST | `/api/importaciones/:id/validar` | `catalogo.items.importar` |
| POST | `/api/importaciones/:id/confirmar` | `catalogo.items.importar` |

#### Precios

| Metodo | Ruta | Permiso |
|--------|------|---------|
| GET/POST/PATCH | `/api/listas-precio` | `precios.listas.*` |
| GET/PUT | `/api/listas-precio/:id/precios` | `precios.listas.*` |
| GET/POST/PATCH | `/api/reglas-descuento` | `precios.reglas.administrar` |
| GET/POST | `/api/tasas-cambio` | `precios.tasas.administrar` |
| GET/PATCH | `/api/configuracion-cotizacion` | `configuracion.organizacion.*` |

#### Cotizaciones

| Metodo | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| POST | `/api/precotizaciones` | `cotizaciones.crear` | Ejecuta el pipeline completo y devuelve el borrador |
| POST | `/api/precotizaciones/:solicitudId/reprocesar` | `cotizaciones.crear` | Nueva interpretacion; reescribe el borrador indicado |
| GET | `/api/cotizaciones` | `cotizaciones.ver` | Historial con filtros |
| GET | `/api/cotizaciones/:id` | `cotizaciones.ver` | Con lineas y candidatos |
| PATCH | `/api/cotizaciones/:id` | `cotizaciones.editar` | Cliente, lista, vigencia, observaciones |
| POST | `/api/cotizaciones/:id/lineas` | `cotizaciones.editar` | Agregar linea manual |
| PATCH | `/api/cotizaciones/:id/lineas/:lineaId` | `cotizaciones.editar` | Cambiar item, cantidad, precio; opcion `guardarAlias` |
| DELETE | `/api/cotizaciones/:id/lineas/:lineaId` | `cotizaciones.editar` | Quitar linea del borrador |
| POST | `/api/cotizaciones/:id/aprobar` | `cotizaciones.aprobar` | Congela precios, descuentos y tasa |
| GET | `/api/cotizaciones/:id/mensaje` | `cotizaciones.generar_documento` | Texto listo para WhatsApp |
| POST | `/api/cotizaciones/:id/documento` | `cotizaciones.generar_documento` | Genera el PDF |
| GET | `/api/cotizaciones/:id/documento` | `cotizaciones.ver` | Descarga el archivo ya generado |
| POST | `/api/cotizaciones/:id/enviada` | `cotizaciones.registrar_resultado` | Marca como entregada |
| POST | `/api/cotizaciones/:id/resultado` | `cotizaciones.registrar_resultado` | Ganada o perdida con motivo |
| POST | `/api/cotizaciones/:id/anular` | `cotizaciones.anular` | Exige motivo |
| POST | `/api/cotizaciones/:id/duplicar` | `cotizaciones.crear` | Nuevo borrador con precios vigentes |

#### Plantillas y reportes

| Metodo | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/plantillas-documento` | `plantillas.ver` |
| GET | `/api/plantillas-documento/:id` | `plantillas.ver` |
| PATCH | `/api/plantillas-documento/:id` | `plantillas.administrar` |
| POST | `/api/plantillas-documento/:id/previsualizar` | `plantillas.administrar` |
| GET | `/api/reportes/cotizaciones-resumen` | `reportes.ver` |
| GET | `/api/reportes/desempeno-reconocimiento` | `reportes.ver` |
| GET | `/api/reportes/terminos-fallidos` | `reportes.ver` |

---

## Contrato de la generacion de precotizacion

```typescript
// POST /api/precotizaciones
type CrearPrecotizacionInput = {
  textoOriginal: string;          // maximo 4000 caracteres
  clienteId?: string;
  nombreClienteLibre?: string;
  telefonoClienteLibre?: string;
  listaPrecioId?: string;         // si falta, la del cliente o la predeterminada
  sucursalId?: string;
  canal?: 'WHATSAPP_PEGADO' | 'MANUAL';
};

type PrecotizacionResultado = {
  cotizacion: CotizacionDetalle;  // en estado BORRADOR
  interpretacion: {
    exito: boolean;
    proveedor: string;
    latenciaMs: number;
    advertencias: string[];
  };
  resumen: {
    lineasTotales: number;
    resueltasAutomaticas: number;
    sugeridas: number;
    noEncontradas: number;
  };
};
```

Si la interpretacion falla, la respuesta es 201 con `interpretacion.exito` en falso, la cotizacion
creada sin lineas y una advertencia. Nunca es un error de la peticion: el operador debe poder seguir
trabajando.

---

## Reglas de negocio criticas

Estas reglas se implementan en servicios o funciones puras y deben tener prueba automatizada.

1. Ninguna consulta devuelve datos de otra organizacion. Un identificador ajeno responde 404.
2. Ningun importe proviene de la salida del proveedor de IA.
3. Una cotizacion sin lineas no se puede aprobar.
4. Una cotizacion con al menos una linea en estado `NO_ENCONTRADA` o sin precio no se puede aprobar.
5. Aprobar congela precio unitario, descuento, regla aplicada, impuesto, tasa, descripcion y SKU de
   cada linea.
6. Una cotizacion aprobada o posterior no admite edicion de lineas. Para cambiarla hay que anularla y
   duplicarla.
7. Las transiciones de estado siguen la tabla del glosario. Cualquier otra transicion es error 422.
8. La anulacion exige motivo de al menos diez caracteres y conserva el registro completo.
9. Un item inactivo no se puede agregar a un borrador nuevo, pero permanece intacto en cotizaciones
   historicas.
10. Un item con precio ausente en la lista aplicada no es cotizable y su linea se marca para revision.
11. El folio se asigna en la creacion, es consecutivo por organizacion y no se reutiliza aunque la
    cotizacion se anule.
12. La cantidad de una linea debe ser mayor que cero, y entera si la unidad no admite decimales.
13. Un item de tipo `SERIALIZADO` admite cantidad uno como maximo.
14. Sobrescribir un precio exige el permiso correspondiente, un motivo y genera un evento.
15. Un alias aprendido se crea solo con confirmacion explicita del operador, nunca de forma automatica.
16. La vigencia se calcula al aprobar, sumando las horas configuradas a la fecha de aprobacion.
17. Una cotizacion enviada cuya vigencia expiro pasa a `VENCIDA` y no admite marcado de resultado sin
    reabrirla como duplicado, salvo el registro de ganada o perdida que si se permite.
18. Los atributos de un item se validan contra las definiciones activas de la organizacion; una clave
    desconocida es error 400.
19. El texto de busqueda del item se regenera en cada guardado del item y en cada cambio de sus alias.
20. Toda accion relevante sobre una cotizacion inserta un evento en la bitacora.

---

## Semilla inicial

El seed debe crear, de forma idempotente:

- Catalogo de permisos completo.
- Perfiles `Superadmin Plataforma`, `Administrador Organizacion` y `Cotizador` con sus permisos.
- Monedas iniciales: USD, VES, COP, EUR.
- Verticales: `FERRETERIA`, `REPUESTOS`, `AUTOMOTRIZ`, `GENERICO`.
- Usuario superadmin de plataforma con credenciales tomadas de variables de entorno.
- Organizacion de demostracion `Demo Ferretería` (vertical ferreteria). Con `SEED_DEMO` distinto de
  `false` (por defecto): pack de maestras, lista de precios, plantilla, items de ejemplo con precios y
  alias, cliente de mostrador, tasa USD→VES, usuarios admin y cotizador. Desactivar con `SEED_DEMO=false`.

---

## Orden de implementacion

| Etapa | Entregable | Especificacion |
|-------|-----------|----------------|
| 1 | Monorepo, base de datos, migracion inicial, extensiones, seed de permisos y perfiles | `specs/000` |
| 2 | Autenticacion, sesiones, contexto de organizacion, guard y filtro de errores | `specs/001` |
| 3 | Plataforma: organizaciones, provisionamiento por vertical, usuario inicial | `specs/000` |
| 4 | Usuarios, perfiles y sucursales dentro de la organizacion | `specs/001`, `specs/002` |
| 5 | Maestras de catalogo: categorias, marcas, unidades, definiciones de atributo | `specs/003` |
| 6 | Items, alias, aplicaciones y busqueda con similitud | `specs/004` |
| 7 | Listas de precios, precios, reglas de descuento, tasas y motor de precios | `specs/006` |
| 8 | Importacion de catalogo, precios y alias | `specs/005` |
| 9 | Clientes | `specs/007` |
| 10 | Pipeline de precotizacion completo con proveedor simulado | `specs/008` |
| 11 | Revision, edicion, aprobacion y texto para WhatsApp | `specs/009` |
| 12 | Plantilla de documento y generacion de PDF | `specs/010` |
| 13 | Historial, estados finales y metricas | `specs/011` |
| 14 | Proveedor de IA real y ajuste de umbrales con datos reales | `specs/008` |

## Criterios para comenzar a codificar

- [x] Vision y alcance acordados.
- [x] Decisiones de arquitectura documentadas en ADRs.
- [x] Modelo de datos definido con nombres, tipos y claves.
- [x] Modelo de seguridad con permisos y perfiles definido.
- [x] Contratos de API definidos para los flujos principales.
- [x] Especificaciones por modulo escritas con criterios de aceptacion.
- [x] Convenciones de implementacion y catalogo de errores publicados.

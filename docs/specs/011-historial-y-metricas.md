# Spec 011: Historial y metricas

## Estado

Especificada — pendiente de implementacion (2026-09-17)

## Objetivo

Definir el historial de cotizaciones de una organización —listado con filtros, detalle con bitácora
de eventos y acciones posteriores a la emisión— y las métricas del piloto que validan si el producto
sirve.

Las métricas no se inventan: se derivan de cotizaciones, líneas, eventos de bitácora e
interpretaciones, según `docs/decisions/0011-auditoria-y-trazabilidad.md`. El vencimiento de una
cotización enviada se evalúa al consultarla, sin trabajo programado en el MVP. La vista de
plataforma agrega conteos entre organizaciones sin exponer datos de negocio detallados.

Invariantes que esta especificación no negocia: ninguna cotización se entrega sin aprobación humana
registrada; una cotización aprobada no cambia de valor; los importes viajan como cadenas con 4
decimales; ninguna consulta devuelve datos de otra organización.

## Dependencias

| Documento | Aporta |
|-----------|--------|
| `docs/06-diseno-tecnico.md` | Endpoints de cotizaciones y reportes, estados, tabla `cotizacion_eventos` |
| `docs/decisions/0011-auditoria-y-trazabilidad.md` | Bitácora append-only, anulación, congelamiento y base de las métricas |
| `docs/decisions/0008-moneda-base-y-presentacion.md` | Montos del piloto en moneda base; tasa congelada irrelevante para revalorizar |
| `docs/05-alcance-mvp.md` | Métricas del piloto y acciones de historial incluidas en el MVP |
| `docs/specs/009-revision-aprobacion.md` | Transiciones de estado, aprobación, resultado y anulación |
| `docs/specs/010-plantillas-documento.md` | Reentrega del PDF y recopiado del texto desde el historial |

Requisitos previos de implementación:

1. Cotizaciones con estados y eventos insertados en las operaciones de creación, aprobación, envío,
   resultado y anulación.
2. Líneas con `estadoResolucion` e interpretaciones asociadas a solicitudes.
3. Permisos `cotizaciones.ver`, `cotizaciones.crear`, `reportes.ver` y `plataforma.metricas.ver`.

## Alcance MVP v1

Incluye:

- Listado paginado de cotizaciones con filtros por estado, cliente, rango de fechas, usuario
  capturador o aprobador, sucursal y texto de folio.
- Detalle de cotización con líneas, totales congelados, documento generado si existe y bitácora de
  eventos ordenada.
- Acciones desde el historial: reabrir o continuar un borrador, duplicar, recopiar texto de
  WhatsApp, descargar PDF ya generado, marcar enviada, registrar ganada o perdida, anular con
  motivo.
- Evaluación de vencimiento al consultar o listar (sin cron en el MVP).
- Métricas del piloto por organización con fórmulas exactas definidas abajo.
- Vista agregada de plataforma sin datos de negocio detallados (sin clientes, sin líneas, sin
  folios, sin textos de solicitud).

No incluye en esta versión:

| Fuera de alcance | Motivo |
|------------------|--------|
| Trabajo programado (cron) que marque vencidas en lote | Diferido; el MVP usa evaluación perezosa al consultar |
| Tablero analítico externo o exportación masiva a BI | El volumen del piloto no lo exige |
| Event sourcing completo | Descartado en ADR 0011 |
| Borrado físico de cotizaciones o eventos | Prohibido |
| Edición de líneas de una cotización ya aprobada | Hay que anular y duplicar; ver spec 009 |
| Comparación de métricas entre verticales con lógica distinta | Ninguna regla ramifica por vertical |
| Alertas push o correo por vencimiento | Fuera del piloto |

## Conceptos principales

| Concepto | Definicion operativa |
|----------|----------------------|
| Historial | Listado y detalle de cotizaciones de la organización, incluidos borradores y anuladas |
| Bitacora | Secuencia append-only de `cotizacion_eventos` de una cotización |
| Accion de historial | Operación permitida según el estado actual (duplicar, marcar resultado, reentregar, etc.) |
| Vencimiento perezoso | Al leer o listar una cotización `ENVIADA` con `vigenciaHasta` en el pasado, se transiciona a `VENCIDA` y se registra el evento antes de responder |
| Metrica del piloto | Indicador derivado únicamente de cotizaciones, líneas, eventos e interpretaciones |
| Vista plataforma | Agregación entre organizaciones con conteos y tasas, sin payloads de negocio |
| Periodo | Intervalo `[desde, hasta]` en UTC aplicado a la fecha de creación de la cotización, salvo que la métrica indique otra marca temporal |

### Tipos de evento relevantes para metricas

Se usan los tipos de `docs/decisions/0011-auditoria-y-trazabilidad.md`. Para las fórmulas de esta
especificación importan en particular:

| Tipo | Uso en metricas |
|------|-----------------|
| `COTIZACION_CREADA` | Instantánea de captura |
| `COTIZACION_APROBADA` | Instantánea de aprobación |
| `LINEA_RESUELTA_AUTOMATICA` | Numerador de tasa automática (alternativa: estado de línea) |
| `LINEA_CORREGIDA` | Numerador de tasa de corrección y fuente de términos fallidos |
| `MARCADA_GANADA` / `MARCADA_PERDIDA` | Conversión comercial |
| `COTIZACION_VENCIDA` | Conteo de vencidas y auditoría del vencimiento perezoso |
| `INTERPRETACION_EJECUTADA` | Latencia y éxito de interpretaciones en el periodo |

Cuando el diseño técnico de `docs/06-diseno-tecnico.md` nombre un tipo más corto (`CREADA`,
`APROBADA`, …), la implementación unifica al catálogo del ADR 0011. No coexisten dos bitácoras.

## Datos requeridos

### Lectura de cotizacion en historial

No se crean tablas nuevas. Se leen:

| Fuente | Campos usados |
|--------|---------------|
| `cotizaciones` | Folio, estados, cliente, totales, monedas, vigencia, auditoría, anulación |
| `cotizacion_lineas` | Descripción congelada, cantidades, importes, `estadoResolucion` |
| `cotizacion_eventos` | Tipo, descripción, `datos`, `usuarioId`, `createdAt` / `ocurridoAt` |
| `documentos_generados` | Existencia, hash, versión de plantilla |
| `interpretaciones_solicitud` | Éxito, latencia, tokens, costo estimado |
| `terminos_no_resueltos` | Texto normalizado, `vecesVisto` para el reporte de fallidos |

### Filtros del listado

| Parametro | Obligatorio | Notas |
|-----------|-------------|-------|
| `page`, `limit` | No | Paginación estándar; `limit` máximo 100 |
| `estado` | No | Uno o varios de los estados del glosario |
| `clienteId` | No | Debe pertenecer a la organización |
| `desde`, `hasta` | No | Rango sobre `cotizaciones.createdAt` en UTC |
| `usuarioId` | No | Filtra por `createdById` o, con `rolUsuario=APROBADOR`, por `aprobadaPorId` |
| `sucursalId` | No | Validada contra `ctx.sucursalIds` |
| `search` | No | Coincide con folio o nombre de cliente (libre o ficha) |
| `anulado` | No | Si es verdadero, solo anuladas; por defecto se incluyen todas |

### Metricas del piloto — formulas exactas

Todas las métricas de organización filtran por `organizacionId = ctx.organizacionId`. Los montos se
expresan en moneda base como cadenas con 4 decimales. Una división por cero devuelve `"0.0000"` o
`0` según el tipo del campo, nunca un error.

#### 1. Cantidad por estado

```text
cantidadPorEstado[E] = COUNT(cotizaciones)
  WHERE organizacionId = :org
    AND createdAt IN [:desde, :hasta]
    AND estado = E
    AND anulado = false   -- las ANULADA se cuentan solo en E = ANULADA
```

Se devuelve un mapa con una entrada por cada estado del glosario, incluyendo ceros. Las anuladas
figuran únicamente en la clave `ANULADA`.

#### 2. Tiempo mediano captura → aprobacion

Sea el conjunto de cotizaciones del periodo que tienen evento `COTIZACION_APROBADA`:

```text
duracion_i = ocurridoAt(COTIZACION_APROBADA)_i - ocurridoAt(COTIZACION_CREADA)_i
tiempoMedianoCapturaAprobacionMs = MEDIANA({ duracion_i | duracion_i >= 0 })
```

Si no hay ninguna cotización aprobada en el periodo, el valor es `null`. La mediana de un conjunto
par es el promedio de los dos valores centrales, redondeado al milisegundo más cercano.

#### 3. Tasa de lineas automaticas

Sobre las líneas de cotizaciones creadas en el periodo (cualquier estado, no anuladas al crear el
borrador; se incluyen todas las líneas existentes de esas cotizaciones):

```text
tasaAutomaticas = COUNT(lineas WHERE estadoResolucion = 'RESUELTA_AUTOMATICA')
                / COUNT(lineas)
```

Resultado como cadena decimal con 4 decimales en el intervalo `[0, 1]`. Si no hay líneas, `"0.0000"`.

#### 4. Tasa de correccion

```text
tasaCorreccion = COUNT(eventos tipo LINEA_CORREGIDA de cotizaciones del periodo)
               / COUNT(lineas de cotizaciones del periodo)
```

Una línea corregida varias veces cuenta varias veces en el numerador. Resultado cadena con 4
decimales. Si no hay líneas, `"0.0000"`.

#### 5. Montos en moneda base

```text
montoTotalAprobado = SUM(total) WHERE estado IN (APROBADA, ENVIADA, GANADA, PERDIDA, VENCIDA)
                     AND createdAt IN periodo AND anulado = false

montoGanado = SUM(total) WHERE estado = GANADA
              AND createdAt IN periodo AND anulado = false

montoPerdido = SUM(total) WHERE estado = PERDIDA
               AND createdAt IN periodo AND anulado = false
```

Los `total` son los congelados en moneda base. No se convierte ni se revaloriza con la tasa vigente.

#### 6. Conversion comercial

```text
conversion = COUNT(estado = GANADA en periodo, no anulada)
           / (COUNT(estado = GANADA) + COUNT(estado = PERDIDA))
```

Solo cotizaciones con resultado explícito. Si el denominador es 0, `"0.0000"`. No incluye vencidas
ni enviadas sin resultado.

#### 7. Terminos fallidos

Lista de los N textos que más fallaron al resolverse en el periodo:

```text
Fuente primaria: terminos_no_resueltos de la organización con ultimaVezAt IN periodo
  ordenados por vecesVisto DESC, limite N (default 20)

Complemento: textos de LINEA_CORREGIDA.datos.textoSolicitado y líneas con
  estadoResolucion = NO_ENCONTRADA en cotizaciones del periodo, agregados por
  texto normalizado, si el término aún no está en la fuente primaria
```

Cada ítem devuelve `textoNormalizado`, `ejemploOriginal`, `vecesVisto` y, si existe,
`resueltoConItemId`. No se revelan datos de otra organización.

### Vista agregada de plataforma

| Campo | Formula |
|-------|---------|
| `organizacionesActivas` | COUNT organizaciones con al menos una cotización creada en el periodo |
| `cotizacionesTotales` | COUNT cotizaciones creadas en el periodo en toda la plataforma |
| `aprobadasTotales` | COUNT con evento `COTIZACION_APROBADA` en el periodo |
| `tasaAprobacionGlobal` | `aprobadasTotales / cotizacionesTotales` (4 decimales) |
| `tiempoMedianoGlobalMs` | Mediana de duraciones captura→aprobación de todas las organizaciones |
| `ganadasTotales` / `perdidasTotales` | Conteos globales de estados en el periodo |

Prohibido en esta vista: nombres de cliente, folios, textos de solicitud, líneas, importes por
organización identificable, alias o catálogo. Si se lista por organización, solo se exponen
`organizacionId`, `nombre` de la organización y los conteos agregados anteriores.

## Reglas de negocio

### Alcance y aislamiento

1. Toda operación de historial y de reportes de organización exige `ctx.organizacionId` no nulo.
2. Toda consulta filtra por `organizacionId` del contexto antes de cualquier otro criterio.
3. Un identificador de cotización, cliente, evento o documento ajeno responde 404.
4. La vista de plataforma exige `ambito = PLATAFORMA` y permiso `plataforma.metricas.ver`. Un
   usuario de organización recibe 403 si intenta esa ruta.
5. Los eventos de bitácora no se actualizan ni se eliminan. No existe endpoint de escritura sobre
   eventos.

### Listado y detalle

6. El listado no ejecuta borrado lógico oculto: las anuladas aparecen marcadas; los borradores
   aparecen; las vencidas aparecen.
7. El detalle incluye líneas con importes congelados, candidatos si el estado es borrador, bitácora
   completa ordenada por tiempo ascendente y metadato del documento generado si existe.
8. Abrir el detalle de una cotización aprobada muestra la descripción congelada aunque el item del
   catálogo se haya renombrado o inactivado.
9. Los importes del detalle viajan como cadenas con 4 decimales.

### Acciones desde el historial

| Estado actual | Acciones permitidas |
|---------------|---------------------|
| `BORRADOR` | Continuar edición, aprobar (vía spec 009), anular, duplicar |
| `APROBADA` | Generar o descargar PDF, obtener mensaje, marcar enviada, anular, duplicar |
| `ENVIADA` | Descargar PDF, recopiar mensaje, marcar ganada o perdida, anular, duplicar; al consultar puede pasar a `VENCIDA` |
| `VENCIDA` | Marcar ganada o perdida, descargar PDF, duplicar; no editar líneas |
| `GANADA` / `PERDIDA` | Descargar PDF, recopiar mensaje, duplicar; sin más transiciones de resultado |
| `ANULADA` | Consultar, descargar PDF si existía, duplicar; sin editar ni reactivar |

10. Duplicar crea un nuevo borrador con precios vigentes del catálogo, referencia
    `cotizacionOrigenId` y evento `COTIZACION_DUPLICADA`. No copia el folio ni el documento.
11. Recopiar el mensaje y descargar el PDF reutilizan `docs/specs/010-plantillas-documento.md`.
12. Marcar ganada o perdida y anular siguen las reglas de `docs/specs/009-revision-aprobacion.md`
    (motivo obligatorio en pérdida y anulación).
13. Ninguna acción del historial modifica importes de una cotización ya aprobada.

### Vencimiento perezoso (sin cron en el MVP)

14. No hay trabajo programado en el MVP que recorra cotizaciones para marcarlas `VENCIDA`.
15. Al ejecutar `GET /api/cotizaciones`, `GET /api/cotizaciones/:id` o cualquier acción sobre una
    cotización en estado `ENVIADA`, el servicio evalúa `vigenciaHasta < now()`. Si se cumple:
    a. Transiciona a `VENCIDA` dentro de la misma transacción de lectura/escritura.
    b. Inserta evento `COTIZACION_VENCIDA` con la fecha de vigencia alcanzada.
    c. Responde ya con el estado `VENCIDA`.
16. La evaluación es idempotente: una cotización ya `VENCIDA` no genera un segundo evento.
17. Alternativa diferida (fase posterior): un trabajo programado nocturno que aplique la misma
    transición en lote. Hasta entonces, una cotización enviada y vencida que nadie consulta puede
    permanecer `ENVIADA` en base; las métricas de “vencidas” cuentan el estado tras la evaluación
    perezosa y, para reportes, también pueden incluir `ENVIADA` con `vigenciaHasta` pasado como
    “vencidas de facto” en un campo separado `vencidasPendientesDeMarca`.
18. Desde `VENCIDA` se permite marcar ganada o perdida (regla 17 del diseño técnico); no se permite
    editar líneas.

### Metricas

19. Las métricas de organización exigen `reportes.ver` y filtran solo la organización del contexto.
20. Las métricas se calculan en consulta; no hay tabla de hechos materializada en el MVP.
21. El periodo por defecto es los últimos 30 días calendario en la zona horaria de la organización,
    convertido a UTC para filtrar.
22. `desde` posterior a `hasta` responde 400.
23. Ninguna métrica usa la salida de un modelo de lenguaje como importe. Los costos estimados de
    interpretación son metadato técnico, no venta.

### Vista plataforma

24. Solo agregados: conteos, tasas y medianas globales o por organización sin detalle comercial.
25. No se puede navegar desde la vista plataforma al detalle de una cotización ajena.

## Permisos

| Operacion | Permiso |
|-----------|---------|
| Listar y ver cotizaciones e historial | `cotizaciones.ver` |
| Duplicar una cotización | `cotizaciones.crear` |
| Marcar enviada, ganada o perdida | `cotizaciones.registrar_resultado` |
| Anular | `cotizaciones.anular` |
| Generar PDF o mensaje | `cotizaciones.generar_documento` |
| Descargar PDF ya generado | `cotizaciones.ver` |
| Ver reportes de la organización | `reportes.ver` |
| Ver métricas agregadas de plataforma | `plataforma.metricas.ver` |

El perfil `Cotizador` tiene `cotizaciones.ver`, creación, aprobación, documento, resultado y
`reportes.ver`. No anula si el catálogo de perfiles del diseño no le otorga `cotizaciones.anular`
(según `docs/06-diseno-tecnico.md`, el Cotizador no tiene `cotizaciones.anular`). El administrador
sí anula.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/cotizaciones` | `cotizaciones.ver` | Historial paginado con filtros; aplica vencimiento perezoso |
| GET | `/api/cotizaciones/:id` | `cotizaciones.ver` | Detalle con líneas, bitácora y documento; aplica vencimiento perezoso |
| POST | `/api/cotizaciones/:id/duplicar` | `cotizaciones.crear` | Nuevo borrador desde una existente |
| POST | `/api/cotizaciones/:id/enviada` | `cotizaciones.registrar_resultado` | Marca entregada |
| POST | `/api/cotizaciones/:id/resultado` | `cotizaciones.registrar_resultado` | Ganada o perdida con motivo |
| POST | `/api/cotizaciones/:id/anular` | `cotizaciones.anular` | Anulación con motivo |
| GET | `/api/cotizaciones/:id/mensaje` | `cotizaciones.generar_documento` | Texto WhatsApp |
| GET | `/api/cotizaciones/:id/documento` | `cotizaciones.ver` | Reentrega PDF |
| GET | `/api/reportes/cotizaciones-resumen` | `reportes.ver` | Cantidad por estado, montos, conversión, tiempo mediano |
| GET | `/api/reportes/desempeno-reconocimiento` | `reportes.ver` | Tasa automáticas y tasa corrección |
| GET | `/api/reportes/terminos-fallidos` | `reportes.ver` | Términos que más fallaron |
| GET | `/api/plataforma/metricas` | `plataforma.metricas.ver` | Vista agregada sin detalle de negocio |

### Resumen de cotizaciones

```typescript
// GET /api/reportes/cotizaciones-resumen?desde=&hasta=
type CotizacionesResumen = {
  periodo: { desde: string; hasta: string };
  cantidadPorEstado: Record<
    'BORRADOR' | 'APROBADA' | 'ENVIADA' | 'GANADA' | 'PERDIDA' | 'VENCIDA' | 'ANULADA',
    number
  >;
  tiempoMedianoCapturaAprobacionMs: number | null;
  montoTotalAprobado: string; // 4 decimales, moneda base
  montoGanado: string;
  montoPerdido: string;
  conversion: string; // 4 decimales, [0,1]
  vencidasPendientesDeMarca: number; // ENVIADA con vigenciaHasta < now
};
```

### Desempeno de reconocimiento

```typescript
// GET /api/reportes/desempeno-reconocimiento?desde=&hasta=
type DesempenoReconocimiento = {
  periodo: { desde: string; hasta: string };
  lineasTotales: number;
  lineasAutomaticas: number;
  eventosCorreccion: number;
  tasaAutomaticas: string; // 4 decimales
  tasaCorreccion: string;  // 4 decimales
};
```

### Terminos fallidos

```typescript
// GET /api/reportes/terminos-fallidos?desde=&hasta=&limit=20
type TerminoFallido = {
  textoNormalizado: string;
  ejemploOriginal: string;
  vecesVisto: number;
  resueltoConItemId: string | null;
};
```

### Metricas de plataforma

```typescript
// GET /api/plataforma/metricas?desde=&hasta=
type MetricasPlataforma = {
  periodo: { desde: string; hasta: string };
  organizacionesActivas: number;
  cotizacionesTotales: number;
  aprobadasTotales: number;
  tasaAprobacionGlobal: string;
  tiempoMedianoGlobalMs: number | null;
  ganadasTotales: number;
  perdidasTotales: number;
  porOrganizacion?: Array<{
    organizacionId: string;
    nombre: string;
    cotizaciones: number;
    aprobadas: number;
    ganadas: number;
    perdidas: number;
  }>;
};
```

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `COTIZACION_NO_ENCONTRADA` | No existe o es de otra organización. Responde 404 |
| `CLIENTE_NO_ENCONTRADO` | Filtro `clienteId` ajeno o inexistente. Responde 404 |
| `SUCURSAL_NO_ENCONTRADA` | Sucursal ajena o fuera de `ctx.sucursalIds`. Responde 404 |
| `PERIODO_INVALIDO` | `desde` posterior a `hasta` o fecha mal formada. Responde 400 |
| `ESTADO_INCOMPATIBLE` | Acción no permitida para el estado actual. Responde 422 |
| `MOTIVO_OBLIGATORIO` | Pérdida o anulación sin motivo válido. Responde 422 |
| `TRANSICION_INVALIDA` | Transición fuera de la tabla del glosario. Responde 422 |
| `DOCUMENTO_NO_ENCONTRADO` | Se pide descarga y no hay PDF. Responde 404 |
| `CONTEXTO_ORGANIZACION_REQUERIDO` | Usuario de plataforma en ruta de organización. Responde 403 o error de contexto |
| `PERMISO_DENEGADO` | Sin el permiso requerido. Responde 403 |

## Experiencia de usuario

### Listado

1. Tabla con folio, cliente, estado, total en moneda base, fecha de creación y usuario.
2. Filtros visibles: estado, fechas, cliente, usuario. La búsqueda por folio es inmediata.
3. Las anuladas se muestran con etiqueta clara; las vencidas también.
4. Al abrir el listado, las enviadas vencidas pasan a `VENCIDA` de forma transparente; un aviso
   discreto puede indicar cuántas se marcaron en esa carga.

### Detalle

1. Cabecera con folio, estado, cliente y totales congelados.
2. Tabla de líneas de solo lectura si no es borrador.
3. Pestaña o sección de bitácora con cada evento, usuario y marca temporal.
4. Acciones contextuales según la tabla de estados; no se ofrecen botones imposibles.
5. Si hay PDF, el botón principal es descargar (reentrega), no regenerar.

### Metricas

1. Pantalla de reportes de la organización con el periodo seleccionable y los siete indicadores.
2. El tiempo mediano se muestra en minutos u horas legibles, además del valor en milisegundos en la
   API.
3. Los términos fallidos enlazan a la curación del catálogo cuando el usuario tiene permiso.
4. La vista plataforma es una pantalla separada, solo para superadmin, con agregados y sin drill-down
   a cotizaciones.

## Criterios de aceptacion

### Listado y detalle

#### CA-001: Listado con filtros basicos

Dado un usuario con `cotizaciones.ver` y cotizaciones en varios estados, cuando lista con
`estado=ENVIADA` y un rango `desde`/`hasta`, entonces solo recibe cotizaciones de su organización
en ese estado (o `VENCIDA` si el vencimiento perezoso las transicionó en la misma petición) creadas
en el rango, con paginación y totales como cadenas de 4 decimales.

#### CA-002: Filtro por cliente ajeno

Dado un `clienteId` de la organización B, cuando un usuario de la organización A filtra por ese
cliente, entonces la respuesta es 404 con `CLIENTE_NO_ENCONTRADO` y el listado no revela cotizaciones
ajenas.

#### CA-003: Detalle con bitacora ordenada

Dada una cotización con eventos de creación, corrección y aprobación, cuando se consulta el detalle,
entonces la bitácora llega ordenada por tiempo ascendente, sin endpoints para editar o borrar
eventos, y cada evento muestra tipo, usuario cuando aplica y `datos`.

#### CA-004: Cotizacion aprobada no cambia al ver historial

Dada una cotización `APROBADA` con total `"999.9900"` y descripción de línea congelada, cuando se
inactiva el item del catálogo y se cambia su precio, y después se abre el detalle, entonces el total
y la descripción de la línea permanecen iguales.

### Acciones de historial

#### CA-005: Duplicar desde historial

Dada una cotización `ENVIADA`, cuando un usuario con `cotizaciones.crear` la duplica, entonces se
crea un `BORRADOR` nuevo con folio distinto, `cotizacionOrigenId` apuntando al origen, precios
vigentes del catálogo y evento `COTIZACION_DUPLICADA`; el origen no se modifica.

#### CA-006: Recopiar mensaje y reentregar PDF

Dada una cotización con PDF generado y estado `ENVIADA`, cuando el usuario obtiene el mensaje y
descarga el documento, entonces el mensaje se genera según la plantilla y el PDF se reentrega sin
re-render, con el mismo hash.

#### CA-007: Marcar ganada desde historial

Dada una cotización `ENVIADA` vigente, cuando se registra resultado ganada, entonces el estado pasa
a `GANADA`, se inserta `MARCADA_GANADA` y los importes congelados no cambian.

#### CA-008: Anulacion con motivo desde historial

Dada una cotización `APROBADA`, cuando un administrador la anula con motivo de al menos diez
caracteres, entonces queda `ANULADA`, permanece en el listado marcada, conserva líneas y documento,
e inserta el evento de anulación. Sin motivo, responde 422.

#### CA-009: Cotizador no anula

Dado un usuario con perfil `Cotizador`, cuando intenta anular, entonces la respuesta es 403.

### Vencimiento perezoso

#### CA-010: Vencimiento al consultar detalle

Dada una cotización `ENVIADA` con `vigenciaHasta` en el pasado, cuando se hace
`GET /api/cotizaciones/:id`, entonces la respuesta muestra estado `VENCIDA`, existe un evento
`COTIZACION_VENCIDA` y un segundo GET no duplica el evento.

#### CA-011: Vencimiento al listar

Dadas tres cotizaciones `ENVIADA` vencidas y dos vigentes, cuando se lista el historial, entonces
las tres vencidas quedan `VENCIDA` tras la petición y aparecen filtrables por ese estado.

#### CA-012: Sin cron en el MVP

Dada una cotización `ENVIADA` vencida que nadie consulta durante 24 horas, cuando se inspecciona la
base sin pasar por los endpoints de historial, entonces puede seguir `ENVIADA`; no existe un job
programado del MVP que la haya cambiado. El reporte expone `vencidasPendientesDeMarca` para este
caso.

### Metricas del piloto

#### CA-013: Cantidad por estado

Dado un periodo con 2 borradores, 3 aprobadas, 1 ganada y 1 anulada, cuando se consulta
`/api/reportes/cotizaciones-resumen`, entonces `cantidadPorEstado` refleja exactamente esos conteos
(y ceros en el resto de claves).

#### CA-014: Tiempo mediano captura a aprobacion

Dadas tres cotizaciones aprobadas con duraciones 10 min, 20 min y 30 min entre
`COTIZACION_CREADA` y `COTIZACION_APROBADA`, cuando se consulta el resumen, entonces
`tiempoMedianoCapturaAprobacionMs` es 20 minutos en milisegundos. Sin aprobadas, es `null`.

#### CA-015: Tasa automaticas y tasa correccion

Dado un periodo con 10 líneas de las cuales 7 están `RESUELTA_AUTOMATICA` y 4 eventos
`LINEA_CORREGIDA`, cuando se consulta desempeño de reconocimiento, entonces `tasaAutomaticas` es
`"0.7000"` y `tasaCorreccion` es `"0.4000"`.

#### CA-016: Montos en moneda base

Dadas cotizaciones ganadas con totales `"100.0000"` y `"50.5000"` y una perdida `"20.0000"` en el
periodo, cuando se consulta el resumen, entonces `montoGanado` es `"150.5000"`, `montoPerdido` es
`"20.0000"` y no se usa la tasa de presentación para estos campos.

#### CA-017: Conversion comercial

Dado el periodo con 3 ganadas y 1 perdida (y varias enviadas sin resultado), cuando se consulta el
resumen, entonces `conversion` es `"0.7500"`.

#### CA-018: Terminos fallidos

Dado un término no resuelto con `vecesVisto` 12 y otro con 5 en el periodo, cuando se consulta
`/api/reportes/terminos-fallidos`, entonces el de 12 aparece primero y solo se listan términos de
la organización del contexto.

#### CA-019: Division por cero en tasas

Dado un periodo sin líneas ni resultados, cuando se consultan los reportes, entonces
`tasaAutomaticas`, `tasaCorreccion` y `conversion` son `"0.0000"` y no hay error 500.

### Vista plataforma y aislamiento

#### CA-020: Vista plataforma sin detalle de negocio

Dado un usuario con `plataforma.metricas.ver`, cuando consulta `/api/plataforma/metricas`, entonces
recibe agregados globales y, si pide desglose, solo `organizacionId`, `nombre` y conteos; el
payload no incluye clientes, folios, textos de solicitud, líneas ni importes por cotización.

#### CA-021: Organizacion no accede a metricas de plataforma

Dado un usuario de organización con `reportes.ver`, cuando llama `/api/plataforma/metricas`,
entonces la respuesta es 403.

#### CA-022: Aislamiento entre organizaciones en historial y reportes

Dado un usuario de la organización A y cotizaciones, eventos, documentos y términos de la
organización B, cuando intenta listarlos, ver detalle, duplicar, reportar o filtrar por sus
identificadores, entonces todas las respuestas son 404 o reportes vacíos solo de A; ningún dato de
B aparece y ningún registro de B se modifica.

#### CA-023: Aprobacion humana visible en bitacora

Dada una cotización aprobada por el usuario María, cuando se abre la bitácora, entonces existe
`COTIZACION_APROBADA` con `usuarioId` de María y los totales congelados en `datos`; no existe
transición a enviada sin ese evento previo de aprobación en el flujo feliz.

#### CA-024: Metricas no usan importes de interpretacion

Dada una interpretación con `costoEstimado` y una cotización ganada, cuando se calculan
`montoGanado` y el resumen, entonces los montos salen de `cotizaciones.total` y no del costo ni de
ningún campo de la salida del modelo de lenguaje.

## Verificacion requerida para cierre

- [ ] Un usuario de la organización A no ve ni modifica cotizaciones, eventos, documentos ni
      términos de la organización B; listados, detalle, filtros y reportes aislados; respuesta 404
      ante identificadores ajenos.
- [ ] El listado aplica filtros de estado, cliente, fechas, usuario y sucursal, con paginación.
- [ ] El detalle expone bitácora append-only ordenada y no ofrece mutación de eventos.
- [ ] Duplicar, marcar resultado, anular, recopiar mensaje y reentregar PDF respetan permisos y
      estados.
- [ ] El vencimiento perezoso transiciona `ENVIADA` → `VENCIDA` al listar o consultar, inserta un
      solo evento y no depende de un cron del MVP.
- [ ] `vencidasPendientesDeMarca` cuenta enviadas con vigencia pasada aún no marcadas.
- [ ] Las siete métricas del piloto coinciden con las fórmulas de esta especificación, con pruebas
      de mediana, tasas, montos, conversión, términos fallidos y división por cero.
- [ ] Los montos del piloto están en moneda base como cadenas de 4 decimales.
- [ ] La vista plataforma no incluye datos de negocio detallados y exige permiso de plataforma.
- [ ] Una cotización aprobada no cambia de importes ni textos al consultar historial ni al calcular
      métricas.
- [ ] El perfil `Cotizador` no puede anular; el administrador sí.
- [ ] Un usuario de ámbito `PLATAFORMA` no opera el historial de una organización sin contexto; sí
      ve métricas agregadas con el permiso correspondiente.

## Preguntas abiertas

| Tema | Pregunta | Impacto si se decide mal |
|------|----------|--------------------------|
| Nombre de eventos | Unificar definitivamente los nombres cortos de `06-diseno-tecnico.md` con el catálogo del ADR 0011 | Doble escritura o métricas rotas |
| Campo temporal de eventos | Si la columna se llama `createdAt` (diseño) u `ocurridoAt` (ADR 0011) | Divergencia en migraciones |
| Inclusion de anuladas en montos | Si `montoTotalAprobado` debe excluir siempre anuladas (como está) o incluir las anuladas post-aprobación | Distorsión del piloto |
| Cron diferido | En qué fase se introduce el job nocturno de vencimiento | Cotizaciones “enviadas” eternas si nadie consulta |
| Desglose plataforma | Si `porOrganizacion` va siempre o solo con query `detalle=true` | Riesgo de filtración accidental de volumen sensible |

## Decisiones MVP v1

1. El historial lista todas las cotizaciones de la organización, incluidas anuladas y borradores.
2. El detalle incluye bitácora append-only; no hay edición ni borrado de eventos.
3. Las acciones disponibles dependen del estado según la tabla de esta especificación.
4. El vencimiento se evalúa al consultar o listar; no hay cron en el MVP. La alternativa diferida es
   un job en lote con la misma transición.
5. Las métricas del piloto usan las siete fórmulas exactas definidas aquí.
6. Los montos del piloto se expresan en moneda base como cadenas con 4 decimales.
7. La conversión comercial solo considera ganadas y perdidas explícitas.
8. La vista plataforma solo expone agregados; sin clientes, folios, líneas ni textos de solicitud.
9. Una cotización aprobada no cambia al abrir el historial ni al reportar.
10. Ningún importe de métrica de ventas proviene de la interpretación de IA.
11. Duplicar crea borrador con precios vigentes y no reutiliza folio ni PDF.
12. Ninguna regla ramifica por vertical.

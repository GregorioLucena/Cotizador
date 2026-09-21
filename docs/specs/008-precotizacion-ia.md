# Spec 008: Precotizacion e interpretacion con IA

## Estado

Cerrada — implementada (2026-09-18)

## Cierre

**Fecha:** 2026-09-18

**Entregables:**
- Migración `1782800000000-PrecotizacionSolicitudCotizacion` (solicitudes, interpretaciones, secuencias_folio, cotizaciones, líneas, candidatos, eventos)
- Entidades y enums de solicitud/cotización en `@cotizador/database`
- Shared: schemas precotización, `normalizarTextoSolicitud`, `ProveedorIa` mock/none, cascada de resolución, folio, errores `SOLICITUD_*` / `IA_*`
- API `POST /api/precotizaciones`, `POST .../reprocesar`, `GET /api/cotizaciones/:id` (pipeline completo + degradación 201)
- UI: `/cotizar` (captura mostrador), `/cotizaciones/[id]` (borrador + semáforo + traza), nav Cotizar

**Verificación de criterios de aceptación (por código y typecheck):**

| CA | Resultado |
|----|-----------|
| CA-001 Captura mínima | Cubierto en `PrecotizacionesService.crear` |
| CA-002 Texto largo | `SOLICITUD_TEXTO_DEMASIADO_LARGO` / validación 4000 |
| CA-003 Normalización WhatsApp | `normalizarTextoSolicitud` + tests |
| CA-004 Cliente ajeno | 404 `CLIENTE_NO_ENCONTRADO` |
| CA-005 Contrato estricto Zod | `resultadoExtraccionSchema.strict()` |
| CA-006/007 Fallo / IA off | 201 + borrador vacío + `exito=false` |
| CA-008 Importes sin IA | Motor `calcularCotizacion` únicamente |
| CA-010…013 Cascada / empate / candidatos / sin precio | `ResolucionCatalogoService` + umbrales ADR 0007 |
| CA-015 Folio atómico | `secuencias_folio` con bloqueo de fila |
| CA-016 Reprocesar | Nueva interpretación + cotización; historial intacto |
| CA-017 Términos | Incremento/alta en `NO_ENCONTRADA` |
| CA-019 Aislamiento | Filtro `organizacionId` + 404 |
| CA-020 Evento CREADA | Bitácora inmutable |
| CA-022 Sucursal | `SUCURSAL_NO_ACCESIBLE` |

**Verificación requerida:** typecheck shared/database/api/web OK. Pruebas E2E con BD y semáforo mixto: QA manual tras `pnpm db:migrate`.

## Objetivo

Definir el pipeline que convierte un mensaje informal de un cliente, pegado desde WhatsApp o escrito a
mano, en una cotización en estado `BORRADOR` lista para revisión humana.

Este módulo materializa la regla de oro del producto: la IA solo interpreta descripción, cantidad y
unidad; el catálogo resuelve el item; el motor de precios calcula los importes; la persona aprueba en
un módulo posterior. Ningún importe de la cotización proviene, directa o indirectamente, de la salida
de un modelo de lenguaje. Si el proveedor de IA falla o está desactivado, el producto sigue siendo
útil: se crea un borrador vacío y el operador arma la cotización a mano.

## Dependencias

| Documento | Aporta |
|-----------|--------|
| `docs/06-diseno-tecnico.md` | Modelo de datos de solicitudes, interpretaciones y cotizaciones; permisos; contrato de `POST /api/precotizaciones`; reglas críticas |
| `docs/decisions/0003-pipeline-precotizacion.md` | Pipeline de cinco etapas, invariantes y degradación controlada |
| `docs/decisions/0004-proveedor-de-ia-abstraido.md` | Interfaz `ProveedorIa`, timeout, reintento, proveedores `openai`, `ollama`, `none` y `mock` |
| `docs/decisions/0005-motor-de-precios.md` | Cálculo puro de importes sin base de datos ni reloj interno |
| `docs/decisions/0007-estrategia-de-matching.md` | Cascada de resolución, umbrales y regla de empate |
| `docs/decisions/0008-moneda-base-y-presentacion.md` | Moneda base, moneda de presentación y tasa vigente al armar el borrador |
| `docs/specs/004-catalogo-items.md` | Normalización, `textoBusqueda`, alias, términos no resueltos e índices de trigramas |
| `docs/specs/006-listas-precios-reglas.md` | Listas, precios, reglas de descuento y configuración de cotización |
| `docs/specs/007-clientes.md` | Cliente, lista de precios asignada y datos libres de contacto |

Esta especificación es consumida por `docs/specs/009-revision-aprobacion.md` y alimenta las métricas
de reconocimiento de `docs/specs/011-historial-metricas.md`.

Requisitos previos de implementación:

1. Catálogo de items con búsqueda por similitud y alias operativos.
2. Listas de precios, reglas de descuento, tasas y motor puro en `@cotizador/shared`.
3. Clientes con lista de precios asignada o lista predeterminada de la organización.
4. Interfaz `ProveedorIa` registrada por configuración, con al menos la implementación `mock`.
5. Función de normalización de texto publicada en `@cotizador/shared`, idéntica a la del catálogo.

## Alcance MVP v1

Incluye:

- Captura de la solicitud con texto original, cliente o datos libres, lista de precios y sucursal.
- Normalización determinista del texto, con ejemplos típicos de WhatsApp.
- Extracción de líneas mediante el proveedor de IA, con contrato estricto validado por Zod.
- Resolución determinista de cada línea contra el catálogo con cascada de cinco estrategias,
  confianza, candidatos y semáforo de estado de resolución.
- Cálculo de precios con el motor puro de `@cotizador/shared`.
- Ensamblado transaccional de solicitud, interpretación, cotización en borrador, líneas, candidatos,
  términos no resueltos y evento inicial.
- Trazabilidad completa de cada interpretación: proveedor, modelo, versión de prompt, latencia,
  tokens, costo estimado, éxito o error.
- Reprocesado de una solicitud sin borrar interpretaciones anteriores.
- Degradación controlada: fallo de IA produce borrador vacío, nunca bloquea al operador.
- Acumulación de términos no resueltos para curar el catálogo.

No incluye en esta versión:

| Fuera de alcance | Motivo |
|------------------|--------|
| Revisión, edición y aprobación del borrador | Pertenece a `docs/specs/009-revision-aprobacion.md` |
| Generación de PDF o plantillas de documento | Pertenece a `docs/specs/010-plantillas-documento.md` |
| Bot o integración con WhatsApp Business API | Diferido a fase 3 por `docs/05-alcance-mvp.md` |
| Interpretación de notas de voz o imágenes | Diferido a fase 2 |
| Búsqueda semántica con embeddings en la resolución | Diferido a fase 2 por `docs/decisions/0007-estrategia-de-matching.md` |
| Que la IA elija el item del catálogo | Descartado por `docs/decisions/0003-pipeline-precotizacion.md` |
| Cola asíncrona de trabajos para la generación | La generación es síncrona con tiempo límite |
| Proveedor de IA configurable por organización | La configuración es de plataforma; la organización solo activa o desactiva el uso |

## Conceptos principales

| Concepto | Definicion operativa |
|----------|----------------------|
| Solicitud | Registro del pedido tal como llegó: texto original, texto normalizado, canal, cliente o datos libres, sucursal y estado |
| Interpretacion | Resultado de una ejecución del proveedor de IA sobre una solicitud, con metadatos de traza y resultado en crudo |
| Linea de pedido | Necesidad extraída del texto: descripción solicitada, cantidad y unidad. Es la única salida útil del modelo |
| Resolucion | Asociación determinista de una línea de pedido con un item del catálogo, con confianza, origen y candidatos |
| Estado de resolucion | Clasificación de la línea del borrador: `RESUELTA_AUTOMATICA`, `SUGERIDA_REVISAR`, `NO_ENCONTRADA`, y más adelante `RESUELTA_MANUAL` o `AGREGADA_MANUAL` |
| Precotizacion | Sinónimo operativo de una cotización en estado `BORRADOR` generada por este pipeline. No es una entidad distinta |
| Pipeline | Secuencia de cinco etapas separadas, independientes y auditables que produce el borrador |
| Proveedor de IA | Adaptador intercambiable que implementa `extraerLineas` sin filtrar precios ni identificadores de catálogo |
| Termino no resuelto | Texto normalizado que no alcanzó umbral de descarte razonable, acumulado para curar alias e items |

### Regla de oro aplicada a este modulo

1. La etapa de extracción es la **única** que invoca un modelo de lenguaje.
2. La salida del modelo se valida con un esquema Zod estricto que rechaza campos no declarados. Una
   respuesta con precios, descuentos, totales, monedas o identificadores de items es un **fallo** de
   la etapa, no una salida parcial.
3. Los importes se calculan exclusivamente con el motor de precios puro a partir del catálogo y las
   reglas de la organización.
4. Ninguna cotización se entrega al cliente desde este módulo: el resultado es siempre un borrador
   que exige revisión y aprobación humanas en `docs/specs/009-revision-aprobacion.md`.

## Datos requeridos

### Solicitud

Tabla `solicitudes`.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Generado | `uuid` |
| `organizacionId` | Generado | Tomado de `ctx.organizacionId`, nunca de la entrada |
| `sucursalId` | Condicional | Si se omite, se usa `ctx.sucursalActivaId`. Debe pertenecer a `ctx.sucursalIds` |
| `clienteId` | No | Cliente activo de la organización. Si se informa, prevalece sobre los datos libres |
| `canal` | No | `WHATSAPP_PEGADO` o `MANUAL`. Si se omite, `WHATSAPP_PEGADO` |
| `textoOriginal` | Si | Texto crudo pegado o escrito. Entre 1 y 4000 caracteres después de recortar espacios |
| `textoNormalizado` | Generado | Resultado de la etapa de normalización. Nunca se acepta desde la entrada |
| `estado` | Generado | `PENDIENTE` al crear; `INTERPRETADA` si la extracción tuvo éxito; `FALLIDA` si falló |
| `recibidaAt` | Generado | Momento de la captura |
| `createdById`, `updatedById` | Generado | Tomados de `ctx.usuarioId` |

La solicitud no guarda lista de precios ni importes. Esos datos viven en la cotización resultante.

### Interpretacion de la solicitud

Tabla `interpretaciones_solicitud`. Una solicitud puede tener muchas interpretaciones; la más reciente
es la que alimenta el borrador vigente tras un reproceso.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Generado | `uuid` |
| `organizacionId` | Generado | Del contexto |
| `solicitudId` | Si | Solicitud de la misma organización |
| `proveedor` | Si | Nombre del adaptador: `openai`, `ollama`, `none`, `mock` |
| `modelo` | Si | Identificador del modelo usado o `none` / `mock` |
| `versionPrompt` | Si | Por ejemplo `extraccion-lineas.v1`. Se incrementa al cambiar el prompt |
| `exito` | Si | Booleano. Falso ante timeout, error de red, validación Zod fallida o proveedor nulo |
| `resultado` | Si | Documento JSON con el arreglo de líneas extraídas o el texto crudo rechazado |
| `advertencias` | No | Arreglo JSON de códigos o mensajes no bloqueantes |
| `errorCodigo` | No | Código funcional cuando `exito` es falso |
| `errorDetalle` | No | Detalle técnico acotado para soporte; no se muestra completo al operador |
| `latenciaMs` | Si | Entero mayor o igual a cero |
| `tokensEntrada`, `tokensSalida` | No | Enteros cuando el proveedor los reporta |
| `costoEstimado` | No | `numeric(18,6)` estimado en la moneda de facturación del proveedor |
| `createdAt`, `createdById` | Generado | Inmutable: la interpretación no se actualiza ni se borra |

### Cotizacion generada por el pipeline

Tabla `cotizaciones`, con los campos definidos en `docs/06-diseno-tecnico.md`. Al salir de este
módulo siempre tiene:

| Campo | Valor al ensamblar |
|-------|--------------------|
| `estado` | `BORRADOR` |
| `solicitudId` | Identificador de la solicitud creada o reprocesada |
| `folioNumero`, `folio` | Asignados en la misma transacción con bloqueo de `secuencias_folio` |
| `listaPrecioId` | La informada, la del cliente o la predeterminada de la organización |
| `clienteId` / `nombreClienteLibre` / `telefonoClienteLibre` | Según la captura |
| `monedaBaseId` | Moneda base de la organización |
| `monedaPresentacionId`, `tasaAplicada`, `tasaFecha` | Si hay moneda de presentación, la tasa vigente al ensamblar |
| `vigenciaHasta` | Nulo hasta aprobar; la vigencia se calcula en la aprobación |
| Importes | Calculados por el motor; cadenas decimales con 4 decimales en la API |

### Linea de cotizacion y candidatos

Tabla `cotizacion_lineas` y `cotizacion_linea_candidatos`.

| Campo de linea | Notas |
|----------------|-------|
| `textoSolicitado` | Descripción tal como la extrajo la IA o, si falla, vacío porque no hay líneas |
| `itemId` | Nulo cuando el estado es `NO_ENCONTRADA` |
| `cantidad` | `numeric(18,4)` mayor que cero |
| `unidadMedidaId` | Unidad resuelta desde el código extraído o la unidad del item |
| `estadoResolucion` | `RESUELTA_AUTOMATICA`, `SUGERIDA_REVISAR` o `NO_ENCONTRADA` en este módulo |
| `confianza` | `numeric(5,4)` entre 0 y 1 |
| `origenMatch` | `SKU`, `ALIAS_EXACTO`, `ALIAS_SIMILITUD`, `TEXTO_SIMILITUD` o `ATRIBUTO` |
| Importes | `precioLista`, `precioUnitario`, `descuentoMonto`, `subtotal`, `total` como `numeric(18,4)` |

Cada línea resuelta o sugerida persiste hasta cinco candidatos en `cotizacion_linea_candidatos`,
ordenados por `puntaje` descendente, con `origenMatch` y `orden` estable.

### Terminos no resueltos

Tabla `terminos_no_resueltos`, definida en `docs/specs/004-catalogo-items.md`. Este módulo solo la
escribe: cada línea con estado `NO_ENCONTRADA` incrementa o crea el término correspondiente al
`textoSolicitado` normalizado.

## Reglas de negocio

### Captura de la solicitud

1. La captura exige el permiso `cotizaciones.crear` y un `ctx.organizacionId` no nulo. Un usuario de
   ámbito `PLATAFORMA` recibe error de contexto.
2. `textoOriginal` es obligatorio, se recorta y no puede superar 4000 caracteres. Un texto vacío
   responde 400 con `TEXTO_SOLICITUD_VACIO`. Un texto demasiado largo responde 400 con
   `TEXTO_SOLICITUD_DEMASIADO_LARGO`.
3. Debe informarse `clienteId` o al menos `nombreClienteLibre`. Informar ambos es válido: el
   `clienteId` prevalece para la lista de precios y el vínculo histórico; el nombre libre no se
   sobreescribe en el cliente.
4. `clienteId` debe referenciar un cliente activo de la organización. Un cliente ajeno o inactivo
   responde 404 con `CLIENTE_NO_ENCONTRADO` o 422 con `CLIENTE_INACTIVO` respectivamente.
5. `listaPrecioId`, si se informa, debe ser una lista activa de la organización. Si se omite, se
   toma la del cliente; si el cliente no tiene lista, la predeterminada de la organización. Sin
   lista resoluble responde 422 con `LISTA_PRECIO_NO_RESOLUBLE`.
6. `sucursalId` debe pertenecer a `ctx.sucursalIds`. Si se omite, se usa `sucursalActivaId`. Sin
   sucursal válida responde 422 con `SUCURSAL_NO_ACCESIBLE`.
7. `canal` solo admite `WHATSAPP_PEGADO` y `MANUAL` en el MVP. Cualquier otro valor es error 400.
8. La captura no llama al proveedor de IA por sí sola: forma parte del mismo endpoint que ejecuta el
   pipeline completo. No existe un endpoint que solo guarde el texto sin generar borrador.

### Etapa 1 — Normalizacion

1. La normalización es una función pura de `@cotizador/shared`, sin IA y sin base de datos.
2. Conserva `textoOriginal` intacto en la solicitud. Solo escribe `textoNormalizado`.
3. Aplica, en este orden:

| Paso | Transformacion | Ejemplo de WhatsApp |
|------|----------------|---------------------|
| 1 | Recorte de espacios al inicio y al final | `"  hola  "` produce `"hola"` |
| 2 | Separación de viñetas, guiones y saltos de línea en líneas lógicas | `"* 2 tubos\n- 10 codos"` produce dos bloques |
| 3 | Eliminación de marcas de hora, nombres de contacto y encabezados de reenvío | `"[10:42] María:"` se descarta |
| 4 | Eliminación de saludos y despedidas frecuentes sin contenido de pedido | `"buenas"`, `"porfa"`, `"gracias"` al inicio o al final se recortan si no aportan ítems |
| 5 | Conversión a minúsculas para la copia de comparación | `"Tubo PVC"` produce `"tubo pvc"` |
| 6 | Eliminación de acentos y diéresis; `ñ` a `n` | `"cañería"` produce `"caneria"` |
| 7 | Sustitución de signos de puntuación por espacio, preservando `/` y `.` en medidas | `"tubo, pvc"` produce `"tubo pvc"` |
| 8 | Colapso de espacios múltiples | `"tubo   media"` produce `"tubo media"` |
| 9 | Equivalencias de medidas y fracciones del pack de vertical | `"media"`, `"1/2"` y `"0.5"` convergen a `"1/2"` |

4. Ejemplos de mensajes reales y su texto normalizado útil para la extracción:

| Texto original pegado | Texto normalizado enviado a la IA |
|-----------------------|-----------------------------------|
| `[10:15] Juan:\nbuenas, necesito 2 tubos de media, 10 codos y un pegamento azul porfa` | `necesito 2 tubos de 1/2, 10 codos y un pegamento azul` |
| `Hola!\n- 5m manguera negra\n- 1 llave de paso 1/2\nGracias` | `5m manguera negra\n1 llave de paso 1/2` |
| `reenviado:\nMensaje original\n1 saco cemento gris` | `1 saco cemento gris` |

5. Si tras normalizar el texto queda vacío, la captura responde 400 con `TEXTO_SOLICITUD_SIN_CONTENIDO`.
6. La misma función de normalización se reutiliza al indexar el catálogo y al resolver líneas. Si
   divergen, el reconocimiento falla de forma silenciosa.

### Etapa 2 — Extraccion con IA

1. Es la única etapa que invoca `ProveedorIa.extraerLineas`.
2. Entrada del proveedor:

```typescript
type EntradaExtraccion = {
  textoNormalizado: string;
  unidadesValidas: string[];   // codigos activos de unidades_medida de la organizacion
  limiteLineas: number;        // valor inicial 40
};
```

3. Contrato de salida estricto, validado con Zod antes de usarse:

```typescript
type LineaExtraida = {
  textoSolicitado: string;     // descripcion tal como la escribio el cliente, 1 a 500 caracteres
  cantidad: string;            // cadena decimal con hasta 4 decimales, mayor que cero
  unidad?: string;             // codigo de unidad de unidadesValidas, si se menciono
  notas?: string;              // hasta 500 caracteres; p. ej. "cantidad asumida en 1"
};

type ResultadoExtraccion = {
  lineas: LineaExtraida[];
  advertencias: string[];
  metricas: {
    latenciaMs: number;
    tokensEntrada?: number;
    tokensSalida?: number;
    costoEstimado?: number;
  };
};
```

4. **Prohibido en la salida:** cualquier campo no declarado; identificadores de items; SKU; precios;
   descuentos; totales; monedas; nombres de listas; sugerencias de catálogo. El esquema Zod usa
   rechazo de claves desconocidas. Una respuesta con precios o ids se registra como fallo con
   `IA_SALIDA_INVALIDA` y no se intenta reparar.
5. Si el modelo no puede determinar la cantidad, debe devolver cantidad `"1.0000"` y anotarlo en
   `notas`. Inventar una cantidad distinta de uno sin base en el texto es un fallo de calidad del
   prompt, no una excepción de runtime.
6. La llamada tiene tiempo límite `IA_TIMEOUT_MS` (valor inicial 20000). Al expirar, la etapa falla
   con `IA_TIMEOUT`.
7. Se permite como máximo un reintento, solo ante error de red, HTTP 429 o 5xx, con espera breve. Un
   error de validación de esquema **no** se reintenta.
8. Si la organización tiene `usaIa` en falso, o el proveedor configurado es `none`, la etapa falla de
   forma controlada con `IA_DESACTIVADA` y cero líneas, sin llamar a un servicio remoto.
9. El prompt vive versionado en el repositorio (`extraccion-lineas.vN.md`). Cambiar el prompt exige
   incrementar `versionPrompt` en la interpretación.
10. Toda ejecución, exitosa o fallida, se persiste en `interpretaciones_solicitud` con el resultado en
    crudo. Nunca se sobrescribe una interpretación anterior.

### Tabla de fallos de la etapa de extraccion

| Condicion | Codigo | Efecto sobre el pipeline |
|-----------|--------|--------------------------|
| Proveedor `none` o `usaIa` falso | `IA_DESACTIVADA` | Borrador vacío; advertencia visible |
| Timeout | `IA_TIMEOUT` | Borrador vacío tras el reintento permitido |
| Error de red o 5xx / 429 tras reintento | `IA_PROVEEDOR_NO_DISPONIBLE` | Borrador vacío |
| Respuesta que no valida el esquema Zod | `IA_SALIDA_INVALIDA` | Borrador vacío; se guarda el crudo |
| Respuesta con precios, ids o campos prohibidos | `IA_SALIDA_INVALIDA` | Igual que la anterior |
| Proveedor devolvió cero líneas con éxito | — | Borrador vacío; advertencia `IA_SIN_LINEAS` |
| Excepción no controlada del adaptador | `IA_ERROR_INTERNO` | Borrador vacío; no se propaga 500 al operador |

**Invariante:** el fallo de la IA **nunca** bloquea al operador. La respuesta HTTP de
`POST /api/precotizaciones` es 201 con `interpretacion.exito` en falso, cotización en `BORRADOR` sin
líneas y advertencias. No es 502 salvo que se configure explícitamente un modo de diagnóstico que no
aplica al MVP operativo.

### Etapa 3 — Resolucion contra el catalogo

1. La resolución es determinista, sin IA, y opera solo sobre items `ACTIVO` de la organización del
   contexto.
2. Cascada de estrategias, en este orden:

| Orden | Estrategia | OrigenMatch | Puntaje base |
|-------|------------|-------------|--------------|
| 1 | SKU exacto en el texto solicitado | `SKU` | `1.0000` |
| 2 | Alias exacto normalizado | `ALIAS_EXACTO` | `0.9800` |
| 3 | Alias por similitud de trigramas | `ALIAS_SIMILITUD` | `0.6000` a `0.9500` |
| 4 | Texto de búsqueda por similitud | `TEXTO_SIMILITUD` | `0.5000` a `0.9000` |
| 5 | Palabras clave con filtro de atributos detectados | `ATRIBUTO` | `0.4500` a `0.8500` |

3. La cascada se detiene en la primera estrategia que produce un resultado por encima de
   `umbralAutomatico`, pero las demás se ejecutan hasta un límite para poblar candidatos.
4. Umbrales de la organización, con valores iniciales:

| Umbral | Valor inicial | Efecto |
|--------|---------------|--------|
| `umbralAutomatico` | `0.8000` | Confianza mayor o igual: `RESUELTA_AUTOMATICA` |
| `umbralDescarte` | `0.4500` | Entre ambos: `SUGERIDA_REVISAR`; por debajo: `NO_ENCONTRADA` |

5. Regla de empate: si los dos mejores candidatos difieren en menos de `0.0500` de puntaje, la línea
   **no** se marca como `RESUELTA_AUTOMATICA` aunque supere el umbral automático. Queda
   `SUGERIDA_REVISAR` para que decida la persona.
6. Cada línea conserva hasta cinco candidatos ordenados por puntaje descendente y, a igual puntaje,
   por nombre de item ascendente.
7. Un item sin precio en la lista aplicada puede resolverse como coincidencia de catálogo, pero la
   etapa 4 lo marcará como no cotizable: la línea queda para revisión y no podrá aprobarse hasta
   resolverla.
8. Al resolver con un alias, se incrementa `vecesUsado` de ese alias en uno.
9. Las líneas `NO_ENCONTRADA` alimentan `terminos_no_resueltos` con el texto normalizado y el ejemplo
   original.

### Etapa 4 — Calculo de precios

1. Se invoca `calcularCotizacion` de `@cotizador/shared` con las líneas resueltas, las reglas vigentes
   de la lista, la configuración de cotización, la fecha de referencia recibida y la tasa vigente si
   hay moneda de presentación.
2. El motor es puro: no accede a base de datos, no lee el reloj y no tiene efectos secundarios.
3. Ningún importe se toma de la interpretación. Si una línea no tiene item o no tiene precio, sus
   importes quedan en cero y la línea se marca no cotizable para la revisión.
4. Los importes se calculan con aritmética decimal y se persisten como `numeric(18,4)`. En la API
   viajan como cadenas con 4 decimales.
5. La conversión a moneda de presentación se aplica solo al total, nunca línea por línea.

### Etapa 5 — Ensamblado transaccional

1. En una única transacción de base de datos se persisten, en este orden lógico:

   1. La solicitud (o se reutiliza en reproceso).
   2. La interpretación nueva.
   3. El incremento de `secuencias_folio` con bloqueo de fila.
   4. La cotización en `BORRADOR` con folio formateado.
   5. Las líneas y sus candidatos.
   6. Los términos no resueltos acumulados.
   7. El evento `CREADA` y, si hubo extracción exitosa, `INTERPRETADA`.

2. Si cualquier paso falla, se revierte toda la transacción. La única excepción controlada es el
   fallo de la etapa 2: ese fallo **sí** se persiste (interpretación con `exito` falso y borrador
   vacío) porque forma parte del resultado esperado.
3. El folio es consecutivo por organización y no se reutiliza aunque la cotización se anule después.
4. Reprocesar una solicitud existente crea una **nueva** interpretación y un **nuevo** borrador
   vinculado a la misma solicitud. No borra ni modifica interpretaciones anteriores ni cotizaciones
   ya creadas. Si el borrador anterior sigue en `BORRADOR` y no ha sido editado de forma sustancial,
   la interfaz puede ofrecer archivarlo visualmente, pero el registro permanece.
5. Toda consulta filtra por `organizacionId` del contexto. Un identificador ajeno responde 404.

### Ejemplo de extremo a extremo

Mensaje pegado:

```text
[18:02] Carlos:
buenas, necesito:
2 tubos de media pvc
10 codos de media
1 pegamento azul
1 rollo de teipex
5 metros de manguera negra
gracias
```

Tras normalización, extracción, resolución y cálculo, el borrador podría quedar así:

| Orden | Texto solicitado | Item resuelto | Estado | Confianza | Semaforo |
|-------|------------------|---------------|--------|-----------|----------|
| 1 | `2 tubos de media pvc` | Tubo PVC 1/2" | `RESUELTA_AUTOMATICA` | `0.9800` | Verde |
| 2 | `10 codos de media` | Codo PVC 1/2" | `RESUELTA_AUTOMATICA` | `0.9600` | Verde |
| 3 | `1 pegamento azul` | Cemento PVC azul | `SUGERIDA_REVISAR` | `0.7200` | Ámbar |
| 4 | `1 rollo de teipex` | Cinta aislante negra | `SUGERIDA_REVISAR` | `0.6100` | Ámbar |
| 5 | `5 metros de manguera negra` | — | `NO_ENCONTRADA` | `0.2100` | Rojo |

El resumen de la respuesta incluye `lineasTotales: 5`, `resueltasAutomaticas: 2`, `sugeridas: 2`,
`noEncontradas: 1`. El término normalizado de la manguera se acumula en `terminos_no_resueltos`. Los
importes de las líneas verdes y ámbar salen del motor; la línea roja no aporta al total cotizable
hasta que la persona la resuelva en la revisión.

## Permisos

| Operacion | Permiso |
|-----------|---------|
| Capturar solicitud y generar precotización | `cotizaciones.crear` |
| Reprocesar una solicitud existente | `cotizaciones.crear` |
| Ver la cotización borrador resultante | `cotizaciones.ver` |
| Ver términos no resueltos acumulados | `catalogo.items.ver` |
| Consultar catálogo durante la resolución (interno) | No exige permiso adicional al operador; el servicio de resolución opera dentro del mismo flujo autorizado |

Consecuencias de los perfiles de `docs/06-diseno-tecnico.md`:

1. El perfil `Cotizador` puede capturar, reprocesar y ver borradores.
2. El perfil `Administrador Organizacion` tiene `cotizaciones.*` y puede hacer lo mismo.
3. Un usuario de ámbito `PLATAFORMA` no opera cotizaciones: los servicios exigen
   `ctx.organizacionId` no nulo.
4. La verificación de permiso ocurre antes de tocar datos, según el orden obligatorio de los métodos
   de servicio.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| POST | `/api/precotizaciones` | `cotizaciones.crear` | Ejecuta el pipeline completo y devuelve el borrador |
| POST | `/api/precotizaciones/:solicitudId/reprocesar` | `cotizaciones.crear` | Nueva interpretación; reescribe el borrador indicado |
| GET | `/api/cotizaciones/:id` | `cotizaciones.ver` | Detalle del borrador con líneas y candidatos |
| GET | `/api/terminos-no-resueltos` | `catalogo.items.ver` | Insumo de curación; escrito por este módulo |

### Crear precotizacion

```typescript
// POST /api/precotizaciones
type CrearPrecotizacionInput = {
  textoOriginal: string;          // 1 a 4000 caracteres
  clienteId?: string;
  nombreClienteLibre?: string;    // obligatorio si no hay clienteId
  telefonoClienteLibre?: string;
  listaPrecioId?: string;         // si falta, la del cliente o la predeterminada
  sucursalId?: string;
  canal?: 'WHATSAPP_PEGADO' | 'MANUAL';
};

type PrecotizacionResultado = {
  cotizacion: CotizacionDetalle;  // estado BORRADOR, importes como cadena con 4 decimales
  interpretacion: {
    id: string;
    exito: boolean;
    proveedor: string;
    modelo: string;
    versionPrompt: string;
    latenciaMs: number;
    advertencias: string[];
    errorCodigo: string | null;
  };
  resumen: {
    lineasTotales: number;
    resueltasAutomaticas: number;
    sugeridas: number;
    noEncontradas: number;
  };
};
```

Si la interpretación falla, la respuesta es **201** con `interpretacion.exito` en falso, cotización
sin líneas y advertencias. Nunca es un error de la petición por causa del proveedor de IA.

### Reprocesar

```typescript
// POST /api/precotizaciones/:solicitudId/reprocesar
type ReprocesarPrecotizacionInput = {
  cotizacionId: string;           // borrador a reescribir (obligatorio)
  listaPrecioId?: string;         // opcional: permite cambiar la lista al reprocesar
  sucursalId?: string;
};
```

El texto original se toma de la solicitud existente. Se crea una interpretación nueva y se
**reescribe la misma cotización** en `BORRADOR` (mismo `id` y folio): las líneas anteriores se
desactivan (`activa = false`) y se ensamblan líneas nuevas. No se consume un folio adicional. Si
`cotizacionId` no es de esa solicitud, responde 404; si no está en `BORRADOR`,
`COTIZACION_ESTADO_INVALIDO`.

Los importes, cantidades y confianzas viajan como cadenas decimales con 4 decimales según
`docs/06-diseno-tecnico.md`.

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `TEXTO_SOLICITUD_VACIO` | `textoOriginal` vacío tras recortar. Responde 400 |
| `TEXTO_SOLICITUD_DEMASIADO_LARGO` | Supera 4000 caracteres. Responde 400 |
| `TEXTO_SOLICITUD_SIN_CONTENIDO` | Tras normalizar no queda texto útil. Responde 400 |
| `CLIENTE_NO_ENCONTRADO` | `clienteId` inexistente o de otra organización. Responde 404 |
| `CLIENTE_INACTIVO` | El cliente existe pero está inactivo. Responde 422 |
| `CLIENTE_O_NOMBRE_REQUERIDO` | No se informó `clienteId` ni `nombreClienteLibre`. Responde 400 |
| `LISTA_PRECIO_NO_ENCONTRADA` | `listaPrecioId` ajena o inexistente. Responde 404 |
| `LISTA_PRECIO_INACTIVA` | La lista existe pero está inactiva. Responde 422 |
| `LISTA_PRECIO_NO_RESOLUBLE` | No hay lista informada, del cliente ni predeterminada. Responde 422 |
| `SUCURSAL_NO_ACCESIBLE` | Sucursal fuera de `ctx.sucursalIds` o inexistente. Responde 404 u 422 |
| `SOLICITUD_NO_ENCONTRADA` | `solicitudId` inexistente o de otra organización al reprocesar. Responde 404 |
| `COTIZACION_NO_ENCONTRADA` | `cotizacionId` inexistente, de otra org o no pertenece a la solicitud. Responde 404 |
| `COTIZACION_ESTADO_INVALIDO` | La cotización a reprocesar no está en `BORRADOR`. Responde 422 |
| `CONTEXTO_ORGANIZACION_REQUERIDO` | Usuario de plataforma sin organización operativa. Responde 403 |
| `IA_DESACTIVADA` | No es error HTTP: viaja en la interpretación fallida del 201 |
| `IA_TIMEOUT` | Idem: interpretación fallida, borrador vacío |
| `IA_PROVEEDOR_NO_DISPONIBLE` | Idem |
| `IA_SALIDA_INVALIDA` | Idem |
| `IA_ERROR_INTERNO` | Idem |
| `IA_SIN_LINEAS` | Advertencia en interpretación exitosa con cero líneas |

Los códigos `IA_*` no producen 502 en el flujo operativo del MVP: el operador debe poder continuar.
El detalle técnico queda en `interpretaciones_solicitud.errorDetalle` para soporte.

## Experiencia de usuario

### Pantalla de captura

1. Un solo campo grande para pegar el mensaje, con contador de caracteres hasta 4000.
2. Selector de cliente con búsqueda; alternativa de nombre y teléfono libres si el cliente no está
   registrado.
3. Selector de lista de precios, prellenado con la del cliente o la predeterminada.
4. Sucursal visible solo si el usuario tiene más de una sucursal accesible.
5. Botón único de generar borrador. Mientras corre el pipeline, la interfaz muestra un estado de
   progreso sin permitir un segundo envío concurrente del mismo texto.

### Resultado del pipeline

1. Si la interpretación tuvo éxito, se navega al borrador con el semáforo por línea.
2. Si falló, se muestra el borrador vacío con un aviso claro: "No se pudo interpretar el mensaje. Puedes
   armar la cotización a mano." y un enlace a agregar líneas manuales (flujo de la spec 009).
3. El resumen (resueltas, sugeridas, no encontradas) aparece arriba del listado de líneas.
4. Desde el detalle se puede ver la traza de la interpretación: proveedor, modelo, versión de prompt,
   latencia y si hubo reintento. El costo estimado solo es visible para perfiles con permiso de
   reportes o administración.
5. La acción de reprocesar pide confirmación y explica que se reemplazarán las líneas del mismo
   borrador (mismo folio), sin crear otra cotización.
6. El detalle muestra el mensaje base del cliente (`textoOriginal`) para contrastar con las líneas.

### Aprendizaje visible

1. Las líneas en rojo alimentan la lista de términos no resueltos, accesible desde el catálogo.
2. La interfaz no crea alias automáticamente en este módulo. El aprendizaje ocurre al corregir en la
   revisión.

## Criterios de aceptacion

### Captura y normalizacion

#### CA-001: Captura minima con cliente registrado

Dado un usuario con permiso `cotizaciones.crear`, un cliente activo con lista de precios y un texto
de al menos un ítem, cuando envía `POST /api/precotizaciones` con `textoOriginal` y `clienteId`,
entonces se crea la solicitud, la interpretación, la cotización en `BORRADOR` con folio consecutivo
y la respuesta es 201 con el resumen de líneas.

#### CA-002: Texto demasiado largo rechazado

Dado un texto de 4001 caracteres, cuando se intenta capturar, entonces la respuesta es 400 con
`TEXTO_SOLICITUD_DEMASIADO_LARGO` y no se crea solicitud ni cotización.

#### CA-003: Normalizacion elimina ruido de WhatsApp

Dado el texto `"[10:15] Juan:\nbuenas, necesito 2 tubos de media\ngracias"`, cuando se normaliza,
entonces `textoNormalizado` no contiene la marca de hora ni el saludo superfluo, convierte `media` a
la equivalencia de medida del pack y conserva la necesidad `2 tubos de 1/2`.

#### CA-004: Cliente de otra organizacion

Dado un `clienteId` de la organización B, cuando un usuario de la organización A captura una
solicitud, entonces la respuesta es 404 con `CLIENTE_NO_ENCONTRADO` y no se revela la existencia del
cliente ajeno.

### Extraccion con IA

#### CA-005: Contrato estricto rechaza precios en la salida

Dado un proveedor simulado que responde líneas con un campo `precio`, cuando corre la extracción,
entonces la interpretación se guarda con `exito` falso y `errorCodigo` `IA_SALIDA_INVALIDA`, la
cotización queda en `BORRADOR` sin líneas y la respuesta HTTP es 201.

#### CA-006: Timeout produce borrador vacio

Dado un proveedor que excede `IA_TIMEOUT_MS`, cuando corre el pipeline, entonces tras el reintento
permitido la interpretación falla con `IA_TIMEOUT`, se crea el borrador vacío y el operador puede
abrir la cotización para editarla a mano.

#### CA-007: Proveedor desactivado no bloquea

Dada una organización con `usaIa` en falso, cuando se captura una solicitud válida, entonces la
respuesta es 201 con `interpretacion.exito` falso, código `IA_DESACTIVADA` y cotización sin líneas.

#### CA-008: Ningun importe proviene de la IA

Dado un proveedor simulado que intenta devolver precios y totales, cuando el pipeline completa con
éxito forzado solo sobre campos permitidos o falla la validación, entonces ningún campo de importe
de `cotizacion_lineas` ni de `cotizaciones` se rellena a partir de la salida del modelo; los importes
existentes solo salen de `calcularCotizacion`.

#### CA-009: Reintento unico ante 503

Dado un proveedor que responde 503 en el primer intento y éxito en el segundo, cuando corre la
extracción, entonces hay exactamente un reintento, la interpretación queda con `exito` verdadero y
se persiste una sola fila de interpretación para esa ejecución lógica del pipeline.

### Resolucion y calculo

#### CA-010: Cascada resuelve por alias exacto

Dado un item con alias normalizado `tubo de 1/2` y umbral automático `0.8000`, cuando la línea
extraída es `tubo de media`, entonces tras normalizar se resuelve con `origenMatch` `ALIAS_EXACTO`,
confianza al menos `0.9800` y estado `RESUELTA_AUTOMATICA`.

#### CA-011: Empate impide resolucion automatica

Dados dos candidatos con puntajes `0.9100` y `0.8800` (diferencia menor que `0.0500`) y ambos por
encima del umbral automático, cuando se resuelve la línea, entonces el estado es `SUGERIDA_REVISAR` y
ambos figuran en los candidatos.

#### CA-012: Hasta cinco candidatos persistidos

Dada una línea con más de cinco coincidencias posibles, cuando se ensambla el borrador, entonces
`cotizacion_linea_candidatos` conserva como máximo cinco filas ordenadas por puntaje descendente.

#### CA-013: Item sin precio queda para revision

Dado un item resuelto con confianza alta pero sin precio en la lista aplicada, cuando corre el
cálculo, entonces la línea conserva el `itemId`, los importes quedan en cero o nulos según el motor,
y el resumen la cuenta como no cotizable de cara a la aprobación posterior.

#### CA-014: Motor puro sin llamar a la IA

Dado un borrador ya interpretado, cuando se recalcula con el motor de precios en aislamiento, entonces
no se invoca al proveedor de IA y el total coincide con el cálculo manual de las reglas configuradas.

### Ensamblado, reproceso y terminos

#### CA-015: Ensamblado atomico con folio

Dada una organización cuyo último folio es `44`, cuando el pipeline completa con éxito, entonces la
nueva cotización recibe folio `45`, la solicitud, la interpretación, las líneas, los candidatos y el
evento `CREADA` existen en la misma transacción, y un fallo posterior a la asignación de folio no
deja cotización huérfana sin líneas a medias.

#### CA-016: Reprocesar sobre el mismo borrador

Dada una solicitud con una interpretación (fallida o no) y una cotización en `BORRADOR`, cuando se
llama a reprocesar con el `cotizacionId` de ese borrador, entonces se crea una interpretación nueva,
se reescribe la misma cotización (mismo `id` y folio), las líneas previas quedan con `activa =
false`, las líneas nuevas se ensamblan, no se incrementa la secuencia de folio, y ninguna
interpretación ni cotización se borra físicamente.

#### CA-017: Termino no resuelto acumulado

Dada una línea con estado `NO_ENCONTRADA` y texto `manguera negra`, cuando se ensambla, entonces
existe o se incrementa un registro en `terminos_no_resueltos` con el texto normalizado, el ejemplo
original y `vecesVisto` actualizado.

#### CA-018: Ejemplo de cinco items con semaforo mixto

Dado el mensaje de ejemplo de cinco ítems de esta especificación y un catálogo con alias cargados
para tubos, codos y pegamento, cuando se genera la precotización, entonces el borrador tiene cinco
líneas, al menos dos en verde o ámbar según datos de prueba, al menos una distinguible por estado, y
el resumen refleja los conteos correctos por estado de resolución.

#### CA-019: Aislamiento entre organizaciones

Dado un usuario de la organización A y una solicitud, interpretación o cotización de la organización
B, cuando intenta reprocesar o leer por identificador, entonces todas las respuestas son 404, ningún
registro de B se modifica y ninguna respuesta revela su existencia.

#### CA-020: Evento de bitacora al crear

Dada una precotización creada con éxito, cuando se consulta la bitácora de la cotización, entonces
existe un evento `CREADA` y, si la interpretación fue exitosa, un evento `INTERPRETADA`, ambos con
`organizacionId` correcto y sin posibilidad de actualización posterior.

#### CA-021: Cantidad asumida en uno queda anotada

Dado un texto sin cantidad explícita para un ítem, cuando la IA extrae cantidad `"1.0000"` con nota
de cantidad asumida, entonces la línea del borrador conserva esa cantidad y la nota es visible para
el operador en la revisión.

#### CA-022: Sucursal fuera de acceso rechazada

Dado un usuario con acceso solo a la sucursal principal, cuando envía `sucursalId` de otra sucursal
de la misma organización, entonces la respuesta es 404 o 422 con `SUCURSAL_NO_ACCESIBLE` y no se
crea la cotización.

## Verificacion requerida para cierre

- [ ] Un usuario de la organización A no puede leer ni reprocesar solicitudes, interpretaciones ni
      cotizaciones de la organización B; recibe 404 en todos los casos.
- [ ] El pipeline ejecuta las cinco etapas en orden y cada etapa tiene pruebas aisladas: normalización
      sin red, extracción con proveedor `mock`, resolución contra un catálogo de prueba, cálculo con
      el motor puro y ensamblado transaccional.
- [ ] Ninguna prueba del motor de precios ni de la resolución invoca al proveedor de IA.
- [ ] El esquema Zod de extracción rechaza campos desconocidos, precios, ids y totales, con una
      prueba por cada clase de violación.
- [ ] El timeout y el reintento único están cubiertos con el proveedor simulado; un error de
      validación no se reintenta.
- [ ] Ante cualquier fallo de IA la respuesta es 201 con borrador vacío y `interpretacion.exito`
      falso; nunca se propaga una excepción al cliente HTTP del operador.
- [ ] La regla de empate menor a `0.0500` impide `RESUELTA_AUTOMATICA` aunque se supere el umbral.
- [ ] Se persisten como máximo cinco candidatos por línea, ordenados de forma estable.
- [ ] Reprocesar crea interpretación y cotización nuevas sin borrar las anteriores.
- [ ] Los términos no resueltos se acumulan solo desde líneas `NO_ENCONTRADA`.
- [ ] Los importes viajan y se persisten con 4 decimales; las tasas con 6.
- [ ] El folio se asigna con bloqueo de fila y no se reutiliza.
- [ ] El perfil `Cotizador` puede capturar y reprocesar; un usuario de plataforma recibe error de
      contexto.
- [ ] Existe un caso de prueba de extremo a extremo con el mensaje de cinco ítems y semáforo mixto.
- [ ] La traza de interpretación guarda proveedor, modelo, `versionPrompt`, latencia y, si aplica,
      tokens y costo estimado.

## Preguntas abiertas

| Tema | Pregunta | Impacto si se decide mal |
|------|----------|--------------------------|
| Limite de lineas extraidas | Si 40 líneas por solicitud es suficiente para el piloto | Mensajes de obra grande truncados o costo de IA elevado |
| Visibilidad del costo estimado | Si el cotizador debe ver el costo de la interpretación o solo administración y reportes | Ruido operativo o falta de control de gasto |
| Unidad no reconocida | Si una unidad extraída fuera de `unidadesValidas` debe fallar la línea, asumir la del item o dejarla nula | Líneas mal medidas o rechazos excesivos |
| Reproceso con texto editado | Si se permite alterar `textoOriginal` al reprocesar o solo se reprocesa el texto guardado | Ambigüedad entre nueva solicitud y nueva interpretación |
| Estrategia 5 de atributos | Cuánto del texto se intenta parsear como atributos en el MVP y con qué diccionario | Falsos positivos en resolución por atributos |
| Códigos de error HTTP vs CA | La spec CA usa `TEXTO_SOLICITUD_*` / `IA_DESACTIVADA`; el catálogo canónico usa `SOLICITUD_TEXTO_*` y registra `IA_*` también como códigos de interpretación. Backend MVP sigue el catálogo para HTTP y los `IA_*` de la spec en `errorCodigo` de la interpretación | Pruebas de aceptación con nombres distintos al contrato HTTP |
| Prefijo de folio sin plantilla | Si no hay plantilla predeterminada, se usa `COT-` + 4 dígitos (ADR 0006). ¿Debe fallar la captura sin plantilla? | Folios inconsistentes entre orgs o rechazo innecesario en piloto |

## Decisiones MVP v1

1. El pipeline tiene exactamente cinco etapas separadas; solo la extracción usa IA.
2. Ningún importe proviene de la salida del modelo de lenguaje; una salida con precios es fallo.
3. El fallo de la IA produce HTTP 201 con borrador vacío; nunca bloquea al operador.
4. `textoOriginal` se conserva intacto; `textoNormalizado` es derivado y no editable por API.
5. El límite de texto es 4000 caracteres; el timeout inicial de IA es 20000 ms con un solo reintento
   ante errores transitorios de red.
6. La validación Zod de la extracción es estricta y no repara heurísticamente respuestas inválidas.
7. La cascada de resolución tiene cinco estrategias; umbrales iniciales `0.8000` y `0.4500`.
8. Un empate menor a `0.0500` entre los dos mejores candidatos impide la resolución automática.
9. Se persisten hasta cinco candidatos por línea.
10. Reprocesar crea interpretación nueva y reescribe el borrador indicado (mismo id/folio); las
    líneas previas se desactivan; no borra historial ni consume folio.
11. Las interpretaciones son inmutables: solo se insertan.
12. Los términos no resueltos se escriben desde líneas `NO_ENCONTRADA` y se curan en el catálogo.
13. El cálculo usa el motor puro de `@cotizador/shared` con importes en cadena de 4 decimales.
14. La configuración del proveedor de IA es de plataforma; la organización solo activa o desactiva
    `usaIa` y ajusta umbrales.
15. Ninguna regla de este módulo ramifica por vertical: el vertical solo aporta equivalencias de
    medidas y unidades semilla.
16. Este módulo no aprueba ni entrega cotizaciones; la aprobación humana es obligatoria y pertenece
    a `docs/specs/009-revision-aprobacion.md`.

# Spec 009: Revision, aprobacion y entrega

## Estado

Especificada — pendiente de implementacion (2026-09-17)

## Objetivo

Definir el comportamiento de revisión humana del borrador de cotización: edición de líneas con
semáforo, recálculo de importes, aprobación con congelamiento, generación del texto para WhatsApp,
marcado de entrega y resultado, anulación y duplicado.

Este módulo cierra la regla de oro del producto: ninguna cotización se entrega al cliente sin una
aprobación humana registrada. Los importes se recalculan con el motor puro de `@cotizador/shared` en
el navegador para respuesta inmediata y se verifican de nuevo en el servidor antes de persistir o
aprobar. Ningún importe proviene de un modelo de lenguaje.

## Dependencias

| Documento | Aporta |
|-----------|--------|
| `docs/06-diseno-tecnico.md` | Modelo de cotizaciones, líneas, eventos, permisos, endpoints y reglas críticas |
| `docs/decisions/0003-pipeline-precotizacion.md` | Origen del borrador y separación entre IA, catálogo y precios |
| `docs/decisions/0005-motor-de-precios.md` | Motor puro compartido entre navegador y servidor; sobrescritura y congelamiento |
| `docs/decisions/0008-moneda-base-y-presentacion.md` | Congelamiento de tasa al aprobar; conversión solo del total |
| `docs/decisions/0011-auditoria-y-trazabilidad.md` | Bitácora inmutable, anulación con motivo y prohibición de borrado físico |
| `docs/specs/008-precotizacion-ia.md` | Generación del borrador, estados de resolución iniciales y candidatos |
| `docs/specs/004-catalogo-items.md` | Búsqueda de items, alias aprendidos y restricciones de tipo |
| `docs/specs/006-listas-precios-reglas.md` | Listas, reglas, impuesto, redondeo y configuración de cotización |
| `docs/01-glosario.md` | Estados de cotización, semáforo y vocabulario de Cliente / Organización / Item |

Esta especificación es consumida por `docs/specs/010-plantillas-documento.md` para el PDF y por
`docs/specs/011-historial-metricas.md` para el historial y las métricas del piloto.

Requisitos previos de implementación:

1. Pipeline de precotización capaz de crear cotizaciones en `BORRADOR` con líneas y candidatos.
2. Motor de precios puro publicado en `@cotizador/shared` y usable desde `apps/web` y `apps/api`.
3. Catálogo con búsqueda por similitud y permiso de administración de alias.
4. Configuración de cotización y plantilla mínima de textos de saludo, condiciones y pie.
5. Bitácora `cotizacion_eventos` disponible para inserción solamente.

## Alcance MVP v1

Incluye:

- Visualización del borrador con semáforo por línea según estado de resolución.
- Acciones sobre líneas: elegir candidato, buscar y asignar item, cambiar cantidad y unidad,
  sobrescribir precio con permiso y motivo, quitar línea.
- Altas de líneas manuales no provenientes del texto del cliente.
- Aprendizaje de alias con confirmación explícita al corregir una línea.
- Recálculo inmediato en el navegador con verificación en el servidor.
- Bloqueos de aprobación y aprobación explícita con congelamiento de precios, descuentos, tasa y
  textos.
- Generación del texto listo para pegar en WhatsApp, con ejemplo.
- Transiciones a `ENVIADA`, `GANADA`, `PERDIDA`, `ANULADA` y duplicado a nuevo borrador.
- Tabla de transiciones de estado y bitácora de eventos por cada acción relevante.

No incluye en esta versión:

| Fuera de alcance | Motivo |
|------------------|--------|
| Generación y almacenamiento del PDF | Pertenece a `docs/specs/010-plantillas-documento.md` |
| Envío automático por WhatsApp Business API | Diferido a fase 3; aquí solo se copia texto |
| Edición de líneas en cotizaciones ya aprobadas | Hay que anular y duplicar |
| Aprobación automática o por umbral de confianza | Viola la regla de oro |
| Portal del cliente comprador | El cliente no usa la plataforma |
| Firma electrónica o flujo de varios aprobadores | Fuera del piloto de mostrador |
| Recálculo masivo de cotizaciones históricas al cambiar precios | Las aprobadas están congeladas; los borradores se recalculan al abrirlos |

## Conceptos principales

| Concepto | Definicion operativa |
|----------|----------------------|
| Semaforo | Traducción visual del `estadoResolucion` de cada línea: verde, ámbar o rojo |
| Revision | Conjunto de ediciones sobre un borrador antes de aprobar |
| Sobrescritura de precio | Precio unitario fijado a mano con permiso, motivo y evento; gana sobre lista y reglas |
| Alias aprendido | Alias creado con confirmación explícita al corregir el item de una línea |
| Recalculo | Ejecución de `calcularCotizacion` tras cada cambio de línea, lista o tasa |
| Aprobacion | Acto humano registrado que congela importes, descuentos, tasa, descripción y SKU |
| Congelamiento | Copia inmutable de los valores comerciales al momento de aprobar |
| Texto WhatsApp | Mensaje plano generado desde la cotización aprobada y la plantilla de textos |
| Bitacora | Tabla `cotizacion_eventos`: solo inserciones, nunca actualizaciones ni borrados |
| Duplicado | Nueva cotización en `BORRADOR` que copia líneas y recalcula con precios vigentes |

### Semaforo por linea

| Estado de resolucion | Semaforo | Significado para el operador |
|----------------------|----------|------------------------------|
| `RESUELTA_AUTOMATICA` | Verde | Coincidencia confiable; puede aprobarse sin tocar si el precio existe |
| `SUGERIDA_REVISAR` | Ámbar | Hay candidatos plausibles; conviene confirmar o cambiar |
| `NO_ENCONTRADA` | Rojo | Sin coincidencia razonable; bloquea la aprobación |
| `RESUELTA_MANUAL` | Verde | La persona eligió o corrigió el item |
| `AGREGADA_MANUAL` | Verde | Línea añadida por la persona, no proveniente del texto |

## Datos requeridos

### Cotizacion editable

Campos de `cotizaciones` relevantes en revisión, además de los ya fijados al crear el borrador:

| Campo | Editable en BORRADOR | Notas |
|-------|----------------------|-------|
| `clienteId` | Si | Cliente activo de la organización |
| `nombreClienteLibre`, `telefonoClienteLibre` | Si | Si no hay cliente registrado |
| `listaPrecioId` | Si | Cambiar la lista recalcula todas las líneas |
| `observaciones` | Si | Notas internas, no van al cliente |
| `textoCondiciones`, `textoPie` | Si | Se pueden ajustar antes de aprobar; al aprobar se congelan |
| `vigenciaHasta` | No en borrador | Se calcula al aprobar con las horas configuradas |
| Importes de cabecera | Generados | Siempre derivados del motor; nunca se editan a mano en cabecera |
| `estado` | Por transiciones | Solo mediante las operaciones de esta especificación |

Tras aprobar, los campos comerciales dejan de ser editables. Solo cambian por transiciones de estado
(`ENVIADA`, `GANADA`, `PERDIDA`, `ANULADA`) o por generación de documento.

### Linea de cotizacion

| Campo | Editable en BORRADOR | Notas |
|-------|----------------------|-------|
| `itemId` | Si | Debe ser item activo de la organización con precio en la lista, salvo sobrescritura |
| `textoSolicitado` | No | Se conserva como evidencia de lo pedido; no se reescribe al corregir el item |
| `descripcion`, `sku` | Generados | Se toman del item al asignarlo; se congelan al aprobar |
| `unidadMedidaId` | Si | Unidad activa; sujeta a `permiteDecimales` |
| `cantidad` | Si | Mayor que cero; entera si la unidad no admite decimales; máximo 1 si el item es `SERIALIZADO` |
| `precioUnitario` | Condicional | Solo con permiso de sobrescritura y motivo |
| `precioSobrescrito`, `motivoSobrescritura` | Condicional | Obligatorios al sobrescribir |
| `estadoResolucion` | Generado | Pasa a `RESUELTA_MANUAL` o `AGREGADA_MANUAL` según la acción |
| `confianza`, `origenMatch` | Generados | `origenMatch` pasa a `MANUAL` cuando la persona elige el item |
| Candidatos | Solo lectura | Siguen disponibles para elegir; no se regeneran al editar salvo que se reprocese |

### Evento de cotizacion

Tabla `cotizacion_eventos`, inmutable.

| Campo | Notas |
|-------|-------|
| `tipo` | Uno de los valores cerrados listados más abajo |
| `descripcion` | Texto corto legible para la bitácora de interfaz |
| `datos` | JSON con el detalle (ids de línea, valores anteriores y nuevos, motivos) |
| `usuarioId` | Tomado del contexto |
| `createdAt` | Asignado al insertar; nunca se actualiza |

Tipos usados por este módulo: `LINEA_CORREGIDA`, `LINEA_AGREGADA`, `LINEA_ELIMINADA`,
`PRECIO_SOBRESCRITO`, `ALIAS_APRENDIDO`, `RECALCULADA`, `APROBADA`, `ENVIADA`, `MARCADA_GANADA`,
`MARCADA_PERDIDA`, `ANULADA`, `DUPLICADA`. Los tipos `CREADA`, `INTERPRETADA`, `DOCUMENTO_GENERADO` y
`VENCIDA` los producen otros módulos o procesos, pero la bitácora es la misma.

## Reglas de negocio

### Contexto y aislamiento

1. Toda operación exige `ctx.organizacionId` no nulo y filtra por ese identificador. Un recurso ajeno
   responde 404.
2. Solo las cotizaciones en estado `BORRADOR` admiten edición de cabecera y de líneas.
3. Una cotización aprobada o posterior no admite edición de líneas. Para cambiarla hay que anularla y
   duplicarla.
4. Las cotizaciones y sus eventos no se borran físicamente.

### Acciones sobre una linea

#### Elegir un candidato

1. El operador selecciona uno de los candidatos persistidos en `cotizacion_linea_candidatos`.
2. Se asigna ese `itemId`, se actualizan descripción, SKU y unidad por defecto del item, se pone
   `estadoResolucion` en `RESUELTA_MANUAL`, `origenMatch` en `MANUAL` y se recalcula.
3. Se inserta el evento `LINEA_CORREGIDA` con el candidato elegido y el puntaje que tenía.

#### Buscar y asignar un item

1. La búsqueda usa `GET /api/items/buscar` del catálogo, filtrada a items activos de la organización.
2. Al asignar un item que no estaba en los candidatos, el comportamiento es el mismo que al elegir
   candidato: estado `RESUELTA_MANUAL`, origen `MANUAL`, recálculo y evento.
3. Un item inactivo no se puede asignar. Responde 422 con `ITEM_NO_COTIZABLE`.
4. Un item sin precio en la lista aplicada se puede asignar solo si a continuación se sobrescribe el
   precio o si la interfaz deja la línea marcada como no cotizable; la aprobación seguirá bloqueada
   mientras no tenga precio válido.

#### Cambiar cantidad

1. La cantidad debe ser mayor que cero. Cero o negativa responde 400 con `CANTIDAD_INVALIDA`.
2. Si la unidad no admite decimales, la cantidad debe ser entera. Responde 422 con
   `CANTIDAD_NO_ENTERA`.
3. Un item `SERIALIZADO` admite cantidad máxima `1.0000`. Responde 422 con
   `SERIALIZADO_CANTIDAD_INVALIDA`.
4. Todo cambio de cantidad recalcula la línea y la cabecera e inserta `LINEA_CORREGIDA` o se agrupa
   en el evento de recálculo según la operación de API usada.

#### Cambiar unidad

1. La unidad debe ser activa y de la organización.
2. Si la nueva unidad no admite decimales y la cantidad actual tiene parte fraccionaria, la operación
   responde 422 con `CANTIDAD_INCOMPATIBLE_CON_UNIDAD` y no trunca en silencio.
3. Cambiar la unidad no cambia el item; solo afecta validación de cantidad y la etiqueta mostrada.

#### Sobrescribir precio

1. Exige el permiso `cotizaciones.sobrescribir_precio` y que la configuración de la organización
   tenga `permiteSobrescribirPrecio` en verdadero.
2. Exige `motivoSobrescritura` de al menos 10 caracteres.
3. El precio sobrescrito es el precio unitario final de la línea. No se aplica descuento adicional de
   reglas sobre ese precio.
4. Se marcan `precioSobrescrito` en verdadero, se guarda el motivo, se recalcula e inserta el evento
   `PRECIO_SOBRESCRITO`.
5. Quitar la sobrescritura (volver al precio de lista y reglas) está permitido en borrador, deja
   `precioSobrescrito` en falso, limpia el motivo y recalcula.
6. El perfil `Cotizador` **no** tiene este permiso por defecto. El `Administrador Organizacion` sí.

#### Quitar linea

1. Eliminar una línea de un borrador la quita de la cotización vigente. En el MVP la fila de línea se
   marca fuera del conjunto activo del documento; no se expone un borrado físico de historial de
   eventos. La operación inserta `LINEA_ELIMINADA` con el detalle de la línea quitada.
2. No se puede dejar la cotización en un estado inconsistente: tras quitar se recalculan los totales.
3. Quitar la última línea deja el borrador sin líneas; la aprobación seguirá bloqueada.

### Lineas manuales

1. Agregar una línea exige item activo, cantidad válida y unidad válida.
2. `textoSolicitado` puede informarse a mano o copiarse del nombre del item; `estadoResolucion` queda
   en `AGREGADA_MANUAL` y `origenMatch` en `MANUAL`.
3. Se inserta el evento `LINEA_AGREGADA`.
4. Las líneas manuales participan del mismo recálculo y de los mismos bloqueos de aprobación que las
   demás.

### Alias aprendido

1. Al corregir el item de una línea que tiene `textoSolicitado`, la interfaz ofrece guardar ese texto
   como alias del item elegido.
2. La creación del alias exige confirmación explícita (`guardarAlias: true` en la petición). Nunca es
   automática.
3. El alias se crea con origen `APRENDIDO`, normalización del servidor y las mismas reglas de
   unicidad por item de `docs/specs/004-catalogo-items.md`.
4. Exige el permiso `catalogo.alias.administrar`.
5. Se inserta el evento `ALIAS_APRENDIDO` con el texto, el item y el identificador del alias.
6. Si el alias ya existe en el mismo item, no se duplica; la respuesta advierte y no falla la
   corrección de la línea.

### Recalculo en navegador y verificacion en servidor

1. `apps/web` importa `calcularCotizacion` desde `@cotizador/shared` y recalcula en cada cambio de
   cantidad, item, lista, sobrescritura, impuesto visible o tasa, sin llamar a la IA.
2. El servidor vuelve a ejecutar el mismo motor al persistir cualquier edición de línea o cabecera y
   al aprobar. Si el total enviado por el cliente difiere del recalculado en servidor más allá de la
   tolerancia de redondeo configurada (un mínimo de la unidad del último decimal), responde 422 con
   `TOTALES_DESFASADOS` y devuelve el resultado servidor como fuente de verdad.
3. Cambiar la lista de precios o la tasa vigente en un borrador recalcula todas las líneas.
4. Cada recálculo persistido puede insertar el evento `RECALCULADA` cuando el cambio no está ya
   cubierto por un evento más específico de línea.
5. Los importes viajan como cadenas con 4 decimales; las tasas con 6.

### Bloqueos de aprobacion

No se puede aprobar cuando se cumple cualquiera de estas condiciones:

| Condicion | Codigo |
|-----------|--------|
| La cotización no está en `BORRADOR` | `COTIZACION_ESTADO_INVALIDO` |
| No tiene ninguna línea | `COTIZACION_SIN_LINEAS` |
| Al menos una línea está en `NO_ENCONTRADA` | `LINEAS_SIN_RESOLVER` |
| Al menos una línea no tiene item asignado | `LINEAS_SIN_RESOLVER` |
| Al menos una línea no tiene precio cotizable (sin precio de lista y sin sobrescritura válida) | `LINEAS_SIN_PRECIO` |
| Alguna cantidad es inválida respecto de unidad o tipo de item | `CANTIDAD_INVALIDA` |
| El usuario carece de `cotizaciones.aprobar` | 403 estándar de permiso |

La aprobación es siempre un acto explícito: no existe aprobación implícita al generar el texto o el
PDF.

### Congelamiento al aprobar

Al aprobar con éxito, en la misma transacción:

1. Se copia a cada línea el precio unitario, descuento, identificador de regla, subtotal, total,
   descripción y SKU vigentes.
2. Se copian a la cabecera subtotal, descuento total, impuesto, total, total de presentación,
   porcentaje de impuesto aplicado, moneda base, moneda de presentación, `tasaAplicada` y
   `tasaFecha`.
3. Se calcula `vigenciaHasta` sumando `vigenciaHorasPredeterminada` a la fecha de aprobación.
4. Se registran `aprobadaPorId` y `aprobadaAt`.
5. El estado pasa a `APROBADA`.
6. Se inserta el evento `APROBADA`.
7. A partir de ese momento, cambiar precios del catálogo, reglas o tasas **no** altera esta
   cotización. Su valor no cambia nunca.

### Texto para WhatsApp

1. Disponible solo para cotizaciones en estado `APROBADA` o posterior no anulado, con permiso
   `cotizaciones.generar_documento`.
2. Se genera a partir de la plantilla de textos de la organización (saludo, columnas visibles en
   texto, condiciones, pie) y de los valores congelados.
3. No vuelve a consultar precios ni tasa vigente.
4. Ejemplo de salida:

```text
Hola Carlos, te cotizo:

1. Tubo PVC 1/2" — 2 und × 12.5000 = 25.0000 USD
2. Codo PVC 1/2" — 10 und × 1.2500 = 12.5000 USD
3. Cemento PVC azul — 1 und × 8.0000 = 8.0000 USD

Subtotal: 45.5000 USD
Descuento: 0.0000 USD
Total: 45.5000 USD
Total ref.: 4.095,00 Bs (tasa 90.000000 del 2026-09-17)

Vigencia: 48 horas
Condiciones: Precios sujetos a existencia.
Gracias por preferirnos.
```

5. El endpoint de mensaje es de lectura: no cambia el estado a `ENVIADA`. Marcar enviada es una
   acción aparte, porque copiar el texto no garantiza que la persona lo haya pegado ya.

### Transiciones de estado

| Estado origen | Accion | Estado destino | Permiso | Requisitos |
|---------------|--------|----------------|---------|------------|
| `BORRADOR` | Aprobar | `APROBADA` | `cotizaciones.aprobar` | Sin bloqueos de aprobación |
| `BORRADOR` | Anular | `ANULADA` | `cotizaciones.anular` | Motivo ≥ 10 caracteres |
| `APROBADA` | Marcar enviada | `ENVIADA` | `cotizaciones.registrar_resultado` | — |
| `APROBADA` | Anular | `ANULADA` | `cotizaciones.anular` | Motivo ≥ 10 caracteres |
| `ENVIADA` | Marcar ganada | `GANADA` | `cotizaciones.registrar_resultado` | — |
| `ENVIADA` | Marcar perdida | `PERDIDA` | `cotizaciones.registrar_resultado` | Motivo de pérdida ≥ 10 caracteres |
| `ENVIADA` | Anular | `ANULADA` | `cotizaciones.anular` | Motivo ≥ 10 caracteres |
| `ENVIADA` | Vencer (proceso) | `VENCIDA` | sistema | `vigenciaHasta` superada |
| `VENCIDA` | Marcar ganada | `GANADA` | `cotizaciones.registrar_resultado` | Permitido para no perder el cierre tardío |
| `VENCIDA` | Marcar perdida | `PERDIDA` | `cotizaciones.registrar_resultado` | Motivo ≥ 10 caracteres |
| Cualquier no terminal | Duplicar | nuevo `BORRADOR` | `cotizaciones.crear` | No cambia el estado del origen |

Estados terminales: `GANADA`, `PERDIDA`, `ANULADA`. Desde ellos no hay transiciones, salvo duplicar
hacia un borrador nuevo.

Cualquier otra transición responde 422 con `TRANSICION_ESTADO_INVALIDA`.

### Enviada, ganada, perdida, anular y duplicar

1. **Enviada:** registra `enviadaAt` e inserta `ENVIADA`. No regenera importes.
2. **Ganada:** registra `resultadoAt`, estado `GANADA`, evento `MARCADA_GANADA`.
3. **Perdida:** exige `motivoPerdida` de al menos 10 caracteres, estado `PERDIDA`, evento
   `MARCADA_PERDIDA`.
4. **Anular:** exige motivo de al menos 10 caracteres; marca `anulado`, `anuladoAt`, `anuladoById`,
   `motivoAnulacion`; estado `ANULADA`; evento `ANULADA`. Conserva líneas, importes y documentos.
5. **Duplicar:** crea una cotización nueva en `BORRADOR` con `cotizacionOrigenId` apuntando al
   origen, nuevas líneas copiadas en contenido comercial, precios y descuentos **recalculados con
   la lista y reglas vigentes**, nuevo folio, evento `DUPLICADA` en el origen y `CREADA` en el
   destino. El texto de la solicitud original no se clona como nueva interpretación salvo que el
   origen tenga `solicitudId`, en cuyo caso el duplicado puede conservar la referencia informativa
   sin crear interpretación nueva.

### Bitacora de eventos

1. Toda acción relevante inserta exactamente los eventos declarados; no se actualizan ni eliminan.
2. La consulta de bitácora es parte del detalle de la cotización o de un subrecurso de solo lectura.
3. Los eventos alimentan las métricas del piloto (tiempo a aprobación, correcciones, resultados).

## Permisos

| Operacion | Permiso |
|-----------|---------|
| Ver cotización, líneas, candidatos y bitácora | `cotizaciones.ver` |
| Editar cabecera y líneas del borrador | `cotizaciones.editar` |
| Sobrescribir precio de una línea | `cotizaciones.sobrescribir_precio` |
| Guardar alias aprendido al corregir | `catalogo.alias.administrar` |
| Aprobar | `cotizaciones.aprobar` |
| Obtener texto WhatsApp | `cotizaciones.generar_documento` |
| Marcar enviada, ganada o perdida | `cotizaciones.registrar_resultado` |
| Anular | `cotizaciones.anular` |
| Duplicar | `cotizaciones.crear` |
| Buscar items para asignar | `catalogo.items.ver` |

Consecuencias de los perfiles:

1. El perfil `Cotizador` puede editar, aprobar, generar texto, registrar resultado y crear alias, pero
   **no** sobrescribir precios.
2. El perfil `Administrador Organizacion` tiene además `cotizaciones.sobrescribir_precio` y
   `cotizaciones.anular`.
3. Un usuario de plataforma no opera cotizaciones.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/cotizaciones/:id` | `cotizaciones.ver` | Detalle con líneas, candidatos y totales |
| PATCH | `/api/cotizaciones/:id` | `cotizaciones.editar` | Cliente, lista, observaciones, textos |
| POST | `/api/cotizaciones/:id/lineas` | `cotizaciones.editar` | Agregar línea manual |
| PATCH | `/api/cotizaciones/:id/lineas/:lineaId` | `cotizaciones.editar` | Item, cantidad, unidad, precio; `guardarAlias` |
| DELETE | `/api/cotizaciones/:id/lineas/:lineaId` | `cotizaciones.editar` | Quitar línea del borrador |
| POST | `/api/cotizaciones/:id/aprobar` | `cotizaciones.aprobar` | Congela e incorpora aprobación |
| GET | `/api/cotizaciones/:id/mensaje` | `cotizaciones.generar_documento` | Texto listo para WhatsApp |
| POST | `/api/cotizaciones/:id/enviada` | `cotizaciones.registrar_resultado` | Marca entregada |
| POST | `/api/cotizaciones/:id/resultado` | `cotizaciones.registrar_resultado` | Ganada o perdida |
| POST | `/api/cotizaciones/:id/anular` | `cotizaciones.anular` | Anula con motivo |
| POST | `/api/cotizaciones/:id/duplicar` | `cotizaciones.crear` | Nuevo borrador con precios vigentes |
| GET | `/api/cotizaciones/:id/eventos` | `cotizaciones.ver` | Bitácora ordenada por fecha |

Ruta adicional respecto de `docs/06-diseno-tecnico.md`: `GET /api/cotizaciones/:id/eventos`, alineada
con las convenciones del documento maestro.

### Edicion de linea

```typescript
// PATCH /api/cotizaciones/:id/lineas/:lineaId
type EditarLineaInput = {
  itemId?: string;
  candidatoItemId?: string;       // atajo: elige un candidato ya persistido
  cantidad?: string;              // cadena decimal 4 decimales
  unidadMedidaId?: string;
  precioUnitario?: string;        // requiere permiso de sobrescritura
  motivoSobrescritura?: string;   // min 10 caracteres si hay precioUnitario
  quitarSobrescritura?: boolean;
  guardarAlias?: boolean;         // confirmacion explicita del alias aprendido
  totalesCliente?: {              // opcional: totales que mostro el navegador
    subtotal: string;
    total: string;
  };
};
```

### Aprobacion y resultado

```typescript
// POST /api/cotizaciones/:id/aprobar
type AprobarInput = {
  totalesCliente?: {
    subtotal: string;
    descuentoTotal: string;
    impuestoTotal: string;
    total: string;
    totalPresentacion?: string | null;
  };
};

// POST /api/cotizaciones/:id/resultado
type RegistrarResultadoInput = {
  resultado: 'GANADA' | 'PERDIDA';
  motivoPerdida?: string;         // obligatorio si PERDIDA, min 10 caracteres
};

// POST /api/cotizaciones/:id/anular
type AnularInput = {
  motivoAnulacion: string;        // min 10 caracteres
};
```

### Mensaje WhatsApp

```typescript
// GET /api/cotizaciones/:id/mensaje
type MensajeWhatsApp = {
  texto: string;
  cotizacionId: string;
  folio: string;
  estado: string;
  generadoAt: string;             // ISO 8601 UTC
};
```

Los importes y cantidades viajan como cadenas con 4 decimales.

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `COTIZACION_NO_ENCONTRADA` | No existe o es de otra organización. Responde 404 |
| `COTIZACION_ESTADO_INVALIDO` | La operación no aplica al estado actual. Responde 422 |
| `TRANSICION_ESTADO_INVALIDA` | Transición no contemplada en la tabla. Responde 422 |
| `COTIZACION_SIN_LINEAS` | Se intenta aprobar sin líneas. Responde 422 |
| `LINEAS_SIN_RESOLVER` | Hay líneas `NO_ENCONTRADA` o sin item. Responde 422 |
| `LINEAS_SIN_PRECIO` | Hay líneas sin precio cotizable. Responde 422 |
| `LINEA_NO_ENCONTRADA` | La línea no existe en la cotización. Responde 404 |
| `ITEM_NO_COTIZABLE` | Item inactivo o no asignable. Responde 422 |
| `ITEM_NO_ENCONTRADO` | Item ajeno o inexistente. Responde 404 |
| `CANTIDAD_INVALIDA` | Cantidad menor o igual a cero. Responde 400 |
| `CANTIDAD_NO_ENTERA` | La unidad no admite decimales. Responde 422 |
| `CANTIDAD_INCOMPATIBLE_CON_UNIDAD` | Cantidad fraccionaria al cambiar a unidad entera. Responde 422 |
| `SERIALIZADO_CANTIDAD_INVALIDA` | Cantidad distinta de uno en item serializado. Responde 422 |
| `SOBRESCRITURA_NO_PERMITIDA` | Configuración o permiso insuficientes. Responde 403 o 422 |
| `MOTIVO_SOBRESCRITURA_REQUERIDO` | Falta motivo o tiene menos de 10 caracteres. Responde 400 |
| `MOTIVO_ANULACION_REQUERIDO` | Motivo ausente o demasiado corto. Responde 400 |
| `MOTIVO_PERDIDA_REQUERIDO` | Motivo ausente o demasiado corto. Responde 400 |
| `TOTALES_DESFASADOS` | Los totales del cliente no coinciden con el motor del servidor. Responde 422 |
| `ALIAS_NO_CONFIRMADO` | No aplica: sin `guardarAlias` simplemente no se crea el alias |
| `BORRADOR_NO_EDITABLE` | Intento de editar líneas fuera de `BORRADOR`. Responde 422 |

## Experiencia de usuario

### Pantalla de revision del borrador

1. Cabecera con folio, cliente, lista, semáforo resumen (conteo verde / ámbar / rojo) y totales.
2. Cada línea muestra: texto solicitado, item elegido, cantidad, unidad, precio, descuento, total de
   línea y el color del semáforo.
3. En líneas ámbar y rojas, los candidatos aparecen expandidos por defecto. En verdes, plegados.
4. Acciones por línea, en este orden de prioridad visual: elegir candidato, buscar item, editar
   cantidad, editar unidad, sobrescribir precio (si hay permiso), quitar.
5. Al cambiar el item, un diálogo pregunta si se guarda el `textoSolicitado` como alias. La opción
   por defecto es no guardar; hay que confirmar explícitamente.
6. Agregar línea manual abre un buscador de items y campos de cantidad y unidad.
7. Los totales se actualizan al instante en el navegador; un indicador discreto señala cuando el
   servidor confirma el mismo resultado.

### Aprobacion y entrega

1. El botón aprobar está deshabilitado mientras existan bloqueos; cada bloqueo se lista en texto
   claro junto al botón.
2. Al aprobar, la interfaz confirma que los precios quedarán congelados y muestra vigencia.
3. Tras aprobar, la acción principal pasa a ser copiar el texto WhatsApp. Copiar no marca enviada;
   hay un botón aparte "Marcar como enviada".
4. Ganada y perdida se ofrecen desde `ENVIADA` (y desde `VENCIDA`). Perdida exige motivo en el mismo
   diálogo.
5. Anular exige motivo y una confirmación que advierte que el registro se conserva.
6. Duplicar explica que se creará un borrador nuevo con precios actuales, no con los congelados.

### Bitacora

1. Panel lateral o sección al final del detalle con los eventos en orden cronológico inverso.
2. Cada evento muestra fecha, usuario, tipo y una descripción corta; el detalle JSON no se muestra
   al cotizador salvo ampliación explícita.

## Criterios de aceptacion

### Edicion de lineas y semaforo

#### CA-001: Elegir candidato pasa a resuelta manual

Dado un borrador con una línea en `SUGERIDA_REVISAR` y tres candidatos, cuando el operador elige el
segundo candidato, entonces la línea queda con ese `itemId`, `estadoResolucion` `RESUELTA_MANUAL`,
`origenMatch` `MANUAL`, se recalculan importes y existe un evento `LINEA_CORREGIDA`.

#### CA-002: Buscar y asignar item fuera de candidatos

Dado una línea en `NO_ENCONTRADA`, cuando el operador asigna un item encontrado por búsqueda, entonces
la línea pasa a `RESUELTA_MANUAL`, deja de bloquear por no encontrada y se recalcula.

#### CA-003: Cantidad no entera rechazada

Dada una unidad con `permiteDecimales` en falso, cuando se informa cantidad `1.5000`, entonces la
respuesta es 422 con `CANTIDAD_NO_ENTERA` y la línea no cambia.

#### CA-004: Serializado solo admite cantidad uno

Dado un item `SERIALIZADO`, cuando se informa cantidad `2.0000`, entonces la respuesta es 422 con
`SERIALIZADO_CANTIDAD_INVALIDA`.

#### CA-005: Quitar linea recalcula totales

Dado un borrador con tres líneas y total `30.0000`, cuando se quita una línea cuyo total era
`10.0000` sin descuentos ni impuesto, entonces el nuevo total es `20.0000` y existe evento
`LINEA_ELIMINADA`.

#### CA-006: Linea manual agregada

Dado un borrador, cuando se agrega una línea manual con item activo, cantidad `3.0000` y unidad
válida, entonces la línea nace con `AGREGADA_MANUAL`, participa del total y existe evento
`LINEA_AGREGADA`.

### Precio, alias y recalculo

#### CA-007: Sobrescritura exige permiso y motivo

Dado un usuario sin `cotizaciones.sobrescribir_precio`, cuando intenta enviar `precioUnitario`,
entonces recibe 403. Dado un administrador con permiso pero sin motivo, recibe 400 con
`MOTIVO_SOBRESCRITURA_REQUERIDO`. Con permiso y motivo válido, la línea queda sobrescrita, sin
descuento de reglas adicional, y existe `PRECIO_SOBRESCRITO`.

#### CA-008: Alias aprendido solo con confirmacion

Dado un cambio de item sobre una línea con `textoSolicitado` `pega azul`, cuando se envía la edición
sin `guardarAlias`, entonces no se crea alias. Cuando se envía con `guardarAlias: true` y permiso de
alias, se crea el alias `APRENDIDO` y existe evento `ALIAS_APRENDIDO`.

#### CA-009: Recalculo compartido navegador y servidor

Dado el mismo conjunto de líneas, reglas y configuración, cuando el navegador calcula con
`@cotizador/shared` y el servidor persiste la edición, entonces los totales coinciden carácter a
carácter en 4 decimales. Si el cliente envía un total distinto, la respuesta es 422 con
`TOTALES_DESFASADOS` y el cuerpo devuelve los totales del servidor.

#### CA-010: Cambio de lista recalcula el borrador

Dado un borrador con precios de la lista pública, cuando se cambia a la lista mayorista, entonces
todas las líneas no sobrescritas adoptan el precio de esa lista, se aplican las reglas vigentes y se
actualizan los totales.

### Aprobacion y congelamiento

#### CA-011: Bloqueo por linea roja

Dado un borrador con al menos una línea `NO_ENCONTRADA`, cuando se llama a aprobar, entonces la
respuesta es 422 con `LINEAS_SIN_RESOLVER` y el estado sigue en `BORRADOR`.

#### CA-012: Bloqueo sin lineas

Dado un borrador vacío, cuando se llama a aprobar, entonces la respuesta es 422 con
`COTIZACION_SIN_LINEAS`.

#### CA-013: Bloqueo por linea sin precio

Dado un borrador con todas las líneas resueltas pero una sin precio de lista ni sobrescritura,
cuando se llama a aprobar, entonces la respuesta es 422 con `LINEAS_SIN_PRECIO`.

#### CA-014: Aprobacion congela importes y tasa

Dado un borrador aprobable con moneda de presentación y tasa `90.000000`, cuando se aprueba,
entonces el estado pasa a `APROBADA`, quedan registrados `aprobadaPorId` y `aprobadaAt`,
`vigenciaHasta` respeta las horas configuradas, `tasaAplicada` queda en `90.000000` y un cambio
posterior de la tasa vigente o del precio del catálogo no modifica los importes de esta cotización.

#### CA-015: Cotizacion aprobada no editable

Dado una cotización `APROBADA`, cuando se intenta editar una línea, entonces la respuesta es 422 con
`BORRADOR_NO_EDITABLE` o `COTIZACION_ESTADO_INVALIDO`.

### Entrega, resultado, anular y duplicar

#### CA-016: Texto WhatsApp con valores congelados

Dada una cotización aprobada con tres líneas y total de presentación, cuando se solicita el mensaje,
entonces el texto incluye folio o saludo configurado, las líneas con cantidades e importes
congelados, el total en moneda base, el total de presentación con tasa y fecha, y la vigencia; no
consulta la tasa actual del día.

#### CA-017: Marcar enviada

Dada una cotización `APROBADA`, cuando se marca enviada, entonces el estado pasa a `ENVIADA`, se
registra `enviadaAt` y existe evento `ENVIADA`. Copiar el mensaje por sí solo no realiza esta
transición.

#### CA-018: Ganada y perdida

Dada una cotización `ENVIADA`, cuando se registra `GANADA`, el estado queda `GANADA` con evento
`MARCADA_GANADA`. Cuando en otro caso se registra `PERDIDA` sin motivo, responde 400; con motivo
válido queda `PERDIDA` con evento `MARCADA_PERDIDA`.

#### CA-019: Anular con motivo conserva el registro

Dada una cotización `APROBADA`, cuando se anula con motivo de al menos 10 caracteres, entonces el
estado es `ANULADA`, las columnas de anulación están pobladas, las líneas y los importes congelados
siguen consultables y existe evento `ANULADA`. No se ejecuta borrado físico.

#### CA-020: Duplicar crea borrador con precios vigentes

Dada una cotización aprobada cuyo item cambió de precio en el catálogo después de aprobar, cuando se
duplica, entonces nace un nuevo `BORRADOR` con nuevo folio, `cotizacionOrigenId` apuntando al
origen, líneas equivalentes recalculadas al precio vigente y eventos `DUPLICADA` / `CREADA`. La
cotización origen no cambia de estado.

#### CA-021: Transicion invalida rechazada

Dada una cotización `GANADA`, cuando se intenta marcar enviada o editar líneas, entonces la
respuesta es 422 con `TRANSICION_ESTADO_INVALIDA` o `COTIZACION_ESTADO_INVALIDO`.

#### CA-022: Bitacora inmutable

Dada una cotización con varios eventos, cuando se consulta `GET /api/cotizaciones/:id/eventos`,
entonces la lista incluye las acciones realizadas en orden cronológico y no existe endpoint que
actualice o borre un evento.

#### CA-023: Aislamiento entre organizaciones

Dado un usuario de la organización A y una cotización de la organización B, cuando intenta verla,
editarla, aprobarla, anularla o duplicarla, entonces todas las respuestas son 404 y ningún registro
de B se modifica.

#### CA-024: Perfil cotizador no sobrescribe precio

Dado un usuario con perfil `Cotizador`, cuando intenta sobrescribir el precio de una línea, entonces
recibe 403 y la línea conserva el precio calculado por el motor.

## Verificacion requerida para cierre

- [ ] Un usuario de la organización A no puede leer ni modificar cotizaciones, líneas ni eventos de
      la organización B; recibe 404 en todos los casos.
- [ ] Todas las transiciones de la tabla de estados tienen prueba de camino feliz y de rechazo de
      transiciones inválidas.
- [ ] Los bloqueos de aprobación (sin líneas, `NO_ENCONTRADA`, sin precio) están cubiertos con
      pruebas independientes.
- [ ] El congelamiento se verifica cambiando precio de catálogo y tasa después de aprobar y
      comprobando que la cotización no cambia.
- [ ] El motor de `@cotizador/shared` se ejecuta en pruebas de interfaz (unidad del módulo) y en
      pruebas de API; ante desfase se responde `TOTALES_DESFASADOS`.
- [ ] La sobrescritura exige permiso, motivo ≥ 10 caracteres y genera evento; el perfil `Cotizador`
      recibe 403.
- [ ] El alias aprendido solo se crea con `guardarAlias: true` y permiso de alias.
- [ ] Cantidades respetan unidad sin decimales e items `SERIALIZADO`.
- [ ] El texto WhatsApp usa valores congelados y no marca el estado `ENVIADA` por sí solo.
- [ ] Anular y perder exigen motivo; anular conserva el registro completo.
- [ ] Duplicar asigna nuevo folio y recalcula con precios vigentes.
- [ ] La bitácora solo inserta; no hay update ni delete de eventos.
- [ ] Los importes viajan como cadenas con 4 decimales y las tasas con 6.
- [ ] Ninguna aprobación ocurre sin usuario y fecha registrados.
- [ ] Ningún importe de la cotización proviene de un modelo de lenguaje en este flujo.

## Preguntas abiertas

| Tema | Pregunta | Impacto si se decide mal |
|------|----------|--------------------------|
| Soft-delete de lineas quitadas | Si al quitar una línea del borrador se inactiva la fila o se elimina de la tabla de líneas manteniendo solo el evento | Dificultad para auditorías de edición vs simplicidad del modelo |
| Tolerancia de `TOTALES_DESFASADOS` | Cuál es el delta exacto aceptable entre cliente y servidor además del redondeo configurado | Falsos positivos al editar en dispositivos lentos |
| Solicitud en el duplicado | Si el duplicado debe clonar `solicitudId` o nacer sin solicitud | Trazabilidad del mensaje original vs claridad de origen |
| Edicion de textos de condiciones tras aprobar | Si se permiten correcciones ortográficas no comerciales después de aprobar | Documentos ya enviados vs flexibilidad operativa |
| Vencimiento automatico | Quién ejecuta el paso a `VENCIDA` (job programado vs evaluación perezosa al leer) | Estados desactualizados en listados |
| Ruta de eventos | Confirmar incorporación de `GET /api/cotizaciones/:id/eventos` al diseño maestro | Divergencia de contrato |

## Decisiones MVP v1

1. Ninguna cotización se entrega sin aprobación humana registrada con usuario y fecha.
2. Ningún importe proviene de IA; el recálculo usa exclusivamente `@cotizador/shared`.
3. El navegador recalcula para UX; el servidor verifica y es la fuente de verdad.
4. El semáforo refleja `estadoResolucion`; corregir a mano produce `RESUELTA_MANUAL` o
   `AGREGADA_MANUAL`.
5. Sobrescribir precio exige permiso específico, motivo y evento; no aplica descuento adicional.
6. El alias aprendido exige confirmación explícita; nunca es automático.
7. No se aprueba con líneas `NO_ENCONTRADA`, sin líneas o sin precio cotizable.
8. Aprobar congela precios, descuentos, regla, impuesto, tasa, descripción y SKU; el valor no cambia
   después.
9. El texto WhatsApp no implica transición a `ENVIADA`; marcar enviada es acción aparte.
10. Las transiciones siguen la tabla de esta especificación; cualquier otra es error 422.
11. Anulación y pérdida exigen motivo de al menos 10 caracteres y conservan el registro.
12. Duplicar crea borrador nuevo con precios vigentes y nuevo folio.
13. La bitácora es de solo inserción.
14. El perfil `Cotizador` no sobrescribe precios.
15. Los importes se transportan como cadenas con 4 decimales.
16. Ninguna regla de este módulo ramifica por vertical.

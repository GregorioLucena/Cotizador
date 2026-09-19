# Spec 004: Catalogo de items

## Estado

Cerrada — implementada (2026-09-18)

## Cierre

**Fecha:** 2026-09-18

**Entregables:**
- Migración `1782400000000-ItemAliasAplicacionesTerminos` (alias, aplicaciones, términos, índices GIN)
- Entidades `ItemAlias`, `ItemAplicacion`, `TerminoNoResuelto`
- Módulo API `apps/api/src/items` (CRUD items, alias, aplicaciones, búsqueda con aplicaciones, reindexar, términos)
- Shared: schemas, errores `ITEM_*`, `validarAtributos`, `construirTextoAplicacion`, `normalizarTexto` + tests
- UI: `/catalogo`, `/catalogo/items/nuevo`, `/catalogo/items/[id]`, `/catalogo/terminos`
- Códigos de error alineados con `docs/08-catalogo-errores.md`

**Verificación de criterios de aceptación (por código y typecheck):**

| CA | Resultado |
|----|-----------|
| CA-001 Alta mínima | Cubierto en `ItemsService.crear` |
| CA-002 SKU duplicado | `ITEM_SKU_DUPLICADO` con `details.itemId` |
| CA-003 Maestra ajena | 404 de maestra correspondiente |
| CA-004 Servicio + stock | `ITEM_SERVICIO_NO_ADMITE_STOCK` |
| CA-005…009 Atributos | `validarAtributos` acumula errores `ITEM_ATRIBUTO_*` |
| CA-010 Definición inactiva | Conserva atributos al editar; regeneración al cambiar `usarEnBusqueda`. Inactivar definición en uso sigue bloqueada por maestras (003) |
| CA-011…014 Alias | Normalización, duplicado, compartido con `itemsCompartidos`, soft-delete |
| CA-015 vecesUsado | Contador listo; incremento en resolución diferido a spec 008 |
| CA-016 Aplicación + año | Expansión de rango + búsqueda por `item_aplicaciones.textoNormalizado` |
| CA-017 Aplicación duplicada | `APLICACION_DUPLICADA` |
| CA-018 Rename marca | Regeneración en `ItemsUsoHelper` sin tocar `updatedAt` en reindex masivo |
| CA-019…021 Búsqueda | Umbral 0.30, límite 25, consulta corta, prioridad SKU/alias |
| CA-022 Item inactivo en cotización | Parcial: catálogo excluye inactivos; cotización en 008/009 |
| CA-023 Cierre término | PATCH con CREAR_ALIAS / DESCARTAR + UI |
| CA-024 Aislamiento | Filtro por `organizacionId` + 404 |

**Verificación requerida (checklist):** typecheck shared/database/api/web OK; tests unitarios de `normalizarTexto` OK. Pruebas de integración con BD y plan EXPLAIN sobre 300 items quedan como QA manual al migrar.

## Objetivo

Definir el comportamiento del catalogo de items de una organización: alta, edición e inactivación de
items, validación dinámica de sus atributos contra las definiciones de la organización, administración
de alias, carga de aplicaciones o compatibilidades, mantenimiento de la columna derivada
`textoBusqueda` y búsqueda del catálogo por similitud textual.

El catálogo es la única fuente de la que puede salir un item cotizable. Sin catálogo no hay producto:
el motor de precios cotiza items del catálogo y el pipeline de precotización resuelve texto libre
contra este mismo catálogo. Por eso esta especificación fija con precisión qué se guarda, cómo se
valida y cómo se busca.

## Dependencias

| Documento | Aporta |
|-----------|--------|
| `docs/06-diseno-tecnico.md` | Modelo de datos, permisos, convenciones de API y reglas críticas |
| `docs/decisions/0002-catalogo-generico-por-vertical.md` | Atributos JSON validados por definiciones y packs de vertical |
| `docs/decisions/0007-estrategia-de-matching.md` | Normalización, `textoBusqueda`, índices de trigramas y alias aprendidos |
| `docs/decisions/0001-multi-tenancy-por-organizacion.md` | Aislamiento por organización y respuesta de no encontrado |
| `docs/specs/003-maestras-catalogo.md` | Categorías, marcas, unidades de medida y definiciones de atributo |

Esta especificación es consumida por `docs/specs/005-importacion-catalogo.md`,
`docs/specs/006-listas-precios-reglas.md` y `docs/specs/008-precotizacion-ia.md`.

Requisitos previos de implementación:

1. Extensiones `pg_trgm` y `unaccent` habilitadas en la base de datos.
2. Maestras de catálogo operativas: al menos una unidad de medida activa y las definiciones de
   atributo materializadas desde el pack de vertical.
3. Función pura de normalización de texto publicada en `@cotizador/shared`.

## Alcance MVP v1

Incluye:

- Alta, edición e inactivación de items con SKU opcional único por organización.
- Tipo de item `FUNGIBLE`, `SERIALIZADO` y `SERVICIO`, con las restricciones propias de cada tipo.
- Atributos propios del rubro validados dinámicamente contra las definiciones activas.
- Stock aproximado informativo opcional, sin movimientos ni valorización.
- Alias por item con origen `MANUAL`, `IMPORTADO` y `APRENDIDO`, con normalización, unicidad por
  item, contador de usos y depuración.
- Aplicaciones o compatibilidades por item con documento JSON y texto normalizado para búsqueda.
- Columna derivada `textoBusqueda` con regeneración determinista.
- Búsqueda del catálogo por similitud de trigramas, con filtros estructurados.
- Listado de términos no resueltos como insumo de curación del catálogo.

No incluye en esta versión:

| Fuera de alcance | Motivo |
|------------------|--------|
| Búsqueda semántica con embeddings | Diferida a fase 2 por `docs/decisions/0007-estrategia-de-matching.md` |
| Inventario con movimientos, existencias por sucursal y valorización | El stock es informativo; ver `docs/05-alcance-mvp.md` |
| Imágenes o archivos adjuntos del item | No aporta al flujo de cotización del piloto |
| Jerarquía de categorías de más de un nivel | Restricción del modelo de datos |
| Items compuestos, kits o listas de materiales | No hay caso de uso validado en el piloto |
| Variantes de un item con matriz de atributos | Cada variante se carga como item propio |
| Borrado físico de items, alias o aplicaciones | Prohibido en datos de negocio |
| Precios del item | Pertenecen a `docs/specs/006-listas-precios-reglas.md` |

## Conceptos principales

| Concepto | Definicion operativa |
|----------|----------------------|
| Item | Unidad vendible del catálogo de una organización. Puede ser un bien fungible, una unidad serializada o un servicio |
| Tipo de item | Clasificación que determina las restricciones de cantidad y de stock: `FUNGIBLE`, `SERIALIZADO`, `SERVICIO` |
| Atributos | Documento JSON plano en `items.atributos` cuyas claves son códigos de definiciones de atributo activas de la organización |
| Definicion de atributo | Descripción del atributo disponible en la organización: `codigo`, `etiqueta`, `tipoDato`, `opciones`, `requerido`, `usarEnBusqueda` |
| Alias | Forma alternativa con la que se pide un item. Es el mecanismo principal de reconocimiento |
| Aplicacion | Registro uno a muchos que indica en qué contexto aplica el item, con datos JSON y texto normalizado |
| Texto de busqueda | Columna derivada `items.textoBusqueda` que concatena y normaliza nombre, SKU, marca, categoría, alias activos y atributos buscables |
| Termino no resuelto | Texto normalizado que el pipeline no pudo asociar con ningún item, acumulado con su contador de ocurrencias |
| Normalizacion | Transformación determinista a minúsculas, sin acentos, sin signos y con equivalencias de medidas, aplicada por igual al indexar y al consultar |
| Similitud | Valor entre 0 y 1 devuelto por `pg_trgm` al comparar dos textos normalizados |

### Normalizacion de texto

La normalización es una función pura de `@cotizador/shared` y es la misma que usa el pipeline de
precotización. Si la normalización del indexado y la de la consulta divergen, la búsqueda falla de
forma silenciosa, por lo que su comportamiento se fija aquí:

| Paso | Transformacion | Ejemplo |
|------|----------------|---------|
| 1 | Recorte de espacios al inicio y al final | `"  Tubo  "` produce `"Tubo"` |
| 2 | Conversión a minúsculas | `"TUBO PVC"` produce `"tubo pvc"` |
| 3 | Eliminación de acentos y diéresis | `"cañería"` produce `"caneria"` |
| 4 | Sustitución de signos de puntuación por espacio, preservando `/` y `.` en medidas | `"tubo, pvc"` produce `"tubo pvc"` |
| 5 | Colapso de espacios múltiples en uno | `"tubo   pvc"` produce `"tubo pvc"` |
| 6 | Equivalencias de medidas y fracciones | `"media"`, `"1/2"` y `"0.5"` convergen a `"1/2"` |

La `ñ` se convierte en `n`. El diccionario de equivalencias de medidas se declara en el pack de
vertical y se consulta desde `@cotizador/shared`.

## Datos requeridos

### Item

Tabla `items`.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Generado | `uuid` generado por la base de datos |
| `organizacionId` | Generado | Tomado de `ctx.organizacionId`, nunca de la entrada |
| `sku` | No | Texto de 1 a 60 caracteres. Se recorta y se guarda en mayúsculas. Único por organización cuando no es nulo |
| `nombre` | Si | Texto de 3 a 200 caracteres. No requiere ser único |
| `descripcion` | No | Texto de hasta 2000 caracteres |
| `categoriaId` | No | Debe referenciar una categoría activa de la organización |
| `marcaId` | No | Debe referenciar una marca activa de la organización |
| `unidadMedidaId` | Si | Debe referenciar una unidad de medida activa de la organización |
| `tipoItem` | No | `FUNGIBLE`, `SERIALIZADO` o `SERVICIO`. Si se omite, `FUNGIBLE` |
| `atributos` | No | Documento JSON plano. Si se omite, objeto vacío. Validado contra las definiciones activas |
| `textoBusqueda` | Generado | Columna derivada. Nunca se acepta desde la entrada |
| `controlaStock` | No | Booleano. Si se omite, falso. Debe ser falso cuando `tipoItem` es `SERVICIO` |
| `stockAproximado` | No | `numeric(18,4)` mayor o igual a cero. Solo tiene sentido cuando `controlaStock` es verdadero |
| `estadoRegistro` | Generado | `ACTIVO` al crear. Se cambia con la operación de inactivación |
| `createdById`, `updatedById` | Generado | Tomados de `ctx.usuarioId` |

### Alias del item

Tabla `item_alias`.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Generado | `uuid` |
| `organizacionId` | Generado | Del contexto |
| `itemId` | Si | Debe referenciar un item de la misma organización |
| `alias` | Si | Texto de 2 a 200 caracteres tal como lo escribió la persona, preservando su forma original |
| `normalizado` | Generado | Resultado de normalizar `alias`. Único por `itemId` |
| `origen` | No | `MANUAL`, `IMPORTADO` o `APRENDIDO`. Si se omite en el alta directa, `MANUAL` |
| `vecesUsado` | Generado | Entero que arranca en cero. Se incrementa cuando el alias resuelve una línea |
| `estadoRegistro` | Generado | `ACTIVO` al crear; `INACTIVO` al depurar |

### Aplicacion o compatibilidad

Tabla `item_aplicaciones`.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Generado | `uuid` |
| `organizacionId` | Generado | Del contexto |
| `itemId` | Si | Debe referenciar un item de la misma organización |
| `datos` | Si | Documento JSON plano con al menos una clave y un valor no vacío. Máximo 20 claves |
| `textoNormalizado` | Generado | Concatenación normalizada de los valores de `datos`, incluidos los años del rango expandidos |
| `estadoRegistro` | Generado | `ACTIVO` al crear; `INACTIVO` al eliminar |

### Termino no resuelto

Tabla `terminos_no_resueltos`. Se escribe desde el pipeline descrito en
`docs/specs/008-precotizacion-ia.md` y esta especificación solo define su lectura y su cierre.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Generado | `uuid` |
| `organizacionId` | Generado | Del contexto |
| `textoNormalizado` | Si | Único por organización. Es la clave de acumulación |
| `ejemploOriginal` | Si | Último texto sin normalizar observado, para que la persona reconozca el caso |
| `vecesVisto` | Generado | Entero. Se incrementa en cada nueva ocurrencia |
| `ultimaVezAt` | Generado | Fecha de la última ocurrencia |
| `resueltoConItemId` | No | Item con el que se cerró el término |
| `estadoRegistro` | Generado | `ACTIVO` mientras el término siga pendiente; `INACTIVO` al cerrarlo |

### Tipos de dato de atributo

| `tipoDato` | Forma aceptada en el JSON | Validacion |
|------------|---------------------------|------------|
| `TEXTO` | Cadena | Longitud de 1 a 200 caracteres después de recortar espacios |
| `NUMERO` | Cadena decimal o número | Decimal con hasta 4 decimales. Se persiste como cadena |
| `ENTERO` | Cadena entera o número | Entero sin parte decimal |
| `BOOLEANO` | `true` o `false` | No se aceptan las cadenas `"true"`, `"si"` ni `"1"` |
| `LISTA` | Cadena | Debe coincidir exactamente con un valor de `opciones` de la definición |
| `RANGO_ANIO` | Objeto `{ "desde": number, "hasta": number }` | Ambos enteros entre 1900 y 2100, con `desde` menor o igual que `hasta` |

Las `opciones` de una definición `LISTA` se declaran en `definiciones_atributo.opciones` como arreglo
de cadenas. La comparación es exacta y sensible a mayúsculas: la interfaz ofrece un selector, por lo
que no hay motivo para aceptar variantes.

## Reglas de negocio

### Identidad y unicidad

1. Todo item pertenece a una sola organización. `organizacionId` se toma del contexto de
   organización y nunca del cuerpo de la petición.
2. El SKU es opcional. Cuando se informa, debe ser único entre los items de la organización,
   incluidos los inactivos, y la comparación se hace sobre el valor recortado y en mayúsculas.
3. Un SKU duplicado responde 409 con `ITEM_SKU_DUPLICADO` e indica en `details` el identificador del item
   que ya lo usa.
4. El nombre no es único. Dos items pueden llamarse igual y distinguirse por atributos, marca o SKU.
5. Al crear o editar, toda referencia por identificador (`categoriaId`, `marcaId`,
   `unidadMedidaId`) se verifica contra la organización del contexto. Una referencia de otra
   organización se responde como no encontrada, nunca como prohibida.
6. Una categoría, marca o unidad de medida inactiva no se puede asignar a un item. El item que ya la
   tenía asignada la conserva y se puede seguir editando sin cambiar ese campo.
7. El cambio de SKU de un item existente está permitido y vuelve a validar la unicidad.

### Tipo de item

1. `tipoItem` se puede cambiar mientras el item no tenga stock aproximado informado ni aplicaciones
   activas incompatibles con el tipo destino.
2. Un item `SERVICIO` debe tener `controlaStock` en falso y `stockAproximado` nulo. Informar stock
   para un servicio responde 422 con `ITEM_SERVICIO_NO_ADMITE_STOCK`.
3. Un item `SERIALIZADO` representa una unidad única: su `stockAproximado`, si se informa, debe ser
   cero o uno. Un valor mayor responde 422 con `ITEM_SERIALIZADO_STOCK_INVALIDO`.
4. La restricción de cantidad máxima uno para items `SERIALIZADO` se aplica al cotizar y está
   especificada en `docs/specs/009-revision-aprobacion.md`. El catálogo solo declara el tipo.
5. `tipoItem` es un valor cerrado. Cualquier otro valor es error 400 de forma.

### Validacion dinamica de atributos

1. Antes de persistir, el servicio construye un esquema de validación a partir de las definiciones de
   atributo activas de la organización y valida `atributos` contra ese esquema.
2. Toda clave del documento debe corresponder al `codigo` de una definición activa. Una clave
   desconocida es error 400 con `ITEM_ATRIBUTO_DESCONOCIDO`.
3. Una definición con `requerido` verdadero exige que la clave esté presente y con valor no vacío.
   Su ausencia es error 400 con `ITEM_ATRIBUTO_REQUERIDO_AUSENTE`.
4. El valor debe corresponder al `tipoDato` de la definición según la tabla de tipos de dato. Un
   valor de tipo incorrecto es error 400 con `ITEM_ATRIBUTO_TIPO_INVALIDO`.
5. Un valor de una definición `LISTA` que no esté en `opciones` es error 400 con
   `ITEM_ATRIBUTO_OPCION_INVALIDA` e incluye en `details` las opciones válidas.
6. Un `RANGO_ANIO` mal formado, con años fuera de 1900 a 2100 o con `desde` mayor que `hasta`, es
   error 400 con `ITEM_ATRIBUTO_RANGO_INVALIDO`.
7. Los valores se normalizan al persistir: se recortan los espacios de los textos y los números se
   guardan como cadena decimal sin ceros a la derecha superfluos.
8. Una clave con valor nulo o cadena vacía se interpreta como eliminación del atributo, salvo que la
   definición sea `requerido`.
9. La validación usa únicamente definiciones con `estadoRegistro` en `ACTIVO`. Si una definición se
   inactiva después, los items que la usaban conservan el valor y pueden editarse sin perderlo, pero
   ese atributo deja de participar en `textoBusqueda`.
10. `atributos` admite como máximo 40 claves por item.

Ejemplos de cada error, para un catálogo de ferretería con las definiciones `diametro` (`TEXTO`),
`material` (`LISTA` con opciones `PVC`, `HG`, `COBRE`), `anios` (`RANGO_ANIO`), `piezas` (`ENTERO`) y
`requiere_sellante` (`BOOLEANO`), siendo `material` requerido:

```json
{ "diametro": "1/2\"", "color": "azul" }
```

Error `ITEM_ATRIBUTO_DESCONOCIDO`: `color` no es una definición de la organización. Además falta
`material`, requerido, por lo que la respuesta acumula también `ITEM_ATRIBUTO_REQUERIDO_AUSENTE`.

```json
{ "material": "PVC", "piezas": "dos" }
```

Error `ITEM_ATRIBUTO_TIPO_INVALIDO`: `piezas` es `ENTERO` y `"dos"` no es un entero.

```json
{ "material": "pvc" }
```

Error `ITEM_ATRIBUTO_OPCION_INVALIDA`: la comparación es exacta y la opción declarada es `PVC`.

```json
{ "material": "PVC", "anios": { "desde": 2018, "hasta": 2012 } }
```

Error `ITEM_ATRIBUTO_RANGO_INVALIDO`: `desde` es mayor que `hasta`.

```json
{ "material": "PVC", "requiere_sellante": "si" }
```

Error `ITEM_ATRIBUTO_TIPO_INVALIDO`: `BOOLEANO` solo acepta `true` o `false`.

La respuesta de validación acumula todos los errores de atributo detectados en una sola llamada. No
se responde el primero y se abandona: la persona debe poder corregir de una vez.

### Stock aproximado

1. `stockAproximado` es informativo. No hay movimientos, ni reservas, ni existencia por sucursal.
2. Un valor negativo es error 400 con `ITEM_STOCK_NEGATIVO`.
3. Un stock en cero no impide cotizar el item. La interfaz lo señala como advertencia en la línea.
4. `controlaStock` en falso implica que la interfaz no muestra el stock y que `stockAproximado` se
   ignora en las respuestas de búsqueda.

### Alias

1. Un alias pertenece a un item y a la organización de ese item.
2. `normalizado` se calcula siempre en el servidor. El cliente nunca lo envía.
3. `normalizado` es único por item. Un alias que normaliza igual que uno existente del mismo item
   responde 409 con `ALIAS_DUPLICADO`, incluso si la forma escrita es distinta.
4. El mismo texto normalizado puede existir como alias de dos items distintos de la misma
   organización. Esa ambigüedad es legítima y el pipeline la resuelve con candidatos alternativos,
   pero el alta debe devolver una advertencia indicando los otros items que ya usan ese alias.
5. `origen` registra la procedencia: `MANUAL` desde la ficha del item, `IMPORTADO` desde
   `docs/specs/005-importacion-catalogo.md`, `APRENDIDO` desde una corrección de línea confirmada por
   la persona.
6. Un alias `APRENDIDO` se crea solo con confirmación explícita del operador. Nunca de forma
   automática.
7. `vecesUsado` se incrementa en uno cada vez que el alias produce la resolución elegida de una
   línea. Nunca se decrementa.
8. La depuración de un alias lo marca `INACTIVO` y nunca lo borra físicamente. Un alias inactivo no
   participa en la resolución ni en `textoBusqueda`.
9. Reactivar un alias inactivo está permitido y vuelve a validar la unicidad por item.
10. Un alias cuyo `normalizado` coincide exactamente con el `normalizado` del nombre del item se
    acepta, pero la respuesta incluye la advertencia `ALIAS_REDUNDANTE` porque no aporta
    reconocimiento nuevo.
11. Un item admite como máximo 50 alias activos. Superarlo responde 422 con `ALIAS_LIMITE_EXCEDIDO`.

### Aplicaciones o compatibilidades

1. Las aplicaciones son una relación uno a muchos y no un atributo escalar. Un item puede tener
   ninguna, una o muchas.
2. `datos` es un documento JSON plano de claves y valores acordados por la organización. No se valida
   contra las definiciones de atributo: es información de compatibilidad, no de especificación.
3. `textoNormalizado` se calcula concatenando los valores de `datos` y normalizando el resultado.
   Cuando `datos` contiene un rango de años con las claves `anioDesde` y `anioHasta`, el texto
   incluye todos los años del rango, de modo que buscar un año concreto encuentre el item.
4. El rango de años admite como máximo 60 años. Un rango mayor responde 422 con
   `APLICACION_RANGO_EXCESIVO`.
5. Dos aplicaciones activas del mismo item con idéntico `textoNormalizado` son un duplicado y se
   responde 409 con `APLICACION_DUPLICADA`.
6. Eliminar una aplicación la marca `INACTIVO`.
7. El caso de referencia es el repuesto por marca, modelo y rango de años de vehículo compatible. Una
   pastilla de freno compatible con dos modelos se carga como dos aplicaciones del mismo item:

```json
{ "marcaVehiculo": "Toyota", "modelo": "Corolla", "anioDesde": 2014, "anioHasta": 2019, "posicion": "delantera" }
```

```json
{ "marcaVehiculo": "Toyota", "modelo": "Yaris", "anioDesde": 2015, "anioHasta": 2018, "posicion": "delantera" }
```

El `textoNormalizado` de la primera incluye `toyota corolla delantera 2014 2015 2016 2017 2018 2019`,
por lo que el texto "pastillas delanteras corolla 2017" alcanza al item por similitud.

8. En verticales sin compatibilidades, como ferretería, la sección de aplicaciones de la ficha del
   item permanece vacía y no estorba. No se ramifica el comportamiento por vertical.

### Texto de busqueda

1. `items.textoBusqueda` es una columna derivada mantenida por la aplicación, no un campo editable.
2. Se compone concatenando, en este orden y separados por un espacio: `nombre`, `sku`, nombre de la
   marca, nombre de la categoría, nombre de la categoría padre si existe, los alias activos del item
   y los valores de los atributos cuya definición tiene `usarEnBusqueda` verdadero. El resultado se
   normaliza con la función de normalización.
3. Se regenera en los siguientes casos:

| Evento | Alcance de la regeneracion |
|--------|----------------------------|
| Alta o edición de un item | Ese item |
| Alta, edición, depuración o reactivación de un alias | El item dueño del alias |
| Cambio de nombre de una categoría o de una marca | Todos los items activos que la referencian |
| Cambio de `usarEnBusqueda` en una definición de atributo | Todos los items activos cuyos atributos incluyen ese código |
| Inactivación de una definición de atributo | Todos los items activos cuyos atributos incluyen ese código |

4. La regeneración masiva por cambio de maestra o de definición se ejecuta dentro de la misma
   transacción que el cambio. Si la organización tiene más items que el límite de proceso sincrónico,
   la operación se rechaza con 422 y `ITEM_REGENERACION_MASIVA_REQUERIDA`, y se ofrece la reindexación
   explícita.
5. Existe una operación de reindexación del catálogo que recalcula `textoBusqueda` de todos los items
   de la organización. Es idempotente y no modifica ningún otro campo ni la auditoría de los items.
6. Los items inactivos también mantienen su `textoBusqueda` actualizado, para que al reactivarlos
   sean encontrables de inmediato.

### Busqueda del catalogo

1. La búsqueda recibe un texto libre, lo normaliza con la misma función que indexa y compara por
   similitud de trigramas contra `items.textoBusqueda` y contra `item_alias.normalizado`.
2. Toda consulta filtra por `organizacionId` del contexto antes de cualquier otro criterio.
3. El texto de consulta debe tener al menos 2 caracteres después de normalizar. Menos responde 400
   con `ITEM_BUSQUEDA_CONSULTA_MUY_CORTA`.
4. El umbral de similitud mínimo de la búsqueda del catálogo es 0.30. Los resultados se ordenan por
   similitud descendente y, a igual similitud, por `nombre` ascendente para que el orden sea estable.
5. La coincidencia exacta de SKU y la coincidencia exacta de un alias normalizado se devuelven
   primero, por encima de cualquier resultado por similitud.
6. El resultado indica, por item, el puntaje de similitud y el origen de la coincidencia, con los
   mismos valores que usa la resolución: `SKU`, `ALIAS_EXACTO`, `ALIAS_SIMILITUD`, `TEXTO_SIMILITUD`.
7. La búsqueda devuelve como máximo 25 items por consulta y aplica un tiempo máximo de ejecución. El
   límite protege la latencia de la generación del borrador.
8. Por defecto la búsqueda devuelve solo items `ACTIVO`. El parámetro de estado permite incluir
   inactivos y está pensado para la administración del catálogo, no para cotizar.
9. La búsqueda admite además filtros estructurados combinables entre sí y con el texto: categoría,
   marca, tipo de item, presencia de precio en una lista y pares de atributo y valor.
10. El filtro por atributo usa el índice GIN sobre `items.atributos` con comparación de contención
    exacta del par clave y valor.
11. Los índices que sostienen estas consultas son los declarados en `docs/06-diseno-tecnico.md`:

| Indice | Objeto | Uso |
|--------|--------|-----|
| GIN con `gin_trgm_ops` | `items.textoBusqueda` compuesto con `organizacionId` | Similitud sobre el texto del item |
| GIN con `gin_trgm_ops` | `item_alias.normalizado` compuesto con `organizacionId` | Similitud sobre alias |
| GIN con `gin_trgm_ops` | `item_aplicaciones.textoNormalizado` | Similitud sobre compatibilidades |
| GIN | `items.atributos` | Filtros por par de atributo y valor |
| B-tree | (`organizacionId`, `estadoRegistro`) | Listado y exclusión de inactivos |
| B-tree | (`organizacionId`, `categoriaId`) | Filtro por categoría |
| Único parcial | (`organizacionId`, `sku`) cuando `sku` no es nulo | Unicidad de SKU |

12. La búsqueda de aplicaciones es una consulta separada de la búsqueda de items y su resultado se
    combina como una fuente más de candidatos. No reemplaza la búsqueda principal.

### Inactivacion

1. Los items no se borran. La baja se expresa cambiando `estadoRegistro` a `INACTIVO`.
2. Un item inactivo no es cotizable: no aparece en la búsqueda de items para cotizar, no se puede
   agregar como línea nueva a un borrador y el pipeline lo excluye de la resolución.
3. Un item inactivo permanece intacto en las cotizaciones históricas. Sus líneas conservan
   descripción, SKU, precio, descuento y regla aplicada tal como se congelaron. Inactivar un item
   jamás modifica una cotización existente.
4. Una cotización en estado `BORRADOR` que ya contiene una línea con un item recién inactivado marca
   esa línea para revisión al recalcular y no puede aprobarse hasta que la persona la resuelva.
5. Inactivar un item ya inactivo responde 422 con `ITEM_YA_INACTIVO`.
6. Reactivar un item está permitido y vuelve a validar la unicidad del SKU, las referencias a
   maestras activas y los atributos requeridos vigentes.
7. Los alias y las aplicaciones de un item inactivo conservan su propio estado y no se inactivan en
   cascada.
8. La inactivación no es una operación separada: se expresa con `PATCH` sobre el item informando
   `estadoRegistro`, con el permiso `catalogo.items.editar`.

### Terminos no resueltos

1. El listado de términos no resueltos se ordena por `vecesVisto` descendente y se usa para decidir
   qué alias o qué items faltan en el catálogo.
2. Desde un término la persona puede crear un alias sobre un item existente o crear un item nuevo.
   Ambas acciones cierran el término informando `resueltoConItemId` y dejándolo `INACTIVO`.
3. Un término se puede descartar sin item cuando no corresponde al catálogo, lo que también lo deja
   `INACTIVO` pero sin `resueltoConItemId`.
4. Cerrar un término no altera las cotizaciones en las que ese texto apareció.
5. El listado es de solo lectura para el perfil `Cotizador`, que puede consultarlo pero cierra
   términos únicamente creando alias, acción que sí tiene permitida.

## Permisos

| Operacion | Permiso |
|-----------|---------|
| Listar, ver y buscar items | `catalogo.items.ver` |
| Crear un item | `catalogo.items.crear` |
| Editar un item, inactivarlo o reactivarlo | `catalogo.items.editar` |
| Crear, editar y depurar alias | `catalogo.alias.administrar` |
| Ver aplicaciones de un item | `catalogo.items.ver` |
| Crear, editar y eliminar aplicaciones | `catalogo.items.editar` |
| Ver categorías, marcas, unidades y definiciones de atributo | `catalogo.maestras.ver` |
| Ver y cerrar términos no resueltos | `catalogo.items.ver` para ver; `catalogo.alias.administrar` o `catalogo.items.crear` para cerrar |
| Reindexar el texto de búsqueda de la organización | `catalogo.items.editar` |

Consecuencias del catálogo de perfiles de `docs/06-diseno-tecnico.md`:

1. El perfil `Cotizador` tiene `catalogo.items.ver`, `catalogo.maestras.ver` y
   `catalogo.alias.administrar`. Puede buscar items y agregar alias mientras corrige un borrador,
   pero no puede crear, editar ni inactivar items.
2. El perfil `Administrador Organizacion` tiene `catalogo.*` y por lo tanto todas las operaciones de
   esta especificación.
3. Un usuario de ámbito `PLATAFORMA` tiene `organizacionId` nulo y no opera el catálogo de ninguna
   organización. Los servicios exigen `ctx.organizacionId` no nulo y responden error de contexto si
   falta.
4. La verificación de permiso ocurre antes de cualquier acceso a datos, según el orden obligatorio de
   los métodos de servicio.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/items` | `catalogo.items.ver` | Listado paginado con filtros de administración |
| GET | `/api/items/buscar?q=` | `catalogo.items.ver` | Búsqueda por similitud para cotizar |
| POST | `/api/items` | `catalogo.items.crear` | Alta de un item |
| PATCH | `/api/items/:id` | `catalogo.items.editar` | Edición, inactivación y reactivación |
| POST | `/api/items/:id/alias` | `catalogo.alias.administrar` | Alta de un alias |
| DELETE | `/api/items/:id/alias/:aliasId` | `catalogo.alias.administrar` | Depuración de un alias, con inactivación |
| GET | `/api/items/:id/aplicaciones` | `catalogo.items.ver` | Listado de compatibilidades del item |
| POST | `/api/items/:id/aplicaciones` | `catalogo.items.editar` | Alta de una compatibilidad |
| GET | `/api/terminos-no-resueltos` | `catalogo.items.ver` | Insumo de curación del catálogo |

Rutas adicionales que esta especificación introduce y que no figuran en
`docs/06-diseno-tecnico.md`. Siguen sus convenciones de prefijo, plural y respuesta:

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/items/:id` | `catalogo.items.ver` | Ficha completa con alias, aplicaciones y precios por lista |
| GET | `/api/items/:id/alias` | `catalogo.items.ver` | Listado de alias del item con su contador de usos |
| PATCH | `/api/items/:id/aplicaciones/:aplicacionId` | `catalogo.items.editar` | Edición de una compatibilidad |
| DELETE | `/api/items/:id/aplicaciones/:aplicacionId` | `catalogo.items.editar` | Eliminación, con inactivación |
| POST | `/api/items/reindexar-busqueda` | `catalogo.items.editar` | Regeneración de `textoBusqueda` de la organización |
| PATCH | `/api/terminos-no-resueltos/:id` | `catalogo.alias.administrar` | Cierre o descarte de un término |

### Alta de un item

```typescript
// POST /api/items
type CrearItemInput = {
  sku?: string;                    // 1 a 60 caracteres, se guarda en mayusculas
  nombre: string;                  // 3 a 200 caracteres
  descripcion?: string;            // hasta 2000 caracteres
  categoriaId?: string;
  marcaId?: string;
  unidadMedidaId: string;
  tipoItem?: 'FUNGIBLE' | 'SERIALIZADO' | 'SERVICIO';
  atributos?: Record<string, string | number | boolean | { desde: number; hasta: number }>;
  controlaStock?: boolean;
  stockAproximado?: string;        // cadena decimal con 4 decimales
  alias?: string[];                // opcional, se crean con origen MANUAL
};
```

```typescript
type ItemDetalle = {
  id: string;
  sku: string | null;
  nombre: string;
  descripcion: string | null;
  categoria: { id: string; nombre: string; padre: string | null } | null;
  marca: { id: string; nombre: string } | null;
  unidadMedida: { id: string; codigo: string; permiteDecimales: boolean };
  tipoItem: 'FUNGIBLE' | 'SERIALIZADO' | 'SERVICIO';
  atributos: Record<string, unknown>;
  controlaStock: boolean;
  stockAproximado: string | null;  // cadena decimal con 4 decimales
  estadoRegistro: 'ACTIVO' | 'INACTIVO';
  alias: Array<{
    id: string;
    alias: string;
    normalizado: string;
    origen: 'MANUAL' | 'IMPORTADO' | 'APRENDIDO';
    vecesUsado: number;
    estadoRegistro: 'ACTIVO' | 'INACTIVO';
  }>;
  aplicaciones: Array<{ id: string; datos: Record<string, unknown>; textoNormalizado: string }>;
  advertencias: string[];          // por ejemplo ALIAS_REDUNDANTE o SIN_PRECIO_EN_LISTA_PREDETERMINADA
};
```

### Busqueda del catalogo

```typescript
// GET /api/items/buscar?q=tubo%20de%20media&limit=25
type BuscarItemsQuery = {
  q: string;                       // minimo 2 caracteres normalizados
  categoriaId?: string;
  marcaId?: string;
  tipoItem?: 'FUNGIBLE' | 'SERIALIZADO' | 'SERVICIO';
  atributos?: Record<string, string>;  // pares clave y valor exactos
  listaPrecioId?: string;          // si se informa, incluye el precio y permite filtrar por conPrecio
  conPrecio?: boolean;
  estadoRegistro?: 'ACTIVO' | 'INACTIVO';  // por defecto ACTIVO
  limit?: number;                  // maximo 25
};

type ResultadoBusquedaItem = {
  itemId: string;
  sku: string | null;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  unidadCodigo: string;
  atributos: Record<string, unknown>;
  puntaje: string;                 // cadena decimal con 4 decimales, entre 0 y 1
  origenMatch: 'SKU' | 'ALIAS_EXACTO' | 'ALIAS_SIMILITUD' | 'TEXTO_SIMILITUD';
  aliasCoincidente: string | null;
  precio: string | null;           // cadena decimal con 4 decimales cuando se informa listaPrecioId
  stockAproximado: string | null;
};
```

### Alias y aplicaciones

```typescript
// POST /api/items/:id/alias
type CrearAliasInput = {
  alias: string;                   // 2 a 200 caracteres
  origen?: 'MANUAL' | 'IMPORTADO' | 'APRENDIDO';  // por defecto MANUAL
};

// POST /api/items/:id/aplicaciones
type CrearAplicacionInput = {
  datos: Record<string, string | number>;  // al menos una clave, maximo 20
};
```

### Cierre de un termino no resuelto

```typescript
// PATCH /api/terminos-no-resueltos/:id
type CerrarTerminoInput = {
  accion: 'CREAR_ALIAS' | 'DESCARTAR';
  itemId?: string;                 // obligatorio cuando accion es CREAR_ALIAS
};
```

Los importes y las cantidades viajan como cadenas decimales con 4 decimales, según las convenciones
de `docs/06-diseno-tecnico.md`. Los puntajes de similitud viajan como cadena con 4 decimales.

## Errores funcionales

Los códigos canónicos viven en `docs/08-catalogo-errores.md`. Prefijo `ITEM_*` para items;
`ALIAS_*`, `APLICACION_*` y `TERMINO_*` sin prefijo adicional.

| Codigo | Cuando ocurre |
|--------|---------------|
| `ITEM_NO_ENCONTRADO` | El item no existe o pertenece a otra organización. Responde 404 |
| `ITEM_SKU_DUPLICADO` | Ya existe un item de la organización con ese SKU, activo o inactivo. Responde 409 |
| `CATEGORIA_NO_ENCONTRADA` | `categoriaId` no existe en la organización. Responde 404 |
| `CATEGORIA_INACTIVA` | La categoría existe pero está inactiva y se intenta asignar. Responde 422 |
| `MARCA_NO_ENCONTRADA` | `marcaId` no existe en la organización. Responde 404 |
| `MARCA_INACTIVA` | La marca existe pero está inactiva y se intenta asignar. Responde 422 |
| `UNIDAD_MEDIDA_NO_ENCONTRADA` | `unidadMedidaId` no existe en la organización. Responde 404 |
| `UNIDAD_MEDIDA_INACTIVA` | La unidad existe pero está inactiva y se intenta asignar. Responde 422 |
| `ITEM_ATRIBUTO_DESCONOCIDO` | Una clave de `atributos` no corresponde a una definición activa. Responde 400 |
| `ITEM_ATRIBUTO_REQUERIDO_AUSENTE` | Falta una clave cuya definición tiene `requerido` verdadero. Responde 400 |
| `ITEM_ATRIBUTO_TIPO_INVALIDO` | El valor no corresponde al `tipoDato` de la definición. Responde 400 |
| `ITEM_ATRIBUTO_OPCION_INVALIDA` | El valor de una definición `LISTA` no está en `opciones`. Responde 400 |
| `ITEM_ATRIBUTO_RANGO_INVALIDO` | Un `RANGO_ANIO` está mal formado, fuera de 1900 a 2100 o con `desde` mayor que `hasta`. Responde 400 |
| `ITEM_ATRIBUTOS_LIMITE_EXCEDIDO` | El documento supera 40 claves. Responde 422 |
| `ITEM_SERVICIO_NO_ADMITE_STOCK` | Se informa stock o `controlaStock` verdadero en un item `SERVICIO`. Responde 422 |
| `ITEM_SERIALIZADO_STOCK_INVALIDO` | Un item `SERIALIZADO` declara stock mayor que uno. Responde 422 |
| `ITEM_STOCK_NEGATIVO` | `stockAproximado` es menor que cero. Responde 400 |
| `ITEM_YA_INACTIVO` | Se intenta inactivar un item que ya está inactivo. Responde 422 |
| `ALIAS_NO_ENCONTRADO` | El alias no existe o no pertenece al item indicado. Responde 404 |
| `ALIAS_DUPLICADO` | El texto normalizado ya existe como alias activo del mismo item. Responde 409 |
| `ALIAS_MUY_CORTO` | El alias tiene menos de 2 caracteres después de normalizar. Responde 400 |
| `ALIAS_LIMITE_EXCEDIDO` | El item ya tiene 50 alias activos. Responde 422 |
| `ALIAS_APRENDIDO_SIN_CONFIRMACION` | Se intenta crear un alias `APRENDIDO` sin confirmación explícita. Responde 422 |
| `APLICACION_NO_ENCONTRADA` | La aplicación no existe o no pertenece al item indicado. Responde 404 |
| `APLICACION_DATOS_INVALIDOS` | `datos` está vacío, no es un objeto plano o supera 20 claves. Responde 400 |
| `APLICACION_DUPLICADA` | Otra aplicación activa del item produce el mismo `textoNormalizado`. Responde 409 |
| `APLICACION_RANGO_EXCESIVO` | El rango de años de la aplicación supera 60 años. Responde 422 |
| `ITEM_BUSQUEDA_CONSULTA_MUY_CORTA` | El texto de búsqueda normalizado tiene menos de 2 caracteres. Responde 400 |
| `ITEM_REGENERACION_MASIVA_REQUERIDA` | El cambio afecta más items que el límite sincrónico y exige reindexación explícita. Responde 422 |
| `TERMINO_NO_ENCONTRADO` | El término no resuelto no existe o pertenece a otra organización. Responde 404 |
| `TERMINO_YA_CERRADO` | Se intenta cerrar un término que ya está inactivo. Responde 422 |

Las advertencias `ALIAS_REDUNDANTE`, `ALIAS_COMPARTIDO_CON_OTRO_ITEM` y
`SIN_PRECIO_EN_LISTA_PREDETERMINADA` no son errores: viajan en el arreglo `advertencias` de una
respuesta exitosa. `ALIAS_COMPARTIDO_CON_OTRO_ITEM` incluye además `itemsCompartidos` con
`itemId` y `nombre` de los otros items.

## Experiencia de usuario

### Ficha del item

La ficha es una sola pantalla con secciones plegables, no un asistente de varios pasos. El orden de
las secciones es: identificación, clasificación, atributos, alias, aplicaciones y precios por lista.

1. Los atributos se renderizan a partir de las definiciones activas de la organización: un campo de
   texto para `TEXTO`, un campo numérico para `NUMERO` y `ENTERO`, un interruptor para `BOOLEANO`, un
   selector para `LISTA` y dos campos de año para `RANGO_ANIO`. Los requeridos se marcan visiblemente.
2. Los errores de atributo se muestran junto a cada campo, todos a la vez, no de uno en uno.
3. La sección de alias permite agregar varios alias escribiendo y presionando la tecla de retorno.
   Muestra el contador de usos de cada alias y ofrece depurar los que tengan cero usos.
4. Cuando un alias ya existe en otro item, la interfaz lo advierte con el nombre del otro item y deja
   decidir a la persona.
5. La sección de aplicaciones está oculta cuando la organización no la usa: si no hay aplicaciones y
   el vertical no las trae en su pack, aparece plegada.
6. La ficha muestra si el item tiene precio en la lista predeterminada. Un item sin precio se marca
   con una advertencia visible, porque no será cotizable.

### Listado y busqueda

1. El listado de administración permite filtrar por categoría, marca, tipo de item, estado y
   presencia de precio, y ordenar por nombre, SKU o fecha de actualización.
2. El campo de búsqueda es tolerante a errores de escritura y a acentos. La persona escribe como
   escribe un cliente.
3. Los resultados muestran, cuando corresponde, qué alias produjo la coincidencia. Eso enseña a la
   persona cómo funciona el reconocimiento y la motiva a curar alias.
4. Los items inactivos no aparecen salvo que se active el filtro de estado, y cuando aparecen se
   muestran atenuados con la etiqueta de inactivo.
5. La inactivación pide confirmación y explica en el mismo diálogo que el item deja de ser cotizable
   pero que las cotizaciones anteriores no cambian.

### Terminos no resueltos

1. La pantalla lista los términos ordenados por frecuencia, con el ejemplo original y la fecha de la
   última vez que apareció.
2. Cada término ofrece dos acciones directas: buscar un item y crear el alias, o crear un item nuevo
   con ese texto como nombre propuesto.
3. Al resolver un término, la interfaz confirma cuántas veces se había visto, para que la persona
   perciba el impacto de la curación.

## Criterios de aceptacion

### Alta y edicion de items

#### CA-001: Alta minima de un item

Dado un usuario con permiso `catalogo.items.crear` y una unidad de medida activa de su organización,
cuando envía un alta con `nombre` y `unidadMedidaId` únicamente, entonces el item se crea con
`tipoItem` en `FUNGIBLE`, `estadoRegistro` en `ACTIVO`, `atributos` como objeto vacío,
`organizacionId` tomado del contexto y `textoBusqueda` calculado, y la respuesta es 201.

#### CA-002: SKU duplicado rechazado

Dado un item existente con SKU `TUB-12-PVC`, cuando un usuario intenta crear otro item con el SKU
`tub-12-pvc`, entonces la respuesta es 409 con código `ITEM_SKU_DUPLICADO`, el cuerpo indica el
identificador del item que ya usa ese SKU y no se crea ningún registro.

#### CA-003: Referencia a una maestra de otra organizacion

Dado un usuario de la organización A y una categoría que pertenece a la organización B, cuando
intenta crear un item con esa `categoriaId`, entonces la respuesta es 404 con código
`CATEGORIA_NO_ENCONTRADA` y no se revela la existencia de la categoría ajena.

#### CA-004: Restriccion de stock en un servicio

Dado un usuario que crea un item con `tipoItem` en `SERVICIO`, cuando informa `controlaStock` en
verdadero o un `stockAproximado` mayor que cero, entonces la respuesta es 422 con código
`ITEM_SERVICIO_NO_ADMITE_STOCK` y el item no se crea.

### Validacion de atributos

#### CA-005: Atributo desconocido

Dada una organización cuyas definiciones activas son `diametro` y `material`, cuando un usuario
guarda un item con el atributo `color`, entonces la respuesta es 400 con código
`ITEM_ATRIBUTO_DESCONOCIDO`, el detalle nombra la clave `color` y el item no se persiste.

#### CA-006: Atributo requerido ausente

Dada una definición `material` con `requerido` verdadero, cuando un usuario guarda un item sin esa
clave, entonces la respuesta es 400 con código `ITEM_ATRIBUTO_REQUERIDO_AUSENTE` y el detalle nombra
`material`.

#### CA-007: Tipo de dato incorrecto

Dada una definición `piezas` de tipo `ENTERO`, cuando un usuario guarda el valor `"dos"`, entonces la
respuesta es 400 con código `ITEM_ATRIBUTO_TIPO_INVALIDO` indicando la clave, el tipo esperado y el valor
recibido.

#### CA-008: Opcion fuera de la lista cerrada

Dada una definición `material` de tipo `LISTA` con opciones `PVC`, `HG` y `COBRE`, cuando un usuario
guarda el valor `pvc` en minúsculas, entonces la respuesta es 400 con código
`ITEM_ATRIBUTO_OPCION_INVALIDA` y el detalle enumera las tres opciones válidas.

#### CA-009: Rango de anios invalido y acumulacion de errores

Dada una definición `anios` de tipo `RANGO_ANIO` y una definición `material` requerida, cuando un
usuario guarda `anios` con `desde` 2018 y `hasta` 2012 y además omite `material`, entonces la
respuesta es 400 y el detalle contiene los dos errores, `ITEM_ATRIBUTO_RANGO_INVALIDO` y
`ITEM_ATRIBUTO_REQUERIDO_AUSENTE`, en una sola llamada.

#### CA-010: Atributo de una definicion inactivada se conserva

Dado un item con el atributo `presentacion` y esa definición posteriormente inactivada, cuando un
usuario edita el nombre del item sin tocar los atributos, entonces la edición se acepta, el valor de
`presentacion` se conserva en `atributos` y deja de aparecer en `textoBusqueda`.

### Alias

#### CA-011: Alta de alias con normalizacion

Dado un item existente, cuando un usuario con permiso `catalogo.alias.administrar` agrega el alias
`"Tubo de Media"`, entonces el alias se guarda con su forma original en `alias`, con
`normalizado` igual a `tubo de 1/2`, con `origen` en `MANUAL`, con `vecesUsado` en cero y el
`textoBusqueda` del item se regenera incluyendo ese texto.

#### CA-012: Alias duplicado en el mismo item

Dado un item con el alias normalizado `pega azul`, cuando un usuario agrega el alias `"PEGA AZUL"`,
entonces la respuesta es 409 con código `ALIAS_DUPLICADO` y no se crea un segundo registro.

#### CA-013: Alias compartido con otro item

Dados dos items de la misma organización y un alias normalizado que ya pertenece al primero, cuando
un usuario agrega ese mismo alias al segundo, entonces la respuesta es 201 y el cuerpo incluye la
advertencia `ALIAS_COMPARTIDO_CON_OTRO_ITEM` con el identificador y el nombre del primer item.

#### CA-014: Depuracion de alias sin borrado fisico

Dado un alias activo con `vecesUsado` en cero, cuando un usuario lo elimina desde
`DELETE /api/items/:id/alias/:aliasId`, entonces el registro persiste con `estadoRegistro` en
`INACTIVO`, deja de aparecer en `textoBusqueda` del item y deja de participar en la búsqueda.

#### CA-015: Contador de usos del alias

Dado un alias activo con `vecesUsado` en 3, cuando una resolución de línea elige ese alias como
origen de la coincidencia, entonces `vecesUsado` queda en 4 y el valor nunca disminuye por
operaciones posteriores del catálogo.

### Aplicaciones y compatibilidades

#### CA-016: Aplicacion con rango de anios expandido

Dado un item de repuestos, cuando un usuario crea una aplicación con `marcaVehiculo` `Toyota`,
`modelo` `Corolla`, `anioDesde` 2014 y `anioHasta` 2019, entonces `textoNormalizado` contiene
`toyota corolla` y los seis años del rango, y una búsqueda por `corolla 2017` devuelve ese item entre
los resultados.

#### CA-017: Aplicacion duplicada rechazada

Dado un item con una aplicación activa cuyo `textoNormalizado` es `toyota corolla 2014 2015`, cuando
un usuario crea otra aplicación con datos que producen el mismo texto normalizado, entonces la
respuesta es 409 con código `APLICACION_DUPLICADA`.

### Texto de busqueda y busqueda del catalogo

#### CA-018: Regeneracion por cambio de nombre de marca

Dados cinco items activos de la marca `Gerfor` y su `textoBusqueda` conteniendo `gerfor`, cuando un
usuario renombra la marca a `Gerfor Andina`, entonces el `textoBusqueda` de los cinco items se
regenera conteniendo `gerfor andina` dentro de la misma transacción del cambio.

#### CA-019: Busqueda tolerante a errores de escritura y acentos

Dado un item llamado `Tubo PVC 1/2 pulgada` con la categoría `Tubería`, cuando un usuario busca
`tuvo pvc`, entonces el item aparece en los resultados con un puntaje mayor o igual a 0.3000 y con
`origenMatch` en `TEXTO_SIMILITUD`.

#### CA-020: Prioridad de la coincidencia exacta

Dado un item con SKU `TUB-12-PVC` y otros items cuyos nombres son similares a ese texto, cuando un
usuario busca `TUB-12-PVC`, entonces el item con ese SKU es el primer resultado, con puntaje
`1.0000` y `origenMatch` en `SKU`, por encima de cualquier resultado por similitud.

#### CA-021: Consulta demasiado corta

Dado un usuario con permiso `catalogo.items.ver`, cuando busca con el texto `a`, entonces la
respuesta es 400 con código `ITEM_BUSQUEDA_CONSULTA_MUY_CORTA` y no se ejecuta ninguna consulta de
similitud.

### Inactivacion

#### CA-022: Item inactivo no cotizable y cotizacion historica intacta

Dado un item que aparece en una cotización aprobada con precio `12.5000` y descripción congelada,
cuando un usuario inactiva ese item, entonces la búsqueda para cotizar deja de devolverlo, el intento
de agregarlo como línea nueva a un borrador se rechaza, y la cotización aprobada conserva sin cambios
la descripción, el SKU, el precio unitario y el total de su línea.

### Terminos no resueltos y aislamiento

#### CA-023: Cierre de un termino creando un alias

Dado un término no resuelto con `textoNormalizado` igual a `pega azul` y `vecesVisto` en 7, cuando un
usuario lo cierra creando un alias sobre un item existente, entonces se crea el alias con `origen` en
`APRENDIDO`, el término queda con `estadoRegistro` en `INACTIVO` y con `resueltoConItemId` apuntando
a ese item, y el `textoBusqueda` del item se regenera.

#### CA-024: Aislamiento entre organizaciones

Dado un usuario autenticado de la organización A y un item, un alias, una aplicación y un término no
resuelto pertenecientes a la organización B, cuando el usuario intenta leerlos, editarlos,
inactivarlos o agregarles alias por su identificador, entonces todas las respuestas son 404 con el
código de no encontrado correspondiente, ningún registro de la organización B se modifica y ninguna
respuesta revela su existencia.

## Verificacion requerida para cierre

- [x] Un usuario de la organización A no puede leer ni modificar items, alias, aplicaciones ni
      términos no resueltos de la organización B, y recibe respuesta de no encontrado en todos los
      casos, incluida la búsqueda por texto y el listado paginado. *(implementado en servicios; QA manual pendiente)*
- [x] El alta y la edición de items validan permiso, forma, pertenencia y reglas de negocio en el
      orden obligatorio de `docs/06-diseno-tecnico.md`.
- [x] La unicidad del SKU se verifica con comparación `UPPER(TRIM)` e incluye inactivos.
- [x] La validación dinámica de atributos acumula errores `ITEM_ATRIBUTO_*` por tipo de dato.
- [x] La función de normalización tiene pruebas unitarias (acentos, `ñ`, signos, medidas).
- [x] La unicidad de alias por item usa `normalizado` único por `itemId`.
- [x] La depuración de alias y la eliminación de aplicaciones son inactivaciones lógicas.
- [ ] El contador `vecesUsado` se incrementa al resolver una línea *(diferido a spec 008)*.
- [x] `textoBusqueda` se regenera en los eventos de item, alias y maestras; reindexación disponible.
- [x] La expansión del rango de años y la búsqueda por aplicaciones están implementadas.
- [x] La búsqueda respeta umbral 0.30 y límite 25; UI consume `/items/buscar`.
- [ ] Plan de ejecución GIN sobre ≥300 items *(QA con datos reales tras migrar)*.
- [ ] Item inactivo en borrador/cotización aprobada *(specs 008/009)*.
- [x] Permisos Cotizador vs Administrador cableados en API y UI.
- [x] Ámbito `PLATAFORMA` exige contexto de organización.

## Preguntas abiertas

| Tema | Pregunta | Impacto si se decide mal |
|------|----------|--------------------------|
| Rutas de detalle | Las rutas `GET /api/items/:id`, la edición de aplicaciones y la reindexación no están en `docs/06-diseno-tecnico.md` y esta especificación las introduce. Confirmar que se incorporan al contrato maestro | Divergencia entre el documento maestro y la implementación |
| Limite de reindexacion sincronica | Cuál es el número de items a partir del cual la regeneración masiva deja de hacerse en línea | Bloqueos largos al renombrar una categoría muy usada |
| Umbral de similitud del catalogo | Si 0.30 es el valor correcto para la búsqueda de administración, distinto del umbral de resolución del pipeline | Resultados ruidosos o ausencia de resultados útiles |
| Alias en el alta de items | Si el arreglo `alias` del alta debe exigir el permiso `catalogo.alias.administrar` además de `catalogo.items.crear` | Un perfil podría crear alias sin el permiso específico |
| Aplicaciones estructuradas | Si conviene declarar un esquema por vertical para `item_aplicaciones.datos` en lugar de aceptar claves libres | Datos de compatibilidad heterogéneos y difíciles de consultar |
| Depuracion asistida de alias | Si se necesita una vista de alias con cero usos en toda la organización, además del contador en la ficha | Alias basura acumulados que degradan el reconocimiento |

## Decisiones MVP v1

1. El SKU es opcional pero único por organización, comparando el valor recortado y en mayúsculas, e
   incluyendo los items inactivos en la verificación.
2. El nombre del item no es único.
3. Los atributos se validan con un esquema construido en tiempo de ejecución a partir de las
   definiciones activas, y la respuesta acumula todos los errores detectados.
4. Una clave de atributo con valor nulo o cadena vacía elimina el atributo, salvo que la definición
   sea requerida.
5. El documento de atributos admite como máximo 40 claves y una aplicación como máximo 20.
6. `textoBusqueda` es responsabilidad de la aplicación, no de un disparador de base de datos, y se
   regenera en los cinco eventos declarados.
7. El umbral de similitud de la búsqueda del catálogo es 0.30 y el límite de resultados es 25.
8. La coincidencia exacta de SKU y de alias precede a cualquier resultado por similitud.
9. La búsqueda excluye items inactivos por defecto.
10. La unicidad de alias es por item y no por organización; un mismo texto puede apuntar a dos items
    y la ambigüedad se resuelve con candidatos, con advertencia al crearlo.
11. Un item admite como máximo 50 alias activos.
12. La depuración de alias y la eliminación de aplicaciones son inactivaciones, no borrados.
13. Los alias `APRENDIDO` se crean solo con confirmación explícita de la persona.
14. El rango de años de una aplicación se expande a años individuales en `textoNormalizado`, con un
    máximo de 60 años.
15. La inactivación de un item se expresa con `PATCH` sobre el propio item y no con una ruta
    dedicada.
16. Un item inactivo no es cotizable y permanece intacto en las cotizaciones históricas.
17. Los stocks y las cantidades viajan como cadenas decimales con 4 decimales, igual que los
    importes.
18. Ninguna regla de esta especificación ramifica por vertical: el vertical solo aporta datos semilla.

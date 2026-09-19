# Spec 005: Importacion de catalogo

## Estado

En implementación — API y UI base (2026-09-18)

## Objetivo

Definir el flujo de importacion masiva de catalogo desde archivo Excel o CSV: items, precios por
lista y alias. La importacion es el camino principal para que una organizacion del piloto cargue sus
150 a 300 items de mayor rotacion sin capturarlos uno a uno.

El flujo es siempre en tres pasos explicitos: cargar el archivo con su tipo y mapeo, validar con
informe de errores por fila, y confirmar (o simular sin persistir). Ninguna fila se escribe en el
catalogo hasta la confirmacion. La simulacion permite ver el efecto completo sin mutar datos.

## Dependencias

| Documento | Que aporta |
|-----------|-----------|
| `docs/06-diseno-tecnico.md` | Tabla `importaciones_catalogo`, permisos y endpoints |
| `docs/05-alcance-mvp.md` | Importacion con mapeo, validacion previa, errores por fila y simulacion |
| `docs/specs/003-maestras-catalogo.md` | Unidades, categorias, marcas y definiciones referenciadas por nombre o codigo |
| `docs/specs/004-catalogo-items.md` | Reglas de items, SKU, atributos, alias y `textoBusqueda` |
| `docs/specs/006-listas-precios-reglas.md` | Listas y precios de item |
| `docs/03-verticales-y-packs.md` | Plantilla por vertical y sinonimos como insumo de alias |
| `docs/decisions/0001-multi-tenancy-por-organizacion.md` | Aislamiento por organizacion |

## Alcance MVP v1

Incluye:

- Tres tipos de importacion: `ITEMS`, `PRECIOS` y `ALIAS`.
- Carga de archivo Excel (`.xlsx`) o CSV (`.csv`) con mapeo de columnas.
- Estados de la importacion: `CARGADA`, `VALIDADA`, `CONFIRMADA`, `FALLIDA`, `CANCELADA`.
- Validacion previa con errores por fila y resumen.
- Confirmacion con persistencia y modo simulacion sin escritura.
- Resolucion de referencias por codigo o nombre de maestras de la organizacion.
- Deteccion de SKU duplicado dentro del archivo y contra el catalogo existente.
- Limite maximo de filas por archivo.
- Plantilla descargable alineada al vertical de la organizacion (columnas de atributos del pack).
- Tabla de columnas esperadas por tipo de importacion.

No incluye en esta version:

| Fuera de alcance | Motivo |
|------------------|--------|
| Importacion de aplicaciones o compatibilidades | Pregunta abierta del pack; se difiere |
| Actualizacion parcial fila a fila con fusion inteligente compleja | El MVP usa alta o actualizacion por SKU con reglas simples |
| Programacion o importacion recurrente automatica | Fuera del piloto |
| Conectores a ERP o APIs de proveedores | Fuera de alcance |
| Importacion de imagenes | No hay adjuntos de item en el MVP |
| Deshacer una confirmacion ya aplicada | Se corrige con una importacion nueva o edicion manual |

## Conceptos principales

| Concepto | Definicion operativa |
|----------|----------------------|
| Importacion | Registro en `importaciones_catalogo` que rastrea un archivo, su tipo, mapeo, estado y resultados |
| Tipo | `ITEMS`, `PRECIOS` o `ALIAS`. Determina columnas esperadas y destino de persistencia |
| Mapeo de columnas | Documento JSON que asocia cada columna del archivo a un campo del sistema |
| Validacion | Paso que clasifica cada fila como valida o con error sin escribir el catalogo |
| Confirmacion | Paso que persiste las filas validas (o todas, segun politica de rechazo parcial) |
| Simulacion | Confirmacion con `simular: true`: ejecuta las mismas reglas y devuelve el resumen sin mutar |
| Error por fila | Entrada en `erroresDetalle` con numero de fila, campo, codigo y mensaje |
| Plantilla por vertical | Archivo de ejemplo con las columnas base mas los atributos del pack materializado |

## Datos requeridos

### Tabla `importaciones_catalogo`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Del `OrgContext` |
| `tipo` | Si | `ITEMS`, `PRECIOS` o `ALIAS` |
| `nombreArchivo` | Si | Nombre original del archivo subido |
| `mapeoColumnas` | Si | JSON que asocia columna del archivo a campo del sistema |
| `estado` | Si | `CARGADA`, `VALIDADA`, `CONFIRMADA`, `FALLIDA` o `CANCELADA` |
| `filasTotales` | Si | Entero. Incluye cabecera excluida del conteo de datos |
| `filasValidas` | Si | Entero. Se actualiza al validar |
| `filasConError` | Si | Entero. Se actualiza al validar |
| `erroresDetalle` | No | JSON arreglo de errores por fila |
| `resumen` | No | JSON con conteos de altas, actualizaciones, omitidas y simulacion |
| `createdAt`, `updatedAt`, `createdById`, `updatedById` | Si | Auditoria estandar |

### Forma de `mapeoColumnas`

```typescript
type MapeoColumnas = {
  // clave: campo del sistema; valor: nombre o indice de columna del archivo
  [campoSistema: string]: string | number;
};
```

Ejemplo para items: `{ "sku": "Codigo", "nombre": "Nombre", "unidadCodigo": "Unidad", "precio": "Precio" }`.

### Forma de `erroresDetalle`

```typescript
type ErrorFilaImportacion = {
  fila: number;            // 1-based sobre el archivo de datos, sin contar cabecera
  campo?: string;          // campo del sistema o nombre de columna
  codigo: string;          // codigo de error funcional
  mensaje: string;
  valorRecibido?: string;
};
```

### Columnas esperadas por tipo

#### Tipo `ITEMS`

| Campo sistema | Obligatorio | Notas |
|---------------|-------------|-------|
| `sku` | No | Si viene, unico en archivo y en catalogo (activos e inactivos) |
| `nombre` | Si | 3 a 200 caracteres |
| `descripcion` | No | Hasta 2000 caracteres |
| `categoria` | No | Nombre de categoria o ruta `Padre > Hija`. Debe existir activa |
| `marca` | No | Nombre de marca activa; si no existe, error (no se crea al vuelo en MVP) |
| `unidadCodigo` | Si | Codigo de unidad activa de la organizacion |
| `tipoItem` | No | `FUNGIBLE`, `SERIALIZADO` o `SERVICIO`. Por defecto `FUNGIBLE` |
| `controlaStock` | No | `true`/`false` o `si`/`no` |
| `stockAproximado` | No | Cadena decimal 4 decimales |
| `atributo:<codigo>` | Segun definicion | Una columna por definicion activa; validacion dinamica |
| `precioLista` | No | Si se informa, exige `listaPrecioCodigo` o usa la predeterminada |
| `listaPrecioCodigo` | No | Codigo de lista activa; solo con `precioLista` |
| `alias` | No | Alias separados por `|`; origen `IMPORTADO` |

#### Tipo `PRECIOS`

| Campo sistema | Obligatorio | Notas |
|---------------|-------------|-------|
| `sku` | Si | Debe existir un item con ese SKU en la organizacion |
| `listaPrecioCodigo` | Si | Lista activa de la organizacion |
| `precio` | Si | Cadena decimal con 4 decimales, mayor que cero |

#### Tipo `ALIAS`

| Campo sistema | Obligatorio | Notas |
|---------------|-------------|-------|
| `sku` | Si | Item existente |
| `alias` | Si | 2 a 200 caracteres; se normaliza; origen `IMPORTADO` |

### Limites del archivo

| Limite | Valor MVP |
|--------|-----------|
| Filas de datos maximas | 2000 |
| Tamaño maximo del archivo | 5 MB |
| Formatos | `.xlsx`, `.csv` (UTF-8) |
| Alias por celda (`ITEMS.alias`) | Maximo 20 separados por `\|` |

## Reglas de negocio

### Flujo y estados

1. Toda operacion exige `ctx.organizacionId` no nulo y el permiso `catalogo.items.importar`.
2. Estados y transiciones:

| Estado actual | Transicion permitida | Destino |
|---------------|----------------------|---------|
| (nuevo) | Cargar archivo | `CARGADA` |
| `CARGADA` | Validar | `VALIDADA` o `FALLIDA` |
| `CARGADA` | Cancelar | `CANCELADA` |
| `VALIDADA` | Confirmar (con o sin simulacion) | `CONFIRMADA` si persiste; permanece `VALIDADA` si solo simula |
| `VALIDADA` | Cancelar | `CANCELADA` |
| `FALLIDA` | Cancelar | `CANCELADA` |
| `CONFIRMADA`, `CANCELADA` | — | Terminales |

3. Validar sobre un estado distinto de `CARGADA` responde 422 con `IMPORTACION_ESTADO_INVALIDO`.
4. Confirmar exige estado `VALIDADA`. Confirmar con cero filas validas responde 422 con
   `IMPORTACION_SIN_FILAS_VALIDAS`.
5. Si al validar el archivo no se puede leer o supera limites, el estado pasa a `FALLIDA`.

### Carga y mapeo

6. Al cargar se crea el registro en `CARGADA`, se guarda el archivo temporalmente via el adaptador de
   almacenamiento y se persiste `mapeoColumnas` y `filasTotales`.
7. Si el mapeo omite un campo obligatorio del tipo, la carga responde 400 con
   `IMPORTACION_MAPEO_INCOMPLETO` y no se crea el registro.
8. Columnas del archivo no mapeadas se ignoran.
9. La primera fila se trata como cabecera. Un archivo sin cabecera reconocible responde
   `IMPORTACION_CABECERA_INVALIDA`.

### Validacion

10. La validacion no escribe items, precios ni alias. Solo actualiza contadores, `erroresDetalle` y
    `resumen` preliminar.
11. Cada fila se valida de forma independiente. Un error en la fila N no detiene la validacion de N+1.
12. Errores de una misma fila se acumulan todos en `erroresDetalle`.
13. Referencias a maestras se resuelven por codigo (unidad, lista) o nombre (categoria, marca) dentro
    de la organizacion. Una referencia inexistente o inactiva es error de fila, no 404 de la peticion.
14. Los atributos se validan con las mismas reglas que `docs/specs/004-catalogo-items.md`.
15. Duplicado de SKU **dentro del archivo**: todas las filas con el mismo SKU normalizado quedan con
    error `SKU_DUPLICADO_EN_ARCHIVO`, excepto que se defina que la ultima gana: en MVP **todas
    fallan** para forzar correccion explicita.
16. Duplicado de SKU **contra catalogo** en tipo `ITEMS`: si el SKU ya existe, la fila se clasifica
    como actualizacion valida (no error), y al confirmar se aplica PATCH de los campos informados.
    Las filas sin SKU siempre son altas.
17. En tipo `PRECIOS`, un SKU inexistente es error de fila `ITEM_SKU_NO_ENCONTRADO`.
18. En tipo `ALIAS`, alias que normaliza igual a uno activo del mismo item es error de fila
    `ALIAS_DUPLICADO`. Alias compartido con otro item es valido con advertencia en el resumen.
19. Precio no positivo o no parseable es error de fila. Los importes se interpretan como cadenas de
    4 decimales.
20. Superar 2000 filas de datos responde a nivel de importacion `IMPORTACION_LIMITE_FILAS` y estado
    `FALLIDA`.

### Confirmacion y simulacion

21. Confirmar con `simular: true` ejecuta el plan de altas y actualizaciones, devuelve el `resumen`
    completo y **no** muta catalogo ni cambia el estado a `CONFIRMADA`; permanece `VALIDADA`.
22. Confirmar con `simular: false` (o omitido) persiste en una transaccion por lotes y deja estado
    `CONFIRMADA`.
23. Politica de persistencia: solo se escriben las filas validas. Las filas con error se omiten. El
    resumen indica `filasAplicadas`, `filasOmitidas` y `filasActualizadas`.
24. Si durante la confirmacion ocurre un error de integridad no previsto, se revierte el lote
    afectado, el estado pasa a `FALLIDA` y `erroresDetalle` se amplía.
25. Los alias creados por importacion llevan `origen` `IMPORTADO`.
26. Tras confirmar items, se regenera `textoBusqueda` de cada item tocado.
27. Confirmar precios hace UPSERT sobre `precios_item` por (`listaPrecioId`, `itemId`).
28. Cancelar solo aplica a `CARGADA`, `VALIDADA` o `FALLIDA` y no deshace una `CONFIRMADA`.

### Plantilla por vertical

29. `GET` de plantilla (ruta adicional) genera un archivo con columnas base del tipo mas una columna
    por cada definicion de atributo activa de la organizacion. No ramifica por codigo de vertical:
    usa las definiciones ya materializadas.
30. La plantilla de `ALIAS` puede incluir una hoja o seccion de sinonimos sugeridos del pack como
    referencia no importable, si estan disponibles en codigo; no es obligatorio persistirlos.

### Aislamiento

31. Una importacion ajena responde 404 al validar, confirmar o consultar.
32. Ninguna fila puede crear o actualizar datos de otra organizacion.

## Permisos

| Permiso | Uso |
|---------|-----|
| `catalogo.items.importar` | Cargar, validar, confirmar, simular, cancelar y descargar plantilla |

Solo el perfil `Administrador Organizacion` tiene este permiso via `catalogo.*`. El `Cotizador` no
importa.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| POST | `/api/importaciones` | `catalogo.items.importar` | Cargar archivo, tipo y mapeo |
| POST | `/api/importaciones/:id/validar` | `catalogo.items.importar` | Validar filas |
| POST | `/api/importaciones/:id/confirmar` | `catalogo.items.importar` | Confirmar o simular |

Rutas adicionales que esta spec introduce siguiendo convenciones de `docs/06-diseno-tecnico.md`:

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/importaciones` | `catalogo.items.importar` | Historial paginado de importaciones |
| GET | `/api/importaciones/:id` | `catalogo.items.importar` | Detalle, resumen y errores |
| POST | `/api/importaciones/:id/cancelar` | `catalogo.items.importar` | Cancelar |
| GET | `/api/importaciones/plantilla` | `catalogo.items.importar` | Descargar plantilla por `tipo` |

```typescript
// POST /api/importaciones (multipart)
type CrearImportacionInput = {
  tipo: 'ITEMS' | 'PRECIOS' | 'ALIAS';
  archivo: File;
  mapeoColumnas: MapeoColumnas;  // JSON en campo de formulario
};

type ImportacionDetalle = {
  id: string;
  tipo: 'ITEMS' | 'PRECIOS' | 'ALIAS';
  nombreArchivo: string;
  estado: 'CARGADA' | 'VALIDADA' | 'CONFIRMADA' | 'FALLIDA' | 'CANCELADA';
  filasTotales: number;
  filasValidas: number;
  filasConError: number;
  mapeoColumnas: MapeoColumnas;
  erroresDetalle: ErrorFilaImportacion[];
  resumen: {
    altas?: number;
    actualizaciones?: number;
    omitidas?: number;
    advertencias?: string[];
    simulado?: boolean;
  } | null;
};

// POST /api/importaciones/:id/confirmar
type ConfirmarImportacionInput = {
  simular?: boolean;  // true = no persiste; default false
};
```

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `PERMISO_DENEGADO` | Sin `catalogo.items.importar` |
| `CONTEXTO_ORGANIZACION_REQUERIDO` | Ambito plataforma |
| `IMPORTACION_NO_ENCONTRADA` | Id inexistente o de otra organizacion |
| `IMPORTACION_ESTADO_INVALIDO` | Transicion no permitida |
| `IMPORTACION_MAPEO_INCOMPLETO` | Falta campo obligatorio en el mapeo |
| `IMPORTACION_CABECERA_INVALIDA` | No se reconoce la fila de cabecera |
| `IMPORTACION_FORMATO_NO_SOPORTADO` | Extensión o MIME no admitido |
| `IMPORTACION_ARCHIVO_DEMASIADO_GRANDE` | Supera 5 MB |
| `IMPORTACION_LIMITE_FILAS` | Mas de 2000 filas de datos |
| `IMPORTACION_SIN_FILAS_VALIDAS` | Confirmar sin filas validas |
| `IMPORTACION_YA_CONFIRMADA` | Intento de reconfirmar |
| Errores por fila | `SKU_DUPLICADO_EN_ARCHIVO`, `ITEM_SKU_NO_ENCONTRADO`, `UNIDAD_NO_ENCONTRADA`, `CATEGORIA_NO_ENCONTRADA`, `MARCA_NO_ENCONTRADA`, `LISTA_PRECIO_NO_ENCONTRADA`, `PRECIO_INVALIDO`, `ATRIBUTO_*`, `ALIAS_DUPLICADO`, `NOMBRE_REQUERIDO`, `TIPO_ITEM_INVALIDO` |

Los errores por fila no fallan la peticion HTTP de validacion: la respuesta es 200 con estado
`VALIDADA` (o `FALLIDA` solo ante fallo estructural del archivo).

## Experiencia de usuario

Flujo en tres pasos bajo `/catalogo/importar`:

1. **Cargar**: elegir tipo (`ITEMS` / `PRECIOS` / `ALIAS`), subir archivo, mapear columnas con
   selectores y enlace para descargar plantilla.
2. **Validar**: tabla de errores por fila, contadores de validas y con error, descarga del informe.
3. **Confirmar**: boton primario Confirmar y secundario Simular. La simulacion muestra el resumen
   propuesto sin escribir. Confirmar pide una casilla de confirmacion con el numero de filas a
   aplicar.

El historial lista importaciones previas con tipo, archivo, estado, fechas y enlace al detalle de
errores. Una importacion `CONFIRMADA` es de solo lectura.

### Mensajes

| Situacion | Mensaje |
|-----------|---------|
| Validacion con errores | Se encontraron N filas con error. Corrija el archivo o confirme solo las validas |
| Simulacion | Simulacion completa: se crearian A items y se actualizarían B. No se guardo nada |
| Confirmacion | Importacion aplicada: A altas, B actualizaciones, C omitidas |
| Limite de filas | El archivo supera el maximo de 2000 filas |
| SKU duplicado en archivo | El SKU aparece mas de una vez; corrija el archivo |

## Criterios de aceptacion

### Carga y mapeo

#### CA-001: Carga de importacion de items

Dado un usuario con `catalogo.items.importar` y un CSV de 10 filas con mapeo completo, cuando carga
tipo `ITEMS`, entonces la respuesta es 201, el estado es `CARGADA` y `filasTotales` es 10.

#### CA-002: Mapeo incompleto rechazado

Dado un mapeo de `ITEMS` sin `nombre` ni `unidadCodigo`, cuando se carga, entonces la respuesta es
400 con `IMPORTACION_MAPEO_INCOMPLETO` y no se crea registro.

#### CA-003: Formato no soportado

Dado un archivo `.pdf`, cuando se carga, entonces la respuesta es 400 con
`IMPORTACION_FORMATO_NO_SOPORTADO`.

### Validacion y errores por fila

#### CA-004: Validacion clasifica filas

Dado un archivo `ITEMS` con 8 filas validas y 2 con unidad inexistente, cuando se valida, entonces el
estado es `VALIDADA`, `filasValidas` es 8, `filasConError` es 2 y `erroresDetalle` tiene dos entradas
con codigo de unidad no encontrada.

#### CA-005: SKU duplicado dentro del archivo

Dadas dos filas con el mismo SKU `TUB-01` en un archivo `ITEMS`, cuando se valida, entonces ambas
filas aparecen en `erroresDetalle` con `SKU_DUPLICADO_EN_ARCHIVO`.

#### CA-006: SKU existente se trata como actualizacion

Dado un item existente con SKU `TUB-01` y una fila del archivo con ese SKU y nombre nuevo, cuando se
valida, entonces la fila es valida y el resumen preliminar indica una actualizacion.

#### CA-007: Validacion de precios

Dado un archivo `PRECIOS` con un SKU inexistente y un precio `abc`, cuando se valida, entonces hay
errores de fila `ITEM_SKU_NO_ENCONTRADO` y `PRECIO_INVALIDO` respectivamente.

#### CA-008: Validacion de alias

Dado un archivo `ALIAS` con un alias que ya existe normalizado en el mismo item, cuando se valida,
entonces esa fila tiene error `ALIAS_DUPLICADO`.

#### CA-009: Limite de filas

Dado un archivo con 2001 filas de datos, cuando se carga o valida, entonces el resultado es
`IMPORTACION_LIMITE_FILAS` y estado `FALLIDA` o rechazo en carga.

### Simulacion y confirmacion

#### CA-010: Simulacion no persiste

Dada una importacion `VALIDADA` con 5 altas de items, cuando se confirma con `simular: true`, entonces
la respuesta incluye resumen con 5 altas, no existen items nuevos en el catalogo y el estado sigue
`VALIDADA`.

#### CA-011: Confirmacion persiste solo validas

Dada una importacion con 7 filas validas y 3 con error, cuando se confirma sin simular, entonces se
crean o actualizan 7 registros, las 3 con error no se escriben, el estado es `CONFIRMADA` y
`resumen.omitidas` es 3.

#### CA-012: Confirmacion de precios hace upsert

Dado un precio existente del item en la lista y una fila con precio nuevo `15.5000`, cuando se
confirma tipo `PRECIOS`, entonces el precio queda `15.5000` y no se duplica la fila de `precios_item`.

#### CA-013: Alias importados con origen IMPORTADO

Dada una confirmacion tipo `ALIAS` valida, cuando se consulta el alias creado, entonces `origen` es
`IMPORTADO` y el `textoBusqueda` del item se regenera.

#### CA-014: No reconfirmar

Dada una importacion `CONFIRMADA`, cuando se intenta confirmar de nuevo, entonces la respuesta es
422 con `IMPORTACION_YA_CONFIRMADA` o `IMPORTACION_ESTADO_INVALIDO`.

### Plantilla y permisos

#### CA-015: Plantilla incluye atributos de la organizacion

Dada una organizacion con definiciones `diametro` y `material` activas, cuando descarga la plantilla
tipo `ITEMS`, entonces el archivo incluye columnas para esos codigos ademas de las columnas base.

#### CA-016: Cotizador no puede importar

Dado un usuario `Cotizador`, cuando invoca `POST /api/importaciones`, entonces la respuesta es 403.

### Aislamiento

#### CA-017: Aislamiento entre organizaciones

Dado un administrador de la organizacion A y una importacion de la organizacion B, cuando intenta
validar, confirmar o ver el detalle por id, entonces la respuesta es 404 con
`IMPORTACION_NO_ENCONTRADA` y ningun dato de B se modifica ni se revela.

#### CA-018: Cancelacion

Dada una importacion `VALIDADA`, cuando se cancela, entonces el estado es `CANCELADA` y no se puede
confirmar despues.

## Verificacion requerida para cierre

- [ ] Transiciones de estado cubiertas con pruebas: caminos felices y rechazos.
- [ ] Validacion acumula multiples errores por fila y no corta el archivo al primer error.
- [ ] SKU duplicado en archivo marca todas las ocurrencias.
- [ ] SKU existente en `ITEMS` actualiza; en `PRECIOS`/`ALIAS` exige existencia.
- [ ] Simulacion produce el mismo resumen que la confirmacion real sin mutar.
- [ ] Confirmacion parcial (solo validas) en una sola operacion atomica por lote.
- [ ] Limite de 2000 filas y 5 MB.
- [ ] Plantilla generada a partir de definiciones activas de la organizacion, no del codigo de
      vertical.
- [ ] Alias con origen `IMPORTADO` y regeneracion de `textoBusqueda`.
- [ ] Upsert de precios por lista e item.
- [ ] **Aislamiento entre organizaciones** en carga, listado, detalle, validar, confirmar y
      plantilla.
- [ ] Perfil `Cotizador` recibe 403; ambito plataforma recibe error de contexto.

## Preguntas abiertas

1. ¿Debe la confirmacion fallar por completo si hay alguna fila con error, en lugar de aplicar solo
   las validas? El MVP aplica solo validas.
2. ¿Se crea la marca al vuelo si el nombre no existe? Hoy se rechaza la fila.
3. Importacion de `item_aplicaciones` para `REPUESTOS`: queda fuera y es demanda probable del piloto.
4. Retencion del archivo original tras `CONFIRMADA`: ¿cuanto tiempo se conserva?
5. Codificacion CSV distinta de UTF-8: ¿se intenta detectar o se rechaza?

## Decisiones MVP v1

| Decision | Motivo |
|----------|--------|
| Tres pasos: cargar, validar, confirmar | Evita escribir basura; el informe de errores es el valor del flujo |
| Simulacion no cambia estado a `CONFIRMADA` | Permite iterar el archivo sin perder el registro validado |
| Solo se persisten filas validas | Maximiza utilidad con archivos imperfectos tipicos del piloto |
| SKU duplicado en archivo invalida todas las ocurrencias | Evita ambigüedad de "ultima gana" |
| SKU existente en items actualiza | Soporta recargas del catalogo sin borrar a mano |
| Marca inexistente no se crea al vuelo | Evita contaminar maestras con typos del Excel |
| Limite 2000 filas / 5 MB | Cubre el piloto (300 items) con margen sin abrir abusos |
| Plantilla segun definiciones de la organizacion | Cumple la regla de no ramificar por vertical |
| Un solo permiso `catalogo.items.importar` | Alineado al diseño tecnico |

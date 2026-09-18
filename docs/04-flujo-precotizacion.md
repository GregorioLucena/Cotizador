# Flujo de precotizacion

Documento de detalle del pipeline que convierte un mensaje informal del cliente en una cotización
en estado `BORRADOR`. Materializa la regla de oro del producto: la IA propone, el catálogo cotiza,
la persona aprueba.

Es la ampliación operativa de `docs/decisions/0003-pipeline-precotizacion.md`. El modelo de datos,
los contratos de API y las reglas críticas viven en `docs/06-diseno-tecnico.md`. La resolución de
ítems se detalla en `docs/decisions/0007-estrategia-de-matching.md`. El cálculo de importes se
detalla en `docs/decisions/0005-motor-de-precios.md`.

## Referencias

| Documento | Aporta |
|-----------|--------|
| `docs/00-vision.md` | Regla de oro y actores |
| `docs/01-glosario.md` | Solicitud, interpretación, resolución, precotización, confianza |
| `docs/06-diseno-tecnico.md` | Tablas, contrato `POST /api/precotizaciones`, reglas críticas |
| `docs/decisions/0003-pipeline-precotizacion.md` | Las cinco etapas y los invariantes |
| `docs/decisions/0004-proveedor-de-ia-abstraido.md` | Interfaz `ProveedorIa`, timeout y degradación |
| `docs/decisions/0005-motor-de-precios.md` | Orden de cálculo y pureza del motor |
| `docs/decisions/0007-estrategia-de-matching.md` | Cascada, umbrales y empate |
| `docs/decisions/0008-moneda-base-y-presentacion.md` | Conversión solo del total |

## Invariante de importes

Ningún importe de una cotización proviene, directa o indirectamente, de la salida de un modelo de
lenguaje. La etapa 2 solo puede devolver descripción, cantidad, unidad y notas. Los precios, los
descuentos, el impuesto, la tasa y los totales los calcula la etapa 4 a partir del catálogo y de las
reglas de la organización.

---

## Flujo completo

```text
Operador pega texto de WhatsApp
        |
        v
POST /api/precotizaciones
  { textoOriginal, clienteId?, listaPrecioId?, sucursalId?, canal? }
        |
        v
+---------------------------------------------------------------+
|  Etapa 1 — Normalizacion                                      |
|  Entrada: textoOriginal                                       |
|  Salida:  textoNormalizado + metadatos de ruido descartado    |
|  Tipo:    funcion pura, sin IA                                |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
|  Etapa 2 — Extraccion de lineas                               |
|  Entrada: textoNormalizado + unidadesValidas                  |
|  Salida:  LineaExtraida[] (sin precios ni ids de catalogo)    |
|  Tipo:    unica etapa con ProveedorIa                         |
|  Fallo:   borrador sin lineas + advertencia (nunca 5xx al UI) |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
|  Etapa 3 — Resolucion contra catalogo                         |
|  Entrada: lineas extraidas + catalogo de la organizacion      |
|  Salida:  item, confianza, origenMatch, candidatos[]          |
|  Tipo:    cascada determinista (ADR 0007), sin IA             |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
|  Etapa 4 — Calculo de precios                                 |
|  Entrada: lineas resueltas + precios + reglas + config        |
|  Salida:  importes por linea y totales                        |
|  Tipo:    funciones puras en @cotizador/shared, sin BD        |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
|  Etapa 5 — Ensamblado                                         |
|  Persistencia atomica: solicitud, interpretacion, cotizacion  |
|  BORRADOR, lineas, candidatos, evento CREADA / INTERPRETADA   |
+-------------------------------+-------------------------------+
                                |
                                v
{ data: PrecotizacionResultado }
  cotizacion en BORRADOR + interpretacion + resumen de semaforo
```

El operador revisa, corrige y aprueba en pantallas posteriores (`docs/specs/009-revision-aprobacion.md`).
Ese tramo no forma parte de este pipeline: aquí termina cuando existe el borrador persistido.

---

## Etapa 1 — Normalizacion

Función pura, determinista y sin IA. Conserva el texto original intacto en `solicitudes.textoOriginal`
y produce `solicitudes.textoNormalizado` para comparación e indexación.

La normalización del pipeline y la del catálogo **son la misma función**: `normalizarTexto` en
`@cotizador/shared/texto`. Si divergen, la búsqueda por similitud falla de forma silenciosa.

### Transformaciones

| Paso | Transformacion | Ejemplo de entrada | Ejemplo de salida |
|------|----------------|--------------------|-------------------|
| 1 | Recorte de espacios al inicio y al final | `"  Tubo  "` | `"Tubo"` |
| 2 | Conversion a minusculas | `"TUBO PVC"` | `"tubo pvc"` |
| 3 | Eliminacion de acentos y dieresis (`ñ` → `n`) | `"cañería"` | `"caneria"` |
| 4 | Sustitucion de signos de puntuacion por espacio, preservando `/` y `.` en medidas | `"tubo, pvc!"` | `"tubo pvc"` |
| 5 | Colapso de espacios multiples en uno | `"tubo   pvc"` | `"tubo pvc"` |
| 6 | Equivalencias de medidas y fracciones | `"media"`, `"½"`, `"0.5"` | `"1/2"` |
| 7 | Separacion de lineas y vinietas en unidades logicas | `"- 2 tubos\n- 10 codos"` | dos segmentos normalizados |
| 8 | Deteccion y descarte de ruido de chat (saludos, marcas de hora, nombres de contacto, reenvios) | ver tabla de ejemplos WhatsApp | texto util conservado |

Los pasos 1 a 6 aplican a cada fragmento de texto que se indexa o se compara (alias, `textoBusqueda`,
línea de pedido). Los pasos 7 y 8 son propios del preprocesado de la solicitud antes de invocar la
etapa 2; el fragmento que queda se vuelve a pasar por `normalizarTexto` completo.

### Funcion `normalizarTexto`

```typescript
// @cotizador/shared/texto
export function normalizarTexto(valor: string): string;
```

Contrato:

| Aspecto | Regla |
|---------|-------|
| Pureza | Sin efectos secundarios, sin reloj, sin IO |
| Idempotencia | `normalizarTexto(normalizarTexto(x)) === normalizarTexto(x)` |
| Uso al indexar | `items.textoBusqueda`, `item_alias.normalizado`, `item_aplicaciones.textoNormalizado` |
| Uso al consultar | Texto de la solicitud y de cada `textoSolicitado` antes de la cascada |
| Diccionario de medidas | Equivalencias declaradas (packs / shared); misma tabla al indexar y al buscar |

### Ejemplos desde WhatsApp

| Texto pegado (original) | Texto util tras limpiar ruido | `normalizarTexto` del util |
|-------------------------|-------------------------------|----------------------------|
| `[10:42] Juan: Hola, buenos dias\nnecesito 2 tubos de media` | `necesito 2 tubos de media` | `necesito 2 tubos de 1/2` |
| `Fwd: lista\n- 10 codos\n- un pegamento azul` | `10 codos\nun pegamento azul` | `10 codos\nun pegamento azul` |
| `me das 3m de cable número 12 porfa 🙏` | `me das 3m de cable número 12 porfa` | `me das 3m de cable numero 12 porfa` |
| `pastillas del corolla 2015` | `pastillas del corolla 2015` | `pastillas del corolla 2015` |
| `½" codo pvc x 8` | `½" codo pvc x 8` | `1/2 codo pvc x 8` |

El emoji y los saludos no aportan a la extracción: se descartan en el preprocesado. El texto original
completo se guarda sin modificar para reprocesar e investigar.

---

## Etapa 2 — Extraccion de lineas

Única etapa que invoca el proveedor de IA. No recibe el catálogo. No conoce precios. Su salida se
valida con un esquema Zod estricto (`strict`) que rechaza campos no declarados.

### Contrato TypeScript

```typescript
// @cotizador/shared — alineado con decisions/0004-proveedor-de-ia-abstraido.md

export type EntradaExtraccion = {
  textoNormalizado: string;
  unidadesValidas: string[];   // codigos de unidades_medida activas de la organizacion
  limiteLineas: number;
};

export type LineaExtraida = {
  textoSolicitado: string;     // descripcion tal como la escribio el cliente
  cantidad: number;            // si no se puede determinar: 1
  unidad?: string;             // codigo de unidad si se menciona y es valida
  notas?: string;              // notas del cliente o advertencia de cantidad asumida
};

export type ResultadoExtraccion = {
  lineas: LineaExtraida[];
  advertencias: string[];
  metricas: {
    latenciaMs: number;
    tokensEntrada?: number;
    tokensSalida?: number;
    costoEstimado?: number;
  };
};

export interface ProveedorIa {
  readonly nombre: string;
  readonly modelo: string;
  readonly versionPrompt: string;
  extraerLineas(entrada: EntradaExtraccion): Promise<ResultadoExtraccion>;
}
```

### Esquema Zod estricto

```typescript
import { z } from 'zod';

export const lineaExtraidaSchema = z
  .object({
    textoSolicitado: z.string().min(1).max(500),
    cantidad: z.number().positive(),
    unidad: z.string().min(1).max(20).optional(),
    notas: z.string().max(500).optional(),
  })
  .strict();

export const resultadoExtraccionSchema = z
  .object({
    lineas: z.array(lineaExtraidaSchema).max(50),
    advertencias: z.array(z.string()).default([]),
  })
  .strict();
```

Cualquier clave extra (`precio`, `itemId`, `sku`, `descuento`, `total`, `moneda`, etc.) hace fallar
la validación. Una respuesta con precios se considera **fallo de la etapa**, no un resultado parcial
reparable.

### Prohibiciones de salida

| Prohibido | Motivo |
|-----------|--------|
| Identificadores de item (`id`, `sku` como resolucion) | La resolucion es la etapa 3 |
| Precios, descuentos, subtotales, totales | Violan el invariante de importes |
| Monedas o tasas | Pertenecen al motor de precios |
| Catalogo embebido o ranking de items | La IA no recibe ni elige del catalogo |

Permitido únicamente: `textoSolicitado`, `cantidad`, `unidad`, `notas`, más `advertencias` a nivel
de resultado.

### Fallo y timeout

| Condicion | Comportamiento |
|-----------|----------------|
| Timeout (`IA_TIMEOUT_MS`, inicial 20000) | Etapa falla de forma controlada |
| Error de red, 429 o 5xx | Como maximo un reintento con espera breve; luego fallo |
| Respuesta que no valida el esquema | Fallo; se registra el texto crudo; **no** se repara |
| `usaIa` en falso u organizacion con proveedor `none` | Cero lineas y advertencia; modo manual |
| Texto mayor a `IA_MAX_CARACTERES` (4000) | Se trunca o se rechaza segun configuracion de plataforma antes de llamar |

Ante fallo, el pipeline **continúa**: se crea la cotización en `BORRADOR` sin líneas y se informa al
operador. Nunca se propaga una excepción de IA como error de la petición HTTP al operador (la API
responde 201 con `interpretacion.exito: false`, ver contrato en `docs/06-diseno-tecnico.md`).

Cada ejecución se persiste en `interpretaciones_solicitud` con `proveedor`, `modelo`,
`versionPrompt`, `exito`, `resultado`, `advertencias`, `errorCodigo`, `errorDetalle`, `latenciaMs`,
`tokensEntrada`, `tokensSalida` y `costoEstimado`.

### Ejemplo completo

Entrada normalizada:

```text
necesito 2 tubos de 1/2, 10 codos y un pegamento azul
```

Unidades válidas de ejemplo: `["UND", "M", "KG", "CAJA", "LT"]`.

Salida válida del proveedor (ya validada por Zod):

```json
{
  "lineas": [
    {
      "textoSolicitado": "tubos de 1/2",
      "cantidad": 2,
      "unidad": "UND"
    },
    {
      "textoSolicitado": "codos",
      "cantidad": 10,
      "unidad": "UND"
    },
    {
      "textoSolicitado": "pegamento azul",
      "cantidad": 1,
      "unidad": "UND",
      "notas": "cantidad asumida en 1 porque el cliente dijo 'un'"
    }
  ],
  "advertencias": []
}
```

Salida **inválida** (rechazada; no se usa):

```json
{
  "lineas": [
    {
      "textoSolicitado": "tubos de 1/2",
      "cantidad": 2,
      "precio": 12.5
    }
  ]
}
```

El campo `precio` hace fallar `.strict()`. Se registra el fallo en `interpretaciones_solicitud` y el
borrador nace sin líneas.

---

## Etapa 3 — Resolucion contra catalogo

Asocia cada `LineaExtraida` con un item del catálogo de la organización, o admite que no puede.
Determinista, auditable y sin IA. Detalle normativo en `docs/decisions/0007-estrategia-de-matching.md`.

### Cascada de cinco estrategias

| Orden | Estrategia | `origenMatch` | Como funciona | Puntaje base |
|-------|------------|---------------|---------------|--------------|
| 1 | SKU exacto | `SKU` | El texto contiene un codigo que coincide con el SKU de un item activo | 1.00 |
| 2 | Alias exacto | `ALIAS_EXACTO` | Coincidencia exacta del texto normalizado con `item_alias.normalizado` | 0.98 |
| 3 | Alias por similitud | `ALIAS_SIMILITUD` | Similitud de trigramas contra alias activos | 0.60 a 0.95 |
| 4 | Texto de busqueda por similitud | `TEXTO_SIMILITUD` | Similitud contra `items.textoBusqueda` (nombre, SKU, marca, categoria, alias, atributos buscables) | 0.50 a 0.90 |
| 5 | Palabras clave con filtro de atributos | `ATRIBUTO` | Coincidencia de terminos mas atributos detectados en el texto (p. ej. medida) | 0.45 a 0.85 |

La cascada se detiene en la primera estrategia que produce un resultado por encima de
`umbralAutomatico`. Las estrategias restantes se ejecutan de todos modos, hasta un límite, para
poblar hasta cinco candidatos alternativos en `cotizacion_linea_candidatos`.

Solo items con `estadoRegistro = ACTIVO` de `ctx.organizacionId` participan. Un identificador ajeno
nunca aparece: el filtro por organización es obligatorio en toda consulta.

### SQL conceptual de similitud

Extensiones: `pg_trgm` y `unaccent` (primera migración). Índices GIN con `gin_trgm_ops` sobre
`items.textoBusqueda` e `item_alias.normalizado`, compuestos con `organizacionId`.

```sql
-- Alias por similitud (estrategia 3), conceptual
SELECT
  a.item_id,
  similarity(a.normalizado, :textoNormalizado) AS puntaje
FROM item_alias a
WHERE a."organizacionId" = :organizacionId
  AND a."estadoRegistro" = 'ACTIVO'
  AND similarity(a.normalizado, :textoNormalizado) >= :umbralDescarte
ORDER BY puntaje DESC
LIMIT 10;

-- Texto de busqueda (estrategia 4), conceptual
SELECT
  i.id AS item_id,
  similarity(i."textoBusqueda", :textoNormalizado) AS puntaje
FROM items i
WHERE i."organizacionId" = :organizacionId
  AND i."estadoRegistro" = 'ACTIVO'
  AND similarity(i."textoBusqueda", :textoNormalizado) >= :umbralDescarte
ORDER BY puntaje DESC
LIMIT 10;
```

`similarity` de `pg_trgm` devuelve un valor entre 0 y 1. El puntaje que se expone puede combinar ese
valor con el rango base de la estrategia; lo importante es que quede registrado en
`cotizacion_lineas.confianza` y en `cotizacion_linea_candidatos.puntaje` como `numeric(5,4)`.

### Umbrales y estados de resolucion

Valores iniciales al provisionar (ver `docs/03-verticales-y-packs.md`):
`umbralAutomatico = 0.8000`, `umbralDescarte = 0.4500`. Editables por organización.

| Condicion | `estadoResolucion` | Semaforo |
|-----------|--------------------|----------|
| Confianza >= `umbralAutomatico` y sin empate | `RESUELTA_AUTOMATICA` | Verde |
| `umbralDescarte` <= confianza < `umbralAutomatico` | `SUGERIDA_REVISAR` | Ambar |
| Confianza < `umbralDescarte` o sin candidatos | `NO_ENCONTRADA` | Rojo |
| Empate: diferencia entre los dos mejores < 0.05 | Nunca automatica; como maximo `SUGERIDA_REVISAR` | Ambar |

Regla de empate: si los dos mejores candidatos difieren en menos de `0.05` de puntaje, la línea
**no** se marca como `RESUELTA_AUTOMATICA` aunque el mejor supere el umbral automático. Ante empate,
decide la persona.

Los textos que quedan en `NO_ENCONTRADA` alimentan `terminos_no_resueltos` (contador
`vecesVisto`, `ejemploOriginal`, `ultimaVezAt`).

### Interfaz `EstrategiaResolucion`

La cascada es una lista ordenada detrás de una interfaz común, de modo que en fase 2 se pueda añadir
embeddings sin tocar el resto del pipeline.

```typescript
// @cotizador/shared — contrato de la cascada (ADR 0007)

export type CandidatoResolucion = {
  itemId: string;
  puntaje: number;           // 0..1
  origenMatch:
    | 'SKU'
    | 'ALIAS_EXACTO'
    | 'ALIAS_SIMILITUD'
    | 'TEXTO_SIMILITUD'
    | 'ATRIBUTO';
};

export type ResultadoEstrategia = {
  elegida?: CandidatoResolucion;
  candidatos: CandidatoResolucion[];
};

export type EntradaResolucionLinea = {
  organizacionId: string;
  textoNormalizado: string;
  umbralAutomatico: number;
  umbralDescarte: number;
};

export interface EstrategiaResolucion {
  readonly nombre: string;
  readonly origenMatch: CandidatoResolucion['origenMatch'];
  resolver(entrada: EntradaResolucionLinea): Promise<ResultadoEstrategia>;
}
```

El orquestador aplica las estrategias en orden, aplica umbrales y empate, y escribe
`estadoResolucion`, `confianza`, `origenMatch`, `itemId` (si hay) y los candidatos ordenados.

---

## Etapa 4 — Calculo de precios

Funciones puras en `@cotizador/shared`, sin base de datos, sin proveedor de IA y sin `new Date()`
interno: la fecha de referencia llega como parámetro. Normativa en
`docs/decisions/0005-motor-de-precios.md` y `docs/decisions/0008-moneda-base-y-presentacion.md`.

### Orden fijo de aplicacion

| Paso | Operacion | Notas |
|------|-----------|-------|
| 1 | Precio base de la lista | `precios_item.precio` de la lista aplicada; si falta, linea no cotizable |
| 2 | Descuento por reglas | Una sola regla por linea; mayor prioridad; a igual prioridad, ambito mas especifico (`ITEM` > `CATEGORIA` > `MARCA` > `GLOBAL`); a igual especificidad, mayor beneficio al cliente |
| 3 | Sobrescritura manual | Si existe, gana siempre; no se aplica descuento adicional; exige motivo y permiso |
| 4 | Impuesto | Porcentaje unico de `configuraciones_cotizacion`; si `preciosIncluyenImpuesto`, la base se obtiene por division |
| 5 | Redondeo | Una sola vez por linea y luego al total; `decimalesRedondeo` y `modoRedondeo`; sin redondeo intermedio |
| 6 | Conversion a moneda de presentacion | Solo el **total** en moneda base × tasa; nunca linea por linea |

Importes: aritmética decimal, almacenamiento `numeric(18,4)`, transporte en API como cadena. Tasas:
`numeric(18,6)`.

### Ejemplo numerico (tres lineas, cuatro decimales)

Hipótesis de configuración:

| Parametro | Valor |
|-----------|-------|
| Moneda base | USD |
| Moneda de presentacion | VES |
| Tasa vigente | `36.500000` (USD → VES) |
| `aplicaImpuesto` | `true` |
| `porcentajeImpuesto` | `16.0000` |
| `preciosIncluyenImpuesto` | `false` |
| `decimalesRedondeo` | `2` |
| `modoRedondeo` | `NORMAL` |

Líneas resueltas (ya con item y precio de lista; sin sobrescritura):

| # | Item | Cantidad | Precio lista | Regla aplicada |
|---|------|----------|--------------|----------------|
| 1 | Tubo PVC 1/2" | 2.0000 | 12.5000 | 10% por cantidad minima 2 (`PORCENTAJE`) |
| 2 | Codo PVC 1/2" | 10.0000 | 1.2500 | ninguna |
| 3 | Pegamento PVC | 1.0000 | 8.7500 | ninguna |

Cálculo por línea (antes del redondeo final a 2 decimales de presentación operativa; se muestran
cuatro decimales de trabajo):

| # | Precio unitario tras descuento | Descuento monto | Subtotal linea | Impuesto linea (16%) | Total linea |
|---|--------------------------------|-----------------|----------------|----------------------|-------------|
| 1 | 12.5000 × (1 − 0.10) = 11.2500 | 2.5000 | 2 × 11.2500 = 22.5000 | 3.6000 | 26.1000 |
| 2 | 1.2500 | 0.0000 | 10 × 1.2500 = 12.5000 | 2.0000 | 14.5000 |
| 3 | 8.7500 | 0.0000 | 1 × 8.7500 = 8.7500 | 1.4000 | 10.1500 |

Totales de la cotización:

| Concepto | Valor (USD, 4 decimales de trabajo) |
|----------|-------------------------------------|
| `subtotal` | 22.5000 + 12.5000 + 8.7500 = 43.7500 |
| `descuentoTotal` | 2.5000 |
| `impuestoTotal` | 3.6000 + 2.0000 + 1.4000 = 7.0000 |
| `total` (moneda base) | 43.7500 + 7.0000 = 50.7500 |
| `totalPresentacion` (VES) | 50.7500 × 36.500000 = 1852.3750 |

Con `decimalesRedondeo = 2` y modo `NORMAL`, los importes mostrados al operador y congelados al
aprobar se redondean al final (p. ej. total base `50.75`, presentación `1852.38`), sin haber
redondeado pasos intermedios. La conversión **no** se aplica a cada línea: la suma de líneas en VES
no se calcula, para evitar diferencias de céntimos.

Si la línea 1 no tuviera precio en la lista, no se inventa importe: queda no cotizable y la
cotización no puede aprobarse hasta resolverla (regla 10 de `docs/06-diseno-tecnico.md`).

---

## Etapa 5 — Ensamblado

Persiste el resultado en una única transacción. Si cualquier escritura falla, se revierte completa:
no queda solicitud huérfana ni cotización a medias.

### Persistencia

| Orden | Tabla | Contenido |
|-------|-------|-----------|
| 1 | `solicitudes` | `textoOriginal`, `textoNormalizado`, `canal`, `clienteId`, `sucursalId`, `estado` (`INTERPRETADA` o `FALLIDA`) |
| 2 | `interpretaciones_solicitud` | Metadatos del proveedor, `exito`, `resultado`, `advertencias`, metricas y errores |
| 3 | `secuencias_folio` | Incremento con bloqueo de fila; asigna `folioNumero` y `folio` |
| 4 | `cotizaciones` | Estado `BORRADOR`, lista, monedas, tasa vigente (si hay presentacion), totales, vigencia provisional segun config |
| 5 | `cotizacion_lineas` | Una fila por linea con importes, `estadoResolucion`, `confianza`, `origenMatch` |
| 6 | `cotizacion_linea_candidatos` | Hasta cinco candidatos por linea, ordenados por puntaje |
| 7 | `terminos_no_resueltos` | Upsert de textos en `NO_ENCONTRADA` |
| 8 | `cotizacion_eventos` | Eventos inmutables de cierre del pipeline |

Todo lleva `organizacionId` tomado de `ctx`, nunca de la entrada. El folio es consecutivo por
organización y no se reutiliza (regla 11).

### Eventos

| Tipo | Cuando |
|------|--------|
| `CREADA` | Siempre, al persistir el borrador |
| `INTERPRETADA` | Cuando la etapa 2 completo con `exito` verdadero (aunque haya advertencias) |

Reprocesar (`POST /api/precotizaciones/:solicitudId/reprocesar`) crea una **interpretación nueva**
y un borrador nuevo según el contrato de API; no sobrescribe interpretaciones anteriores (invariante
6 del ADR 0003).

### Respuesta al operador

La forma de éxito es `PrecotizacionResultado` en `docs/06-diseno-tecnico.md`: cotización en
`BORRADOR`, bloque `interpretacion` (`exito`, `proveedor`, `latenciaMs`, `advertencias`) y
`resumen` (`lineasTotales`, `resueltasAutomaticas`, `sugeridas`, `noEncontradas`).

---

## Modos de fallo y degradacion

| Fallo | Etapa | Efecto en el borrador | Respuesta al operador |
|-------|-------|----------------------|------------------------|
| Texto vacio o solo ruido | 1 | No se crea cotizacion util | Error de validacion 400 |
| Proveedor IA timeout / red / 5xx | 2 | Cotizacion `BORRADOR` sin lineas | 201, `interpretacion.exito: false`, advertencia |
| Respuesta IA invalida (Zod) | 2 | Igual que arriba; crudo guardado | 201, exito falso |
| `usaIa` falso o proveedor `none` | 2 | Borrador sin lineas | 201, advertencia de modo manual |
| Ningun item supera `umbralDescarte` | 3 | Linea en `NO_ENCONTRADA` | 201, linea en rojo |
| Empate < 0.05 | 3 | No automatica; `SUGERIDA_REVISAR` | 201, linea en ambar |
| Item sin precio en la lista | 4 | Linea no cotizable / a revisar | 201, bloquea aprobacion posterior |
| Error de persistencia | 5 | Transaccion revertida | Error 5xx / 409 segun causa; nada a medias |
| Catalogo vacio | 3 | Todas `NO_ENCONTRADA` | 201; el producto sigue siendo util en modo manual |

Principio: el producto **nunca** queda bloqueado por el proveedor de IA. El operador puede armar la
cotización a mano agregando líneas (`AGREGADA_MANUAL`).

---

## Metricas del pipeline

Métricas observables desde interpretaciones, líneas y eventos. Alimentan
`GET /api/reportes/desempeno-reconocimiento` y el panel de métricas del piloto.

| Metrica | Fuente | Uso |
|---------|--------|-----|
| Latencia de extraccion (`latenciaMs`) | `interpretaciones_solicitud` | Detectar degradacion del proveedor |
| Tasa de exito de interpretacion | `interpretaciones_solicitud.exito` | Disponibilidad de la etapa 2 |
| Tokens y `costoEstimado` | `interpretaciones_solicitud` | Costo por cotizacion |
| % lineas `RESUELTA_AUTOMATICA` | `cotizacion_lineas.estadoResolucion` | Calidad del reconocimiento |
| % lineas `SUGERIDA_REVISAR` | idem | Carga de revision humana |
| % lineas `NO_ENCONTRADA` | idem | Huecos de catalogo / alias |
| Distribucion de `origenMatch` | `cotizacion_lineas.origenMatch` | Que estrategia aporta valor |
| Correcciones (`LINEA_CORREGIDA`) | `cotizacion_eventos` | Brecha entre automatico y humano |
| Alias aprendidos (`ALIAS_APRENDIDO`) | `cotizacion_eventos` | Curacion del vocabulario |
| Terminos mas fallidos | `terminos_no_resueltos` | Priorizar alias e items nuevos |
| Tiempo captura → aprobacion | eventos `CREADA` / `APROBADA` | Objetivo de menos de un minuto |

Al cambiar el prompt se incrementa `versionPrompt` para poder comparar calidad entre versiones sin
mezclar series.

---

## Documentos relacionados

- `docs/specs/008-precotizacion-ia.md` — criterios de aceptacion del pipeline.
- `docs/specs/009-revision-aprobacion.md` — edicion humana posterior al borrador.
- `docs/09-guia-ux-ui.md` — semaforo y pantalla de cotizar.
- `docs/03-verticales-y-packs.md` — umbrales iniciales y sinonimos del rubro.






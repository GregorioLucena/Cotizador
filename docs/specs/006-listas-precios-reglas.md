# Spec 006: Listas de precios, reglas y tasas

## Estado

Especificada — pendiente de implementacion (2026-09-17)

## Objetivo

Definir listas de precios, precios por item, reglas de descuento no acumulativas, tasas de cambio y
el orden de calculo del motor de precios. Este modulo es donde un error cuesta dinero: el calculo
debe ser determinista, explicable y coincidente entre servidor e interfaz mediante funciones puras en
`@cotizador/shared`.

Ningun importe de una cotizacion proviene de un modelo de lenguaje. Los precios salen de las listas;
los descuentos de las reglas; el impuesto y el redondeo de la configuracion de cotizacion; la
conversion solo se aplica al total.

## Dependencias

| Documento | Que aporta |
|-----------|-----------|
| `docs/06-diseno-tecnico.md` | Tablas `listas_precio`, `precios_item`, `reglas_descuento`, `tasas_cambio` |
| `docs/decisions/0005-motor-de-precios.md` | Orden de calculo, no acumulacion, precision decimal |
| `docs/decisions/0008-moneda-base-y-presentacion.md` | Moneda base, presentacion y conversion solo al total |
| `docs/specs/002-configuracion-organizacion.md` | Impuesto, redondeo, lista predeterminada |
| `docs/specs/004-catalogo-items.md` | Items cotizables y marcas/categorias |
| `docs/01-glosario.md` | Lista, precio de item, regla, tasa, monedas |

## Alcance MVP v1

Incluye:

- ABM de listas de precios con moneda, vigencia y marca de predeterminada.
- Precio por item y lista (alta, reemplazo, inactivacion logica del precio).
- Reglas de descuento por ambito `ITEM`, `CATEGORIA`, `MARCA` o `GLOBAL`, con prioridad y vigencia.
- Desempate de reglas no acumulativas documentado.
- Tasas de cambio manuales con vigencia.
- Motor de calculo puro: precio base, descuento, sobrescritura, impuesto, redondeo, conversion.
- Dos ejemplos numericos con 4 decimales (impuesto agregado vs impuesto incluido).

No incluye en esta version:

| Fuera de alcance | Motivo |
|------------------|--------|
| Descuentos acumulativos en cascada | Descartados en ADR 0005 |
| Listas en moneda distinta de la base | El campo existe; el MVP exige coincidencia con moneda base |
| Fuente automatica de tasas | Diferida; el modelo admite `AUTOMATICA` sin implementarla |
| Promociones por horario o cupones | Fuera del piloto |
| Recalculo masivo de cotizaciones aprobadas | Aprobar congela; nunca se recalculan |

## Conceptos principales

| Concepto | Definicion operativa |
|----------|----------------------|
| Lista de precios | Conjunto de precios para un segmento; una es `esPredeterminada` |
| Precio de item | Importe del item en una lista, moneda base, `numeric(18,4)` como cadena |
| Regla de descuento | Condicion declarativa que modifica el precio de una linea; una sola por linea |
| Prioridad | Entero; mayor numero gana. A igualdad, desempate por especificidad y beneficio |
| Tasa de cambio | Valor `numeric(18,6)` entre moneda origen y destino con `fechaVigencia` |
| Motor de precios | Funciones puras en `@cotizador/shared` sin reloj ni base de datos |

## Datos requeridos

### Tabla `listas_precio`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Del contexto |
| `nombre` | Si | 2 a 80 caracteres |
| `codigo` | Si | Mayusculas, 2 a 20 caracteres. Unico por organizacion |
| `monedaId` | Si | Debe coincidir con la moneda base de la organizacion en el MVP |
| `esPredeterminada` | Si | Exactamente una lista activa predeterminada por organizacion |
| `vigenciaDesde` | No | Si se informa, la lista no aplica antes de esa fecha |
| `vigenciaHasta` | No | Si se informa, no aplica despues |
| `estadoRegistro` | Si | `ACTIVO` / `INACTIVO` |
| Auditoria | Si | Estandar |

### Tabla `precios_item`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Del contexto |
| `listaPrecioId` | Si | Lista de la misma organizacion |
| `itemId` | Si | Item de la misma organizacion |
| `precio` | Si | `numeric(18,4)` como cadena, mayor que cero. Ejemplo: `"12.5000"` |
| `estadoRegistro` | Si | Inactivar quita el precio de uso sin borrar |
| Auditoria | Si | Estandar |

Unico: (`listaPrecioId`, `itemId`).

### Tabla `reglas_descuento`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Del contexto |
| `listaPrecioId` | No | Nulo = aplica a todas las listas de la organizacion |
| `nombre` | Si | 2 a 120 caracteres |
| `ambito` | Si | `ITEM`, `CATEGORIA`, `MARCA` o `GLOBAL` |
| `referenciaId` | Segun ambito | Obligatorio salvo `GLOBAL`; id del item, categoria o marca |
| `cantidadMinima` | Si | `numeric(18,4)` >= 0. Por defecto `"1.0000"` |
| `cantidadMaxima` | No | Si se informa, >= `cantidadMinima` |
| `tipoDescuento` | Si | `PORCENTAJE`, `MONTO_FIJO` o `PRECIO_FIJO` |
| `valor` | Si | Cadena 4 decimales. Porcentaje 0 a 100; montos y precios > 0 |
| `prioridad` | Si | Entero. Mayor gana |
| `vigenciaDesde`, `vigenciaHasta` | No | Ventana de aplicacion |
| `estadoRegistro` | Si | Solo activas participan |
| Auditoria | Si | Estandar |

### Tabla `tasas_cambio`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Del contexto |
| `monedaOrigenId` | Si | Tipicamente la moneda base |
| `monedaDestinoId` | Si | Tipicamente la de presentacion |
| `valor` | Si | `numeric(18,6)` como cadena, mayor que cero. Ejemplo: `"36.500000"` |
| `fechaVigencia` | Si | Fecha (dia) desde la cual aplica |
| `fuente` | Si | `MANUAL` en el MVP; `AUTOMATICA` reservado |
| `estadoRegistro` | Si | |
| Auditoria | Si | Estandar |

Unico: (`organizacionId`, `monedaOrigenId`, `monedaDestinoId`, `fechaVigencia`).

## Reglas de negocio

### Listas de precios

1. Toda operacion filtra por `ctx.organizacionId`. Referencias ajenas: 404.
2. El `codigo` se normaliza a mayusculas. Unico por organizacion incluidos inactivos.
3. `monedaId` debe ser la moneda base de la organizacion. Otra moneda responde 422 con
   `LISTA_MONEDA_DISTINTA_DE_BASE`.
4. Exactamente una lista activa con `esPredeterminada` verdadero. Al marcar otra como predeterminada,
   la anterior pierde la marca en la misma transaccion.
5. No se puede inactivar la unica lista predeterminada activa sin designar otra antes: 422 con
   `LISTA_PREDETERMINADA_REQUERIDA`.
6. Una lista fuera de vigencia no se ofrece en selectores de captura; los precios historicos en
   cotizaciones aprobadas no se tocan.
7. La lista creada en el provisionamiento nace predeterminada en moneda base.

### Precios de item

8. El precio se informa y se transporta como cadena con 4 decimales.
9. Precio menor o igual a cero: 400 o 422 con `PRECIO_INVALIDO`.
10. PUT reemplaza el precio del par lista-item (alta o actualizacion).
11. Item o lista inactivos no admiten precio nuevo.
12. Item sin precio activo en la lista aplicada no es cotizable: la linea se marca para revision
    (regla 10 de `docs/06-diseno-tecnico.md`).
13. Inactivar un precio no borra la fila.

### Reglas de descuento — elegibilidad

14. Solo reglas `ACTIVO` cuya vigencia cubre la `fechaReferencia` del calculo.
15. Si la regla tiene `listaPrecioId`, solo aplica a esa lista; si es nulo, a todas.
16. Ambito:

| Ambito | Condicion |
|--------|-----------|
| `ITEM` | `referenciaId` = item de la linea |
| `CATEGORIA` | categoria del item = `referenciaId` (no incluye automaticamente hijas: la linea debe tener esa categoria exacta; pregunta abierta para heredar de padre) |
| `MARCA` | marca del item = `referenciaId` |
| `GLOBAL` | siempre candidata |

17. La cantidad de la linea debe cumplir `cantidadMinima` y, si hay, `cantidadMaxima` (ambos
    inclusive).
18. `PORCENTAJE`: `valor` entre `"0.0000"` y `"100.0000"`. `MONTO_FIJO` y `PRECIO_FIJO`: `valor` > 0.

### Reglas de descuento — no acumulacion y desempate

19. **Una sola regla por linea.** No se acumulan.
20. Orden de desempate entre candidatas elegibles:

| Paso | Criterio |
|------|----------|
| 1 | Mayor `prioridad` |
| 2 | A igual prioridad: mayor especificidad de ambito: `ITEM` > `CATEGORIA` > `MARCA` > `GLOBAL` |
| 3 | A igual especificidad: la de mayor beneficio para el cliente (menor `precioUnitario` resultante) |
| 4 | A igual beneficio: menor `id` (orden estable) |

21. Tipos de aplicacion sobre el precio de lista `P` y cantidad `Q`:

| Tipo | Precio unitario resultante |
|------|----------------------------|
| `PORCENTAJE` | `P * (1 - valor/100)` |
| `MONTO_FIJO` | `max(P - valor, 0)` |
| `PRECIO_FIJO` | `valor` |

22. El identificador de la regla elegida se guarda en la linea al calcular/aprobar.
23. Si no hay candidatas, no hay descuento.

### Orden de calculo

24. Orden fijo (ADR 0005):

1. Precio base de la lista (`precioLista`).
2. Descuento por la regla elegida → `precioUnitario` y montos de descuento.
3. Sobrescritura manual si existe: reemplaza `precioUnitario`; no se aplica descuento adicional.
4. Impuesto segun configuracion de cotizacion.
5. Redondeo una vez por linea y luego al total (sin redondeos intermedios).
6. Conversion a moneda de presentacion **solo del total**.

25. Aritmetica decimal; nunca punto flotante binario.
26. `fechaReferencia` y la tasa se reciben como entrada; el motor no llama a `new Date()` ni lee BD.

### Impuesto

27. Si `aplicaImpuesto` es falso: `impuestoTotal` es `"0.0000"`.
28. Si `preciosIncluyenImpuesto` es falso (impuesto agregado): se suma el porcentaje sobre la base
    imponible (suma de totales de linea tras descuento).
29. Si `preciosIncluyenImpuesto` es verdadero: la base se obtiene por division
    `totalConImpuesto / (1 + porcentaje/100)` y el impuesto es la diferencia.
30. El porcentaje aplicado se registra en la cotizacion al aprobar.

### Conversion

31. Solo si hay moneda de presentacion y tasa vigente para el par en la fecha de referencia.
32. `totalPresentacion = total * tasa` (cadena, precision de tasa 6 decimales en el factor).
33. Nunca se convierten precios unitarios linea por linea.
34. Sin tasa vigente: el borrador puede omitir `totalPresentacion` y advertir; no se inventa tasa.

### Tasas

35. Alta con fuente `MANUAL` en el MVP.
36. Unicidad por organizacion, par de monedas y fecha de vigencia.
37. La tasa vigente para una fecha es la de mayor `fechaVigencia` menor o igual a esa fecha, activa.
38. Origen y destino deben ser distintos.

## Permisos

| Permiso | Uso |
|---------|-----|
| `precios.listas.ver` | Ver listas y precios |
| `precios.listas.administrar` | ABM listas y precios |
| `precios.reglas.administrar` | ABM reglas (ver incluido en administrar para el administrador) |
| `precios.tasas.administrar` | Alta y consulta de tasas |

El `Cotizador` tiene `precios.listas.ver` solamente. No administra reglas ni tasas.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET/POST | `/api/listas-precio` | `precios.listas.ver` / `administrar` | Listado y alta |
| PATCH | `/api/listas-precio/:id` | `precios.listas.administrar` | Edicion e inactivacion |
| GET/PUT | `/api/listas-precio/:id/precios` | `precios.listas.ver` / `administrar` | Listar / reemplazar precios |
| GET/POST/PATCH | `/api/reglas-descuento` | `precios.reglas.administrar` | ABM reglas |
| GET/POST | `/api/tasas-cambio` | `precios.tasas.administrar` | Consulta y alta |

```typescript
type CrearListaPrecioInput = {
  nombre: string;
  codigo: string;
  monedaId: string;
  esPredeterminada?: boolean;
  vigenciaDesde?: string;
  vigenciaHasta?: string | null;
};

type UpsertPrecioInput = {
  itemId: string;
  precio: string;  // "12.5000"
};

type CrearReglaDescuentoInput = {
  listaPrecioId?: string | null;
  nombre: string;
  ambito: 'ITEM' | 'CATEGORIA' | 'MARCA' | 'GLOBAL';
  referenciaId?: string;
  cantidadMinima?: string;
  cantidadMaxima?: string | null;
  tipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO' | 'PRECIO_FIJO';
  valor: string;
  prioridad: number;
  vigenciaDesde?: string;
  vigenciaHasta?: string | null;
};

type CrearTasaCambioInput = {
  monedaOrigenId: string;
  monedaDestinoId: string;
  valor: string;           // "36.500000"
  fechaVigencia: string;   // ISO date
  fuente?: 'MANUAL';
};
```

El recalculo de una cotizacion en borrador vive en `docs/specs/009-revision-aprobacion.md` y consume
el mismo motor.

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `LISTA_PRECIO_NO_ENCONTRADA` | Id inexistente o ajeno |
| `LISTA_CODIGO_DUPLICADO` | Codigo repetido |
| `LISTA_MONEDA_DISTINTA_DE_BASE` | Moneda distinto de la base |
| `LISTA_PREDETERMINADA_REQUERIDA` | Se deja a la organizacion sin lista predeterminada activa |
| `PRECIO_INVALIDO` | Precio <= 0 o mal formado |
| `ITEM_NO_ENCONTRADO` | Item ajeno o inexistente al poner precio |
| `REGLA_NO_ENCONTRADA` | Regla ajena o inexistente |
| `REGLA_REFERENCIA_REQUERIDA` | Ambito no GLOBAL sin `referenciaId` |
| `REGLA_VALOR_INVALIDO` | Porcentaje fuera de rango o valor no positivo |
| `TASA_NO_ENCONTRADA` | Par sin tasa para la fecha |
| `TASA_DUPLICADA` | Misma vigencia y par |
| `TASA_MISMA_MONEDA` | Origen igual a destino |
| `PERMISO_DENEGADO` / `CONTEXTO_ORGANIZACION_REQUERIDO` | Seguridad |

## Experiencia de usuario

Rutas bajo `/precios`: listas, detalle con grilla de precios por item, reglas y tasas. El cotizador
solo consulta precios al armar borradores (lectura embebida).

Al crear o editar una regla, la interfaz muestra un ejemplo en vivo del desempate con datos de
muestra. En tasas se muestra la fecha de la ultima tasa y un aviso si tiene mas de un dia.

### Mensajes

| Situacion | Mensaje |
|-----------|---------|
| Sin precio | Este item no tiene precio en la lista seleccionada |
| Regla aplicada | Descuento aplicado: {nombre de la regla} |
| Tasa antigua | La tasa de cambio tiene mas de un dia; verifique antes de aprobar |
| Lista predeterminada | Debe existir una lista predeterminada activa |

## Ejemplos numericos del motor (4 decimales)

Configuracion comun a ambos ejemplos salvo lo indicado:

- Precio de lista del item: `"100.0000"`
- Cantidad: `"2.0000"`
- Regla elegida: `PORCENTAJE` `"10.0000"` (prioridad alta)
- `decimalesRedondeo`: 2, `modoRedondeo`: `NORMAL`
- Tasa a moneda de presentacion: `"36.500000"` (solo sobre el total)
- `porcentajeImpuesto`: `"16.0000"`

### Ejemplo A — Impuesto agregado (`preciosIncluyenImpuesto` = false)

Orden:

1. Precio lista unitario: `"100.0000"`
2. Descuento 10%: unitario `"90.0000"`; descuento por unidad `"10.0000"`
3. Subtotal linea (2 × 90): `"180.0000"`
4. Impuesto 16% sobre `"180.0000"`: `"28.8000"`
5. Total linea / documento de una linea antes de redondeo de presentacion: subtotal `"180.0000"`,
   impuesto `"28.8000"`, total `"208.8000"`
6. Redondeo a 2 decimales modo `NORMAL`: total `"208.8000"` (ya exacto)
7. Conversion solo del total: `"208.8000"` × `"36.500000"` = `"7621.200000"` → se presenta segun
   decimales de la moneda de presentacion; el factor y el total base se conservan con precision de
   almacenamiento. Total en base: `"208.8000"`. Total presentacion calculado: `"7621.2000"` (4
   decimales de importe).

Resumen ejemplo A:

| Concepto | Valor |
|----------|-------|
| `precioLista` | `"100.0000"` |
| `precioUnitario` | `"90.0000"` |
| `descuentoMonto` (linea) | `"20.0000"` |
| `subtotal` | `"180.0000"` |
| `impuestoTotal` | `"28.8000"` |
| `total` | `"208.8000"` |
| `totalPresentacion` | `"7621.2000"` |

### Ejemplo B — Impuesto incluido (`preciosIncluyenImpuesto` = true)

Los precios de catalogo ya contienen el impuesto. Misma lista y descuento:

1. Precio lista unitario (incluye impuesto): `"100.0000"`
2. Descuento 10%: unitario `"90.0000"` (sigue incluyendo impuesto)
3. Total linea con impuesto incluido: 2 × `"90.0000"` = `"180.0000"`
4. Base imponible por division: `"180.0000"` / (1 + 16/100) = `"180.0000"` / `"1.1600"` =
   `"155.1724"` (4 decimales en aritmetica decimal del motor)
5. Impuesto desglosado: `"180.0000"` − `"155.1724"` = `"24.8276"`
6. Total (lo que paga el cliente en moneda base): `"180.0000"`
7. Conversion solo del total: `"180.0000"` × `"36.500000"` = `"6570.0000"`

Resumen ejemplo B:

| Concepto | Valor |
|----------|-------|
| `precioLista` | `"100.0000"` |
| `precioUnitario` | `"90.0000"` |
| `descuentoMonto` (linea) | `"20.0000"` |
| Base imponible | `"155.1724"` |
| `impuestoTotal` | `"24.8276"` |
| `total` | `"180.0000"` |
| `totalPresentacion` | `"6570.0000"` |

Contraste: con impuesto agregado el cliente paga `"208.8000"`; con impuesto incluido el precio ya
embebía el gravamen y el total permanece `"180.0000"`, desglosando `"24.8276"` de impuesto.

## Criterios de aceptacion

### Listas y precios

#### CA-001: Alta de lista en moneda base

Dado un administrador con moneda base USD, cuando crea una lista con `monedaId` USD y codigo
`MAYOR`, entonces la respuesta es 201 y la lista queda activa.

#### CA-002: Lista en otra moneda rechazada

Dado un intento de crear lista con moneda EUR distinta de la base USD, cuando se envia, entonces
422 con `LISTA_MONEDA_DISTINTA_DE_BASE`.

#### CA-003: Cambiar lista predeterminada

Dadas listas A (predeterminada) y B, cuando se marca B como predeterminada, entonces B queda con
`esPredeterminada` verdadero y A con falso.

#### CA-004: Upsert de precio

Dado un item y una lista, cuando se hace PUT con precio `"12.5000"` y luego `"13.0000"`, entonces
existe una sola fila `precios_item` con `"13.0000"`.

#### CA-005: Item sin precio no cotizable

Dado un item sin precio en la lista del borrador, cuando se calcula la linea, entonces no se inventa
precio y la linea queda marcada para revision.

### Reglas y desempate

#### CA-006: Una sola regla por linea

Dadas dos reglas elegibles, cuando se calcula, entonces solo una se aplica y su id queda en la
linea.

#### CA-007: Mayor prioridad gana

Dadas regla GLOBAL prioridad 1 al 5% y regla ITEM prioridad 10 al 2%, cuando se calcula, entonces
aplica la de prioridad 10.

#### CA-008: Desempate por especificidad

Dadas ITEM y CATEGORIA con la misma prioridad, cuando ambas aplican, entonces gana `ITEM`.

#### CA-009: Desempate por mayor beneficio

Dadas dos reglas GLOBAL misma prioridad, 5% y 10%, cuando ambas aplican, entonces gana la del 10%.

#### CA-010: Cantidad minima en el limite

Dada regla con `cantidadMinima` `"10.0000"` y linea con cantidad `"10.0000"`, cuando se calcula,
entonces la regla es elegible.

#### CA-011: Regla vencida no aplica

Dada una regla con `vigenciaHasta` anterior a `fechaReferencia`, cuando se calcula, entonces no es
candidata.

#### CA-012: Precio sobrescrito anula descuento adicional

Dada una linea con sobrescritura manual, cuando se calcula, entonces `precioUnitario` es el
sobrescrito y no se aplica regla de descuento.

### Impuesto, conversion y ejemplos

#### CA-013: Ejemplo A impuesto agregado

Dada la entrada del Ejemplo A, cuando se ejecuta `calcularCotizacion`, entonces los importes
coinciden con la tabla del Ejemplo A (`total` `"208.8000"`, `impuestoTotal` `"28.8000"`,
`totalPresentacion` `"7621.2000"`).

#### CA-014: Ejemplo B impuesto incluido

Dada la entrada del Ejemplo B, cuando se ejecuta `calcularCotizacion`, entonces los importes
coinciden con la tabla del Ejemplo B (`total` `"180.0000"`, `impuestoTotal` `"24.8276"`, base
`"155.1724"`, `totalPresentacion` `"6570.0000"`).

#### CA-015: Conversion solo al total

Dado un documento de varias lineas, cuando hay moneda de presentacion, entonces la suma de lineas
convertidas individualmente no se usa; solo `total * tasa` alimenta `totalPresentacion`.

#### CA-016: Alta de tasa manual

Dado un par USD→VES con valor `"36.500000"` y fecha de hoy, cuando se crea, entonces la respuesta es
201 y es la vigente para esa fecha.

### Permisos y aislamiento

#### CA-017: Cotizador no administra reglas

Dado un `Cotizador`, cuando intenta `POST /api/reglas-descuento`, entonces 403.

#### CA-018: Aislamiento entre organizaciones

Dado un usuario de la organizacion A y listas, precios, reglas y tasas de B, cuando los consulta o
modifica por id, entonces todas las respuestas son 404 y ningun dato de B cambia.

## Verificacion requerida para cierre

- [ ] Pruebas unitarias de tabla del motor: sin descuento, limite de cantidad, conflicto de
      prioridad, especificidad, mayor beneficio, regla vencida, sobrescritura, ejemplos A y B,
      redondeo con quinto decimal, item sin precio, conversion con tasa de 6 decimales.
- [ ] Ninguna prueba del motor usa BD, red ni reloj del sistema.
- [ ] Importes y tasas viajan como cadena.
- [ ] ABM de listas, precios, reglas y tasas con unicidad.
- [ ] Exactamente una lista predeterminada activa.
- [ ] Moneda de lista = moneda base.
- [ ] **Aislamiento entre organizaciones** en los cuatro recursos.
- [ ] Perfiles: administrador administra; cotizador solo ve listas/precios.

## Preguntas abiertas

1. ¿La regla por `CATEGORIA` incluye subcategorias hijas o solo coincidencia exacta? El MVP asume
   coincidencia exacta.
2. ¿GET de reglas para quien solo tiene `precios.listas.ver`? Hoy exige `precios.reglas.administrar`.
3. Politica cuando hay dos tasas el mismo dia tras correccion: ¿inactivar la anterior?
4. ¿Se permite `PRECIO_FIJO` mayor que el precio de lista (aumento)? Hoy se permite tal cual.

## Decisiones MVP v1

| Decision | Motivo |
|----------|--------|
| Descuentos no acumulativos | Explicabilidad; ADR 0005 |
| Desempate prioridad → especificidad → beneficio → id | Determinismo total |
| Conversion solo al total | Evita descuadres de centavos; ADR 0008 |
| Listas solo en moneda base | Simplifica el piloto; el campo queda para el futuro |
| Motor puro en `@cotizador/shared` | Misma cifra en API y en UI |
| Ejemplos A/B fijados en la spec | Contrato de prueba obligatorio |
| Tasas manuales | Sin dependencia externa en el MVP |

# Verticales y packs

## Objetivo

Este documento define el contenido concreto de cada pack de vertical: las unidades de medida, las
definiciones de atributo, las categorias sugeridas, los sinonimos del rubro, la configuracion inicial
de cotizacion y la plantilla de documento con la que queda operativa una organizacion recien creada.

Es el documento de datos que acompaña a `decisions/0002-catalogo-generico-por-vertical.md`. El ADR
decide *como* se estructura la variabilidad por rubro; aqui se declara *que* contiene cada rubro.

El alcance funcional que sostiene este documento esta en `docs/05-alcance-mvp.md` y el modelo de datos
que se materializa esta en `docs/06-diseno-tecnico.md`.

## Como funciona un pack

Un pack de vertical es una semilla en codigo, no una fila de configuracion global. Vive en
`packages/database/src/seeds/verticales/<codigo>.ts` y se **materializa por copia** en tablas propias
de la organizacion durante el provisionamiento, en una unica transaccion.

| Aspecto | Comportamiento |
|---------|----------------|
| Ubicacion | `packages/database/src/seeds/verticales/<codigo>.ts` |
| Registro | Una fila en el catalogo global `verticales` con el mismo `codigo` |
| Momento de aplicacion | Al crear la organizacion, en `POST /api/organizaciones` |
| Forma de aplicacion | Copia a `unidades_medida`, `definiciones_atributo`, `categorias`, `listas_precio`, `configuraciones_cotizacion` y `plantillas_documento` de la organizacion |
| Autoridad posterior | Ninguna. Despues de provisionar, la organizacion es dueña de sus datos |
| Efecto de editar un pack | Afecta solo a organizaciones creadas despues de la edicion |
| Propagacion retroactiva | No existe en el MVP. Requeriria un comando explicito de sincronizacion |

Consecuencias directas de la materializacion por copia:

1. Dos organizaciones del mismo vertical pueden divergir en definiciones, categorias y unidades. Eso
   es deseado.
2. Ninguna consulta de catalogo necesita mirar el pack: todo lo que se consulta son datos de la
   organizacion, filtrados por `organizacionId`.
3. El vertical de la organizacion es dato informativo y de provisionamiento. **Ninguna regla de
   negocio ramifica por vertical.**

## Estructura de un pack

El tipo describe exactamente lo que un pack puede declarar. La lista de campos es cerrada: si un rubro
necesita algo que no esta aqui, primero se decide donde se persiste en `docs/06-diseno-tecnico.md`.

```typescript
// packages/database/src/seeds/verticales/tipos.ts

export type CodigoVertical = 'FERRETERIA' | 'REPUESTOS' | 'AUTOMOTRIZ' | 'GENERICO';

export type PackVertical = {
  codigo: CodigoVertical;
  nombre: string;
  unidadesMedida: PackUnidadMedida[];
  definicionesAtributo: PackDefinicionAtributo[];
  categorias: PackCategoria[];
  sinonimos: PackSinonimo[];
  configuracionCotizacion: PackConfiguracionCotizacion;
  plantillaDocumento: PackPlantillaDocumento;
  usaAplicaciones: boolean;
};

// Se copia a `unidades_medida`.
export type PackUnidadMedida = {
  codigo: string;              // sin acentos, mayusculas: UND, M, KG
  nombre: string;
  permiteDecimales: boolean;
};

// Se copia a `definiciones_atributo`.
export type PackDefinicionAtributo = {
  codigo: string;              // clave del documento `items.atributos`
  etiqueta: string;
  tipoDato: 'TEXTO' | 'NUMERO' | 'ENTERO' | 'BOOLEANO' | 'LISTA' | 'RANGO_ANIO';
  opciones?: string[];         // obligatorio y no vacio cuando tipoDato es LISTA
  unidadSugerida?: string;
  requerido: boolean;
  usarEnBusqueda: boolean;     // si es true, entra en `items.textoBusqueda`
  orden: number;
};

// Se copia a `categorias`. Un solo nivel de jerarquia.
export type PackCategoria = {
  nombre: string;
  orden: number;
  subcategorias?: Array<{ nombre: string; orden: number }>;
};

// Insumo para los alias del catalogo. No se persiste como fila propia al provisionar.
export type PackSinonimo = {
  texto: string;                          // como lo escribe el cliente, ya normalizado
  destinoTipo: 'CATEGORIA' | 'TERMINO';
  destino: string;                        // nombre de categoria o termino canonico del rubro
};

// Se copia a `configuraciones_cotizacion`.
export type PackConfiguracionCotizacion = {
  vigenciaHorasPredeterminada: number;
  aplicaImpuesto: boolean;
  porcentajeImpuesto: string;             // decimal como cadena
  preciosIncluyenImpuesto: boolean;
  decimalesRedondeo: number;
  modoRedondeo: 'NORMAL' | 'ARRIBA' | 'ABAJO';
  mostrarDescuentoDetallado: boolean;
  permiteSobrescribirPrecio: boolean;
};

// Parcial de `plantillaDocumentoConfigSchema`. El bloque `identidad` no lo declara el pack:
// se completa en el provisionamiento con los datos de la organizacion.
export type PackPlantillaDocumento = Omit<
  z.infer<typeof plantillaDocumentoConfigSchema>,
  'identidad'
>;
```

### Reglas del tipo

| Regla | Motivo |
|-------|--------|
| `codigo` de unidad y de atributo sin acentos y en mayusculas | Son claves, no texto de interfaz |
| `opciones` obligatorio cuando `tipoDato` es `LISTA` | La lista es cerrada y se valida al guardar el item |
| `usarEnBusqueda` verdadero solo en atributos que la gente menciona al pedir | Cada atributo buscable engorda `items.textoBusqueda` y diluye la similitud |
| `categorias` admite un solo nivel de anidamiento | `categorias.categoriaPadreId` no acepta mas profundidad |
| `sinonimos` se declara normalizado | Se compara con la salida de `normalizarTexto`, ver `docs/04-flujo-precotizacion.md` |
| `plantillaDocumento` nunca declara `identidad` | La identidad son datos de la organizacion, no del rubro |
| `usaAplicaciones` no habilita ninguna rama de negocio | Solo controla si la interfaz muestra la seccion de compatibilidades del item |

### Sobre `RANGO_ANIO`

El tipo de dato `RANGO_ANIO` existe para atributos de rango de años del propio item. La compatibilidad
de un item con vehiculos **no** es un atributo: vive en `item_aplicaciones` con su documento `datos` y
su columna `textoNormalizado`. Ningun pack declara la compatibilidad como definicion de atributo.

## Pack FERRETERIA

Rubro de referencia del MVP. Catalogo amplio, items fungibles, medidas en el nombre popular y
vocabulario muy alejado del nombre tecnico.

`usaAplicaciones`: `false`.

### Unidades de medida de FERRETERIA

| Codigo | Nombre | Permite decimales |
|--------|--------|-------------------|
| `UND` | Unidad | No |
| `M` | Metro | Si |
| `KG` | Kilogramo | Si |
| `CAJA` | Caja | No |
| `SACO` | Saco | No |
| `LT` | Litro | Si |
| `JGO` | Juego | No |
| `ROLLO` | Rollo | No |

### Definiciones de atributo de FERRETERIA

| Codigo | Etiqueta | Tipo de dato | Opciones | Buscable | Requerido |
|--------|----------|--------------|----------|----------|-----------|
| `diametro` | Diametro | `TEXTO` | — | Si | No |
| `material` | Material | `LISTA` | `PVC`, `CPVC`, `HG`, `COBRE`, `PPR`, `ACERO`, `ALUMINIO`, `PLASTICO` | Si | No |
| `medida` | Medida | `TEXTO` | — | Si | No |
| `presentacion` | Presentacion | `TEXTO` | — | No | No |
| `color` | Color | `TEXTO` | — | No | No |
| `rosca` | Rosca | `LISTA` | `SIN_ROSCA`, `NPT`, `BSP`, `MACHO`, `HEMBRA` | No | No |

`diametro` y `medida` conviven a proposito: `diametro` guarda la dimension nominal de tuberia y
conexiones (`1/2"`, `3/4"`), y `medida` guarda cualquier otra dimension relevante (`3m`, `2x4`,
`12 AWG`). Ambos son buscables porque el cliente casi siempre pide por medida.

### Categorias sugeridas de FERRETERIA

| Categoria | Subcategorias |
|-----------|---------------|
| Plomeria | Tuberia, Conexiones, Llaves y valvulas, Griferia, Sanitarios |
| Electricidad | Cables, Tomacorrientes e interruptores, Iluminacion, Tuberia y canalizacion, Tableros y breakers |
| Herramientas | Manuales, Electricas, Medicion, Accesorios y brocas |
| Pinturas | Pintura de caucho, Esmaltes, Fondos y bases, Solventes, Accesorios de pintura |
| Ferreteria general | Candados y cerraduras, Cadenas y guayas, Herrajes, Articulos de limpieza |
| Construccion | Cemento y agregados, Bloques y ladrillos, Acero de refuerzo, Impermeabilizantes |
| Adhesivos y sellantes | Pegamentos, Siliconas, Cintas, Masillas |
| Tornilleria | Tornillos, Tuercas y arandelas, Clavos, Anclajes y ramplugs |

### Sinonimos de FERRETERIA

| Texto del cliente | Tipo de destino | Destino |
|-------------------|-----------------|---------|
| `tubo de media` | `TERMINO` | `tubo 1/2"` |
| `pega azul` | `TERMINO` | `pegamento PVC` |
| `cinta de plomero` | `TERMINO` | `teflon` |
| `cable numero 12` | `TERMINO` | `cable 12 AWG` |
| `chaza` | `TERMINO` | `ramplug` |
| `bombillo` | `CATEGORIA` | `Iluminacion` |
| `manguera` | `CATEGORIA` | `Tuberia` |
| `tirro` | `TERMINO` | `cinta adhesiva de papel` |
| `pintura de caucho` | `CATEGORIA` | `Pintura de caucho` |
| `varilla` | `TERMINO` | `cabilla` |

### Documento de FERRETERIA

| Orden | Campo | Etiqueta sugerida |
|-------|-------|-------------------|
| 1 | `ORDEN` | `#` |
| 2 | `DESCRIPCION` | `Descripcion` |
| 3 | `UNIDAD` | `Unidad` |
| 4 | `CANTIDAD` | `Cant.` |
| 5 | `PRECIO_UNITARIO` | `Precio` |
| 6 | `TOTAL_LINEA` | `Total` |

Columna opcional recomendada: `ATRIBUTO` con `atributoCodigo` en `presentacion`, para que quede
explicito si el precio corresponde a la barra, al metro o al rollo.

### Notas del rubro FERRETERIA

- El precio se pide con frecuencia por presentacion distinta a la unidad de venta ("cuanto la barra de
  tubo" contra "cuanto el metro"). Mostrar la unidad en el documento evita reclamos.
- La calidad del reconocimiento depende casi por completo de los alias. El pack aporta el vocabulario
  base; el resto se acumula con los alias `APRENDIDO` de las correcciones del operador.
- Los items son `FUNGIBLE` en practicamente todos los casos. Los servicios de instalacion se cargan
  como `SERVICIO` con unidad `UND`.

## Pack REPUESTOS

Venta de repuestos para vehiculos. El item se identifica por numero de parte y, sobre todo, por el
vehiculo al que aplica.

`usaAplicaciones`: `true`.

### Unidades de medida de REPUESTOS

| Codigo | Nombre | Permite decimales |
|--------|--------|-------------------|
| `UND` | Unidad | No |
| `JGO` | Juego | No |
| `PAR` | Par | No |
| `LT` | Litro | Si |
| `KIT` | Kit | No |

### Definiciones de atributo de REPUESTOS

| Codigo | Etiqueta | Tipo de dato | Opciones | Buscable | Requerido |
|--------|----------|--------------|----------|----------|-----------|
| `numeroParte` | Numero de parte | `TEXTO` | — | Si | No |
| `posicion` | Posicion | `LISTA` | `DELANTERA`, `TRASERA`, `IZQUIERDA`, `DERECHA`, `SUPERIOR`, `INFERIOR` | Si | No |
| `lado` | Lado | `LISTA` | `IZQUIERDO`, `DERECHO`, `AMBOS` | No | No |
| `sistema` | Sistema | `LISTA` | `FRENOS`, `SUSPENSION`, `MOTOR`, `TRANSMISION`, `ELECTRICO`, `ENFRIAMIENTO`, `CARROCERIA` | Si | No |
| `origen` | Origen | `LISTA` | `ORIGINAL`, `ALTERNO`, `GENUINO` | No | No |

`numeroParte` es buscable porque la estrategia 1 de la cascada resuelve por codigo exacto y muchos
clientes pegan el numero de parte tal como lo leyeron. `origen` no es buscable: es un criterio de
eleccion entre candidatos, no de identificacion.

### Categorias sugeridas de REPUESTOS

Las categorias se organizan por sistema del vehiculo, de modo que coincidan con el atributo `sistema`.

| Categoria | Subcategorias |
|-----------|---------------|
| Frenos | Pastillas, Discos y tambores, Bombas y cilindros, Mangueras y liquido |
| Suspension y direccion | Amortiguadores, Rotulas y terminales, Bujes y cauchos, Rolineras |
| Motor | Empacaduras, Correas y tensores, Bombas, Sensores, Sistema de encendido |
| Transmision | Embrague, Cajas y sincronicos, Juntas homocineticas, Aceites de caja |
| Sistema electrico | Baterias, Alternadores y arranques, Iluminacion, Cableado y fusibles |
| Enfriamiento | Radiadores, Termostatos, Ventiladores, Mangueras y refrigerante |
| Carroceria | Parachoques, Faros y luces, Espejos, Vidrios y molduras |
| Filtros y lubricantes | Filtros de aceite, Filtros de aire, Filtros de combustible, Aceites y aditivos |

### Sinonimos de REPUESTOS

| Texto del cliente | Tipo de destino | Destino |
|-------------------|-----------------|---------|
| `pastillas` | `TERMINO` | `pastillas de freno` |
| `bomba de agua` | `TERMINO` | `bomba de agua` |
| `tren delantero` | `CATEGORIA` | `Suspension y direccion` |
| `sincronico` | `TERMINO` | `embrague` |
| `caucho de suspension` | `TERMINO` | `buje de suspension` |
| `rolinera` | `TERMINO` | `rodamiento` |
| `bujia` | `CATEGORIA` | `Sistema de encendido` |
| `correa de tiempo` | `TERMINO` | `correa de distribucion` |
| `guaya de freno` | `TERMINO` | `cable de freno de mano` |

### Documento de REPUESTOS

| Orden | Campo | Etiqueta sugerida | Nota |
|-------|-------|-------------------|------|
| 1 | `ORDEN` | `#` | — |
| 2 | `SKU` | `Codigo` | — |
| 3 | `DESCRIPCION` | `Repuesto` | — |
| 4 | `MARCA` | `Marca` | — |
| 5 | `ATRIBUTO` | `N. parte` | `atributoCodigo` en `numeroParte` |
| 6 | `CANTIDAD` | `Cant.` | — |
| 7 | `PRECIO_UNITARIO` | `Precio` | — |
| 8 | `TOTAL_LINEA` | `Total` | — |

### El papel de las aplicaciones en REPUESTOS

Este es el unico vertical del MVP que se apoya en `item_aplicaciones`, y es la pieza que permite
resolver un pedido como "pastillas del corolla 2015". El texto del cliente trae dos cosas distintas:
el repuesto y el vehiculo. El repuesto se resuelve contra `items.textoBusqueda` y los alias; el
vehiculo se resuelve contra `item_aplicaciones.textoNormalizado`.

Estructura recomendada del documento `item_aplicaciones.datos`:

```typescript
// Validado con un esquema Zod propio del vertical, no con las definiciones de atributo.
type AplicacionVehiculo = {
  marca: string;        // TOYOTA
  modelo: string;       // COROLLA
  anioDesde: number;    // 2014
  anioHasta: number;    // 2019
  motor?: string;       // 1.8L
};
```

`textoNormalizado` se deriva de ese documento con la misma funcion `normalizarTexto` que normaliza la
solicitud, y se indexa con GIN de trigramas. Sin esa columna, "corolla 2015" no encuentra un registro
cuyo rango es 2014 a 2019.

| Sin aplicaciones cargadas | Con aplicaciones cargadas |
|---------------------------|---------------------------|
| "pastillas del corolla 2015" resuelve, en el mejor caso, a "pastillas de freno" genericas | Resuelve al item cuyo rango de años cubre 2015 para ese modelo |
| Varios candidatos con puntaje casi identico, empate y revision manual | Un candidato claramente por delante |
| El operador elige el repuesto correcto de memoria | El sistema propone y el operador confirma |

Por eso el pack `REPUESTOS` declara `usaAplicaciones` en verdadero y la importacion de catalogo del
rubro debe contemplar la carga de aplicaciones desde el inicio, no como paso posterior.

## Pack AUTOMOTRIZ

Venta de vehiculos. Cada item es una unidad unica, identificada por su VIN, y la cotizacion tiene una
o muy pocas lineas.

`usaAplicaciones`: `false`. Un vehiculo no es compatible con nada: es la cosa vendida.

### Unidades de medida de AUTOMOTRIZ

| Codigo | Nombre | Permite decimales |
|--------|--------|-------------------|
| `UND` | Unidad | No |
| `SERV` | Servicio | No |

`SERV` se usa para lineas de gestion documental, traspaso o preparacion, cargadas como items de tipo
`SERVICIO`.

### Definiciones de atributo de AUTOMOTRIZ

| Codigo | Etiqueta | Tipo de dato | Opciones | Buscable | Requerido |
|--------|----------|--------------|----------|----------|-----------|
| `vin` | VIN | `TEXTO` | — | Si | Si |
| `anio` | Año | `ENTERO` | — | Si | No |
| `kilometraje` | Kilometraje | `ENTERO` | — | No | No |
| `transmision` | Transmision | `LISTA` | `AUTOMATICA`, `SINCRONICA` | No | No |
| `combustible` | Combustible | `LISTA` | `GASOLINA`, `DIESEL`, `GAS`, `HIBRIDO`, `ELECTRICO` | No | No |
| `traccion` | Traccion | `LISTA` | `4X2`, `4X4`, `AWD` | No | No |
| `color` | Color | `TEXTO` | — | No | No |
| `condicion` | Condicion | `LISTA` | `NUEVO`, `USADO` | No | No |

`vin` es el unico atributo requerido de todos los packs. Es la identificacion real de la unidad y sin
el no se puede emitir un documento serio. `kilometraje` usa `unidadSugerida` con valor `KM`.

### Categorias sugeridas de AUTOMOTRIZ

| Categoria | Subcategorias |
|-----------|---------------|
| Vehiculos nuevos | Sedan, SUV y camioneta, Pick-up, Comercial |
| Vehiculos usados | Sedan, SUV y camioneta, Pick-up, Comercial |
| Accesorios | Seguridad, Confort, Estetica |
| Servicios | Gestion documental, Traspaso, Preparacion y entrega |

### Sinonimos de AUTOMOTRIZ

| Texto del cliente | Tipo de destino | Destino |
|-------------------|-----------------|---------|
| `carro nuevo` | `CATEGORIA` | `Vehiculos nuevos` |
| `camioneta` | `CATEGORIA` | `SUV y camioneta` |
| `automatico` | `TERMINO` | `transmision automatica` |
| `sincronico` | `TERMINO` | `transmision sincronica` |
| `4x4` | `TERMINO` | `traccion 4X4` |
| `full equipo` | `TERMINO` | `equipamiento completo` |
| `papeles al dia` | `CATEGORIA` | `Gestion documental` |

### Documento de AUTOMOTRIZ

| Orden | Campo | Etiqueta sugerida | Nota |
|-------|-------|-------------------|------|
| 1 | `ORDEN` | `#` | — |
| 2 | `DESCRIPCION` | `Vehiculo` | — |
| 3 | `ATRIBUTO` | `VIN` | `atributoCodigo` en `vin` |
| 4 | `ATRIBUTO` | `Año` | `atributoCodigo` en `anio` |
| 5 | `CANTIDAD` | `Cant.` | — |
| 6 | `PRECIO_UNITARIO` | `Precio` | — |
| 7 | `TOTAL_LINEA` | `Total` | — |

Que el VIN y el año se muestren con columnas de tipo `ATRIBUTO` es exactamente el caso que justifica
ese campo en `decisions/0006-plantillas-de-documento.md`: el enumerado de columnas no crece por rubro,
y aun asi un concesionario obtiene el documento que necesita.

### Notas del rubro AUTOMOTRIZ

- Los items se cargan como `SERIALIZADO`. Por la regla 13 de `docs/06-diseno-tecnico.md`, la cantidad
  maxima cotizable de un item `SERIALIZADO` es uno. La interfaz debe fijar la cantidad en 1 y no
  permitir editarla en esas lineas.
- Un item vendido no se borra: pasa a `estadoRegistro` `INACTIVO` y permanece intacto en las
  cotizaciones historicas.
- La vigencia predeterminada del rubro es mas larga que en ferreteria, porque la decision de compra
  toma dias, no horas.
- El impuesto se configura activo con mayor frecuencia que en los otros rubros, y suele venir
  desglosado en el documento.

## Pack GENERICO

Minimo viable para cualquier negocio con catalogo que no encaje en los rubros anteriores. Existe para
que registrar una organizacion nunca dependa de escribir un pack nuevo.

`usaAplicaciones`: `false`.

### Unidades de medida de GENERICO

| Codigo | Nombre | Permite decimales |
|--------|--------|-------------------|
| `UND` | Unidad | No |
| `M` | Metro | Si |
| `KG` | Kilogramo | Si |
| `LT` | Litro | Si |

### Definiciones de atributo de GENERICO

| Codigo | Etiqueta | Tipo de dato | Opciones | Buscable | Requerido |
|--------|----------|--------------|----------|----------|-----------|
| `modelo` | Modelo | `TEXTO` | — | Si | No |
| `presentacion` | Presentacion | `TEXTO` | — | No | No |

No se precargan mas atributos. La marca no es atributo: es la tabla `marcas` y la columna
`items.marcaId` del nucleo fijo, disponible en todos los verticales. La organizacion agrega sus propias
definiciones de atributo desde `catalogo.maestras.administrar` cuando descubre que las necesita.

### Categorias sugeridas de GENERICO

| Categoria | Subcategorias |
|-----------|---------------|
| Productos | Sin clasificar |
| Servicios | Sin clasificar |

### Sinonimos de GENERICO

Ninguno. No hay vocabulario de rubro que precargar. El reconocimiento arranca con el nombre del item y
crece con los alias que cargue la organizacion o que se aprendan de las correcciones.

### Documento de GENERICO

| Orden | Campo | Etiqueta sugerida |
|-------|-------|-------------------|
| 1 | `ORDEN` | `#` |
| 2 | `DESCRIPCION` | `Descripcion` |
| 3 | `CANTIDAD` | `Cant.` |
| 4 | `PRECIO_UNITARIO` | `Precio` |
| 5 | `TOTAL_LINEA` | `Total` |

## Configuracion de cotizacion por pack

Valores iniciales que cada pack copia a `configuraciones_cotizacion`. Todos son editables por la
organizacion despues del provisionamiento.

| Campo | `FERRETERIA` | `REPUESTOS` | `AUTOMOTRIZ` | `GENERICO` |
|-------|--------------|-------------|--------------|------------|
| `vigenciaHorasPredeterminada` | 48 | 72 | 168 | 48 |
| `aplicaImpuesto` | `false` | `false` | `true` | `false` |
| `porcentajeImpuesto` | `0.0000` | `0.0000` | `16.0000` | `0.0000` |
| `preciosIncluyenImpuesto` | `false` | `false` | `false` | `false` |
| `decimalesRedondeo` | 2 | 2 | 2 | 2 |
| `modoRedondeo` | `NORMAL` | `NORMAL` | `NORMAL` | `NORMAL` |
| `mostrarDescuentoDetallado` | `true` | `true` | `false` | `true` |
| `permiteSobrescribirPrecio` | `true` | `true` | `true` | `true` |

`listaPrecioPredeterminadaId` no lo declara el pack: se resuelve durante el provisionamiento, cuando ya
existe la lista de precios creada en la misma transaccion.

## Agregar un vertical nuevo

Agregar un rubro es agregar datos. Si algun paso exige tocar logica de negocio, el diseño esta mal y
hay que revisar que definicion de configuracion falta.

| Paso | Accion | Archivo o tabla |
|------|--------|-----------------|
| 1 | Escribir la semilla del pack con el tipo `PackVertical` | `packages/database/src/seeds/verticales/<codigo>.ts` |
| 2 | Registrar el pack en el mapa de packs disponibles | `packages/database/src/seeds/verticales/index.ts` |
| 3 | Insertar la fila del rubro en el catalogo global, de forma idempotente | Tabla `verticales` desde el seed de plataforma |
| 4 | Agregar la migracion del enumerado solo si el codigo de vertical se modela como tipo `enum` de PostgreSQL en alguna columna | `packages/database/src/migrations/` |
| 5 | Probar el provisionamiento completo creando una organizacion del vertical nuevo | Prueba de integracion sobre `POST /api/organizaciones` |
| 6 | Verificar que la organizacion queda operativa: puede crear un item, ponerle precio y cotizarlo | Prueba manual o de integracion |

Sobre el paso 4: el modelo actual declara el rubro como fila del catalogo `verticales` y la
organizacion lo referencia con `organizaciones.verticalId`, por lo que normalmente basta insertar la
fila. La migracion de enumerado solo aplica si en el futuro se introduce una columna de tipo `enum` con
los codigos de vertical.

### Regla de no ramificacion

```typescript
// Prohibido. Si esto aparece en una revision de codigo, se rechaza.
if (organizacion.vertical.codigo === 'REPUESTOS') {
  mostrarSeccionAplicaciones();
}

// Correcto. El comportamiento se decide con datos de la organizacion.
if (organizacion.usaAplicaciones) {
  mostrarSeccionAplicaciones();
}
```

Ninguna regla de negocio, ningun servicio y ninguna pantalla consulta el codigo del vertical para
decidir que hacer. El codigo del vertical se usa en dos lugares y solo en dos: al elegir el pack
durante el provisionamiento, y como dato informativo en la ficha de la organizacion.

## Provisionamiento

El provisionamiento se ejecuta al crear la organizacion, dentro de `POST /api/organizaciones`, con el
permiso `plataforma.organizaciones.crear`. Es una sola transaccion.

### Orden de la transaccion

| Paso | Tabla | Contenido | Dependencia |
|------|-------|-----------|-------------|
| 1 | `organizaciones` | Datos del negocio, `verticalId`, `monedaBaseId`, `zonaHoraria`, `locale`, `usaIa`, `umbralAutomatico` en `0.8000`, `umbralDescarte` en `0.4500` | — |
| 2 | `sucursales` | Sucursal principal con `esPrincipal` en verdadero | Paso 1 |
| 3 | `unidades_medida` | Una fila por cada `PackUnidadMedida` | Paso 1 |
| 4 | `definiciones_atributo` | Una fila por cada `PackDefinicionAtributo`, con sus `opciones` | Paso 1 |
| 5 | `categorias` | Primero las categorias raiz, luego las subcategorias con su `categoriaPadreId` | Paso 1 |
| 6 | `listas_precio` | Lista predeterminada con `esPredeterminada` en verdadero y `monedaId` igual a la moneda base | Paso 1 |
| 7 | `configuraciones_cotizacion` | El `PackConfiguracionCotizacion` mas `listaPrecioPredeterminadaId` del paso 6 | Pasos 1 y 6 |
| 8 | `plantillas_documento` | `PackPlantillaDocumento` mas el bloque `identidad` derivado de la organizacion, `version` en 1, `esPredeterminada` en verdadero | Paso 1 |

El bloque `identidad` de la plantilla se completa con los datos ya cargados de la organizacion:
`nombreComercial` desde `organizaciones.nombre`, `razonSocial`, `identificacionFiscal`, `direccion`,
`telefonos`, `email` y `logoUrl` desde sus columnas equivalentes. Si un dato falta, el campo queda
ausente y la organizacion lo completa desde `plantillas.administrar`.

### Los sinonimos del pack no se materializan

`item_alias` exige `itemId` y al provisionar la organizacion todavia no tiene items. Por lo tanto los
sinonimos del pack **no** producen filas en el provisionamiento. Su uso previsto es:

1. Sugerir alias al crear o editar un item cuyo nombre o categoria coincide con el destino del
   sinonimo.
2. Alimentar la plantilla de importacion de alias, para que la organizacion cargue de una vez el
   vocabulario del rubro junto con su catalogo.
3. Servir de referencia al revisar `terminos_no_resueltos`.

Esto deja una pregunta abierta, registrada al final de este documento.

### Idempotencia

El provisionamiento se puede reejecutar sobre la misma organizacion sin duplicar datos ni pisar
cambios de la organizacion.

| Tabla | Clave de idempotencia | Comportamiento si ya existe |
|-------|-----------------------|-----------------------------|
| `sucursales` | (`organizacionId`, `nombre`) | No se toca |
| `unidades_medida` | (`organizacionId`, `codigo`) | No se toca |
| `definiciones_atributo` | (`organizacionId`, `codigo`) | No se toca |
| `categorias` | (`organizacionId`, `categoriaPadreId`, `nombre`) | No se toca |
| `listas_precio` | (`organizacionId`, `codigo`) | No se toca |
| `configuraciones_cotizacion` | `organizacionId` | No se toca |
| `plantillas_documento` | (`organizacionId`, `esPredeterminada`) | No se toca |

Regla: **no actualizar nunca**. Si la fila existe se omite, porque puede haber sido editada por la
organizacion y el provisionamiento no tiene autoridad sobre sus datos.

### Atomicidad

La transaccion es todo o nada. Si cualquiera de los ocho pasos falla, se revierte completa y no queda
ninguna organizacion a medio provisionar. Una organizacion sin sucursal, sin unidades o sin lista de
precios no es operativa y no debe existir en la base de datos.

Consecuencia para la API: el error se responde con el codigo correspondiente al fallo (409 si es
conflicto de unicidad, 422 si es una regla de negocio incumplida) y la organizacion no se crea. No hay
estado intermedio que reparar a mano.

### Prueba de aceptacion del provisionamiento

Segun `docs/05-alcance-mvp.md`, el criterio es que una organizacion nueva de cualquier vertical quede
operativa sin intervencion manual en base de datos. La prueba minima:

```text
1. Crear la organizacion del vertical X con moneda base USD.
2. Verificar que existe una sucursal principal.
3. Verificar que existen todas las unidades del pack con su `permiteDecimales`.
4. Verificar que existen todas las definiciones de atributo con sus opciones.
5. Verificar que existen las categorias y que cada subcategoria apunta a su padre.
6. Verificar que existe una lista de precios predeterminada en moneda base.
7. Verificar que existe la configuracion de cotizacion apuntando a esa lista.
8. Verificar que existe la plantilla predeterminada, version 1, con identidad completada.
9. Crear un item, asignarle precio y generar una cotizacion manual de una linea.
```

## Preguntas abiertas

| Tema | Pregunta | Impacto |
|------|----------|---------|
| Persistencia de sinonimos | `docs/06-diseno-tecnico.md` no define una tabla donde guardar los sinonimos del pack por organizacion. ¿Se agrega una tabla de sugerencias o los sinonimos quedan solo en codigo como insumo del importador y de la interfaz de alias? | Sin tabla, la organizacion no puede editar ni ampliar el vocabulario sugerido del rubro |
| `usaAplicaciones` | No existe columna en `organizaciones` que lo represente. Derivarlo del vertical viola la regla de no ramificacion, por lo que la opcion coherente es una columna booleana propia | La interfaz necesita el dato para decidir si muestra la seccion de compatibilidades del item |
| Tipo de item predeterminado | El pack `AUTOMOTRIZ` requiere que los items nuevos nazcan como `SERIALIZADO`, pero no hay donde guardar ese valor: no esta en `configuraciones_cotizacion` ni en `organizaciones` | Sin el dato, la interfaz no puede preseleccionar el tipo y el operador debe elegirlo en cada item |
| Validacion del documento de aplicaciones | El esquema de `item_aplicaciones.datos` no esta definido en el modelo de datos. Se propone un esquema Zod fijo con `marca`, `modelo`, `anioDesde`, `anioHasta` y `motor` | Sin esquema declarado, cada importacion podria guardar claves distintas y `textoNormalizado` se vuelve inconsistente |

## Documentos relacionados

- `decisions/0002-catalogo-generico-por-vertical.md` — por que los packs se materializan por copia.
- `decisions/0006-plantillas-de-documento.md` — esquema completo de la plantilla de documento.
- `decisions/0007-estrategia-de-matching.md` — como se usan los alias y el texto de busqueda.
- `docs/04-flujo-precotizacion.md` — normalizacion y resolucion en detalle.
- `docs/06-diseno-tecnico.md` — modelo de datos, permisos y contratos de API.

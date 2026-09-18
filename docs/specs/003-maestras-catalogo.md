# Spec 003: Maestras de catalogo

## Estado

En implementacion — rama `feature/spec-003-maestras-catalogo` (sobre ABM usuarios)

## Objetivo

Definir la administracion de las maestras del catalogo de una organizacion: unidades de medida,
categorias con un solo nivel de jerarquia, marcas y definiciones de atributo. Estas maestras son el
suelo sobre el que se construyen los items: sin unidades no hay item cotizable, sin definiciones no
hay atributos validables, y sin categorias ni marcas la busqueda y las reglas de descuento pierden
segmentacion.

Las maestras nacen del pack de vertical en el provisionamiento y, a partir de ese momento, la
organizacion es dueña de ellas: puede agregar, editar, reordenar e inactivar sin que el pack vuelva
a imponer nada. Ninguna regla de este modulo ramifica por vertical.

## Dependencias

| Documento | Que aporta |
|-----------|-----------|
| `docs/06-diseno-tecnico.md` | Tablas `unidades_medida`, `categorias`, `marcas`, `definiciones_atributo`, permisos y rutas |
| `docs/03-verticales-y-packs.md` | Contenido concreto de cada pack y reglas de materializacion por copia |
| `docs/decisions/0002-catalogo-generico-por-vertical.md` | Nucleo fijo mas atributos JSON y packs materializados |
| `docs/decisions/0001-multi-tenancy-por-organizacion.md` | Aislamiento por organizacion y respuesta de no encontrado |
| `docs/specs/000-plataforma-organizaciones.md` | Provisionamiento que copia el pack a las maestras |
| `docs/specs/004-catalogo-items.md` | Consumidor de las maestras al crear y editar items |

Esta especificacion es consumida por `docs/specs/004-catalogo-items.md`,
`docs/specs/005-importacion-catalogo.md` y `docs/specs/006-listas-precios-reglas.md`.

## Alcance MVP v1

Incluye:

- Consulta, alta, edicion e inactivacion de unidades de medida.
- Consulta, alta, edicion, reorden e inactivacion de categorias raiz y subcategorias (un solo nivel).
- Consulta, alta, edicion e inactivacion de marcas.
- Consulta, alta, edicion e inactivacion de definiciones de atributo, con tipos de dato cerrados.
- Inmutabilidad del `tipoDato` de una definicion una vez que algun item la usa.
- Proteccion `MAESTRA_EN_USO` al inactivar una maestra referenciada por items activos.
- Lectura de lo materializado por el pack de vertical como punto de partida editable.

No incluye en esta version:

| Fuera de alcance | Motivo |
|------------------|--------|
| Jerarquia de categorias de mas de un nivel | Restriccion del modelo: `categoriaPadreId` no acepta mas profundidad |
| Propagacion retroactiva de cambios del pack | El pack no manda despues del provisionamiento; ver `docs/03-verticales-y-packs.md` |
| Borrado fisico de maestras | Prohibido en datos de negocio |
| Conversion entre unidades de medida | No hay caso de uso validado en el piloto |
| Atributos compuestos o anidados | El documento `items.atributos` es plano |
| Administracion de sinonimos del pack como filas editables | Pregunta abierta en `docs/03-verticales-y-packs.md` |
| Items, alias, aplicaciones, precios e importacion | Pertenecen a las specs 004, 005 y 006 |

## Conceptos principales

| Concepto | Definicion operativa |
|----------|----------------------|
| Unidad de medida | Codigo y nombre con los que se cotiza un item. Declara si admite cantidades decimales |
| Categoria | Clasificacion del catalogo con un solo nivel de padre. Unica por (`organizacionId`, `categoriaPadreId`, `nombre`) |
| Marca | Nombre comercial asociado a items. Unica por (`organizacionId`, `nombre`) |
| Definicion de atributo | Descripcion de un atributo disponible: `codigo`, `etiqueta`, `tipoDato`, `opciones`, `requerido`, `usarEnBusqueda`, `orden` |
| Pack de vertical | Semilla en codigo que se copia a las maestras al crear la organizacion. Despues no tiene autoridad |
| Maestra en uso | Situacion en la que una maestra esta referenciada por al menos un item activo y no puede inactivarse sin resolverlo |
| Estado de registro | `ACTIVO` o `INACTIVO`. Reemplaza el borrado fisico |

### Relacion con el pack

Al provisionar la organizacion se copian unidades, definiciones y categorias del pack. Las marcas no
vienen del pack: la organizacion las crea segun su catalogo. Los sinonimos del pack no se materializan
como filas propias; alimentan sugerencias de alias e importacion, segun `docs/03-verticales-y-packs.md`.

## Datos requeridos

### Tabla `unidades_medida`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Tomado del `OrgContext`, nunca de la entrada |
| `codigo` | Si | Sin acentos, mayusculas, 1 a 10 caracteres. Unico por organizacion |
| `nombre` | Si | Entre 2 y 60 caracteres |
| `permiteDecimales` | Si | Booleano. Determina si las cantidades cotizadas pueden ser fraccionarias |
| `estadoRegistro` | Si | `ACTIVO` al crear. Baja por inactivacion |
| `createdAt`, `updatedAt`, `createdById`, `updatedById` | Si | Auditoria estandar |

### Tabla `categorias`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Del contexto |
| `nombre` | Si | Entre 2 y 80 caracteres. Unico con el padre dentro de la organizacion |
| `categoriaPadreId` | No | Nulo en categorias raiz. Si se informa, debe ser una categoria raiz activa de la misma organizacion |
| `orden` | Si | Entero no negativo. Orden de presentacion entre hermanas |
| `estadoRegistro` | Si | `ACTIVO` al crear |
| `createdAt`, `updatedAt`, `createdById`, `updatedById` | Si | Auditoria estandar |

Unicidad: (`organizacionId`, `categoriaPadreId`, `nombre`). Dos subcategorias de padres distintos
pueden llamarse igual.

### Tabla `marcas`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Del contexto |
| `nombre` | Si | Entre 2 y 80 caracteres. Unico por organizacion. Comparacion sin distinguir mayusculas |
| `estadoRegistro` | Si | `ACTIVO` al crear |
| `createdAt`, `updatedAt`, `createdById`, `updatedById` | Si | Auditoria estandar |

### Tabla `definiciones_atributo`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Del contexto |
| `codigo` | Si | Sin acentos, minusculas camel o snake, 1 a 40 caracteres. Unico por organizacion. Es la clave de `items.atributos` |
| `etiqueta` | Si | Texto visible en la interfaz, 2 a 80 caracteres |
| `tipoDato` | Si | `TEXTO`, `NUMERO`, `ENTERO`, `BOOLEANO`, `LISTA` o `RANGO_ANIO` |
| `opciones` | Si cuando `LISTA` | Arreglo JSON de cadenas no vacias, al menos una. Nulo en los demas tipos |
| `unidadSugerida` | No | Texto corto de ayuda, por ejemplo `KM` |
| `requerido` | Si | Booleano. Si es verdadero, el item debe informar la clave al guardar |
| `usarEnBusqueda` | Si | Booleano. Si es verdadero, el valor entra en `items.textoBusqueda` |
| `orden` | Si | Entero no negativo. Orden de presentacion en la ficha del item |
| `estadoRegistro` | Si | `ACTIVO` al crear |
| `createdAt`, `updatedAt`, `createdById`, `updatedById` | Si | Auditoria estandar |

### Tipos de dato admitidos

| `tipoDato` | `opciones` | Uso tipico |
|------------|------------|------------|
| `TEXTO` | No | Diametro, medida, color libre |
| `NUMERO` | No | Valores decimales persistidos como cadena |
| `ENTERO` | No | Año, kilometraje, piezas |
| `BOOLEANO` | No | Indicadores si/no estrictos |
| `LISTA` | Obligatorio, cerrado | Material, posicion, origen |
| `RANGO_ANIO` | No | Rango de años del propio item, no compatibilidad de vehiculo |

La compatibilidad de un item con vehiculos **no** es una definicion de atributo: vive en
`item_aplicaciones`, segun `docs/specs/004-catalogo-items.md` y `docs/03-verticales-y-packs.md`.

## Reglas de negocio

### Alcance y aislamiento

1. Toda operacion exige `ctx.organizacionId` no nulo y filtra exclusivamente por esa organizacion.
2. Un identificador de maestra ajeno responde 404 con el codigo de no encontrado correspondiente,
   nunca 403.
3. Un usuario de ambito `PLATAFORMA` recibe error de contexto de organizacion.
4. La lectura exige `catalogo.maestras.ver`; la escritura exige `catalogo.maestras.administrar`.

### Unidades de medida

5. El `codigo` se normaliza a mayusculas, sin acentos y sin espacios antes de validar unicidad.
6. El `codigo` es unico por organizacion, incluidos los registros inactivos.
7. `permiteDecimales` se puede cambiar mientras la unidad no este en uso por items activos. Si esta
   en uso, el cambio responde 422 con `MAESTRA_EN_USO` y el detalle indica cuantos items la
   referencian, porque cambiarlo alteraria la validacion de cantidades ya cotizables.
8. Inactivar una unidad en uso por al menos un item activo responde 422 con `MAESTRA_EN_USO`.
9. Una unidad inactiva no se puede asignar a items nuevos. Los items que ya la tenian la conservan.
10. No hay borrado fisico.

### Categorias

11. Solo se admite un nivel de jerarquia: una categoria con padre no puede ser padre de otra. Intentar
    crear o mover una subcategoria bajo otra subcategoria responde 422 con
    `CATEGORIA_PROFUNDIDAD_EXCEDIDA`.
12. `categoriaPadreId`, cuando se informa, debe referenciar una categoria raiz activa de la misma
    organizacion. Una referencia ajena o a una subcategoria responde 404 o 422 segun el caso.
13. El nombre es unico dentro del mismo padre (o entre raices cuando el padre es nulo). La
    comparacion no distingue mayusculas.
14. `orden` determina la presentacion entre hermanas. Dos hermanas pueden compartir orden; el
    desempate es por nombre ascendente.
15. Inactivar una categoria raiz inactiva en cascada logica sus subcategorias solo para selectores:
    las subcategorias conservan su propio `estadoRegistro`, pero una raiz inactiva no aparece ni
    ofrece hijas en los selectores de alta de items.
16. Inactivar una categoria referenciada por al menos un item activo responde 422 con
    `MAESTRA_EN_USO`. El detalle enumera la cantidad de items y, si aplica, de subcategorias activas.
17. Mover una subcategoria a otra raiz valida unicidad de nombre bajo el nuevo padre.
18. Cambiar el nombre de una categoria regenera `textoBusqueda` de los items activos que la
    referencian, segun `docs/specs/004-catalogo-items.md`.

### Marcas

19. El nombre es unico por organizacion sin distinguir mayusculas, incluidos inactivos.
20. Inactivar una marca en uso por items activos responde 422 con `MAESTRA_EN_USO`.
21. Cambiar el nombre regenera `textoBusqueda` de los items activos que la referencian.
22. Una marca inactiva no se asigna a items nuevos.

### Definiciones de atributo

23. El `codigo` se normaliza: minusculas, sin acentos, sin espacios. Es unico por organizacion,
    incluidos inactivos. Una vez creado, el `codigo` **no se puede cambiar**.
24. `tipoDato` es un enumerado cerrado. Cualquier otro valor es error 400 de forma.
25. Cuando `tipoDato` es `LISTA`, `opciones` es obligatorio, no vacio, sin duplicados y con cadenas
    de 1 a 60 caracteres. En cualquier otro tipo, `opciones` debe ser nulo o ausente.
26. **Inmutabilidad del tipo en uso:** si al menos un item (activo o inactivo) tiene la clave del
    `codigo` en su documento `atributos`, el `tipoDato` no se puede cambiar. La respuesta es 422 con
    `DEFINICION_TIPO_INMUTABLE`.
27. Mientras ningun item use la clave, el `tipoDato` si se puede cambiar. Cambiar de o hacia `LISTA`
    exige ajustar `opciones` en la misma operacion.
28. Se pueden agregar opciones nuevas a una `LISTA` en uso. Quitar una opcion que algun item ya
    tiene como valor responde 422 con `DEFINICION_OPCION_EN_USO` y el detalle indica cuantos items
    la usan.
29. Cambiar `requerido` de falso a verdadero no invalida items existentes de inmediato; la
    validacion se aplica en la proxima edicion del item. La interfaz advierte el efecto.
30. Cambiar `usarEnBusqueda` regenera `textoBusqueda` de los items activos que incluyen ese codigo,
    segun la tabla de eventos de `docs/specs/004-catalogo-items.md`.
31. Inactivar una definicion en uso (clave presente en atributos de items activos) responde 422 con
    `MAESTRA_EN_USO`. Alternativa: el administrador puede dejarla activa y no requerida.
32. Una definicion inactiva no participa en la validacion de altas nuevas ni en `textoBusqueda`. Los
    items que ya tenian el valor lo conservan, segun `docs/specs/004-catalogo-items.md`.
33. El `orden` controla la presentacion en la ficha del item.

### Proteccion `MAESTRA_EN_USO`

34. Se considera en uso una unidad, categoria, marca o definicion referenciada por al menos un item
    con `estadoRegistro` `ACTIVO` de la misma organizacion. Para definiciones, la referencia es la
    presencia de la clave en `items.atributos`.
35. El codigo de error es siempre `MAESTRA_EN_USO`. El `details` discrimina el tipo de maestra, el
    identificador y el conteo de items afectados.
36. Reactivar una maestra inactiva esta permitido y vuelve a validar unicidad.

### Pack de vertical

37. Las filas creadas por el provisionamiento son editables e inactivables con las mismas reglas que
    las creadas a mano. No hay marca de "origen pack" en el modelo.
38. Ninguna operacion de este modulo consulta el codigo del vertical para decidir comportamiento.

## Permisos

| Permiso | Uso en esta spec |
|---------|------------------|
| `catalogo.maestras.ver` | Listar y ver unidades, categorias, marcas y definiciones |
| `catalogo.maestras.administrar` | Crear, editar, reordenar e inactivar maestras |

El perfil `Administrador Organizacion` tiene `catalogo.*`. El perfil `Cotizador` tiene
`catalogo.maestras.ver` y puede consultar maestras para filtrar y entender atributos, pero no
administrarlas.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/unidades-medida` | `catalogo.maestras.ver` | Listado con filtro de estado |
| POST | `/api/unidades-medida` | `catalogo.maestras.administrar` | Alta |
| PATCH | `/api/unidades-medida/:id` | `catalogo.maestras.administrar` | Edicion e inactivacion |
| GET | `/api/categorias` | `catalogo.maestras.ver` | Arbol o listado plano con padre |
| POST | `/api/categorias` | `catalogo.maestras.administrar` | Alta de raiz o subcategoria |
| PATCH | `/api/categorias/:id` | `catalogo.maestras.administrar` | Edicion, reorden e inactivacion |
| GET | `/api/marcas` | `catalogo.maestras.ver` | Listado con busqueda |
| POST | `/api/marcas` | `catalogo.maestras.administrar` | Alta |
| PATCH | `/api/marcas/:id` | `catalogo.maestras.administrar` | Edicion e inactivacion |
| GET | `/api/definiciones-atributo` | `catalogo.maestras.ver` | Listado ordenado |
| POST | `/api/definiciones-atributo` | `catalogo.maestras.administrar` | Alta |
| PATCH | `/api/definiciones-atributo/:id` | `catalogo.maestras.administrar` | Edicion e inactivacion |

Las rutas figuran de forma agrupada en `docs/06-diseno-tecnico.md` como
`GET/POST/PATCH` sobre `/api/categorias`, `/api/marcas`, `/api/unidades-medida` y
`/api/definiciones-atributo` con permisos `catalogo.maestras.*`. Esta spec las detalla.

```typescript
// POST /api/unidades-medida
type CrearUnidadMedidaInput = {
  codigo: string;              // se normaliza a mayusculas
  nombre: string;
  permiteDecimales: boolean;
};

// POST /api/categorias
type CrearCategoriaInput = {
  nombre: string;
  categoriaPadreId?: string;   // ausente o nulo = raiz
  orden?: number;              // por defecto al final
};

// POST /api/marcas
type CrearMarcaInput = {
  nombre: string;
};

// POST /api/definiciones-atributo
type CrearDefinicionAtributoInput = {
  codigo: string;
  etiqueta: string;
  tipoDato: 'TEXTO' | 'NUMERO' | 'ENTERO' | 'BOOLEANO' | 'LISTA' | 'RANGO_ANIO';
  opciones?: string[];         // obligatorio si tipoDato es LISTA
  unidadSugerida?: string;
  requerido: boolean;
  usarEnBusqueda: boolean;
  orden?: number;
};

// PATCH generico de maestra (campos opcionales segun recurso)
type EditarMaestraEstadoInput = {
  estadoRegistro?: 'ACTIVO' | 'INACTIVO';
};
```

Los listados aceptan `page`, `limit`, `search` y `estadoRegistro` segun las convenciones de
`docs/06-diseno-tecnico.md`. El listado de categorias admite `soloRaices=true` y `padreId`.

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `VALIDACION_ENTRADA_INVALIDA` | Forma invalida: codigo fuera de rango, opciones vacias en no-LISTA, etc. |
| `PERMISO_DENEGADO` | Falta `catalogo.maestras.ver` o `catalogo.maestras.administrar` |
| `CONTEXTO_ORGANIZACION_REQUERIDO` | Usuario de ambito plataforma sin organizacion |
| `UNIDAD_MEDIDA_NO_ENCONTRADA` | Identificador inexistente o de otra organizacion |
| `UNIDAD_MEDIDA_CODIGO_DUPLICADO` | Codigo ya usado en la organizacion |
| `CATEGORIA_NO_ENCONTRADA` | Identificador inexistente o ajeno |
| `CATEGORIA_NOMBRE_DUPLICADO` | Nombre repetido bajo el mismo padre |
| `CATEGORIA_PROFUNDIDAD_EXCEDIDA` | Se intenta anidar mas de un nivel |
| `CATEGORIA_PADRE_INVALIDO` | El padre es una subcategoria o esta inactivo |
| `MARCA_NO_ENCONTRADA` | Identificador inexistente o ajeno |
| `MARCA_NOMBRE_DUPLICADO` | Nombre ya usado en la organizacion |
| `DEFINICION_ATRIBUTO_NO_ENCONTRADA` | Identificador inexistente o ajeno |
| `DEFINICION_CODIGO_DUPLICADO` | Codigo ya usado en la organizacion |
| `DEFINICION_CODIGO_INMUTABLE` | Se intenta cambiar el `codigo` de una definicion existente |
| `DEFINICION_TIPO_INMUTABLE` | Se intenta cambiar `tipoDato` estando la clave en uso por items |
| `DEFINICION_OPCIONES_REQUERIDAS` | `LISTA` sin opciones validas |
| `DEFINICION_OPCION_EN_USO` | Se intenta quitar una opcion presente en items |
| `MAESTRA_EN_USO` | Inactivacion o cambio incompatible mientras hay items activos que la referencian |

Estados HTTP segun `docs/06-diseno-tecnico.md`: 400 forma, 403 permiso, 404 no encontrado o ajeno,
409 duplicados, 422 reglas de negocio.

## Experiencia de usuario

Las maestras viven bajo `/catalogo/maestras` con pestañas: Unidades, Categorias, Marcas y Atributos.
Solo usuarios con `catalogo.maestras.*` ven la seccion de administracion; el cotizador consulta
maestras embebidas en selectores del catalogo de items.

### Patron ABM comun

Tabla con buscador, filtro por estado, paginacion, accion primaria de crear y acciones por fila de
editar e inactivar o reactivar. No se ofrece eliminar.

| Situacion | Comportamiento de interfaz |
|-----------|----------------------------|
| Inactivar maestra en uso | Dialogo bloqueante que muestra el conteo de items y no permite continuar |
| Cambiar `permiteDecimales` en uso | Mismo bloqueo con explicacion |
| Cambiar `tipoDato` en uso | Campo deshabilitado con texto: el tipo no se puede cambiar porque hay items que usan este atributo |
| Quitar opcion de lista en uso | La opcion aparece marcada como no eliminable con el conteo |
| Categoria raiz | Selector de padre oculto; al crear subcategoria el padre es obligatorio |

### Categorias

Vista de arbol de un nivel: raices expandibles con sus hijas. El reorden se hace con controles de
subir y bajar entre hermanas, no con arrastre libre en el MVP.

### Definiciones

Al crear, el selector de `tipoDato` es el primer campo. Si se elige `LISTA`, aparece el editor de
opciones. Tras guardar con items en uso, `tipoDato` y `codigo` quedan de solo lectura.

### Mensajes

| Situacion | Mensaje |
|-----------|---------|
| Guardado correcto | Maestra guardada |
| Codigo duplicado | Ya existe una unidad o definicion con ese codigo |
| Nombre duplicado | Ya existe una categoria o marca con ese nombre |
| En uso | No se puede inactivar: hay N items activos que la usan |
| Tipo inmutable | El tipo de dato no se puede cambiar porque el atributo ya esta en uso |
| Profundidad | Solo se admite un nivel de subcategorias |

## Criterios de aceptacion

### Unidades de medida

#### CA-001: Alta de unidad desde el pack y a mano

Dado un usuario con `catalogo.maestras.administrar` en una organizacion provisionada como
`FERRETERIA`, cuando lista unidades, entonces encuentra al menos `UND`, `M` y `KG` del pack; y cuando
crea una unidad con codigo `par` y `permiteDecimales` falso, entonces se guarda con codigo `PAR` y
respuesta 201.

#### CA-002: Codigo de unidad duplicado

Dada una unidad activa o inactiva con codigo `UND`, cuando se intenta crear otra con codigo `und`,
entonces la respuesta es 409 con `UNIDAD_MEDIDA_CODIGO_DUPLICADO`.

#### CA-003: Inactivar unidad en uso

Dada una unidad referenciada por al menos un item activo, cuando se intenta poner
`estadoRegistro` en `INACTIVO`, entonces la respuesta es 422 con `MAESTRA_EN_USO` y el detalle
incluye el conteo de items.

#### CA-004: Cambiar permiteDecimales en uso

Dada una unidad en uso con `permiteDecimales` verdadero, cuando se intenta cambiarlo a falso,
entonces la respuesta es 422 con `MAESTRA_EN_USO` y el valor no cambia.

### Categorias

#### CA-005: Alta de raiz y subcategoria

Dado un usuario administrador, cuando crea la categoria raiz `Plomeria` y luego la subcategoria
`Tuberia` con ese padre, entonces ambas quedan activas, la hija apunta al padre y la respuesta de
cada alta es 201.

#### CA-006: Profundidad maxima de un nivel

Dada una subcategoria existente, cuando se intenta crear otra categoria con esa subcategoria como
padre, entonces la respuesta es 422 con `CATEGORIA_PROFUNDIDAD_EXCEDIDA`.

#### CA-007: Nombre duplicado bajo el mismo padre

Dada la subcategoria `Tuberia` bajo `Plomeria`, cuando se intenta crear otra `tuberia` bajo el mismo
padre, entonces la respuesta es 409 con `CATEGORIA_NOMBRE_DUPLICADO`.

#### CA-008: Inactivar categoria en uso

Dada una categoria asignada a items activos, cuando se intenta inactivarla, entonces la respuesta es
422 con `MAESTRA_EN_USO`.

#### CA-009: Renombrar categoria regenera texto de busqueda

Dados items activos en la categoria `Tuberia`, cuando se renombra a `Tuberias y conexiones`, entonces
el `textoBusqueda` de esos items se regenera incluyendo el nombre nuevo dentro de la misma
transaccion.

### Marcas

#### CA-010: Alta y unicidad de marca

Dado un alta con nombre `Gerfor`, cuando se intenta crear otra con `gerfor`, entonces la segunda
responde 409 con `MARCA_NOMBRE_DUPLICADO`.

#### CA-011: Inactivar marca en uso

Dada una marca en items activos, cuando se inactiva, entonces la respuesta es 422 con
`MAESTRA_EN_USO`.

### Definiciones de atributo

#### CA-012: Alta de definicion LISTA con opciones

Dado un alta con `tipoDato` `LISTA`, codigo `material`, opciones `PVC`, `HG` y `COBRE`, cuando se
guarda, entonces la definicion queda activa y las opciones persisten en `opciones`.

#### CA-013: LISTA sin opciones se rechaza

Dado un alta con `tipoDato` `LISTA` sin `opciones` o con arreglo vacio, cuando se envia, entonces la
respuesta es 400 o 422 con `DEFINICION_OPCIONES_REQUERIDAS`.

#### CA-014: Tipo inmutable cuando hay items en uso

Dada una definicion `diametro` de tipo `TEXTO` presente en el documento `atributos` de al menos un
item, cuando se intenta cambiar `tipoDato` a `LISTA`, entonces la respuesta es 422 con
`DEFINICION_TIPO_INMUTABLE` y el tipo no cambia.

#### CA-015: Tipo mutable sin uso

Dada una definicion recien creada que ningun item usa, cuando se cambia `tipoDato` de `TEXTO` a
`ENTERO`, entonces la respuesta es 200 y el tipo queda `ENTERO`.

#### CA-016: Quitar opcion en uso

Dada la opcion `PVC` presente en items, cuando se intenta guardar la lista sin `PVC`, entonces la
respuesta es 422 con `DEFINICION_OPCION_EN_USO`.

#### CA-017: Codigo de definicion inmutable

Dada una definicion existente, cuando se intenta cambiar su `codigo` por PATCH, entonces la respuesta
es 422 con `DEFINICION_CODIGO_INMUTABLE`.

#### CA-018: Inactivar definicion en uso

Dada una definicion cuya clave aparece en atributos de items activos, cuando se intenta inactivarla,
entonces la respuesta es 422 con `MAESTRA_EN_USO`.

#### CA-019: Cambiar usarEnBusqueda regenera texto

Dada una definicion con `usarEnBusqueda` verdadero y items que la usan, cuando se pone
`usarEnBusqueda` en falso, entonces el `textoBusqueda` de esos items se regenera sin ese valor.

### Pack y aislamiento

#### CA-020: Maestras del pack son editables

Dada una organizacion `FERRETERIA` recien provisionada, cuando un administrador edita la etiqueta de
la definicion `diametro` heredada del pack, entonces el cambio se persiste y no afecta a otras
organizaciones del mismo vertical.

#### CA-021: Aislamiento entre organizaciones

Dado un administrador de la organizacion A y una unidad, categoria, marca y definicion de la
organizacion B, cuando intenta leerlas o editarlas por identificador, entonces todas las respuestas
son 404 y ningun registro de B se modifica.

#### CA-022: Cotizador solo lectura

Dado un usuario con perfil `Cotizador`, cuando consulta `GET /api/categorias` entonces recibe 200; y
cuando intenta `POST /api/marcas`, entonces recibe 403 con `PERMISO_DENEGADO`.

## Verificacion requerida para cierre

Pruebas unitarias:

- [ ] Normalizacion de codigo de unidad a mayusculas y de codigo de definicion a minusculas sin
      acentos.
- [ ] Validacion de `LISTA` con opciones obligatorias, sin duplicados y rechazo en otros tipos.
- [ ] Regla de profundidad de categorias: raiz, un nivel, rechazo del segundo nivel.
- [ ] Deteccion de maestra en uso para unidad, categoria, marca y definicion (clave en JSON).
- [ ] Inmutabilidad de `tipoDato` y de `codigo` de definicion segun uso.

Pruebas de integracion:

- [ ] ABM completo de las cuatro maestras con unicidad y estados.
- [ ] `MAESTRA_EN_USO` en inactivacion y en cambio de `permiteDecimales`.
- [ ] `DEFINICION_TIPO_INMUTABLE` y `DEFINICION_OPCION_EN_USO`.
- [ ] Renombrar categoria o marca regenera `textoBusqueda` de items afectados.
- [ ] Cambiar `usarEnBusqueda` regenera `textoBusqueda`.
- [ ] Organizacion provisionada expone las maestras del pack y son editables.
- [ ] Dos organizaciones del mismo vertical divergen tras editar maestras propias.
- [ ] **Aislamiento entre organizaciones**: lectura y escritura cruzada responden 404 en unidades,
      categorias, marcas y definiciones.
- [ ] Perfil `Cotizador` solo puede ver; `Administrador Organizacion` puede administrar.
- [ ] Usuario de ambito plataforma recibe `CONTEXTO_ORGANIZACION_REQUERIDO`.

Pruebas manuales:

- [ ] Recorrer el arbol de categorias de un nivel y reordenar hermanas.
- [ ] Intentar inactivar una maestra en uso y verificar el dialogo con conteo.
- [ ] Verificar que el campo de tipo de dato queda bloqueado cuando hay items.

## Preguntas abiertas

1. Falta decidir si inactivar una categoria raiz debe inactivar automaticamente sus subcategorias o
   solo ocultarlas en selectores (hoy se elige lo segundo).
2. No esta definido un endpoint de reorden masivo de categorias; el MVP usa PATCH individual de
   `orden`.
3. El `codigo` de definicion: ¿se permite `snake_case`, `camelCase` o ambos? Esta spec acepta ambos
   tras normalizar a minusculas sin acentos.
4. Falta alinear con `docs/03-verticales-y-packs.md` la pregunta de `usaAplicaciones` como columna
   de organizacion; las maestras no la resuelven.
5. El catalogo comun de errores `docs/08-catalogo-errores.md` todavia no existe; los codigos de esta
   spec son la propuesta inicial.

## Decisiones MVP v1

| Decision | Motivo |
|----------|--------|
| Un solo nivel de categorias | El modelo lo fija; mas profundidad complica selectores e importacion sin demanda del piloto |
| `MAESTRA_EN_USO` bloquea inactivar | Evita dejar items con referencias rotas en selectores y reportes |
| `tipoDato` inmutable en uso | Cambiar el tipo invalidaria valores ya guardados en `items.atributos` |
| `codigo` de definicion inmutable | Es la clave del documento JSON; renombrarlo huerfania valores |
| Se pueden agregar opciones a una LISTA en uso | Ampliar el catalogo es seguro; quitar opciones en uso no |
| Cambiar `permiteDecimales` exige unidad libre de uso | Alteraria la validacion de cantidades en cotizaciones futuras |
| Maestras del pack son datos propios editables | Consecuencia directa de la materializacion por copia |
| Ninguna regla ramifica por vertical | El vertical solo aporta la semilla inicial |


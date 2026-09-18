# Spec 002: Configuracion de la organizacion

## Estado

En implementacion — rama `feature/spec-002-configuracion-organizacion` (2026-09-18)

## Objetivo

Definir todo lo que un administrador puede configurar dentro de su propia organizacion, una vez que
el proveedor la registro y la provisiono: los datos de identidad que aparecen en el documento, el
logo, las monedas de calculo y de presentacion, las sucursales, la configuracion de cotizacion y el
uso de IA con sus umbrales de confianza.

Esta especificacion cubre el ajuste del comportamiento del producto sin tocar codigo. Es el lugar
donde la organizacion decide cuanto dura una cotizacion, si se aplica impuesto, como se redondea,
quien puede sobrescribir un precio y cuando el sistema se atreve a resolver una linea solo.

La regla que gobierna todo el modulo es que la configuracion afecta al futuro, nunca al pasado:
cambiar cualquier valor de aqui no modifica ninguna cotizacion ya aprobada.

## Dependencias

| Documento | Que aporta |
|-----------|-----------|
| `docs/06-diseno-tecnico.md` | Tablas `organizaciones`, `sucursales`, `configuraciones_cotizacion`, permisos y contratos |
| `docs/specs/000-plataforma-organizaciones.md` | La organizacion y su provisionamiento inicial, incluida la sucursal principal |
| `docs/specs/001-usuarios-perfiles.md` | `OrgContext`, permisos, sucursales asignadas y sucursal activa |
| `docs/decisions/0008-moneda-base-y-presentacion.md` | Moneda base de calculo, moneda de presentacion y congelamiento de la tasa |
| `docs/decisions/0007-estrategia-de-matching.md` | Significado de `umbralAutomatico` y `umbralDescarte` en el semaforo |
| `docs/decisions/0001-multi-tenancy-por-organizacion.md` | Aislamiento y respuesta de no encontrado ante datos ajenos |

Las listas de precios en si se especifican en `docs/specs/006-listas-precios-reglas.md`; aqui solo se
elige cual es la predeterminada. La plantilla de documento se especifica en
`docs/specs/010-plantilla-documento.md`; aqui solo se carga el logo, que la plantilla consume.

## Alcance MVP v1

Incluye:

- Consulta y edicion de los datos e identidad de la organizacion desde dentro de la organizacion.
- Carga, reemplazo y eliminacion del logo.
- Seleccion de moneda base y de moneda de presentacion opcional, con la advertencia asociada.
- Alta, edicion e inactivacion de sucursales, con la proteccion de la sucursal principal.
- Configuracion de cotizacion completa: vigencia predeterminada, impuesto, decimales y redondeo,
  sobrescritura de precios, lista de precios predeterminada y detalle de descuentos.
- Activacion del uso de IA y ajuste de los dos umbrales de confianza, con explicacion de su efecto.

No incluye en esta version:

- Cambio del vertical de la organizacion, que queda fijo tras el provisionamiento.
- Configuracion por sucursal: la configuracion de cotizacion es unica por organizacion.
- Configuracion de la plantilla de documento, sus colores, columnas y textos.
- Administracion de listas de precios, precios, reglas de descuento y tasas de cambio.
- Cambio de la sucursal principal a otra sucursal.
- Historial de cambios de configuracion con posibilidad de revertir.
- Eleccion del proveedor de IA, su modelo o su version de prompt.

## Conceptos principales

### Identidad de la organizacion

Conjunto de datos que describen al negocio y que alimentan el encabezado del documento entregado al
cliente: nombre, razon social, identificacion fiscal, telefono, correo, direccion y logo.

### Moneda base

Moneda en la que estan expresados todos los precios del catalogo y en la que se hace todo el calculo.
Es la unica moneda de calculo del sistema.

### Moneda de presentacion

Moneda opcional en la que ademas se muestra el total convertido, para que el cliente vea el importe
en la moneda con la que va a pagar. La conversion se aplica solo al total, nunca linea por linea, y
la tasa se congela en la cotizacion al aprobarla.

### Sucursal

Punto de venta o deposito dentro de la organizacion. Toda organizacion tiene exactamente una sucursal
principal, creada en el provisionamiento. Las sucursales segmentan cotizaciones y determinan a que
usuarios se les asigna acceso. No son una frontera de aislamiento: la frontera es la organizacion.

### Configuracion de cotizacion

Fila unica por organizacion que gobierna el comportamiento del motor de precios y del documento:
cuanto vale una cotizacion, si lleva impuesto, como se redondea, si se permite sobrescribir un
precio, que lista se usa por omision y si el descuento se muestra desglosado.

### Umbrales de confianza

Dos valores entre 0 y 1 que traducen la confianza de la resolucion de cada linea en el semaforo que
ve el operador. Por encima del umbral automatico la linea sale verde; por debajo del umbral de
descarte sale roja; entre ambos sale ambar.

## Datos requeridos

### Datos editables de `organizaciones`

Subconjunto de la tabla `organizaciones` que se administra desde dentro de la organizacion.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `nombre` | Si | Nombre comercial. Unico en toda la plataforma. Entre 3 y 120 caracteres |
| `razonSocial` | No | Denominacion legal. Aparece en el documento si la plantilla la incluye |
| `identificacionFiscal` | No | Unico en la plataforma cuando no es nulo |
| `telefono` | No | Contacto mostrado en el documento |
| `email` | No | Formato de correo valido |
| `direccion` | No | Domicilio mostrado en el documento |
| `logoUrl` | No | Ruta del archivo almacenado. No se edita a mano: resulta de la carga del logo |
| `monedaBaseId` | Si | Moneda activa del catalogo global. Cambiarla no reconvierte precios |
| `monedaPresentacionId` | No | Moneda activa distinta de la base. Nulo desactiva la presentacion dual |
| `zonaHoraria` | Si | Identificador IANA. Determina el dia de las fechas mostradas y de los informes |
| `locale` | Si | Codigo de idioma y region. Determina el formato de numeros y fechas |
| `usaIa` | Si | Booleano. Falso deshabilita la interpretacion automatica sin romper el flujo manual |
| `umbralAutomatico` | Si | `numeric(5,4)` entre 0 y 1. Debe ser mayor que `umbralDescarte` |
| `umbralDescarte` | Si | `numeric(5,4)` entre 0 y 1. Debe ser menor que `umbralAutomatico` |

Los campos `verticalId`, `notasInternas` y `estadoRegistro` no se administran desde este modulo. El
vertical queda fijo, las notas internas son de uso exclusivo del ambito plataforma y el estado lo
controla el proveedor segun `docs/specs/000-plataforma-organizaciones.md`.

### Logo

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `archivo` | Si | Formatos aceptados: PNG, JPG y SVG. Tamaño maximo 2 MB |
| `dimensiones` | Si | Minimo 200 por 200 pixeles para PNG y JPG. Sin minimo para SVG |

El archivo se guarda por el adaptador de almacenamiento definido en `docs/06-diseno-tecnico.md` y
solo su ruta se persiste en `organizaciones.logoUrl`. Reemplazar el logo no borra el archivo
anterior, porque los documentos ya generados pueden referenciarlo.

### Tabla `sucursales`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Tomado del `OrgContext`, nunca de la entrada |
| `nombre` | Si | Entre 2 y 80 caracteres. Unico dentro de la organizacion |
| `codigo` | Si | Corto, entre 2 y 10 caracteres, en mayusculas. Unico dentro de la organizacion |
| `direccion` | No | Domicilio de la sucursal |
| `telefono` | No | Contacto de la sucursal |
| `esPrincipal` | Si | Verdadero en exactamente una sucursal por organizacion. No editable en esta version |
| `estadoRegistro` | Si | `ACTIVO` o `INACTIVO`. La principal no se puede inactivar |
| `createdAt`, `updatedAt`, `createdById`, `updatedById` | Si | Auditoria estandar |

### Tabla `configuraciones_cotizacion`

Una unica fila por organizacion, creada en el provisionamiento. No se crea ni se elimina desde este
modulo: solo se consulta y se edita.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Unico. Tomado del `OrgContext` |
| `vigenciaHorasPredeterminada` | Si | Entero entre 1 y 8760. Valor inicial 48 |
| `aplicaImpuesto` | Si | Booleano. Falso oculta el impuesto en el calculo y en el documento |
| `porcentajeImpuesto` | Si cuando `aplicaImpuesto` | `numeric(9,4)` entre 0 y 100 |
| `preciosIncluyenImpuesto` | Si | Verdadero significa que los precios del catalogo ya lo contienen y el impuesto se desglosa hacia atras |
| `decimalesRedondeo` | Si | Entero entre 0 y 4. Decimales del importe calculado |
| `modoRedondeo` | Si | `NORMAL`, `ARRIBA` o `ABAJO` |
| `mostrarDescuentoDetallado` | Si | Verdadero muestra el descuento por linea; falso lo muestra solo en el total |
| `permiteSobrescribirPrecio` | Si | Falso bloquea la sobrescritura para todos, incluso con el permiso |
| `listaPrecioPredeterminadaId` | Si | Lista activa de la organizacion en la moneda base |
| `createdAt`, `updatedAt`, `createdById`, `updatedById` | Si | Auditoria estandar |

## Reglas de negocio

### Alcance y aislamiento

1. Toda operacion de este modulo exige `ctx.organizacionId` no nulo y opera exclusivamente sobre esa
   organizacion. El identificador nunca se toma de la entrada.
2. Un usuario de ambito plataforma recibe error de contexto de organizacion en todos los endpoints de
   este modulo. El proveedor edita los datos de una organizacion por la ruta de plataforma, no por
   esta.
3. Cualquier referencia a una sucursal, lista de precios o moneda que no pertenezca a la organizacion
   del contexto se responde como no encontrada.
4. La lectura de la configuracion exige `configuracion.organizacion.ver`; toda escritura exige
   `configuracion.organizacion.administrar`.

### Identidad de la organizacion

5. El `nombre` es unico en toda la plataforma. Cambiarlo a uno ya usado devuelve conflicto sin
   revelar que organizacion lo ocupa.
6. La `identificacionFiscal`, cuando se informa, es unica en toda la plataforma. Cuando es nula no
   participa de la unicidad.
7. Cambiar los datos de identidad no modifica ninguna cotizacion ya aprobada: el documento generado
   conserva los datos vigentes en el momento de su generacion.
8. El `verticalId` no se puede modificar desde este modulo ni desde ningun otro.
9. Las `notasInternas` nunca se devuelven en las respuestas de este modulo.

### Logo

10. La carga del logo acepta PNG, JPG y SVG, con un maximo de 2 MB. Un formato o un tamaño fuera de
    rango devuelve entrada invalida.
11. Las imagenes de mapa de bits deben tener al menos 200 por 200 pixeles, para que el documento no
    quede con un logo pixelado.
12. Al reemplazar el logo se actualiza `logoUrl` y el archivo anterior se conserva en el
    almacenamiento, porque los documentos ya generados lo referencian.
13. Eliminar el logo deja `logoUrl` nulo. La plantilla debe seguir generando el documento sin logo, no
    fallar.
14. Cambiar el logo no regenera ningun documento ya emitido.

### Monedas

15. La moneda base y la de presentacion se eligen del catalogo global de monedas y deben estar
    activas. La organizacion no crea monedas.
16. La moneda de presentacion, cuando se informa, debe ser distinta de la base.
17. Cambiar la moneda base **no reconvierte ningun precio**. Los importes de las listas de precios
    quedan con el mismo valor numerico y pasan a interpretarse en la moneda nueva. La interfaz debe
    exigir una confirmacion explicita que enuncie esta consecuencia antes de guardar.
18. Cambiar la moneda base no modifica ninguna cotizacion ya aprobada: cada cotizacion conserva la
    moneda base, la moneda de presentacion, la tasa y la fecha que tenia al aprobarse.
19. Si existen listas de precios cuya moneda no coincide con la moneda base nueva, el cambio se
    permite pero la respuesta incluye la lista de las listas afectadas, y la interfaz las muestra para
    que el administrador las corrija.
20. Quitar la moneda de presentacion deja el sistema operando en una sola moneda, sin pantallas ni
    campos adicionales. Las cotizaciones aprobadas que ya la tenian la conservan.
21. Activar una moneda de presentacion sin tener una tasa de cambio vigente para ese par no impide
    guardar la configuracion, pero la interfaz advierte que los borradores no podran mostrar el total
    convertido hasta cargar la tasa.

### Sucursales

22. Toda organizacion tiene exactamente una sucursal con `esPrincipal` verdadero, creada en el
    provisionamiento.
23. El nombre y el codigo de una sucursal son unicos dentro de la organizacion. Un duplicado devuelve
    conflicto.
24. El codigo se normaliza a mayusculas y sin espacios antes de validar la unicidad.
25. La sucursal principal no se puede inactivar. Intentarlo devuelve regla de negocio incumplida.
26. La marca de sucursal principal no se puede trasladar a otra sucursal en esta version.
27. Una sucursal con usuarios asignados no se puede inactivar mientras sea la unica sucursal de
    alguno de ellos, porque dejaria a ese usuario sin acceso a ninguna. La respuesta enumera los
    usuarios afectados.
28. Inactivar una sucursal no altera las cotizaciones ni las solicitudes ya asociadas a ella: siguen
    siendo legibles en el historial.
29. Una sucursal inactiva no se puede elegir como sucursal activa ni asignar a un usuario, y no
    aparece en los selectores de captura de solicitudes.
30. Una sucursal no se elimina fisicamente. La unica baja es el cambio de `estadoRegistro` a
    `INACTIVO`.
31. Si el usuario que edita tiene como sucursal activa la que acaba de inactivar, su sucursal activa
    pasa a la primera sucursal activa que conserve en el siguiente refresco de token.

### Configuracion de cotizacion

32. Existe exactamente una configuracion de cotizacion por organizacion. Si no existiera, la lectura
    devuelve no encontrado en lugar de crearla al vuelo, porque su ausencia indica un
    provisionamiento incompleto.
33. `vigenciaHorasPredeterminada` debe ser un entero entre 1 y 8760. Se usa al aprobar una cotizacion,
    sumandose a la fecha de aprobacion.
34. Cambiar la vigencia predeterminada no altera la `vigenciaHasta` de ninguna cotizacion ya
    aprobada.
35. Cuando `aplicaImpuesto` es verdadero, `porcentajeImpuesto` es obligatorio y debe estar entre 0 y
    100. Cuando es falso, el porcentaje se conserva almacenado pero no se aplica ni se muestra.
36. `preciosIncluyenImpuesto` cambia como se calcula el impuesto, no cuanto cobra el negocio: con
    valor verdadero el impuesto se desglosa del precio cargado; con valor falso se suma sobre el
    subtotal. La interfaz debe mostrar un ejemplo numerico de ambos casos.
37. `decimalesRedondeo` debe estar entre 0 y 4 y `modoRedondeo` debe ser `NORMAL`, `ARRIBA` o
    `ABAJO`. El redondeo se aplica segun `docs/decisions/0005-motor-de-precios.md`.
38. Cuando `permiteSobrescribirPrecio` es falso, la sobrescritura queda bloqueada para toda la
    organizacion, incluso para un usuario con `cotizaciones.sobrescribir_precio`. La configuracion es
    una restriccion adicional al permiso, nunca un sustituto.
39. `listaPrecioPredeterminadaId` debe referenciar una lista de precios activa de la organizacion. Una
    lista ajena o inactiva se responde como no encontrada.
40. Cambiar la lista predeterminada no modifica la lista asignada a ningun cliente ni la de ninguna
    cotizacion existente. Solo afecta a los borradores creados a partir de ese momento cuyo cliente no
    tenga lista propia.
41. `mostrarDescuentoDetallado` solo afecta a la presentacion del documento y del borrador, nunca al
    calculo.
42. Ningun cambio en la configuracion de cotizacion recalcula cotizaciones existentes, ni siquiera
    los borradores ya creados. Un borrador toma los valores vigentes cuando se recalcula, que es una
    accion explicita del operador.

### Uso de IA y umbrales

43. `usaIa` en falso deshabilita la llamada al proveedor de IA. La captura de una solicitud sigue
    funcionando: crea el borrador vacio y el operador arma las lineas manualmente.
44. Los umbrales se siguen usando aunque `usaIa` sea falso, porque el motor de resolucion los aplica
    cuando el operador busca un item.
45. `umbralAutomatico` y `umbralDescarte` deben estar entre 0 y 1, expresados con cuatro decimales, y
    `umbralDescarte` debe ser estrictamente menor que `umbralAutomatico`.
46. El efecto de los umbrales sobre el semaforo es el siguiente y debe mostrarse en la interfaz:

| Confianza de la linea | Estado de resolucion | Semaforo |
|-----------------------|----------------------|----------|
| Mayor o igual que `umbralAutomatico` | `RESUELTA_AUTOMATICA` | Verde |
| Entre `umbralDescarte` y `umbralAutomatico` | `SUGERIDA_REVISAR` | Ambar |
| Menor que `umbralDescarte` | `NO_ENCONTRADA` | Rojo |

47. Subir el umbral automatico produce mas lineas en ambar y menos resoluciones automaticas
    incorrectas. Bajarlo produce lo contrario. La interfaz debe enunciar ese intercambio junto al
    control.
48. Independientemente de los umbrales, si los dos mejores candidatos de una linea difieren en menos
    de 0.05 de puntaje, la linea no se marca como automatica, segun
    `docs/decisions/0007-estrategia-de-matching.md`. Esa regla no es configurable.
49. Cambiar los umbrales no reprocesa ninguna solicitud ni recalcula ningun borrador existente. Aplica
    a las interpretaciones y resoluciones posteriores al cambio.

### Efecto sobre cotizaciones existentes

50. Ningun cambio de este modulo modifica una cotizacion en estado `APROBADA`, `ENVIADA`, `GANADA`,
    `PERDIDA`, `VENCIDA` o `ANULADA`. Al aprobar se congelan precios, descuentos, impuesto, tasa,
    descripciones y textos, segun `docs/06-diseno-tecnico.md`.
51. Los documentos ya generados conservan su contenido y su hash. Cambiar el logo, los datos de
    identidad o la configuracion no los regenera ni los invalida.
52. La interfaz debe enunciar esta garantia de forma visible en la pantalla de configuracion, porque
    es la duda mas frecuente al cambiar un impuesto o una moneda.

## Permisos

| Permiso | Uso en esta spec |
|---------|------------------|
| `configuracion.organizacion.ver` | Consultar los datos de la organizacion y la configuracion de cotizacion |
| `configuracion.organizacion.administrar` | Editar datos, logo, monedas, umbrales, uso de IA y configuracion de cotizacion |
| `configuracion.sucursales.ver` | Listar y ver sucursales |
| `configuracion.sucursales.administrar` | Crear, editar e inactivar sucursales |

Los cuatro los satisface el comodin `configuracion.*` del perfil `Administrador Organizacion`. El
perfil `Cotizador` no tiene ninguno de ellos y no accede a este modulo, segun la tabla comparativa de
`docs/specs/001-usuarios-perfiles.md`.

La lectura del catalogo global de monedas exige solo autenticacion y se resuelve con
`GET /api/monedas`, definido en `docs/specs/000-plataforma-organizaciones.md`.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/configuracion-organizacion` | `configuracion.organizacion.ver` | Datos e identidad de la organizacion del contexto |
| PATCH | `/api/configuracion-organizacion` | `configuracion.organizacion.administrar` | Editar identidad, monedas, zona horaria, locale, uso de IA y umbrales |
| POST | `/api/configuracion-organizacion/logo` | `configuracion.organizacion.administrar` | Cargar o reemplazar el logo |
| DELETE | `/api/configuracion-organizacion/logo` | `configuracion.organizacion.administrar` | Quitar el logo |
| GET | `/api/sucursales` | `configuracion.sucursales.ver` | Listado con filtro por estado y busqueda |
| POST | `/api/sucursales` | `configuracion.sucursales.administrar` | Crear una sucursal |
| GET | `/api/sucursales/:id` | `configuracion.sucursales.ver` | Detalle de una sucursal |
| PATCH | `/api/sucursales/:id` | `configuracion.sucursales.administrar` | Editar datos e inactivar o reactivar |
| GET | `/api/configuracion-cotizacion` | `configuracion.organizacion.ver` | Configuracion de cotizacion vigente |
| PATCH | `/api/configuracion-cotizacion` | `configuracion.organizacion.administrar` | Editar la configuracion de cotizacion |

Las rutas de `/api/configuracion-organizacion` y `/api/sucursales` no figuran en la tabla de
endpoints de `docs/06-diseno-tecnico.md`; esta especificacion las incorpora siguiendo sus
convenciones para dar soporte a los permisos `configuracion.organizacion.*` y
`configuracion.sucursales.*`, que si estan definidos alli. `GET/PATCH /api/configuracion-cotizacion`
si figura alli.

### Datos de la organizacion

```typescript
// PATCH /api/configuracion-organizacion
type EditarConfiguracionOrganizacionInput = {
  nombre?: string;
  razonSocial?: string | null;
  identificacionFiscal?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  monedaBaseId?: string;
  monedaPresentacionId?: string | null;   // null desactiva la presentacion dual
  zonaHoraria?: string;
  locale?: string;
  usaIa?: boolean;
  umbralAutomatico?: string;              // decimal como cadena, por ejemplo '0.8000'
  umbralDescarte?: string;                // decimal como cadena, por ejemplo '0.4500'
  confirmarCambioMonedaBase?: boolean;    // obligatorio cuando cambia monedaBaseId
};

type EditarConfiguracionOrganizacionResultado = {
  organizacion: OrganizacionConfiguracion;
  advertencias: Array<{
    codigo: 'LISTAS_EN_OTRA_MONEDA' | 'TASA_CAMBIO_AUSENTE';
    mensaje: string;
    detalle?: unknown;
  }>;
};
```

### Sucursales

```typescript
// POST /api/sucursales
type CrearSucursalInput = {
  nombre: string;                  // 2 a 80 caracteres, unico en la organizacion
  codigo: string;                  // 2 a 10 caracteres, se normaliza a mayusculas, unico
  direccion?: string;
  telefono?: string;
};

// PATCH /api/sucursales/:id
type EditarSucursalInput = {
  nombre?: string;
  codigo?: string;
  direccion?: string | null;
  telefono?: string | null;
  estadoRegistro?: 'ACTIVO' | 'INACTIVO';
};
// esPrincipal no es editable en esta version.
```

### Configuracion de cotizacion

```typescript
// PATCH /api/configuracion-cotizacion
type EditarConfiguracionCotizacionInput = {
  vigenciaHorasPredeterminada?: number;   // entero, 1 a 8760
  aplicaImpuesto?: boolean;
  porcentajeImpuesto?: string;            // decimal como cadena, '0' a '100'
  preciosIncluyenImpuesto?: boolean;
  decimalesRedondeo?: number;             // entero, 0 a 4
  modoRedondeo?: 'NORMAL' | 'ARRIBA' | 'ABAJO';
  mostrarDescuentoDetallado?: boolean;
  permiteSobrescribirPrecio?: boolean;
  listaPrecioPredeterminadaId?: string;   // lista activa de la organizacion
};
```

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `VALIDACION_ENTRADA_INVALIDA` | La entrada no cumple el esquema: nombre fuera de rango, correo mal formado, decimales fuera de 0 a 4, vigencia fuera de 1 a 8760 |
| `PERMISO_DENEGADO` | El usuario no tiene el permiso `configuracion.*` requerido |
| `CONTEXTO_ORGANIZACION_REQUERIDO` | Un usuario de ambito plataforma invoca un endpoint de este modulo |
| `RECURSO_NO_ENCONTRADO` | La sucursal, la lista de precios o la moneda no existen o pertenecen a otra organizacion |
| `CONFIGURACION_COTIZACION_AUSENTE` | La organizacion no tiene fila de configuracion de cotizacion, lo que indica un provisionamiento incompleto |
| `ORGANIZACION_NOMBRE_DUPLICADO` | El nombre nuevo ya esta usado por otra organizacion |
| `ORGANIZACION_IDENTIFICACION_DUPLICADA` | La identificacion fiscal nueva ya esta usada por otra organizacion |
| `MONEDA_INACTIVA` | La moneda elegida existe pero esta inactiva |
| `MONEDA_PRESENTACION_IGUAL_A_BASE` | La moneda de presentacion coincide con la moneda base |
| `CAMBIO_MONEDA_BASE_NO_CONFIRMADO` | Se cambia la moneda base sin enviar la confirmacion explicita |
| `UMBRALES_INCOHERENTES` | `umbralDescarte` es mayor o igual que `umbralAutomatico` |
| `UMBRAL_FUERA_DE_RANGO` | Un umbral queda fuera del intervalo de 0 a 1 |
| `LOGO_FORMATO_NO_SOPORTADO` | El archivo no es PNG, JPG ni SVG |
| `LOGO_DEMASIADO_GRANDE` | El archivo supera 2 MB |
| `LOGO_DIMENSIONES_INSUFICIENTES` | La imagen de mapa de bits mide menos de 200 por 200 pixeles |
| `SUCURSAL_NOMBRE_DUPLICADO` | Ya existe una sucursal con ese nombre en la organizacion |
| `SUCURSAL_CODIGO_DUPLICADO` | Ya existe una sucursal con ese codigo en la organizacion |
| `SUCURSAL_PRINCIPAL_NO_INACTIVABLE` | Se intenta inactivar la sucursal principal |
| `SUCURSAL_PRINCIPAL_NO_TRASLADABLE` | Se intenta cambiar la marca de sucursal principal |
| `SUCURSAL_EN_USO_POR_USUARIOS` | Inactivarla dejaria sin ninguna sucursal a uno o mas usuarios |
| `IMPUESTO_PORCENTAJE_REQUERIDO` | `aplicaImpuesto` es verdadero y no hay un porcentaje valido |
| `LISTA_PRECIO_INACTIVA` | La lista elegida como predeterminada existe pero esta inactiva |

Los codigos siguen el formato del catalogo comun `docs/08-catalogo-errores.md`, pendiente de
publicacion. Los estados HTTP se asignan segun `docs/06-diseno-tecnico.md`: 400 para validacion y
archivos invalidos, 403 para permisos, 404 para recursos ausentes o ajenos, 409 para duplicados y 422
para reglas de negocio incumplidas.

## Experiencia de usuario

La configuracion vive bajo `/configuracion` y solo aparece en la navegacion para usuarios con algun
permiso `configuracion.*`.

| Ruta | Pantalla | Contenido |
|------|----------|-----------|
| `/configuracion/organizacion` | Datos e identidad | Identidad, logo, monedas, zona horaria y locale |
| `/configuracion/sucursales` | Listado | Tabla de sucursales con el patron ABM |
| `/configuracion/sucursales/nueva` | Alta | Formulario de sucursal |
| `/configuracion/sucursales/:id` | Edicion | Formulario con estado y acciones |
| `/configuracion/cotizacion` | Configuracion de cotizacion | Vigencia, impuesto, redondeo, precios y presentacion |
| `/configuracion/ia` | Uso de IA | Interruptor de uso de IA y los dos umbrales con su simulador |

En la parte superior de las tres pantallas de configuracion se muestra de forma permanente la
garantia: los cambios de configuracion no modifican cotizaciones ya aprobadas.

### Datos e identidad

Formulario de una sola columna con tres bloques: identidad, logo y monedas y formato. Guarda con un
unico boton y muestra el resultado sin recargar la pagina.

El bloque de logo muestra la imagen actual con su tamaño, una zona de arrastre para reemplazarla y
una accion de quitar. Debajo se indica el formato aceptado y el tamaño maximo.

El selector de moneda base abre, al cambiarlo, un dialogo de confirmacion que enuncia en una frase la
consecuencia: los precios ya cargados no se reconvierten y pasan a interpretarse en la moneda nueva.
El dialogo exige escribir el codigo de la moneda nueva para confirmar. Si hay listas de precios en
otra moneda, el dialogo las enumera.

El selector de moneda de presentacion incluye la opcion de ninguna. Al elegir una moneda sin tasa
vigente, se muestra un aviso con un enlace a la pantalla de tasas de cambio.

### Sucursales

Patron ABM comun: tabla con buscador por nombre y codigo, filtro por estado, paginacion, accion
primaria de crear arriba a la derecha y acciones por fila de editar e inactivar o reactivar.

| Columna | Contenido |
|---------|-----------|
| Nombre | Nombre y codigo debajo |
| Direccion | Texto recortado |
| Principal | Marca visible solo en la sucursal principal |
| Usuarios | Cantidad de usuarios con acceso |
| Estado | Activo o Inactivo |

La accion de inactivar aparece deshabilitada en la sucursal principal, con la razon visible al pasar
el puntero. Cuando la inactivacion dejaria a algun usuario sin sucursal, el dialogo de confirmacion
enumera esos usuarios y no permite continuar hasta resolverlo.

### Configuracion de cotizacion

Formulario agrupado en cuatro bloques, cada uno con una linea de explicacion:

1. **Vigencia**: horas predeterminadas, con el equivalente en dias mostrado al lado.
2. **Impuesto**: interruptor, porcentaje y la eleccion de si los precios ya lo incluyen. Debajo, un
   ejemplo numerico en vivo con un precio de muestra que compara ambos comportamientos.
3. **Redondeo**: decimales y modo, con un ejemplo en vivo del resultado sobre el mismo precio de
   muestra.
4. **Precios y presentacion**: lista de precios predeterminada, permiso de sobrescritura y detalle
   del descuento.

El interruptor de sobrescritura aclara que, al desactivarlo, nadie puede sobrescribir precios aunque
tenga el permiso.

### Uso de IA y umbrales

El interruptor de uso de IA explica el efecto de desactivarlo: la captura de solicitudes sigue
disponible y el borrador se crea vacio para armarlo a mano.

Los dos umbrales se ajustan con controles deslizantes de cuatro decimales acompañados de una barra de
semaforo que se actualiza en vivo: un tramo verde por encima del umbral automatico, uno ambar entre
ambos y uno rojo por debajo del umbral de descarte. Debajo se enuncia el intercambio en una frase:
subir el umbral automatico reduce los errores no detectados y aumenta el trabajo de revision.

### Mensajes

| Situacion | Mensaje |
|-----------|---------|
| Guardado correcto | Configuracion actualizada. Las cotizaciones aprobadas no se modifican |
| Cambio de moneda base | Cambiar la moneda base no reconvierte los precios ya cargados. Los importes conservan su valor numerico y pasaran a interpretarse en la moneda nueva |
| Listas en otra moneda | Hay listas de precios en una moneda distinta de la base. Reviselas |
| Tasa ausente | No hay tasa de cambio vigente para la moneda de presentacion. Cargue una para que los borradores muestren el total convertido |
| Sucursal principal | La sucursal principal no se puede inactivar |
| Sucursal con usuarios | No se puede inactivar: los siguientes usuarios quedarian sin ninguna sucursal |
| Codigo duplicado | Ya existe una sucursal con ese codigo |
| Impuesto sin porcentaje | Indique el porcentaje de impuesto o desactive su aplicacion |
| Umbrales incoherentes | El umbral de descarte debe ser menor que el umbral automatico |
| Sobrescritura desactivada | Con esta opcion desactivada, nadie podra sobrescribir precios aunque tenga el permiso |

## Criterios de aceptacion

### Identidad y logo

#### CA-001: Edicion de identidad

Dado un usuario con `configuracion.organizacion.administrar`, cuando edita razon social,
identificacion fiscal, telefono, correo y direccion con valores validos, entonces la respuesta es 200
y el detalle devuelto refleja los valores nuevos.

#### CA-002: Nombre duplicado entre organizaciones

Dado que la organizacion B se llama `Ferreteria Central`, cuando un administrador de la organizacion
A intenta renombrar la suya con ese nombre, entonces la respuesta es 409 con codigo
`ORGANIZACION_NOMBRE_DUPLICADO` y el mensaje no revela a que organizacion pertenece.

#### CA-003: Carga y reemplazo del logo

Dado un archivo PNG de 400 por 400 pixeles y 300 KB, cuando se carga como logo, entonces `logoUrl`
apunta al archivo nuevo; y cuando despues se carga otro, `logoUrl` apunta al segundo y el primero
sigue disponible en el almacenamiento.

#### CA-004: Rechazo de logo invalido

Dados un archivo PDF, un PNG de 5 MB y un JPG de 100 por 100 pixeles, cuando se intenta cargar cada
uno, entonces se rechazan con `LOGO_FORMATO_NO_SOPORTADO`, `LOGO_DEMASIADO_GRANDE` y
`LOGO_DIMENSIONES_INSUFICIENTES` respectivamente, y `logoUrl` no cambia.

### Monedas

#### CA-005: El cambio de moneda base exige confirmacion

Dado un cambio de `monedaBaseId` sin enviar `confirmarCambioMonedaBase`, cuando se envia la peticion,
entonces la respuesta es 422 con codigo `CAMBIO_MONEDA_BASE_NO_CONFIRMADO` y la moneda base no
cambia.

#### CA-006: El cambio de moneda base no reconvierte precios

Dada una organizacion con moneda base USD y un item con precio `100.0000` en su lista
predeterminada, cuando se cambia la moneda base a EUR con la confirmacion, entonces el precio del
item sigue siendo `100.0000` y la respuesta incluye la advertencia `LISTAS_EN_OTRA_MONEDA` con la
lista afectada.

#### CA-007: El cambio de moneda base no altera cotizaciones aprobadas

Dada una cotizacion aprobada con moneda base USD, tasa congelada y total calculado, cuando se cambia
la moneda base de la organizacion, entonces esa cotizacion conserva exactamente su moneda base, su
moneda de presentacion, su tasa, su fecha de tasa y todos sus importes.

#### CA-008: La moneda de presentacion no puede ser la base

Dado un intento de establecer `monedaPresentacionId` igual a `monedaBaseId`, cuando se envia la
peticion, entonces la respuesta es 400 con codigo `MONEDA_PRESENTACION_IGUAL_A_BASE`.

#### CA-009: Quitar la moneda de presentacion

Dada una organizacion con moneda de presentacion configurada, cuando se establece
`monedaPresentacionId` en nulo, entonces el sistema opera en una sola moneda y las cotizaciones
aprobadas que ya tenian moneda de presentacion la conservan con su tasa congelada.

### Sucursales

#### CA-010: Alta de sucursal

Dado un usuario con `configuracion.sucursales.administrar`, cuando crea una sucursal con nombre y
codigo validos, entonces la respuesta es 201, la sucursal queda activa, con `esPrincipal` falso y con
el `organizacionId` del contexto.

#### CA-011: Codigo duplicado en la organizacion

Dada una sucursal con codigo `CEN`, cuando se intenta crear otra con codigo `cen`, entonces el codigo
se normaliza a mayusculas, la respuesta es 409 con codigo `SUCURSAL_CODIGO_DUPLICADO` y no se crea la
sucursal.

#### CA-012: La sucursal principal no se puede inactivar

Dada la sucursal principal de una organizacion, cuando se intenta poner su `estadoRegistro` en
`INACTIVO`, entonces la respuesta es 422 con codigo `SUCURSAL_PRINCIPAL_NO_INACTIVABLE` y la sucursal
sigue activa.

#### CA-013: No se deja a un usuario sin sucursal

Dada una sucursal que es la unica asignada a un usuario activo, cuando se intenta inactivarla,
entonces la respuesta es 422 con codigo `SUCURSAL_EN_USO_POR_USUARIOS`, el detalle enumera a ese
usuario y la sucursal sigue activa.

#### CA-014: Inactivar una sucursal conserva su historial

Dada una sucursal con cotizaciones asociadas y ningun usuario que dependa solo de ella, cuando se
inactiva, entonces sus cotizaciones siguen siendo legibles en el historial con la sucursal indicada y
la sucursal deja de aparecer en los selectores de captura.

### Configuracion de cotizacion

#### CA-015: Edicion de la configuracion de cotizacion

Dado un usuario con `configuracion.organizacion.administrar`, cuando establece vigencia 72, impuesto
del 16 por ciento no incluido en los precios, dos decimales y modo `NORMAL`, entonces la respuesta es
200 y la configuracion devuelta refleja esos valores.

#### CA-016: Impuesto activo exige porcentaje

Dado `aplicaImpuesto` en verdadero sin `porcentajeImpuesto` valido, cuando se envia la peticion,
entonces la respuesta es 422 con codigo `IMPUESTO_PORCENTAJE_REQUERIDO`.

#### CA-017: La sobrescritura desactivada bloquea incluso con permiso

Dada la configuracion con `permiteSobrescribirPrecio` en falso y un usuario con el permiso
`cotizaciones.sobrescribir_precio`, cuando intenta sobrescribir el precio de una linea de un
borrador, entonces la operacion se rechaza.

#### CA-018: La lista predeterminada debe ser propia y activa

Dados el identificador de una lista de precios de otra organizacion y el de una lista propia
inactiva, cuando se intenta establecer cada uno como predeterminado, entonces el primero responde 404
con `RECURSO_NO_ENCONTRADO` y el segundo 422 con `LISTA_PRECIO_INACTIVA`.

#### CA-019: Cambiar la vigencia no altera lo aprobado

Dada una cotizacion aprobada con `vigenciaHasta` calculada con 48 horas, cuando se cambia la vigencia
predeterminada a 24 horas, entonces la `vigenciaHasta` de esa cotizacion no cambia y la cotizacion
aprobada siguiente usa 24 horas.

### Uso de IA y umbrales

#### CA-020: Umbrales incoherentes se rechazan

Dado un intento de guardar `umbralAutomatico` 0.4000 y `umbralDescarte` 0.6000, cuando se envia la
peticion, entonces la respuesta es 422 con codigo `UMBRALES_INCOHERENTES` y los umbrales no cambian.

#### CA-021: Los umbrales determinan el semaforo

Dada una organizacion con `umbralAutomatico` 0.8000 y `umbralDescarte` 0.4500, cuando se resuelven
lineas con confianza 0.9000, 0.6000 y 0.3000, entonces sus estados de resolucion son
`RESUELTA_AUTOMATICA`, `SUGERIDA_REVISAR` y `NO_ENCONTRADA` respectivamente.

#### CA-022: Desactivar la IA no rompe el flujo manual

Dada una organizacion con `usaIa` en falso, cuando un cotizador captura una solicitud, entonces la
respuesta es correcta, no se invoca al proveedor de IA, el borrador se crea sin lineas y el operador
puede agregarlas manualmente.

### Aislamiento

#### CA-023: Aislamiento entre organizaciones en la configuracion

Dado un administrador de la organizacion A y una sucursal existente de la organizacion B, cuando
consulta o edita esa sucursal por su identificador, entonces ambas respuestas son 404 con codigo
`RECURSO_NO_ENCONTRADO`, nunca 403, y la sucursal de B no se modifica.

#### CA-024: La configuracion leida es siempre la propia

Dados dos administradores, uno de la organizacion A y otro de la B, cuando cada uno consulta
`GET /api/configuracion-organizacion` y `GET /api/configuracion-cotizacion`, entonces cada uno recibe
exclusivamente los valores de su organizacion, sin ningun campo de la otra y sin las notas internas
del ambito plataforma.

## Verificacion requerida para cierre

Pruebas unitarias:

- [ ] Validacion del esquema de configuracion de cotizacion: vigencia fuera de 1 a 8760, decimales
      fuera de 0 a 4, modo de redondeo desconocido, porcentaje de impuesto fuera de 0 a 100.
- [ ] Regla de coherencia de umbrales, con casos limite de igualdad y de valores en los extremos 0 y
      1.
- [ ] Mapeo de confianza a estado de resolucion para los tres tramos, incluidos los valores
      exactamente iguales a cada umbral.
- [ ] Normalizacion del codigo de sucursal a mayusculas y sin espacios antes de validar unicidad.
- [ ] Validacion del archivo de logo: formato, tamaño y dimensiones minimas.

Pruebas de integracion:

- [ ] Edicion de identidad y persistencia de los valores.
- [ ] Conflicto de nombre e identificacion fiscal duplicados entre organizaciones distintas.
- [ ] Carga, reemplazo y eliminacion del logo, verificando que el archivo anterior se conserva.
- [ ] Cambio de moneda base sin confirmacion y con confirmacion, verificando que los precios
      conservan su valor numerico y que se devuelve la advertencia de listas afectadas.
- [ ] Una cotizacion aprobada conserva moneda, tasa e importes tras cambiar la moneda base, el
      impuesto, el redondeo y el logo de la organizacion.
- [ ] Alta, edicion e inactivacion de sucursales, con los conflictos de nombre y codigo.
- [ ] Bloqueo de inactivacion de la sucursal principal y de la sucursal que dejaria a un usuario sin
      ninguna.
- [ ] Una sucursal inactiva no se puede asignar a un usuario ni elegir como sucursal activa.
- [ ] `permiteSobrescribirPrecio` en falso bloquea la sobrescritura de un usuario que si tiene el
      permiso.
- [ ] Lista predeterminada ajena responde no encontrado e inactiva responde regla de negocio.
- [ ] Cambio de umbrales y su efecto en la resolucion de lineas posteriores, sin recalcular las
      anteriores.
- [ ] `usaIa` en falso: la captura de solicitud no invoca al proveedor y crea el borrador vacio.
- [ ] **Aislamiento entre organizaciones**: un usuario de la organizacion A intenta leer y modificar
      la configuracion, el logo, una sucursal y la configuracion de cotizacion de la organizacion B, y
      recibe respuesta de no encontrado en todos los casos, nunca de prohibido y nunca datos ajenos.
- [ ] Un usuario con el perfil `Cotizador` recibe permiso denegado en todos los endpoints de este
      modulo.
- [ ] Un usuario de ambito plataforma recibe `CONTEXTO_ORGANIZACION_REQUERIDO` en todos los endpoints
      de este modulo.

Pruebas manuales:

- [ ] Cargar un logo real y comprobar en la vista previa de la plantilla que aparece con la
      proporcion correcta.
- [ ] Cambiar la moneda base y verificar que el dialogo de confirmacion enuncia la consecuencia y
      exige escribir el codigo de la moneda.
- [ ] Cambiar el impuesto y el redondeo, generar una cotizacion nueva y comprobar el calculo contra
      el resultado manual.
- [ ] Verificar que una cotizacion aprobada antes de esos cambios muestra exactamente los mismos
      importes que antes.
- [ ] Mover los controles de umbral y comprobar que la barra de semaforo se actualiza y refleja los
      tres tramos.
- [ ] Desactivar el uso de IA y comprobar que la pantalla de captura sigue funcionando y avisa de que
      el borrador se creara vacio.

## Preguntas abiertas

1. No existe forma de trasladar la marca de sucursal principal a otra sucursal. Si una organizacion
   cierra su local original, hoy solo puede renombrar la principal. Falta decidir si se agrega una
   operacion explicita de traslado.
2. Falta decidir si la configuracion de cotizacion debe poder variar por sucursal. Hoy es unica por
   organizacion y eso simplifica el motor de precios; una cadena con impuestos distintos por region
   lo necesitaria.
3. No hay historial de cambios de configuracion. Con `docs/decisions/0011-auditoria-y-trazabilidad.md`
   pendiente de escribir, queda por decidir si los cambios de impuesto, moneda y umbrales se
   registran en una bitacora consultable.
4. Cambiar la moneda base no ofrece reconversion de precios. Falta decidir si en una version
   posterior se ofrece una conversion masiva asistida con una tasa indicada por el administrador.
5. No esta definido si se deben conservar los archivos de logo antiguos de forma indefinida o si
   procede una politica de retencion ligada a los documentos que los referencian.
6. El catalogo comun de errores `docs/08-catalogo-errores.md` todavia no existe; los codigos de esta
   spec son la propuesta inicial.

## Decisiones MVP v1

| Decision | Motivo |
|----------|--------|
| La configuracion nunca altera cotizaciones ya aprobadas | Aprobar congela el documento; si un cambio de impuesto reescribiera el pasado, ninguna cotizacion seria confiable |
| Cambiar la moneda base no reconvierte precios | Una conversion automatica con una tasa elegida por el sistema seria una decision economica tomada sin el administrador |
| El cambio de moneda base exige confirmacion explicita | Es el cambio con mayor potencial de daño silencioso de todo el modulo |
| La sucursal principal no se puede inactivar ni trasladar | Toda organizacion debe tener al menos una sucursal operativa, y el traslado no tiene demanda en el piloto |
| `permiteSobrescribirPrecio` restringe incluso a quien tiene el permiso | Permite a una organizacion prohibir la practica sin rehacer la asignacion de perfiles |
| La configuracion de cotizacion es unica por organizacion | Configuracion por sucursal multiplicaria los caminos del motor de precios sin caso real en el piloto |
| Los umbrales se siguen usando con `usaIa` en falso | El motor de resolucion tambien opera en la busqueda manual de items |
| La regla de empate de 0.05 no es configurable | Es una salvaguarda contra falsos positivos, no una preferencia; vive en `docs/decisions/0007-estrategia-de-matching.md` |
| El logo antiguo se conserva al reemplazarlo | Los documentos ya generados lo referencian y deben poder reentregarse identicos |

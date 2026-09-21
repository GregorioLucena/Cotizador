# Spec 000: Plataforma y organizaciones

## Estado

En implementacion (2026-09-18)

## Objetivo

Definir el modulo de plataforma: el ambito desde el cual el proveedor del producto registra
organizaciones, las provisiona con el pack de su vertical, les crea el usuario administrador inicial,
controla su estado y observa metricas basicas de uso.

Este modulo es la puerta de entrada de cualquier negocio al producto. Al terminar el flujo descrito
aqui, una organizacion nueva debe quedar operativa sin ninguna intervencion manual en la base de
datos: con su sucursal principal, sus maestras de catalogo, su lista de precios predeterminada, su
configuracion de cotizacion, su plantilla de documento y un usuario capaz de iniciar sesion.

La frontera de responsabilidad es estricta: un usuario de plataforma **administra** organizaciones,
pero **no opera** el negocio de ninguna de ellas. No captura solicitudes, no edita catalogo, no
aprueba cotizaciones y no consulta precios ajenos.

## Dependencias

| Documento | Que aporta |
|-----------|-----------|
| `docs/06-diseno-tecnico.md` | Modelo de datos, catalogo de permisos, contratos de API y convenciones |
| `docs/decisions/0001-multi-tenancy-por-organizacion.md` | Columna discriminadora, `OrgContext`, respuesta de no encontrado ante datos ajenos |
| `docs/decisions/0002-catalogo-generico-por-vertical.md` | Packs de vertical y su materializacion por copia al provisionar |
| `docs/decisions/0008-moneda-base-y-presentacion.md` | Moneda base de calculo y moneda de presentacion opcional |
| `docs/decisions/0007-estrategia-de-matching.md` | Significado de los umbrales de confianza que se fijan al crear la organizacion |
| `docs/01-glosario.md` | Vocabulario: `Organizacion`, `Sucursal`, `Vertical`, `Pack de vertical`, `Usuario` |

Esta especificacion debe estar implementada antes de `docs/specs/002-configuracion-organizacion.md`,
`docs/specs/003-maestras-catalogo.md` y todas las posteriores, porque ninguna organizacion existe sin
ella. Depende a su vez del mecanismo de autenticacion y del `OrgContext` descritos en
`docs/specs/001-usuarios-perfiles.md`.

## Alcance MVP v1

Incluye:

- Consulta del catalogo global de verticales y del catalogo global de monedas.
- Listado, busqueda y consulta de detalle de organizaciones desde el ambito plataforma.
- Alta de organizacion con sus datos de identidad, vertical, monedas, zona horaria, locale, uso de IA
  y umbrales de confianza.
- Provisionamiento transaccional de la organizacion a partir del pack de su vertical.
- Edicion de los datos de una organizacion desde el ambito plataforma.
- Inactivacion y reactivacion de una organizacion, con su efecto sobre el inicio de sesion de sus
  usuarios.
- Creacion del usuario administrador inicial con contraseña temporal y obligacion de cambiarla.
- Vista de plataforma con metricas basicas por organizacion.

No incluye en esta version:

- Autogestion de registro: ninguna organizacion se da de alta sola. El proveedor la crea.
- Facturacion, planes, limites de uso o cobro de la suscripcion.
- Eliminacion fisica de una organizacion o exportacion masiva de sus datos.
- Reasignacion del vertical de una organizacion ya provisionada.
- Sincronizacion posterior de un pack de vertical con organizaciones existentes.
- Administracion de usuarios de ambito plataforma distintos del superadmin de semilla.
- Metricas historicas con series temporales, tableros configurables o exportacion de informes.

## Conceptos principales

### Plataforma

La instalacion completa del producto, operada por un unico proveedor. Es el ambito que contiene a
todas las organizaciones. Un usuario de plataforma tiene `organizacionId` nulo y `ambito` igual a
`PLATAFORMA` en su `OrgContext`.

### Organizacion

El negocio que contrata el servicio y la frontera de aislamiento de datos. Toda la informacion
operativa del producto pertenece a exactamente una organizacion.

### Vertical

Rubro de negocio de la organizacion, tomado del catalogo global: `FERRETERIA`, `REPUESTOS`,
`AUTOMOTRIZ` o `GENERICO`. Determina que pack se aplica al provisionar y despues queda como dato
informativo. Ninguna regla de negocio posterior puede ramificar por vertical.

### Pack de vertical

Conjunto de datos semilla versionado en codigo que describe el punto de partida de una organizacion
de ese rubro: definiciones de atributo, categorias sugeridas, unidades de medida, sinonimos
frecuentes, configuracion inicial de cotizacion y plantilla de documento inicial.

### Provisionamiento

Operacion que materializa el pack de vertical como datos propios de la organizacion recien creada.
Es una copia, no una herencia: terminada la operacion, la organizacion es dueña de esos datos y puede
modificarlos sin afectar al pack ni a otras organizaciones.

### Usuario administrador inicial

Primer usuario de ambito organizacion, creado por el proveedor con el perfil
`Administrador Organizacion` y una contraseña temporal que debe cambiar en su primer ingreso. Es
quien continua la configuracion desde dentro de la organizacion.

## Datos requeridos

### Tabla `verticales` (global de plataforma)

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` generado por la base de datos |
| `codigo` | Si | Unico. Valores de semilla: `FERRETERIA`, `REPUESTOS`, `AUTOMOTRIZ`, `GENERICO` |
| `nombre` | Si | Etiqueta visible en la interfaz |
| `descripcion` | No | Texto breve que orienta la eleccion del rubro |
| `estadoRegistro` | Si | `ACTIVO` o `INACTIVO`. Solo los activos se pueden elegir al crear |

Esta tabla no lleva `organizacionId`. Se crea y mantiene por semilla; no se administra desde la
interfaz en esta version.

### Tabla `monedas` (global de plataforma)

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `codigoIso` | Si | Unico, tres letras: `USD`, `VES`, `COP`, `EUR` |
| `nombre` | Si | Nombre de la moneda |
| `simbolo` | Si | Simbolo de presentacion |
| `decimales` | Si | Entero. Decimales de presentacion, no de calculo |
| `estadoRegistro` | Si | `ACTIVO` o `INACTIVO` |

La organizacion elige monedas de este catalogo; no puede crearlas.

### Tabla `organizaciones`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `nombre` | Si | Nombre comercial. Unico en toda la plataforma. Entre 3 y 120 caracteres |
| `razonSocial` | No | Denominacion legal para el documento |
| `identificacionFiscal` | No | Unico parcial cuando no es nulo |
| `verticalId` | Si | Referencia a un vertical activo. No se puede cambiar despues de provisionar |
| `telefono` | No | Contacto del negocio |
| `email` | No | Contacto del negocio. Formato de correo valido |
| `direccion` | No | Domicilio para el documento |
| `logoUrl` | No | Se carga desde la organizacion; ver `docs/specs/002-configuracion-organizacion.md` |
| `monedaBaseId` | Si | Moneda de calculo de todos los precios |
| `monedaPresentacionId` | No | Moneda adicional de presentacion. Debe ser distinta de la base |
| `zonaHoraria` | Si | Identificador IANA, por ejemplo `America/Caracas`. Predeterminado configurable |
| `locale` | Si | Codigo de idioma y region, por ejemplo `es-VE`. Predeterminado `es-VE` |
| `usaIa` | Si | Booleano. Predeterminado verdadero |
| `umbralAutomatico` | Si | `numeric(5,4)` entre 0 y 1. Predeterminado 0.8000 |
| `umbralDescarte` | Si | `numeric(5,4)` entre 0 y 1. Predeterminado 0.4500. Debe ser menor que `umbralAutomatico` |
| `notasInternas` | No | Visible solo para el ambito plataforma. Nunca se muestra dentro de la organizacion |
| `estadoRegistro` | Si | `ACTIVO` o `INACTIVO`. Predeterminado `ACTIVO` |
| `createdAt`, `updatedAt`, `createdById`, `updatedById` | Si | Auditoria estandar |

### Entidades creadas por el provisionamiento

El provisionamiento no agrega tablas nuevas: escribe filas en tablas ya definidas en
`docs/06-diseno-tecnico.md`.

| Entidad | Cantidad | Origen del contenido |
|---------|----------|----------------------|
| `sucursales` | 1 | Sucursal principal, `esPrincipal` verdadero |
| `unidades_medida` | N | Unidades habituales del pack |
| `definiciones_atributo` | N | Definiciones del pack con tipo, opciones, obligatoriedad y orden |
| `categorias` | N | Categorias sugeridas del pack, con un solo nivel de jerarquia |
| `listas_precio` | 1 | Lista predeterminada en la moneda base, `esPredeterminada` verdadero |
| `configuraciones_cotizacion` | 1 | Valores iniciales del pack; `listaPrecioPredeterminadaId` apunta a la lista creada |
| `plantillas_documento` | 1 | Plantilla inicial del pack, `esPredeterminada` verdadero, `version` 1 |

### Datos del usuario administrador inicial

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `nombreCompleto` | Si | Entre 3 y 120 caracteres |
| `email` | Si | Unico en toda la plataforma, no solo en la organizacion |
| `telefono` | No | Contacto |
| `passwordTemporal` | No | Si no se envia, el sistema genera una y la devuelve una sola vez |

El registro resultante en `usuarios` lleva `organizacionId` de la organizacion,
`debeCambiarPassword` verdadero, `estadoRegistro` `ACTIVO`, una fila en `usuario_perfiles` con el
perfil `Administrador Organizacion` y una fila en `usuario_sucursales` con la sucursal principal.

### Metricas basicas por organizacion

Son valores derivados, no una tabla nueva.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `organizacionId` | Si | Identificador de la organizacion |
| `nombre` | Si | Nombre de la organizacion |
| `vertical` | Si | Codigo del vertical |
| `estadoRegistro` | Si | Estado actual |
| `usuariosActivos` | Si | Conteo de usuarios con `estadoRegistro` `ACTIVO` |
| `itemsActivos` | Si | Conteo de items con `estadoRegistro` `ACTIVO` |
| `cotizacionesTotales` | Si | Conteo de cotizaciones no anuladas |
| `cotizacionesPeriodo` | Si | Conteo en el rango consultado, predeterminado los ultimos 30 dias |
| `ultimaCotizacionAt` | No | Nulo si la organizacion todavia no cotizo |
| `ultimoAccesoAt` | No | Maximo `ultimoAccesoAt` entre sus usuarios. Nulo si nadie ingreso |

## Reglas de negocio

### Catalogos globales

1. Los catalogos de verticales y monedas son globales de plataforma y no llevan `organizacionId`.
2. Cualquier usuario autenticado puede leer ambos catalogos, porque la interfaz los necesita para
   mostrar etiquetas. La lectura devuelve unicamente registros con `estadoRegistro` `ACTIVO` salvo
   que se pida lo contrario de forma explicita.
3. Ni verticales ni monedas se crean, editan ni inactivan desde la interfaz en esta version. Se
   gestionan por semilla idempotente.

### Alta de organizacion

4. Solo un usuario con `plataforma.organizaciones.crear` puede registrar una organizacion.
5. El `nombre` debe ser unico en toda la plataforma. Un nombre repetido devuelve conflicto.
6. La `identificacionFiscal`, cuando se informa, debe ser unica en toda la plataforma. Un valor
   repetido devuelve conflicto. Cuando es nula no participa de la unicidad.
7. El `verticalId` debe referenciar un vertical activo y debe existir un pack registrado para su
   codigo. Si no hay pack disponible, el alta se rechaza y no se crea nada.
8. La `monedaBaseId` debe referenciar una moneda activa.
9. La `monedaPresentacionId`, cuando se informa, debe referenciar una moneda activa distinta de la
   base. Si coincide con la base, la entrada es invalida.
10. `umbralAutomatico` y `umbralDescarte` deben estar entre 0 y 1, y `umbralDescarte` debe ser
    estrictamente menor que `umbralAutomatico`. Si no se informan, se aplican 0.8000 y 0.4500.
11. Si `usaIa` es falso, los umbrales se persisten igual con sus valores predeterminados, porque el
    motor de resolucion los usa aunque el operador arme la cotizacion manualmente.
12. La zona horaria debe ser un identificador IANA valido y el locale un codigo de idioma y region
    valido.
13. El alta y el provisionamiento ocurren en la misma transaccion. La respuesta exitosa implica que
    la organizacion quedo operativa.

### Provisionamiento

14. El provisionamiento se ejecuta una sola vez, dentro de la transaccion de creacion de la
    organizacion, y copia el contenido del pack del vertical elegido.
15. La operacion crea exactamente: una sucursal principal, las unidades de medida del pack, las
    definiciones de atributo del pack, las categorias sugeridas del pack, una lista de precios
    predeterminada en la moneda base, una configuracion de cotizacion y una plantilla de documento
    predeterminada.
16. La sucursal principal se crea con `esPrincipal` verdadero, nombre predeterminado `Principal` y
    codigo `PRIN`, o con el nombre y codigo enviados en el alta si se informan.
17. Todas las filas creadas llevan el `organizacionId` de la organizacion nueva y `estadoRegistro`
    `ACTIVO`.
18. Si cualquier paso del provisionamiento falla, la transaccion completa se revierte y no queda una
    organizacion a medio crear. La respuesta es un error del servidor con el codigo de fallo de
    provisionamiento.
19. Terminado el provisionamiento, el pack deja de mandar: modificar el pack en codigo no altera
    ninguna organizacion existente, y modificar los datos de la organizacion no altera el pack.
20. Dos organizaciones del mismo vertical se provisionan con el mismo contenido inicial pero con
    filas independientes. Editar una categoria de la organizacion A no puede afectar a la B.
21. La version del pack aplicada se registra en el resumen del provisionamiento devuelto al ambito
    plataforma, para poder diagnosticar diferencias entre organizaciones creadas en momentos
    distintos.

### Edicion y estado de la organizacion

22. Solo un usuario con `plataforma.organizaciones.editar` puede modificar una organizacion desde el
    ambito plataforma.
23. El `verticalId` no se puede modificar despues de provisionar. Intentarlo devuelve regla de
    negocio incumplida.
24. La `monedaBaseId` se puede modificar, pero el cambio no reconvierte ningun precio ya cargado.
    La interfaz debe advertirlo de forma explicita antes de confirmar. La regla completa vive en
    `docs/specs/002-configuracion-organizacion.md`.
25. Inactivar una organizacion establece `estadoRegistro` `INACTIVO`. No borra ni anula ningun dato.
26. Mientras la organizacion esta inactiva, ninguno de sus usuarios puede iniciar sesion ni refrescar
    su token, aunque el usuario este activo. El intento devuelve el mismo error generico de
    credenciales invalidas que un usuario inexistente, para no revelar el estado de la cuenta.
27. Las sesiones vigentes de los usuarios de una organizacion que se inactiva se revocan en la misma
    operacion, de modo que el acceso cesa sin esperar al vencimiento del token.
28. Reactivar una organizacion restablece el inicio de sesion de sus usuarios activos. No restaura
    sesiones revocadas: cada usuario debe autenticarse de nuevo.
29. Una organizacion no se elimina fisicamente en ningun caso.
30. Las `notasInternas` son de uso exclusivo del ambito plataforma y nunca se devuelven en respuestas
    consumidas desde el ambito organizacion.

### Usuario administrador inicial

31. Solo un usuario con `plataforma.usuarios.administrar` puede crear el usuario administrador
    inicial de una organizacion.
32. El correo debe ser unico en toda la plataforma. Un correo ya registrado, incluso en otra
    organizacion, devuelve conflicto.
33. Si no se envia contraseña temporal, el sistema genera una que cumple la politica de contraseña
    definida en `docs/specs/001-usuarios-perfiles.md` y la devuelve en la respuesta de creacion.
34. La contraseña temporal se devuelve una unica vez, en esa respuesta, y nunca se puede volver a
    consultar. Solo se persiste su hash.
35. El usuario creado queda con `debeCambiarPassword` verdadero y no puede operar hasta cambiarla.
36. El usuario creado recibe el perfil `Administrador Organizacion` y acceso a la sucursal principal.
37. La operacion es idempotente respecto del concepto de usuario inicial: si la organizacion ya tiene
    al menos un usuario con el perfil `Administrador Organizacion` activo, la operacion devuelve
    conflicto e indica que la administracion de usuarios continua desde dentro de la organizacion.
38. No se puede crear el usuario inicial de una organizacion inactiva.

### Separacion de ambitos

39. Un usuario de plataforma tiene `organizacionId` nulo y `ambito` `PLATAFORMA`. Los servicios de
    dominio de la organizacion exigen `ctx.organizacionId` no nulo y devuelven error de contexto
    cuando falta.
40. Un usuario de plataforma no puede capturar solicitudes, editar catalogo, administrar precios,
    aprobar cotizaciones ni leer datos operativos de ninguna organizacion. Esos permisos no forman
    parte del perfil `Superadmin Plataforma`.
41. Un usuario de ambito organizacion no puede invocar ningun endpoint de plataforma. La ausencia del
    permiso `plataforma.*` devuelve permiso denegado.
42. Los servicios de plataforma son la unica excepcion a la regla de no recibir `organizacionId`
    desde la entrada: lo reciben de forma explicita en la ruta y exigen un permiso `plataforma.*`,
    segun `docs/decisions/0001-multi-tenancy-por-organizacion.md`.

### Metricas de plataforma

43. La vista de metricas requiere `plataforma.metricas.ver` y devuelve una fila por organizacion.
44. Las metricas son conteos agregados. No exponen ningun dato operativo identificable: ni nombres de
    clientes, ni items, ni importes, ni contenido de cotizaciones.
45. El periodo de las metricas es un rango de fechas opcional; sin rango se usan los ultimos 30 dias.
46. Las organizaciones inactivas aparecen en la vista con su estado visible y sus conteos historicos.

## Permisos

| Permiso | Uso en esta spec |
|---------|------------------|
| `plataforma.organizaciones.ver` | Listar organizaciones y ver el detalle de una |
| `plataforma.organizaciones.crear` | Registrar una organizacion y provisionarla |
| `plataforma.organizaciones.editar` | Editar datos e inactivar o reactivar una organizacion |
| `plataforma.usuarios.administrar` | Crear el usuario administrador inicial de una organizacion |
| `plataforma.metricas.ver` | Consultar la vista de metricas por organizacion |

Los cuatro primeros los satisface el comodin `plataforma.*` del perfil `Superadmin Plataforma`. La
lectura de verticales y monedas solo exige autenticacion.

Ningun permiso de los modulos `configuracion`, `seguridad`, `catalogo`, `precios`, `clientes`,
`cotizaciones`, `plantillas` o `reportes` forma parte del ambito plataforma.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/verticales` | autenticado | Catalogo global de rubros disponibles |
| GET | `/api/monedas` | autenticado | Catalogo global de monedas |
| GET | `/api/organizaciones` | `plataforma.organizaciones.ver` | Listado paginado con busqueda y filtro por estado y vertical |
| POST | `/api/organizaciones` | `plataforma.organizaciones.crear` | Alta y provisionamiento en una transaccion |
| GET | `/api/organizaciones/:id` | `plataforma.organizaciones.ver` | Detalle con el resumen de provisionamiento |
| PATCH | `/api/organizaciones/:id` | `plataforma.organizaciones.editar` | Edicion de datos y cambio de `estadoRegistro` |
| POST | `/api/organizaciones/:id/usuario-inicial` | `plataforma.usuarios.administrar` | Crear el administrador inicial |
| GET | `/api/plataforma/metricas` | `plataforma.metricas.ver` | Metricas basicas por organizacion |

La ruta `GET /api/plataforma/metricas` no figura en la tabla de endpoints de
`docs/06-diseno-tecnico.md`; esta especificacion la incorpora siguiendo sus convenciones para dar
soporte al permiso `plataforma.metricas.ver`, que si esta definido alli.

### Alta de organizacion

```typescript
// POST /api/organizaciones
type CrearOrganizacionInput = {
  nombre: string;                      // 3 a 120 caracteres, unico
  razonSocial?: string;
  identificacionFiscal?: string;       // unico cuando se informa
  verticalId: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  monedaBaseId: string;
  monedaPresentacionId?: string;       // distinta de la base
  zonaHoraria: string;                 // identificador IANA
  locale: string;                      // por ejemplo 'es-VE'
  usaIa?: boolean;                     // predeterminado true
  umbralAutomatico?: string;           // decimal como cadena, predeterminado '0.8000'
  umbralDescarte?: string;             // decimal como cadena, predeterminado '0.4500'
  notasInternas?: string;
  sucursalPrincipal?: {
    nombre: string;
    codigo: string;
    direccion?: string;
    telefono?: string;
  };
};

type CrearOrganizacionResultado = {
  organizacion: OrganizacionDetalle;
  provisionamiento: {
    verticalCodigo: string;
    packVersion: string;
    sucursalPrincipalId: string;
    listaPrecioPredeterminadaId: string;
    plantillaDocumentoId: string;
    unidadesMedidaCreadas: number;
    definicionesAtributoCreadas: number;
    categoriasCreadas: number;
  };
};

// GET /api/organizaciones/:id
type ObtenerOrganizacionResultado = {
  organizacion: OrganizacionDetalle;
  provisionamiento: CrearOrganizacionResultado['provisionamiento'];
  usuarios: Array<{
    id: string;
    nombreCompleto: string;
    email: string;
    estadoRegistro: 'ACTIVO' | 'INACTIVO';
    esAdministrador: boolean;
    createdAt: string;
  }>;
  tieneAdministrador: boolean;
};
```

### Usuario administrador inicial

```typescript
// POST /api/organizaciones/:id/usuario-inicial
type CrearUsuarioInicialInput = {
  nombreCompleto: string;
  email: string;
  telefono?: string;
  passwordTemporal?: string;           // si falta, el sistema la genera
};

type CrearUsuarioInicialResultado = {
  usuarioId: string;
  email: string;
  passwordTemporal: string;            // se devuelve una unica vez, nunca se vuelve a consultar
  debeCambiarPassword: true;
  perfiles: string[];                  // ['Administrador Organizacion']
  sucursalIds: string[];               // [sucursal principal]
};
```

### Metricas de plataforma

```typescript
// GET /api/plataforma/metricas?desde=&hasta=
type MetricaOrganizacion = {
  organizacionId: string;
  nombre: string;
  vertical: string;
  estadoRegistro: 'ACTIVO' | 'INACTIVO';
  usuariosActivos: number;
  itemsActivos: number;
  cotizacionesTotales: number;
  cotizacionesPeriodo: number;
  ultimaCotizacionAt: string | null;   // ISO 8601 en UTC
  ultimoAccesoAt: string | null;
};
```

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `VALIDACION_ENTRADA_INVALIDA` | La entrada no cumple el esquema: nombre corto, correo mal formado, umbral fuera del rango 0 a 1, zona horaria o locale invalidos |
| `PERMISO_DENEGADO` | El usuario autenticado no tiene el permiso `plataforma.*` requerido |
| `CONTEXTO_PLATAFORMA_REQUERIDO` | Un usuario de ambito organizacion invoca un endpoint de plataforma |
| `RECURSO_NO_ENCONTRADO` | La organizacion, el vertical o la moneda indicados no existen |
| `ORGANIZACION_NOMBRE_DUPLICADO` | Ya existe una organizacion con ese nombre |
| `ORGANIZACION_IDENTIFICACION_DUPLICADA` | Ya existe una organizacion con esa identificacion fiscal |
| `VERTICAL_INACTIVO` | El vertical elegido existe pero esta inactivo |
| `MONEDA_INACTIVA` | La moneda base o la de presentacion existe pero esta inactiva |
| `MONEDA_PRESENTACION_IGUAL_A_BASE` | La moneda de presentacion coincide con la moneda base |
| `UMBRALES_INCOHERENTES` | `umbralDescarte` es mayor o igual que `umbralAutomatico` |
| `PACK_VERTICAL_NO_DISPONIBLE` | No existe un pack registrado para el codigo del vertical elegido |
| `PROVISIONAMIENTO_FALLIDO` | Un paso del provisionamiento fallo y la transaccion se revirtio |
| `VERTICAL_NO_MODIFICABLE` | Se intenta cambiar el vertical de una organizacion ya provisionada |
| `USUARIO_EMAIL_DUPLICADO` | El correo del usuario inicial ya existe en la plataforma |
| `ORGANIZACION_YA_TIENE_ADMINISTRADOR` | Se intenta crear el usuario inicial de una organizacion que ya tiene un administrador activo |
| `ORGANIZACION_INACTIVA` | Se intenta crear el usuario inicial o provisionar sobre una organizacion inactiva |
| `PASSWORD_DEBIL` | La contraseña temporal enviada no cumple la politica de contraseña |

Los codigos se corresponden con el formato del catalogo comun de errores
`docs/08-catalogo-errores.md`, que todavia esta pendiente de publicacion. Cada codigo se transporta
en la envoltura `{ "error": { "code", "message", "details" } }` con el estado HTTP que corresponde
segun la tabla de codigos de estado de `docs/06-diseno-tecnico.md`: 400 para validacion, 403 para
permiso, 404 para recurso ausente, 409 para duplicados y conflictos de estado, 422 para reglas de
negocio incumplidas y 500 para el fallo de provisionamiento.

## Experiencia de usuario

El area de plataforma vive bajo el prefijo `/plataforma` y solo es visible para usuarios de ambito
`PLATAFORMA`. Un usuario de organizacion que navegue a esas rutas recibe la pantalla de acceso
denegado, sin enumerar las opciones existentes.

| Ruta | Pantalla | Contenido |
|------|----------|-----------|
| `/plataforma/organizaciones` | Listado | Tabla con nombre, vertical, moneda base, usuarios activos, estado y fecha de alta. Buscador por nombre e identificacion fiscal, filtros por vertical y estado, paginacion |
| `/plataforma/organizaciones/nueva` | Alta | Formulario en dos bloques: identidad y configuracion inicial |
| `/plataforma/organizaciones/:id` | Detalle | Datos, resumen de provisionamiento, usuarios existentes y acciones |
| `/plataforma/organizaciones/:id/editar` | Edicion | Mismos campos del alta salvo el vertical, que se muestra bloqueado con la razon |
| `/plataforma/metricas` | Metricas | Tabla de metricas por organizacion con selector de periodo |

### Patron de alta

El formulario de alta se organiza en dos bloques visibles a la vez, no en un asistente por pasos,
porque el conjunto de campos es corto y el proveedor lo completa con los datos ya recolectados.

1. **Identidad**: nombre, razon social, identificacion fiscal, telefono, correo, direccion.
2. **Configuracion inicial**: vertical, moneda base, moneda de presentacion, zona horaria, locale,
   uso de IA, umbrales y nombre y codigo de la sucursal principal.

El selector de vertical muestra, junto a cada opcion, un resumen de lo que aportara el pack: cuantas
categorias, cuantas unidades y cuantas definiciones de atributo. Debajo del selector se muestra el
aviso de que el vertical no se podra cambiar despues.

Los umbrales se presentan con sus valores predeterminados ya cargados y una explicacion en una linea:
por encima del umbral automatico la linea sale en verde, por debajo del umbral de descarte sale en
rojo, y entre ambos en ambar. El detalle del semaforo esta en
`docs/specs/002-configuracion-organizacion.md`.

### Confirmacion del alta

Al guardar, la pantalla muestra el resultado del provisionamiento como lista de verificacion con lo
que quedo creado, y ofrece como accion siguiente y destacada crear el usuario administrador inicial.

### Usuario administrador inicial

Se crea desde un dialogo en el detalle de la organizacion. Al confirmar, la contraseña temporal se
muestra una sola vez en un bloque con accion de copiar y un aviso de que no se volvera a mostrar. El
dialogo no se cierra solo: exige confirmacion explicita de que la contraseña fue copiada.

Si la organizacion ya tiene un administrador activo, la accion aparece deshabilitada con el texto de
que la administracion de usuarios continua desde dentro de la organizacion.

### Inactivacion

La accion de inactivar abre una confirmacion que enuncia la consecuencia en una frase: los usuarios
de la organizacion no podran iniciar sesion y sus sesiones activas se cerraran. Los datos se
conservan. La accion de reactivar no pide confirmacion.

### Mensajes

| Situacion | Mensaje |
|-----------|---------|
| Alta correcta | Organizacion creada y provisionada correctamente |
| Nombre duplicado | Ya existe una organizacion con ese nombre |
| Identificacion duplicada | Ya existe una organizacion con esa identificacion fiscal |
| Umbrales incoherentes | El umbral de descarte debe ser menor que el umbral automatico |
| Vertical bloqueado | El vertical no se puede cambiar porque la organizacion ya fue provisionada |
| Provisionamiento fallido | No se pudo provisionar la organizacion. No se creo ningun dato. Reintente |
| Usuario inicial creado | Usuario administrador creado. Copie la contraseña temporal: no se volvera a mostrar |
| Ya tiene administrador | Esta organizacion ya tiene un administrador. Los usuarios se administran desde la organizacion |
| Inactivacion correcta | Organizacion inactivada. Sus usuarios ya no pueden iniciar sesion |

## Criterios de aceptacion

### Catalogos globales

#### CA-001: Lectura del catalogo de verticales

Dado un usuario autenticado de cualquier ambito, cuando consulta `GET /api/verticales`, entonces
recibe los verticales con `estadoRegistro` `ACTIVO` y cada uno incluye codigo, nombre y descripcion.

#### CA-002: Lectura del catalogo de monedas

Dado un usuario autenticado de cualquier ambito, cuando consulta `GET /api/monedas`, entonces recibe
las monedas activas con codigo ISO, nombre, simbolo y decimales de presentacion.

### Alta y provisionamiento

#### CA-003: Alta correcta deja la organizacion operativa

Dado un usuario con `plataforma.organizaciones.crear` y un vertical con pack registrado, cuando crea
una organizacion con datos validos, entonces la respuesta es 201 y la organizacion queda con una
sucursal principal, las unidades de medida, las definiciones de atributo y las categorias del pack,
una lista de precios predeterminada en la moneda base, una configuracion de cotizacion y una
plantilla de documento predeterminada, todo con su `organizacionId`.

#### CA-004: El nombre es unico en la plataforma

Dado que ya existe una organizacion llamada `Ferreteria Central`, cuando se intenta crear otra con
el mismo nombre, entonces la respuesta es 409 con codigo `ORGANIZACION_NOMBRE_DUPLICADO` y no se crea
ningun registro.

#### CA-005: Umbrales incoherentes se rechazan

Dado un alta con `umbralAutomatico` 0.5000 y `umbralDescarte` 0.7000, cuando se envia la peticion,
entonces la respuesta es 400 con codigo `UMBRALES_INCOHERENTES` y no se crea la organizacion.

#### CA-006: La moneda de presentacion no puede ser la base

Dado un alta donde `monedaPresentacionId` es igual a `monedaBaseId`, cuando se envia la peticion,
entonces la respuesta es 400 con codigo `MONEDA_PRESENTACION_IGUAL_A_BASE`.

#### CA-007: El provisionamiento es transaccional

Dado un alta valida donde la creacion de la plantilla de documento falla, cuando termina la
operacion, entonces la respuesta es un error con codigo `PROVISIONAMIENTO_FALLIDO` y no existe en la
base ninguna fila de la organizacion, ni la organizacion misma, ni su sucursal, ni sus maestras.

#### CA-008: Dos organizaciones del mismo vertical quedan independientes

Dadas dos organizaciones creadas con el vertical `FERRETERIA`, cuando la organizacion A inactiva una
de sus categorias provisionadas, entonces la categoria equivalente de la organizacion B permanece
activa y sin cambios.

#### CA-009: Vertical sin pack disponible

Dado un vertical activo para el que no existe pack registrado en codigo, cuando se intenta crear una
organizacion con ese vertical, entonces la respuesta es 422 con codigo `PACK_VERTICAL_NO_DISPONIBLE`
y no se crea nada.

### Edicion y estado

#### CA-010: El vertical no se puede cambiar

Dada una organizacion ya provisionada, cuando un usuario con `plataforma.organizaciones.editar`
intenta modificar su `verticalId`, entonces la respuesta es 422 con codigo
`VERTICAL_NO_MODIFICABLE` y el vertical se conserva.

#### CA-011: Inactivar impide el inicio de sesion

Dada una organizacion activa con un usuario activo que puede iniciar sesion, cuando se inactiva la
organizacion, entonces ese usuario ya no puede autenticarse con sus credenciales correctas y recibe
el mismo error generico de credenciales invalidas.

#### CA-012: Inactivar revoca las sesiones vigentes

Dado un usuario de una organizacion con una sesion activa y un token de refresco valido, cuando se
inactiva la organizacion, entonces el intento de refrescar el token falla con 401 y la sesion queda
marcada como revocada.

#### CA-013: Reactivar restablece el acceso

Dada una organizacion inactivada cuyos usuarios no pueden ingresar, cuando se reactiva, entonces un
usuario activo de esa organizacion vuelve a iniciar sesion correctamente con sus credenciales.

#### CA-014: La organizacion nunca se elimina

Dada cualquier organizacion, cuando se recorren los endpoints del modulo, entonces no existe ninguna
operacion de borrado y la unica baja disponible es el cambio de `estadoRegistro` a `INACTIVO`.

### Usuario administrador inicial

#### CA-015: Creacion con contraseña generada

Dada una organizacion activa sin usuarios, cuando un usuario con `plataforma.usuarios.administrar`
crea el usuario inicial sin enviar contraseña, entonces la respuesta incluye una contraseña temporal
que cumple la politica, el usuario queda con `debeCambiarPassword` verdadero, con el perfil
`Administrador Organizacion` y con acceso a la sucursal principal.

#### CA-016: La contraseña temporal no se puede volver a consultar

Dado un usuario inicial recien creado, cuando se consulta el detalle de la organizacion o del
usuario, entonces ninguna respuesta incluye la contraseña temporal ni el hash almacenado.

#### CA-017: El primer ingreso exige cambio de contraseña

Dado el usuario inicial con su contraseña temporal, cuando inicia sesion, entonces la autenticacion
es correcta, la respuesta indica `debeCambiarPassword` verdadero y cualquier endpoint distinto de
cambio de contraseña, consulta de perfil y cierre de sesion responde con el error correspondiente,
segun `docs/specs/001-usuarios-perfiles.md`.

#### CA-018: Correo duplicado en otra organizacion

Dado un correo ya usado por un usuario de la organizacion A, cuando se intenta crear con ese correo
el usuario inicial de la organizacion B, entonces la respuesta es 409 con codigo
`USUARIO_EMAIL_DUPLICADO`.

#### CA-019: No se duplica el administrador inicial

Dada una organizacion que ya tiene un usuario activo con el perfil `Administrador Organizacion`,
cuando se invoca de nuevo la creacion del usuario inicial, entonces la respuesta es 409 con codigo
`ORGANIZACION_YA_TIENE_ADMINISTRADOR`.

### Separacion de ambitos y aislamiento

#### CA-020: Un usuario de organizacion no accede a la plataforma

Dado un usuario con el perfil `Administrador Organizacion`, cuando invoca
`GET /api/organizaciones`, entonces la respuesta es 403 con codigo `PERMISO_DENEGADO` y no recibe
ningun dato de ninguna organizacion.

#### CA-021: Un usuario de plataforma no opera cotizaciones

Dado un usuario con el perfil `Superadmin Plataforma`, cuando invoca `POST /api/precotizaciones` o
`GET /api/items`, entonces la respuesta es un error de permiso o de contexto de organizacion y en
ningun caso devuelve datos operativos de una organizacion.

#### CA-022: Las metricas no exponen datos operativos

Dado un usuario con `plataforma.metricas.ver`, cuando consulta `GET /api/plataforma/metricas`,
entonces recibe unicamente conteos agregados y fechas por organizacion, sin nombres de clientes, sin
items, sin importes y sin contenido de cotizaciones.

## Verificacion requerida para cierre

Pruebas unitarias:

- [ ] Validacion del esquema de alta: nombre fuera de rango, correo invalido, umbrales fuera de 0 a 1,
      zona horaria invalida, locale invalido.
- [ ] Regla de coherencia de umbrales con casos limite: igualdad, diferencia minima y valores nulos
      que aplican los predeterminados.
- [ ] Regla de moneda de presentacion distinta de la base.
- [ ] Generador de contraseña temporal: siempre cumple la politica de contraseña.
- [ ] Resolucion del pack por codigo de vertical, incluido el caso de pack ausente.

Pruebas de integracion:

- [ ] Alta completa con provisionamiento: se verifican las siete entidades creadas, su cantidad y su
      `organizacionId`.
- [ ] Reversion completa del provisionamiento cuando falla un paso intermedio.
- [ ] Unicidad de nombre y de identificacion fiscal, incluido el caso de identificacion nula
      repetida, que debe permitirse.
- [ ] Independencia entre dos organizaciones del mismo vertical tras modificar las maestras de una.
- [ ] Bloqueo del cambio de vertical tras el provisionamiento.
- [ ] Inactivacion de organizacion: bloqueo de login, revocacion de sesiones y fallo del refresco.
- [ ] Reactivacion y restablecimiento del acceso.
- [ ] Creacion del usuario inicial con y sin contraseña enviada, con verificacion de perfil, sucursal
      y `debeCambiarPassword`.
- [ ] Conflicto por correo duplicado entre organizaciones distintas.
- [ ] Conflicto al crear un segundo usuario inicial.
- [ ] **Aislamiento entre organizaciones**: un usuario autenticado de la organizacion A intenta leer y
      modificar registros de la organizacion B mediante identificadores conocidos, y recibe respuesta
      de no encontrado en la lectura y en la escritura, nunca de prohibido y nunca datos ajenos.
- [ ] Un usuario de ambito organizacion recibe permiso denegado en todos los endpoints de plataforma.
- [ ] Un usuario de ambito plataforma recibe error de contexto en los endpoints de dominio de la
      organizacion.
- [ ] Las metricas devuelven solo conteos y no filtran informacion operativa.

Pruebas manuales:

- [ ] Crear una organizacion de cada vertical disponible y comprobar en la interfaz que sus maestras
      quedaron cargadas y son distintas entre rubros.
- [ ] Crear el usuario administrador inicial, copiar la contraseña temporal, iniciar sesion con ella y
      completar el cambio obligatorio.
- [ ] Inactivar una organizacion mientras uno de sus usuarios tiene la aplicacion abierta y comprobar
      que queda fuera de la sesion en el siguiente refresco.
- [ ] Revisar la vista de metricas con al menos tres organizaciones y verificar los conteos contra los
      datos reales.

## Preguntas abiertas

1. El catalogo comun de errores `docs/08-catalogo-errores.md` todavia no existe. Los codigos de esta
   spec son la propuesta inicial y deben consolidarse alli antes de implementar.
2. `docs/decisions/0011-auditoria-y-trazabilidad.md` esta referenciado desde
   `docs/06-diseno-tecnico.md` pero aun no esta escrito. Queda por definir si las acciones de
   plataforma, en particular el alta y la inactivacion de una organizacion, deben registrarse en una
   bitacora propia equivalente a `cotizacion_eventos`.
3. No esta decidido si el proveedor necesita alguna vez asumir el contexto de una organizacion para
   dar soporte. Hoy la respuesta es que no, y esa restriccion esta especificada. Si cambiara, debe
   resolverse con un mecanismo auditado y explicito, no relajando la separacion de ambitos.
4. Falta definir la politica de reintento del provisionamiento: si una organizacion quedara creada sin
   provisionar por una falla parcial no cubierta por la transaccion, hoy no hay operacion para
   completarla.
5. Queda por acordar el valor predeterminado de zona horaria y locale a nivel de instalacion.

## Decisiones MVP v1

| Decision | Motivo |
|----------|--------|
| El alta y el provisionamiento ocurren en una sola transaccion | Evita organizaciones a medio crear, que son el peor estado posible para diagnosticar |
| El vertical no se puede cambiar despues de provisionar | Los datos ya se materializaron por copia; cambiar el rubro no reescribe las maestras y dejaria un estado incoherente |
| El pack se copia y no se hereda | Decision tomada en `docs/decisions/0002-catalogo-generico-por-vertical.md`: la organizacion debe poder divergir |
| La contraseña temporal se muestra una sola vez | Solo se persiste el hash; volver a mostrarla exigiria almacenarla en claro |
| Inactivar una organizacion revoca sus sesiones | Sin esto, el acceso continuaria hasta quince minutos despues de la inactivacion |
| Un usuario de plataforma no opera cotizaciones | Separacion de ambitos exigida por `docs/01-glosario.md` y por el modelo de confianza del producto |
| Las metricas son conteos agregados | El proveedor necesita supervisar el servicio, no leer los datos comerciales de sus clientes |
| No hay autoregistro de organizaciones | En el piloto la relacion comercial es directa, segun `docs/05-alcance-mvp.md` |

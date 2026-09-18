# Spec 001: Usuarios, perfiles y sesiones

## Estado

Especificada — pendiente de implementacion (2026-09-17)

## Objetivo

Definir el modelo de autenticacion y autorizacion del producto y la administracion de usuarios dentro
de una organizacion.

Esta especificacion cubre como se identifica un usuario, como se construye el `OrgContext` que
acompaña cada peticion, como se evaluan los permisos, como se administran los usuarios de una
organizacion y que reglas impiden que una organizacion se quede sin quien la administre.

Es la base de todas las demas especificaciones: ningun modulo del producto puede aplicar aislamiento
por organizacion sin el contexto que se construye aqui.

## Dependencias

| Documento | Que aporta |
|-----------|-----------|
| `docs/06-diseno-tecnico.md` | Catalogo completo de permisos, perfiles semilla, decisiones de autenticacion y modelo de `usuarios`, `sesiones`, `perfiles` |
| `docs/decisions/0001-multi-tenancy-por-organizacion.md` | `OrgContext` como unica fuente de filtrado, correo unico global, sucursal como sub ambito |
| `docs/specs/000-plataforma-organizaciones.md` | Existencia de la organizacion, su estado y el usuario administrador inicial |
| `docs/01-glosario.md` | Vocabulario: `Usuario`, `Perfil`, `Permiso`, `Contexto de organizacion`, `Sucursal` |

## Alcance MVP v1

Incluye:

- Modelo de autorizacion con perfiles de ambito `PLATAFORMA` y `ORGANIZACION`, permisos atomicos y
  evaluacion con comodin.
- Construccion del `OrgContext` en cada autenticacion y en cada refresco.
- Inicio de sesion con correo y contraseña.
- Token de acceso de 15 minutos y token de refresco opaco en cookie `HttpOnly`, con rotacion y
  revocacion.
- Cierre de sesion.
- Cambio de contraseña voluntario y cambio obligatorio en el primer ingreso.
- Politica de contraseña.
- Restablecimiento de contraseña por parte de un administrador de la organizacion.
- Alta, edicion e inactivacion de usuarios dentro de la organizacion, con asignacion de perfiles y de
  sucursales.
- Seleccion de la sucursal activa.
- Los dos perfiles operativos de organizacion con su tabla comparativa de permisos.
- Reglas de proteccion contra el bloqueo accidental de la administracion.

No incluye en esta version:

- Recuperacion de contraseña por correo mediante enlace de un solo uso.
- Segundo factor de autenticacion.
- Perfiles definidos por la organizacion: los perfiles son globales y de semilla.
- Permisos concedidos directamente a un usuario al margen de un perfil.
- Inicio de sesion federado o con proveedor externo de identidad.
- Listado de sesiones activas por usuario y cierre remoto de una sesion concreta.
- Bloqueo de cuenta por intentos fallidos y limitacion de intentos por origen.
- Administracion de usuarios de ambito plataforma desde la interfaz.

## Conceptos principales

### Usuario

Persona que usa el sistema. Se identifica por su correo, que es unico en toda la plataforma porque es
la credencial de acceso. Un usuario pertenece a una organizacion, salvo los usuarios de ambito
plataforma, que tienen `organizacionId` nulo.

### Perfil

Conjunto nombrado de permisos, global de la plataforma y creado por semilla. Tiene un ambito:
`PLATAFORMA` u `ORGANIZACION`. Un usuario puede tener uno o varios perfiles, pero todos deben ser del
mismo ambito que el usuario.

### Permiso

Autorizacion atomica con codigo `modulo.recurso.accion`. Los permisos no se asignan directamente a un
usuario: se obtienen por los perfiles que tiene.

### Permiso con comodin

Un perfil puede tener concedido un codigo terminado en `*`. `catalogo.*` satisface
`catalogo.items.crear` y cualquier otro codigo cuyo prefijo coincida hasta el punto anterior al
comodin. La evaluacion es por segmentos, no por coincidencia de texto: `catalogo.*` satisface
`catalogo.items.crear`, pero `catalogo.item*` no es un patron valido.

### OrgContext

Objeto que acompaña cada peticion autenticada y contiene la identidad efectiva del usuario. Es la
unica fuente valida para filtrar por organizacion. Se recalcula en cada login y en cada refresco;
nunca se hereda del token anterior.

```typescript
// @cotizador/shared/types
export type OrgContext = {
  usuarioId: string;
  organizacionId: string | null;   // null solo para usuarios de plataforma
  ambito: 'PLATAFORMA' | 'ORGANIZACION';
  sucursalIds: string[];
  sucursalActivaId?: string;
  permisos: string[];
  sesionId: string;
};
```

### Sesion

Registro de un inicio de sesion. Guarda el hash del token de refresco, su vencimiento, el momento de
revocacion si lo hubo, y el origen. Es lo que permite revocar el acceso sin esperar a que caduque el
token de acceso.

### Sucursal activa

Sucursal con la que el usuario esta trabajando en este momento, elegida entre las que tiene
asignadas. Determina a que sucursal se asocian las solicitudes y cotizaciones que cree. No es una
frontera de aislamiento: la frontera es la organizacion.

## Datos requeridos

### Tabla `perfiles` (global de plataforma)

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `nombre` | Si | Nombre visible: `Superadmin Plataforma`, `Administrador Organizacion`, `Cotizador` |
| `codigo` | Si | Unico, en UPPER_SNAKE_CASE: `SUPERADMIN_PLATAFORMA`, `ADMINISTRADOR_ORGANIZACION`, `COTIZADOR` |
| `ambito` | Si | `PLATAFORMA` u `ORGANIZACION` |
| `descripcion` | No | Explicacion breve mostrada al asignar perfiles |
| `esSistema` | Si | Verdadero en los tres perfiles semilla. Un perfil de sistema no se puede editar ni inactivar |
| `estadoRegistro` | Si | `ACTIVO` o `INACTIVO` |

### Tabla `permisos` (global de plataforma)

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `codigo` | Si | Unico, formato `modulo.recurso.accion` |
| `modulo` | Si | Primer segmento del codigo. Sirve para agrupar en la interfaz |
| `descripcion` | Si | Texto mostrado en la tabla comparativa de perfiles |

### Tabla `perfil_permisos` (global de plataforma)

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `perfilId` | Si | Referencia al perfil |
| `permisoId` | Si | Referencia al permiso |

Unico por par. La concesion con comodin se materializa en la semilla como el conjunto de permisos
concretos que el comodin abarca, de modo que la tabla siempre refleja el conjunto efectivo.

### Tabla `usuarios`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | No | Nulo identifica a un usuario de ambito plataforma |
| `nombreCompleto` | Si | Entre 3 y 120 caracteres |
| `email` | Si | Unico en toda la plataforma. Se normaliza a minusculas y se recorta |
| `passwordHash` | Si | bcrypt con 12 rondas. Nunca sale en ninguna respuesta |
| `telefono` | No | Contacto |
| `debeCambiarPassword` | Si | Verdadero al crear y al restablecer. Falso tras un cambio exitoso |
| `ultimoAccesoAt` | No | Se actualiza en cada login exitoso |
| `estadoRegistro` | Si | `ACTIVO` o `INACTIVO`. Un usuario inactivo no puede iniciar sesion |
| `createdAt`, `updatedAt`, `createdById`, `updatedById` | Si | Auditoria estandar |

### Tabla `usuario_perfiles`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `usuarioId` | Si | Referencia al usuario |
| `perfilId` | Si | El ambito del perfil debe coincidir con el ambito del usuario |

Unico por par. Un usuario debe tener al menos un perfil.

### Tabla `usuario_sucursales`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `usuarioId` | Si | Referencia al usuario |
| `sucursalId` | Si | Debe pertenecer a la misma organizacion que el usuario |

Unico por par. Un usuario de organizacion debe tener al menos una sucursal asignada.

### Tabla `sesiones`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid`. Viaja en el token de acceso como `sesionId` |
| `usuarioId` | Si | Referencia al usuario |
| `refreshTokenHash` | Si | SHA-256 del token opaco. Nunca se guarda el valor en claro. Indice sobre esta columna |
| `expiraAt` | Si | Vencimiento del refresco, 7 dias desde su emision |
| `revocadaAt` | No | Nulo mientras la sesion esta vigente |
| `userAgent` | No | Origen informativo |
| `ip` | No | Origen informativo |
| `createdAt` | Si | Momento de creacion |

## Reglas de negocio

### Autenticacion

1. El inicio de sesion recibe correo y contraseña. El correo se normaliza a minusculas antes de
   buscar.
2. Se autentica unicamente a un usuario con `estadoRegistro` `ACTIVO`. Un usuario inactivo recibe el
   mismo error generico que un correo inexistente.
3. Un usuario de ambito organizacion solo se autentica si su organizacion tiene `estadoRegistro`
   `ACTIVO`. Si la organizacion esta inactiva, recibe el mismo error generico.
4. La contraseña se compara contra el hash bcrypt de 12 rondas. Un fallo devuelve el mismo error
   generico, sin distinguir si el correo existe o si la contraseña es incorrecta.
5. El tiempo de respuesta ante un correo inexistente debe ser comparable al de una contraseña
   incorrecta, para no revelar la existencia de la cuenta.
6. Tras un login exitoso se cargan perfiles, permisos y sucursales, se crea una sesion, se firma el
   token de acceso y se establece la cookie de refresco. Se actualiza `ultimoAccesoAt`.
7. El token de acceso es un JWT firmado con vigencia de 15 minutos, transportado en
   `Authorization: Bearer`, y contiene el `OrgContext` completo.
8. El token de refresco es opaco y aleatorio, se entrega en una cookie `HttpOnly` con ruta
   `/api/auth` y vigencia de 7 dias, y de el solo se persiste el hash SHA-256.
9. El guard de autenticacion es global. Las unicas rutas publicas son el login, el refresco y la
   comprobacion de salud del servicio, marcadas de forma explicita.
10. Una peticion sin token, con token mal formado o con token expirado responde sin autenticacion.

### Sesiones, refresco y cierre

11. El refresco valida la cookie contra el hash almacenado, verifica que la sesion no este revocada y
    que no haya expirado.
12. Cada refresco rota el token: emite uno nuevo, revoca el anterior y actualiza el hash almacenado.
13. Un token de refresco ya usado o ya revocado no sirve. Presentarlo responde sin autenticacion.
14. El contexto se recalcula en cada refresco a partir de los datos actuales del usuario. Un permiso
    quitado o una sucursal retirada surten efecto en el siguiente refresco, a lo sumo quince minutos
    despues del cambio.
15. Si al refrescar el usuario quedo inactivo, o su organizacion quedo inactiva, el refresco falla y
    la sesion se revoca.
16. El cierre de sesion revoca la sesion actual y borra la cookie de refresco. Es idempotente:
    cerrar una sesion ya cerrada responde correctamente.
17. Revocar una sesion no invalida de inmediato el token de acceso ya emitido, que caduca a los
    quince minutos. Esa ventana es una consecuencia aceptada del diseño y esta declarada.

### Contraseñas

18. La politica de contraseña exige: minimo 10 caracteres, maximo 128, al menos una letra minuscula,
    al menos una letra mayuscula y al menos un digito. Se prohiben las contraseñas iguales al correo
    o al nombre del usuario.
19. La contraseña nunca se registra en trazas, ni se devuelve en respuestas, ni se almacena en claro.
20. Un usuario con `debeCambiarPassword` verdadero puede invocar unicamente la consulta de su perfil,
    el cambio de contraseña y el cierre de sesion. Cualquier otro endpoint responde con el error de
    cambio de contraseña requerido.
21. El cambio de contraseña exige la contraseña actual y la nueva. La nueva debe cumplir la politica
    y debe ser distinta de la actual.
22. Un cambio exitoso pone `debeCambiarPassword` en falso y revoca todas las sesiones del usuario
    salvo la actual.
23. El restablecimiento lo realiza un usuario con `seguridad.usuarios.restablecer_clave` sobre otro
    usuario de su misma organizacion. Establece una contraseña temporal, pone `debeCambiarPassword`
    en verdadero y revoca todas las sesiones del usuario afectado.
24. La contraseña temporal del restablecimiento se devuelve una unica vez en la respuesta y no se
    puede volver a consultar. Si no se envia una, el sistema la genera cumpliendo la politica.
25. Un usuario no puede restablecer su propia contraseña con esa operacion: para eso existe el cambio
    de contraseña.

### Autorizacion

26. Cada metodo publico de servicio verifica el permiso antes de tocar datos, como primer paso de la
    secuencia obligatoria de `docs/06-diseno-tecnico.md`.
27. Los permisos se leen del `OrgContext`, no de la base de datos, en cada peticion.
28. La evaluacion admite comodin por segmentos. Un permiso concedido `catalogo.*` satisface
    `catalogo.items.crear`.
29. La ausencia del permiso requerido responde con permiso denegado, sin revelar si el recurso
    existe.
30. Un usuario de ambito `ORGANIZACION` no puede tener perfiles de ambito `PLATAFORMA`, y a la
    inversa. La asignacion cruzada es invalida.
31. Los servicios de dominio de la organizacion exigen `ctx.organizacionId` no nulo. Un usuario de
    plataforma recibe error de contexto de organizacion.
32. El acceso a una sucursal se valida contra `ctx.sucursalIds` con un helper dedicado. Una sucursal
    fuera de esa lista responde como no encontrada.

### Administracion de usuarios de la organizacion

33. La administracion de usuarios opera exclusivamente dentro de la organizacion del contexto. Un
    usuario de otra organizacion se responde como no encontrado, nunca como prohibido.
34. El alta de usuario exige nombre completo, correo, al menos un perfil de ambito `ORGANIZACION` y
    al menos una sucursal de la organizacion.
35. El correo debe ser unico en toda la plataforma. Un correo repetido devuelve conflicto sin revelar
    a que organizacion pertenece.
36. El usuario creado queda con `debeCambiarPassword` verdadero y con la contraseña temporal
    devuelta una unica vez.
37. Las sucursales asignadas deben pertenecer a la organizacion del contexto y estar activas. Una
    sucursal ajena responde como no encontrada.
38. La edicion permite cambiar nombre completo, telefono, perfiles, sucursales y estado. El correo no
    se puede cambiar en esta version.
39. Quitar una sucursal o un perfil a un usuario surte efecto en su siguiente refresco de token. La
    interfaz debe advertirlo.
40. Si se quita al usuario la sucursal que tenia como activa, en el siguiente refresco su sucursal
    activa pasa a ser la primera de las que conserve.
41. Inactivar un usuario revoca todas sus sesiones en la misma operacion.
42. Un usuario no se elimina fisicamente. La unica baja es el cambio de `estadoRegistro` a
    `INACTIVO`.

### Reglas de proteccion

43. Un usuario no puede modificar sus propios perfiles. Intentarlo devuelve regla de negocio
    incumplida, aunque tenga `seguridad.usuarios.editar`.
44. Un usuario no puede inactivarse a si mismo.
45. Toda organizacion debe conservar al menos un usuario activo con el perfil
    `Administrador Organizacion`. Se rechaza cualquier operacion que dejaria a la organizacion sin
    ninguno: inactivar al ultimo administrador o quitarle el perfil.
46. Un usuario de organizacion no puede asignar ni quitar perfiles de ambito `PLATAFORMA`, ni
    siquiera con el comodin `seguridad.*`.
47. Un usuario no puede dejar a otro sin ningun perfil ni sin ninguna sucursal.
48. Estas reglas se evaluan sobre el estado resultante de la operacion, no sobre la entrada, para que
    una operacion que cambia varias cosas a la vez no pueda esquivarlas.

### Sucursal activa

49. La sucursal activa se elige entre las sucursales asignadas y activas del usuario. Una sucursal
    fuera de esa lista responde como no encontrada.
50. Al iniciar sesion, la sucursal activa es la sucursal principal si el usuario tiene acceso a ella,
    y si no la primera de sus sucursales por nombre.
51. Cambiar la sucursal activa emite un token de acceso nuevo con el contexto actualizado. No crea
    una sesion nueva ni rota el refresco.
52. La sucursal activa no amplia ni restringe el aislamiento por organizacion: es un sub ambito
    dentro de ella.

## Permisos

### Catalogo completo de permisos del MVP

Tomado de `docs/06-diseno-tecnico.md`. Es la lista cerrada: ningun modulo puede exigir un permiso que
no este aqui.

| Codigo | Descripcion |
|--------|-------------|
| `plataforma.organizaciones.ver` | Listar y ver organizaciones |
| `plataforma.organizaciones.crear` | Registrar una organizacion y provisionarla |
| `plataforma.organizaciones.editar` | Editar datos y estado de una organizacion |
| `plataforma.usuarios.administrar` | Crear el usuario administrador inicial de una organizacion |
| `plataforma.metricas.ver` | Ver metricas agregadas de la plataforma |
| `configuracion.organizacion.ver` | Ver la configuracion de la organizacion |
| `configuracion.organizacion.administrar` | Editar datos, monedas, umbrales y configuracion de cotizacion |
| `configuracion.sucursales.ver` | Ver sucursales |
| `configuracion.sucursales.administrar` | Crear y editar sucursales |
| `seguridad.usuarios.ver` | Ver usuarios de la organizacion |
| `seguridad.usuarios.crear` | Crear usuarios |
| `seguridad.usuarios.editar` | Editar usuarios, perfiles y accesos |
| `seguridad.usuarios.restablecer_clave` | Forzar el cambio de contraseña de un usuario |
| `catalogo.maestras.ver` | Ver categorias, marcas, unidades y definiciones de atributo |
| `catalogo.maestras.administrar` | Administrar categorias, marcas, unidades y definiciones de atributo |
| `catalogo.items.ver` | Ver y buscar items |
| `catalogo.items.crear` | Crear items |
| `catalogo.items.editar` | Editar e inactivar items |
| `catalogo.items.importar` | Importar catalogo, precios y alias desde archivo |
| `catalogo.alias.administrar` | Crear, editar y depurar alias |
| `precios.listas.ver` | Ver listas y precios |
| `precios.listas.administrar` | Administrar listas y precios de items |
| `precios.reglas.administrar` | Administrar reglas de descuento |
| `precios.tasas.administrar` | Actualizar tasas de cambio |
| `clientes.ver` | Ver clientes |
| `clientes.crear` | Crear clientes |
| `clientes.editar` | Editar clientes |
| `cotizaciones.ver` | Ver cotizaciones e historial |
| `cotizaciones.crear` | Capturar solicitudes y generar borradores |
| `cotizaciones.editar` | Editar lineas de un borrador |
| `cotizaciones.sobrescribir_precio` | Sobrescribir manualmente el precio de una linea |
| `cotizaciones.aprobar` | Aprobar una cotizacion |
| `cotizaciones.generar_documento` | Generar el PDF y el texto de entrega |
| `cotizaciones.registrar_resultado` | Marcar ganada o perdida |
| `cotizaciones.anular` | Anular una cotizacion con motivo |
| `plantillas.ver` | Ver plantillas de documento |
| `plantillas.administrar` | Editar la plantilla de documento |
| `reportes.ver` | Ver metricas e informes de la organizacion |

### Perfiles semilla

| Perfil | Codigo | Ambito | Permisos concedidos |
|--------|--------|--------|---------------------|
| `Superadmin Plataforma` | `SUPERADMIN_PLATAFORMA` | `PLATAFORMA` | `plataforma.*` mas lectura de metricas |
| `Administrador Organizacion` | `ADMINISTRADOR_ORGANIZACION` | `ORGANIZACION` | `configuracion.*`, `seguridad.*`, `catalogo.*`, `precios.*`, `clientes.*`, `cotizaciones.*`, `plantillas.*`, `reportes.ver` |
| `Cotizador` | `COTIZADOR` | `ORGANIZACION` | `catalogo.items.ver`, `catalogo.maestras.ver`, `catalogo.alias.administrar`, `precios.listas.ver`, `clientes.*`, `cotizaciones.ver`, `cotizaciones.crear`, `cotizaciones.editar`, `cotizaciones.aprobar`, `cotizaciones.generar_documento`, `cotizaciones.registrar_resultado`, `reportes.ver` |

### Tabla comparativa de los perfiles de organizacion

| Permiso | `Administrador Organizacion` | `Cotizador` |
|---------|:----------------------------:|:-----------:|
| `configuracion.organizacion.ver` | Si | No |
| `configuracion.organizacion.administrar` | Si | No |
| `configuracion.sucursales.ver` | Si | No |
| `configuracion.sucursales.administrar` | Si | No |
| `seguridad.usuarios.ver` | Si | No |
| `seguridad.usuarios.crear` | Si | No |
| `seguridad.usuarios.editar` | Si | No |
| `seguridad.usuarios.restablecer_clave` | Si | No |
| `catalogo.maestras.ver` | Si | Si |
| `catalogo.maestras.administrar` | Si | No |
| `catalogo.items.ver` | Si | Si |
| `catalogo.items.crear` | Si | No |
| `catalogo.items.editar` | Si | No |
| `catalogo.items.importar` | Si | No |
| `catalogo.alias.administrar` | Si | Si |
| `precios.listas.ver` | Si | Si |
| `precios.listas.administrar` | Si | No |
| `precios.reglas.administrar` | Si | No |
| `precios.tasas.administrar` | Si | No |
| `clientes.ver` | Si | Si |
| `clientes.crear` | Si | Si |
| `clientes.editar` | Si | Si |
| `cotizaciones.ver` | Si | Si |
| `cotizaciones.crear` | Si | Si |
| `cotizaciones.editar` | Si | Si |
| `cotizaciones.sobrescribir_precio` | Si | No |
| `cotizaciones.aprobar` | Si | Si |
| `cotizaciones.generar_documento` | Si | Si |
| `cotizaciones.registrar_resultado` | Si | Si |
| `cotizaciones.anular` | Si | No |
| `plantillas.ver` | Si | No |
| `plantillas.administrar` | Si | No |
| `reportes.ver` | Si | Si |

La separacion es deliberada: el `Cotizador` opera el flujo comercial completo, desde capturar el
pedido hasta entregar el documento y registrar el resultado, pero no puede tocar las condiciones
economicas ni la configuracion. No administra precios, reglas, tasas, usuarios ni plantillas, no
sobrescribe manualmente un precio y no anula una cotizacion emitida.

### Permisos usados por esta especificacion

| Permiso | Uso en esta spec |
|---------|------------------|
| `seguridad.usuarios.ver` | Listar y ver usuarios de la organizacion |
| `seguridad.usuarios.crear` | Crear un usuario |
| `seguridad.usuarios.editar` | Editar datos, perfiles, sucursales y estado de un usuario |
| `seguridad.usuarios.restablecer_clave` | Restablecer la contraseña de otro usuario |

El inicio de sesion, el refresco, el cierre de sesion, la consulta del propio perfil, el cambio de la
propia contraseña y la seleccion de sucursal activa no exigen ningun permiso: solo autenticacion.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| POST | `/api/auth/login` | publico | Autenticar con correo y contraseña |
| POST | `/api/auth/refresh` | publico con cookie | Rotar el refresco y emitir un token de acceso nuevo |
| POST | `/api/auth/logout` | autenticado | Revocar la sesion actual y borrar la cookie |
| GET | `/api/auth/perfil` | autenticado | Devolver el usuario y su contexto efectivo |
| POST | `/api/auth/cambiar-password` | autenticado | Cambiar la propia contraseña |
| POST | `/api/auth/sucursal-activa` | autenticado | Cambiar la sucursal activa y reemitir el token |
| GET | `/api/perfiles` | `seguridad.usuarios.ver` | Listar los perfiles asignables del ambito del contexto |
| GET | `/api/usuarios` | `seguridad.usuarios.ver` | Listado paginado de los usuarios de la organizacion |
| POST | `/api/usuarios` | `seguridad.usuarios.crear` | Crear un usuario de la organizacion |
| GET | `/api/usuarios/:id` | `seguridad.usuarios.ver` | Detalle de un usuario de la organizacion |
| PATCH | `/api/usuarios/:id` | `seguridad.usuarios.editar` | Editar datos, perfiles, sucursales y estado |
| POST | `/api/usuarios/:id/restablecer-password` | `seguridad.usuarios.restablecer_clave` | Restablecer la contraseña de otro usuario |

Las rutas `/api/perfiles` y `/api/usuarios` no figuran en la tabla de endpoints de
`docs/06-diseno-tecnico.md`; esta especificacion las incorpora siguiendo sus convenciones para dar
soporte a los permisos `seguridad.usuarios.*`, que si estan definidos alli.

### Inicio de sesion

```typescript
// POST /api/auth/login
type LoginInput = {
  email: string;
  password: string;
};

type LoginResultado = {
  accessToken: string;               // JWT, 15 minutos
  expiraEn: number;                  // segundos
  debeCambiarPassword: boolean;
  usuario: {
    id: string;
    nombreCompleto: string;
    email: string;
  };
  contexto: OrgContext;
};
// El token de refresco no viaja en el cuerpo: se establece como cookie HttpOnly
// con ruta /api/auth y vigencia de 7 dias.
```

### Cambio de contraseña y sucursal activa

```typescript
// POST /api/auth/cambiar-password
type CambiarPasswordInput = {
  passwordActual: string;
  passwordNueva: string;             // debe cumplir la politica y ser distinta de la actual
};

// POST /api/auth/sucursal-activa
type SucursalActivaInput = {
  sucursalId: string;                // debe estar en ctx.sucursalIds
};

type SucursalActivaResultado = {
  accessToken: string;               // token nuevo con el contexto actualizado
  contexto: OrgContext;
};
```

### Usuarios de la organizacion

```typescript
// POST /api/usuarios
type CrearUsuarioInput = {
  nombreCompleto: string;            // 3 a 120 caracteres
  email: string;                     // unico en toda la plataforma
  telefono?: string;
  perfilIds: string[];               // al menos uno, todos de ambito ORGANIZACION
  sucursalIds: string[];             // al menos una, todas de la organizacion del contexto
  passwordTemporal?: string;         // si falta, el sistema la genera
};

type CrearUsuarioResultado = {
  usuarioId: string;
  email: string;
  passwordTemporal: string;          // se devuelve una unica vez
  debeCambiarPassword: true;
};

// PATCH /api/usuarios/:id
type EditarUsuarioInput = {
  nombreCompleto?: string;
  telefono?: string;
  perfilIds?: string[];              // reemplaza el conjunto completo
  sucursalIds?: string[];            // reemplaza el conjunto completo
  estadoRegistro?: 'ACTIVO' | 'INACTIVO';
};

// POST /api/usuarios/:id/restablecer-password
type RestablecerPasswordInput = {
  passwordTemporal?: string;         // si falta, el sistema la genera
};

type RestablecerPasswordResultado = {
  passwordTemporal: string;          // se devuelve una unica vez
  sesionesRevocadas: number;
};
```

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `VALIDACION_ENTRADA_INVALIDA` | La entrada no cumple el esquema: correo mal formado, nombre fuera de rango, lista de perfiles vacia |
| `CREDENCIALES_INVALIDAS` | Correo inexistente, contraseña incorrecta, usuario inactivo u organizacion inactiva. Mensaje identico en los cuatro casos |
| `NO_AUTENTICADO` | Peticion sin token, con token mal formado o expirado |
| `SESION_INVALIDA` | El token de refresco no existe, ya fue rotado, fue revocado o expiro |
| `PERMISO_DENEGADO` | El usuario autenticado no tiene el permiso requerido |
| `CONTEXTO_ORGANIZACION_REQUERIDO` | Un usuario de ambito plataforma invoca un servicio de dominio de la organizacion |
| `CAMBIO_PASSWORD_REQUERIDO` | El usuario tiene `debeCambiarPassword` verdadero e invoca un endpoint distinto de perfil, cambio de contraseña o cierre de sesion |
| `PASSWORD_DEBIL` | La contraseña nueva o temporal no cumple la politica |
| `PASSWORD_ACTUAL_INCORRECTA` | La contraseña actual enviada en el cambio no coincide |
| `PASSWORD_IGUAL_A_LA_ANTERIOR` | La contraseña nueva coincide con la vigente |
| `RECURSO_NO_ENCONTRADO` | El usuario, el perfil o la sucursal no existen, o pertenecen a otra organizacion |
| `USUARIO_EMAIL_DUPLICADO` | El correo ya esta registrado en la plataforma |
| `PERFIL_AMBITO_INCOMPATIBLE` | Se intenta asignar un perfil de ambito distinto al del usuario |
| `USUARIO_SIN_PERFIL` | La operacion dejaria al usuario sin ningun perfil |
| `USUARIO_SIN_SUCURSAL` | La operacion dejaria a un usuario de organizacion sin ninguna sucursal |
| `AUTOGESTION_PERFILES_PROHIBIDA` | Un usuario intenta modificar sus propios perfiles |
| `AUTOINACTIVACION_PROHIBIDA` | Un usuario intenta inactivarse a si mismo |
| `ULTIMO_ADMINISTRADOR_ORGANIZACION` | La operacion dejaria a la organizacion sin ningun administrador activo |
| `SUCURSAL_NO_ASIGNADA` | Se intenta activar una sucursal que no esta en `ctx.sucursalIds` |
| `SUCURSAL_INACTIVA` | Se intenta asignar o activar una sucursal inactiva |

Los codigos siguen el formato del catalogo comun `docs/08-catalogo-errores.md`, pendiente de
publicacion. Los estados HTTP se asignan segun `docs/06-diseno-tecnico.md`: 400 para validacion y
politica de contraseña, 401 para credenciales, autenticacion y sesion, 403 para permisos y cambio de
contraseña requerido, 404 para recursos ausentes o ajenos, 409 para duplicados y 422 para las reglas
de proteccion.

## Experiencia de usuario

El area de acceso vive en el grupo de rutas publicas y el resto bajo el area autenticada.

| Ruta | Pantalla | Contenido |
|------|----------|-----------|
| `/acceso` | Inicio de sesion | Correo, contraseña y accion de ingresar |
| `/acceso/cambiar-password` | Cambio obligatorio | Contraseña actual, nueva y confirmacion. Sin navegacion lateral |
| `/configuracion/usuarios` | Listado | Tabla de usuarios de la organizacion |
| `/configuracion/usuarios/nuevo` | Alta | Formulario de creacion |
| `/configuracion/usuarios/:id` | Detalle y edicion | Datos, perfiles, sucursales, estado y acciones |

### Inicio de sesion

Un unico formulario con correo y contraseña. El error de credenciales muestra siempre el mismo texto,
sin distinguir si el correo existe. Tras un ingreso correcto:

- Si `debeCambiarPassword` es verdadero, redirige a `/acceso/cambiar-password` y no permite salir de
  esa pantalla mas que cerrando sesion.
- Si no, redirige al panel principal con la sucursal activa ya seleccionada.

### Cambio obligatorio de contraseña

La pantalla explica por que aparece: la contraseña fue asignada por un administrador y debe
reemplazarse. Muestra los requisitos de la politica como lista con verificacion en vivo mientras se
escribe. Al completarse, informa que las demas sesiones se cerraron y continua al panel principal.

### Selector de sucursal activa

Vive en la barra superior y solo se muestra cuando el usuario tiene mas de una sucursal asignada. Al
cambiarla, la aplicacion renueva el token y refresca los datos en pantalla sin pedir credenciales.

### Patron ABM de usuarios

El listado sigue el patron comun de las pantallas de administracion: tabla con buscador por nombre y
correo, filtro por perfil y por estado, paginacion, accion primaria de crear arriba a la derecha y
acciones por fila.

| Columna | Contenido |
|---------|-----------|
| Nombre | Nombre completo y correo debajo |
| Perfiles | Etiquetas con los perfiles asignados |
| Sucursales | Cantidad, con detalle al pasar el puntero |
| Estado | Activo o Inactivo |
| Ultimo acceso | Fecha relativa, o aviso de que nunca ingreso |

Las acciones por fila son editar, restablecer contraseña e inactivar o reactivar. Las acciones no
permitidas por las reglas de proteccion aparecen deshabilitadas con la razon visible al pasar el
puntero, en lugar de fallar al confirmar.

### Formulario de usuario

Un solo formulario con tres bloques: datos personales, perfiles y sucursales. Los perfiles se eligen
con casillas y cada uno muestra su descripcion y un enlace a la tabla comparativa de permisos. Las
sucursales se eligen con casillas y la sucursal principal viene marcada de forma predeterminada.

Al crear, la contraseña temporal se muestra una sola vez en un bloque con accion de copiar y un aviso
de que no se volvera a mostrar. El dialogo exige confirmacion explicita antes de cerrarse.

### Mensajes

| Situacion | Mensaje |
|-----------|---------|
| Credenciales incorrectas | Correo o contraseña incorrectos |
| Cambio obligatorio pendiente | Debe cambiar su contraseña antes de continuar |
| Contraseña debil | La contraseña debe tener al menos 10 caracteres, una mayuscula, una minuscula y un digito |
| Cambio correcto | Contraseña actualizada. Se cerraron sus otras sesiones |
| Correo duplicado | Ya existe un usuario con ese correo |
| Perfiles propios | No puede modificar sus propios perfiles. Solicitelo a otro administrador |
| Autoinactivacion | No puede inactivar su propio usuario |
| Ultimo administrador | La organizacion debe conservar al menos un administrador activo |
| Restablecimiento correcto | Contraseña restablecida. Copiela: no se volvera a mostrar. Las sesiones del usuario se cerraron |
| Cambio de permisos | Los cambios se aplicaran en la proxima renovacion de sesion del usuario |

## Criterios de aceptacion

### Inicio de sesion y sesiones

#### CA-001: Login correcto devuelve contexto y cookie

Dado un usuario activo de una organizacion activa con credenciales validas, cuando invoca
`POST /api/auth/login`, entonces recibe un token de acceso con vigencia de 15 minutos, una cookie
`HttpOnly` de refresco con ruta `/api/auth`, y un `OrgContext` con su `organizacionId`, su ambito,
sus permisos, sus sucursales, su sucursal activa y el identificador de la sesion creada.

#### CA-002: Credenciales invalidas no revelan informacion

Dados un correo inexistente, una contraseña incorrecta, un usuario inactivo y un usuario de una
organizacion inactiva, cuando cada uno intenta iniciar sesion, entonces las cuatro respuestas son 401
con el mismo codigo `CREDENCIALES_INVALIDAS` y el mismo mensaje, sin distinguir el caso.

#### CA-003: El refresco rota el token

Dado un token de refresco valido, cuando se invoca `POST /api/auth/refresh`, entonces se recibe un
token de acceso nuevo y una cookie de refresco nueva, y el token de refresco anterior deja de ser
valido con codigo `SESION_INVALIDA`.

#### CA-004: El contexto se recalcula al refrescar

Dado un usuario al que se le quito un perfil despues de iniciar sesion, cuando refresca su token,
entonces el `OrgContext` nuevo ya no contiene los permisos de ese perfil y las peticiones que los
exigian responden con permiso denegado.

#### CA-005: El cierre de sesion revoca la sesion

Dado un usuario autenticado, cuando invoca `POST /api/auth/logout` y despues intenta refrescar con la
cookie que tenia, entonces el refresco falla con `SESION_INVALIDA` y la sesion queda con
`revocadaAt` informado.

#### CA-006: El refresco falla si el usuario queda inactivo

Dado un usuario con sesion vigente que es inactivado por un administrador, cuando intenta refrescar
su token, entonces la respuesta es 401, la sesion queda revocada y no se emite token nuevo.

### Contraseñas

#### CA-007: El primer ingreso obliga a cambiar la contraseña

Dado un usuario con `debeCambiarPassword` verdadero, cuando inicia sesion y luego invoca
`GET /api/items`, entonces la respuesta es 403 con codigo `CAMBIO_PASSWORD_REQUERIDO`, mientras que
`GET /api/auth/perfil`, `POST /api/auth/cambiar-password` y `POST /api/auth/logout` responden
correctamente.

#### CA-008: La politica de contraseña se aplica

Dadas contraseñas de nueve caracteres, sin mayuscula, sin digito e igual al correo del usuario,
cuando se intenta establecer cada una, entonces las cuatro se rechazan con 400 y codigo
`PASSWORD_DEBIL`.

#### CA-009: El cambio de contraseña revoca las demas sesiones

Dado un usuario con tres sesiones vigentes, cuando cambia su contraseña desde una de ellas, entonces
`debeCambiarPassword` queda en falso, la sesion desde la que cambio sigue vigente y las otras dos
quedan revocadas.

#### CA-010: Restablecimiento por un administrador

Dado un administrador con `seguridad.usuarios.restablecer_clave` y un usuario de su organizacion con
sesiones vigentes, cuando restablece su contraseña, entonces la respuesta incluye una contraseña
temporal que cumple la politica, el usuario afectado queda con `debeCambiarPassword` verdadero y
todas sus sesiones quedan revocadas.

#### CA-011: La contraseña temporal no se puede volver a consultar

Dado un usuario recien creado o recien restablecido, cuando se consulta su detalle o el listado de
usuarios, entonces ninguna respuesta incluye la contraseña temporal ni el `passwordHash`.

### Autorizacion

#### CA-012: El comodin satisface el permiso concreto

Dado un usuario con el perfil `Administrador Organizacion`, que concede `catalogo.*`, cuando invoca
una operacion que exige `catalogo.items.crear`, entonces la peticion se autoriza.

#### CA-013: El `Cotizador` no puede sobrescribir precios

Dado un usuario con el perfil `Cotizador`, cuando intenta una operacion que exige
`cotizaciones.sobrescribir_precio`, entonces la respuesta es 403 con codigo `PERMISO_DENEGADO`.

#### CA-014: El `Cotizador` no administra configuracion ni usuarios

Dado un usuario con el perfil `Cotizador`, cuando invoca `GET /api/usuarios`,
`PATCH /api/configuracion-cotizacion` o `PATCH /api/plantillas-documento/:id`, entonces las tres
respuestas son 403 con codigo `PERMISO_DENEGADO`.

#### CA-015: El `Cotizador` completa el flujo comercial

Dado un usuario con el perfil `Cotizador`, cuando captura una solicitud, edita las lineas del
borrador, aprueba la cotizacion, genera el documento y registra el resultado, entonces las cinco
operaciones se autorizan.

#### CA-016: Perfil de ambito incompatible

Dado un usuario de ambito `ORGANIZACION`, cuando se intenta asignarle el perfil
`Superadmin Plataforma`, entonces la respuesta es 422 con codigo `PERFIL_AMBITO_INCOMPATIBLE` y no se
modifica ninguna asignacion.

### Administracion de usuarios

#### CA-017: Alta de usuario con perfiles y sucursales

Dado un administrador de la organizacion, cuando crea un usuario con un perfil y una sucursal
validos, entonces el usuario queda activo, con `debeCambiarPassword` verdadero, con las filas
correspondientes en `usuario_perfiles` y `usuario_sucursales`, y puede iniciar sesion con la
contraseña temporal devuelta.

#### CA-018: Correo unico en toda la plataforma

Dado un correo ya usado por un usuario de otra organizacion, cuando un administrador intenta crear un
usuario con ese correo, entonces la respuesta es 409 con codigo `USUARIO_EMAIL_DUPLICADO` y el
mensaje no revela a que organizacion pertenece el correo existente.

#### CA-019: Inactivar un usuario revoca sus sesiones

Dado un usuario activo con dos sesiones vigentes, cuando un administrador lo inactiva, entonces sus
dos sesiones quedan revocadas y el usuario no puede volver a iniciar sesion.

### Reglas de proteccion

#### CA-020: Nadie modifica sus propios perfiles

Dado un administrador de la organizacion, cuando intenta modificar la lista de perfiles de su propio
usuario, entonces la respuesta es 422 con codigo `AUTOGESTION_PERFILES_PROHIBIDA` y sus perfiles
permanecen sin cambios.

#### CA-021: Nadie se inactiva a si mismo

Dado un administrador de la organizacion, cuando intenta poner su propio `estadoRegistro` en
`INACTIVO`, entonces la respuesta es 422 con codigo `AUTOINACTIVACION_PROHIBIDA`.

#### CA-022: Siempre queda un administrador activo

Dada una organizacion con un unico administrador activo, cuando otro administrador intenta
inactivarlo o quitarle el perfil `Administrador Organizacion`, entonces ambas operaciones responden
422 con codigo `ULTIMO_ADMINISTRADOR_ORGANIZACION` y el estado no cambia.

### Sucursal activa y aislamiento

#### CA-023: Cambio de sucursal activa

Dado un usuario con dos sucursales asignadas, cuando invoca `POST /api/auth/sucursal-activa` con la
segunda, entonces recibe un token de acceso nuevo cuyo `sucursalActivaId` es esa sucursal, sin que se
cree una sesion nueva ni se rote el refresco.

#### CA-024: Sucursal no asignada

Dado un usuario cuya lista `sucursalIds` no contiene una sucursal concreta de su organizacion, cuando
intenta activarla, entonces la respuesta es 404 con codigo `RECURSO_NO_ENCONTRADO` y su sucursal
activa no cambia.

#### CA-025: Aislamiento entre organizaciones en la administracion de usuarios

Dado un administrador de la organizacion A y un usuario existente de la organizacion B, cuando el
administrador de A consulta o edita ese usuario por su identificador, entonces ambas respuestas son
404 con codigo `RECURSO_NO_ENCONTRADO`, nunca 403, y el usuario de B no se modifica.

## Verificacion requerida para cierre

Pruebas unitarias:

- [ ] Evaluacion de permisos con comodin por segmentos: `catalogo.*` satisface `catalogo.items.crear`;
      `catalogo.items.*` no satisface `precios.listas.ver`; un patron sin punto antes del comodin se
      considera invalido.
- [ ] Politica de contraseña: longitud minima y maxima, ausencia de mayuscula, de minuscula y de
      digito, coincidencia con el correo y con el nombre.
- [ ] Generador de contraseña temporal: siempre cumple la politica.
- [ ] Construccion del `OrgContext` a partir de perfiles, permisos y sucursales, incluido el caso de
      usuario de plataforma con `organizacionId` nulo.
- [ ] Eleccion de la sucursal activa inicial: con sucursal principal asignada y sin ella.
- [ ] Reglas de proteccion evaluadas sobre el estado resultante: quitar el perfil y a la vez agregar
      otro usuario administrador en la misma operacion no debe rechazarse; quitarlo sin reemplazo si.

Pruebas de integracion:

- [ ] Login correcto, contenido del token y atributos de la cookie de refresco.
- [ ] Respuesta identica en los cuatro casos de credenciales invalidas.
- [ ] Rotacion del refresco y rechazo del token anterior.
- [ ] Recalculo del contexto al refrescar tras cambiar perfiles y sucursales.
- [ ] Revocacion de sesion al cerrar sesion, al inactivar el usuario y al inactivar la organizacion.
- [ ] Bloqueo de endpoints con `CAMBIO_PASSWORD_REQUERIDO` y las tres excepciones permitidas.
- [ ] Cambio de contraseña con revocacion de las demas sesiones.
- [ ] Restablecimiento por administrador con revocacion de todas las sesiones del afectado.
- [ ] Alta de usuario con perfiles y sucursales, y login posterior con la contraseña temporal.
- [ ] Conflicto por correo duplicado entre organizaciones distintas.
- [ ] Rechazo de asignacion de perfil de ambito incompatible.
- [ ] Las tres reglas de proteccion: perfiles propios, autoinactivacion y ultimo administrador.
- [ ] Matriz de permisos de los dos perfiles de organizacion: para cada permiso de la tabla
      comparativa se verifica que el perfil que lo tiene autoriza y el que no lo tiene responde 403.
- [ ] **Aislamiento entre organizaciones**: un usuario de la organizacion A intenta leer y modificar
      un usuario, un perfil asignado y una sucursal de la organizacion B, y recibe respuesta de no
      encontrado en todos los casos, nunca de prohibido y nunca datos ajenos.
- [ ] Un usuario de ambito plataforma recibe `CONTEXTO_ORGANIZACION_REQUERIDO` al invocar
      `GET /api/usuarios`.

Pruebas manuales:

- [ ] Ingresar con un usuario recien creado, comprobar la pantalla de cambio obligatorio y que no se
      puede navegar a ninguna otra seccion.
- [ ] Cambiar la sucursal activa con la aplicacion abierta y verificar que las pantallas reflejan la
      sucursal nueva sin pedir credenciales.
- [ ] Quitar un permiso a un usuario conectado y comprobar que la interfaz deja de ofrecer la accion
      tras la renovacion del token.
- [ ] Verificar en el navegador que la cookie de refresco es `HttpOnly`, tiene ruta `/api/auth` y no
      es accesible desde el codigo de la pagina.
- [ ] Intentar inactivar al unico administrador de una organizacion y comprobar que la accion aparece
      deshabilitada con su razon visible.

## Preguntas abiertas

1. No hay recuperacion de contraseña autogestionada. Hoy depende de que exista otro administrador
   activo en la organizacion; si el unico administrador pierde su contraseña, la unica salida es que
   el proveedor intervenga. Falta decidir si eso se resuelve con un endpoint de plataforma auditado o
   con envio de correo en una version posterior.
2. No hay limitacion de intentos de inicio de sesion. Queda por decidir si se implementa por origen,
   por cuenta o en la capa de infraestructura antes de salir a produccion.
3. Queda por definir si el usuario debe poder ver y cerrar sus sesiones activas. El modelo de datos
   ya lo permite; solo falta la interfaz.
4. El correo no se puede cambiar en esta version. Falta decidir si el cambio de correo exige
   verificacion y como afecta a las sesiones vigentes.
5. El catalogo comun de errores `docs/08-catalogo-errores.md` todavia no existe; los codigos de esta
   spec son la propuesta inicial.
6. `docs/decisions/0011-auditoria-y-trazabilidad.md` no esta escrito. Falta decidir si los eventos de
   seguridad, como el restablecimiento de contraseña o el cambio de perfiles, se registran en una
   bitacora consultable.

## Decisiones MVP v1

| Decision | Motivo |
|----------|--------|
| Token de acceso de 15 minutos con el contexto dentro | Evita consultar permisos en cada peticion y acota la ventana de un token filtrado |
| Refresco opaco en cookie `HttpOnly` con rotacion | El valor no es legible desde la pagina y un refresco reutilizado se detecta de inmediato |
| Del refresco solo se guarda el hash | Una filtracion de la tabla `sesiones` no permite suplantar a nadie |
| El contexto se recalcula en cada login y refresco | Un cambio de permisos surte efecto en minutos sin invalidar todas las sesiones |
| Se acepta una ventana de hasta 15 minutos tras revocar | El costo de verificar la sesion en cada peticion no se justifica en el volumen previsto |
| Mensaje identico para todos los fallos de credenciales | No se revela que correos existen ni el estado de la cuenta o de la organizacion |
| Los perfiles son globales y de semilla | Perfiles por organizacion multiplican la superficie de error en la autorizacion sin demanda real en el piloto |
| Los permisos solo se obtienen por perfil | Una concesion directa a un usuario seria invisible en la tabla comparativa y dificil de auditar |
| El `Cotizador` aprueba pero no sobrescribe precios ni anula | Aprobar es parte de su trabajo diario; cambiar el precio o invalidar un documento emitido es una decision economica |
| Las reglas de proteccion se evaluan sobre el estado resultante | Impide esquivarlas combinando varios cambios en una sola operacion |
| El correo es unico en toda la plataforma | Es la credencial de acceso, segun `docs/decisions/0001-multi-tenancy-por-organizacion.md` |

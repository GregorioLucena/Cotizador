# ADR 0001: Multi-tenancy por columna de organizacion

## Estado

Aceptada — 2026-09-17

## Contexto

La plataforma alojara a multiples negocios independientes (organizaciones) en una misma instalacion y
una misma base de datos. Cada organizacion debe ver exclusivamente sus datos: catalogo, precios,
clientes, cotizaciones, plantillas y usuarios. Una fuga de datos entre organizaciones es el peor
fallo posible del producto, porque expondria precios y clientes a competidores directos.

Al mismo tiempo el proveedor de la plataforma necesita administrar organizaciones y crear sus usuarios
iniciales, lo que implica un ambito de acceso superior al de cualquier organizacion.

Alternativas evaluadas: una base de datos por organizacion, un esquema PostgreSQL por organizacion,
Row Level Security de PostgreSQL, y una columna discriminadora con filtrado en la capa de aplicacion.

## Decision

Se adopta **una sola base de datos con una columna discriminadora `organizacionId`** en todas las
tablas de datos operativos, con filtrado explicito en la capa de servicio.

### Reglas de implementacion

1. Toda tabla que contenga datos pertenecientes a una organizacion lleva la columna
   `organizacionId uuid NOT NULL` con clave foranea a `organizaciones`.
2. Las tablas globales de plataforma no llevan esa columna: `monedas`, `perfiles`, `permisos`,
   `perfil_permisos`, `verticales`.
3. La tabla `usuarios` lleva `organizacionId` **nulable**: un valor nulo identifica a un usuario de
   ambito plataforma.
4. La identidad efectiva de cada peticion viaja en un objeto `OrgContext` construido por el guard de
   autenticacion a partir del token, nunca a partir de parametros de la peticion.
5. Ningun servicio acepta `organizacionId` como parametro de entrada desde el cliente. Siempre se
   toma de `OrgContext`. La unica excepcion son los servicios de ambito plataforma, que reciben el
   identificador de forma explicita y exigen un permiso `plataforma.*`.
6. Toda consulta de lectura y escritura incluye la condicion `organizacionId = ctx.organizacionId`.
   En actualizaciones y eliminaciones logicas la condicion va en el `WHERE`, no en una validacion
   posterior en memoria.
7. Un registro solicitado por identificador que no pertenezca a la organizacion del contexto se
   responde como **no encontrado**, nunca como prohibido. No se revela la existencia de datos ajenos.
8. Las claves unicas de negocio son compuestas con la organizacion: por ejemplo el SKU es unico por
   organizacion, no globalmente. El correo del usuario si es unico global, porque es la credencial de
   acceso.
9. La `sucursalId` es un sub ambito dentro de la organizacion, no un tenant: se valida contra
   `ctx.sucursalIds` con un helper dedicado.

### Segundo nivel de defensa

Se establece una prueba de integracion obligatoria y transversal: para cada modulo con datos de
organizacion debe existir un caso que autentique a un usuario de la organizacion A e intente leer y
modificar un registro de la organizacion B, verificando respuesta de no encontrado. Esta prueba es
condicion de cierre de cada especificacion.

## Alternativas descartadas

### Base de datos por organizacion

**Pros:** aislamiento fisico total, respaldo y restauracion independientes, imposible cruzar datos por
error de consulta.
**Contras:** migraciones multiplicadas por la cantidad de organizaciones, costo de infraestructura por
cliente, consultas agregadas de plataforma imposibles sin replicacion, provisionamiento lento.
**Descartada** porque el modelo de negocio apunta a muchas organizaciones pequeñas, donde el costo
operativo por tenant seria desproporcionado.

### Esquema por organizacion

**Pros:** buen aislamiento con una sola base, respaldo selectivo posible.
**Contras:** el ORM debe conmutar el esquema por peticion, las migraciones deben iterar todos los
esquemas y el numero de tablas crece de forma lineal con los clientes.
**Descartada** por complejidad operativa sin beneficio proporcional para el volumen previsto.

### Row Level Security de PostgreSQL

**Pros:** garantia en el motor, resistente a un olvido de filtro en una consulta.
**Contras:** exige fijar una variable de sesion por peticion, lo que obliga a controlar el pool de
conexiones con cuidado; complica migraciones y depuracion; el equipo tiene menos experiencia con el
mecanismo y un error de configuracion produce fallos silenciosos dificiles de diagnosticar.
**Descartada para el MVP**, pero se mantiene como refuerzo futuro: el diseño con columna
discriminadora es compatible con activar RLS despues sin cambiar el modelo de datos. Esa es una
consecuencia deliberada de esta decision.

## Consecuencias

- El aislamiento depende de la disciplina del codigo, por lo que el filtrado por organizacion es el
  primer paso obligatorio de todo metodo de servicio y un punto explicito de revision de codigo.
- Se puede consultar informacion agregada de toda la plataforma con una sola consulta.
- El provisionamiento de una organizacion nueva es una transaccion de datos, no una operacion de
  infraestructura: se puede hacer desde la interfaz en segundos.
- Los indices deben empezar por `organizacionId` en las tablas de alto volumen para que las consultas
  filtradas por tenant sean eficientes.
- Si en el futuro una organizacion grande exige aislamiento fisico, se puede extraer a otra instancia
  copiando sus filas, porque el discriminador ya existe en todas las tablas.

## Referencias

- `docs/06-diseno-tecnico.md`, seccion de multi-tenancy y modelo de datos.
- `docs/specs/000-plataforma-organizaciones.md`
- `docs/specs/001-usuarios-perfiles.md`

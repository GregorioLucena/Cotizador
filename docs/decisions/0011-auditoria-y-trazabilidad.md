# ADR 0011: Auditoria, estado de registro y bitacora de eventos

## Estado

Aceptada — 2026-09-17

## Contexto

Una cotizacion es un documento comercial que sale del sistema y llega a un tercero. Una vez enviada, el
negocio tiene que poder responder tres preguntas meses despues, sin depender de la memoria de nadie:

1. Que decia exactamente el documento que recibio el cliente.
2. Quien lo aprobo, cuando, y que cambio respecto de lo que propuso el sistema.
3. Por que un item tiene hoy un precio distinto del que figura en una cotizacion de hace dos meses.

A eso se suma una necesidad del piloto: las metricas que validan el producto, definidas en
`docs/05-alcance-mvp.md`, no son datos de conveniencia sino el criterio con el que se decide si el
producto sirve. Tiempo desde la captura hasta la aprobacion, tasa de lineas resueltas automaticamente,
proporcion de ganadas y perdidas, y terminos que mas fallan al resolverse. Ninguna de esas metricas se
puede calcular a partir del estado actual de una fila: todas requieren saber **que paso y cuando**.

Por ultimo, el modelo tiene una tension conocida. El catalogo cambia todo el tiempo: se corrigen
precios, se inactivan items descontinuados, se renombran categorias. Las cotizaciones emitidas no pueden
cambiar por eso.

## Decision

Se adoptan **cuatro mecanismos complementarios**, cada uno con un ambito claro, y una prohibicion
transversal.

| Mecanismo | Se aplica a | Que resuelve |
|-----------|-------------|--------------|
| Columnas de auditoria | Toda entidad de negocio | Quien creo y quien modifico por ultima vez, y cuando |
| `estadoRegistro` | Entidades de configuracion y catalogo | Retirar de uso sin romper el historico |
| Anulacion con motivo | Entidades transaccionales | Invalidar un documento dejando constancia de por que |
| Bitacora de eventos | Cotizaciones | Reconstruir la historia completa y alimentar las metricas |

**Prohibicion transversal:** no se ejecuta `DELETE` fisico sobre datos de negocio en ningun entorno. No
existe un endpoint que borre una organizacion, un item, un cliente o una cotizacion. Las unicas
sentencias de borrado admitidas son sobre datos tecnicos sin valor historico, como sesiones expiradas o
registros de trabajos temporales, y estan documentadas caso por caso en la especificacion
correspondiente.

### Columnas de auditoria

Toda entidad de negocio lleva las mismas cuatro columnas, con los mismos nombres:

| Columna | Tipo | Regla |
|---------|------|-------|
| `createdAt` | `timestamptz` | Asignada por la base de datos al insertar; nunca se actualiza |
| `updatedAt` | `timestamptz` | Actualizada en cada modificacion |
| `createdById` | `uuid` nulable | Usuario que creo el registro; nulo solo si lo creo el provisionamiento o una semilla |
| `updatedById` | `uuid` nulable | Usuario de la ultima modificacion |

Reglas de implementacion:

1. Las columnas se declaran en una clase base de entidad, no se repiten a mano en cada archivo.
2. `createdById` y `updatedById` se toman del `OrgContext` de la peticion, nunca de un campo del cuerpo.
   Se aplica el mismo criterio que en `decisions/0001-multi-tenancy-por-organizacion.md`: la identidad
   no viaja en los datos de entrada.
3. Un registro creado por el provisionamiento de una organizacion, descrito en
   `decisions/0002-catalogo-generico-por-vertical.md`, deja `createdById` nulo y se identifica por su
   origen, no por un usuario de sistema ficticio.
4. Las columnas de auditoria no sustituyen a la bitacora de eventos y no responden "que cambio": solo
   "quien toco esto por ultima vez".

### Estado de registro en configuracion y catalogo

Las entidades de configuracion y catalogo llevan `estadoRegistro` con valores `ACTIVO` e `INACTIVO`, tal
como define el glosario en `docs/01-glosario.md`.

| Entidad | Efecto de `INACTIVO` |
|---------|----------------------|
| `items` | No aparece en busqueda ni se puede agregar a un borrador; sigue siendo valido en cotizaciones existentes |
| `categorias`, `marcas`, `unidades_medida` | No se puede asignar a items nuevos; los items que ya la tienen no se alteran |
| `definiciones_atributo` | Deja de validarse y de mostrarse; los valores ya guardados en `items.atributos` se conservan |
| `item_alias` | Deja de participar en la resolucion y sale de la columna de texto de busqueda |
| `listas_precios`, `reglas_descuento` | No se pueden seleccionar; las cotizaciones aprobadas que las usaron conservan el resultado congelado |
| `clientes` | No se puede seleccionar en una cotizacion nueva; su historial permanece accesible |
| `usuarios` | No puede iniciar sesion; sus sesiones activas se revocan; sigue figurando como autor en el historial |
| `organizaciones` | Suspende el acceso de todos sus usuarios sin destruir ningun dato |

Reglas:

1. Toda consulta de seleccion filtra por `estadoRegistro = 'ACTIVO'`. Las consultas de historial y de
   detalle **no** filtran, porque deben poder mostrar lo que se uso en su momento.
2. Inactivar no valida referencias: no se comprueba si el item figura en cotizaciones, precisamente
   porque no importa. Ese es el objetivo del mecanismo.
3. Reactivar es una operacion normal y no requiere nada especial.
4. Las claves unicas de negocio incluyen los registros inactivos. Un SKU inactivo sigue ocupando su
   valor dentro de la organizacion, para que reactivarlo no produzca un conflicto y para que no existan
   dos items con el mismo SKU en el historial.

### Anulacion con motivo en entidades transaccionales

Una cotizacion no se inactiva: se **anula**. La diferencia no es cosmetica. Inactivar un item es
retirarlo del uso corriente; anular una cotizacion es declarar que un documento que pudo haber salido
del sistema ya no es valido, y eso exige explicar por que.

| Columna | Tipo | Regla |
|---------|------|-------|
| `anulado` | `boolean` | Falso por defecto |
| `anuladoAt` | `timestamptz` nulable | Momento de la anulacion |
| `anuladoById` | `uuid` nulable | Usuario que anulo, tomado del `OrgContext` |
| `motivoAnulacion` | `text` nulable | Obligatorio al anular; no se admite vacio ni un texto trivial |

Reglas:

1. El motivo es obligatorio. Una anulacion sin motivo no aporta nada y no se acepta.
2. Anular lleva la cotizacion al estado `ANULADA`, que es terminal segun la tabla de estados de
   `docs/01-glosario.md`. Desde ahi no hay transiciones.
3. Una cotizacion anulada se conserva completa: lineas, candidatos, importes congelados, documentos
   generados y eventos. Sigue siendo consultable y sigue apareciendo en el historial, marcada.
4. Las cuatro columnas se acompañan de un evento `COTIZACION_ANULADA` en la bitacora. La cotizacion
   registra el estado final; la bitacora registra el hecho.
5. Los documentos ya generados y entregados no se eliminan. El sistema no puede retirar un archivo que
   ya esta en el telefono del cliente, y fingir lo contrario borrando el registro empeora la
   trazabilidad.

### Bitacora inmutable de eventos de cotizacion

La tabla `cotizacion_eventos` registra todo lo que le pasa a una cotizacion. Es **append-only**: se
inserta y nunca se actualiza ni se borra.

| Columna | Tipo | Contenido |
|---------|------|-----------|
| `id` | `uuid` | Identificador del evento |
| `organizacionId` | `uuid` | Discriminador de aislamiento, obligatorio como en toda tabla operativa |
| `cotizacionId` | `uuid` | Cotizacion a la que pertenece |
| `tipo` | `varchar` | Tipo de evento, de una lista cerrada |
| `ocurridoAt` | `timestamptz` | Momento del hecho |
| `usuarioId` | `uuid` nulable | Quien lo provoco; nulo si el origen es el sistema |
| `origen` | `varchar` | `USUARIO` o `SISTEMA` |
| `datos` | `jsonb` | Carga util especifica del tipo de evento |

Tipos de evento y contenido de `datos`:

| Tipo | Origen | Que guarda en `datos` |
|------|--------|------------------------|
| `COTIZACION_CREADA` | Usuario | Identificador de la solicitud, canal de origen, cliente, lista de precios, cantidad de lineas propuestas |
| `INTERPRETACION_EJECUTADA` | Sistema | Proveedor, modelo, version del prompt, latencia, tokens, costo estimado, exito o codigo de error |
| `LINEA_RESUELTA_AUTOMATICA` | Sistema | Linea, item elegido, confianza, estrategia de la cascada que decidio |
| `LINEA_CORREGIDA` | Usuario | Linea, item anterior, item nuevo, confianza original, texto solicitado |
| `LINEA_AGREGADA` | Usuario | Linea, item, cantidad |
| `LINEA_ELIMINADA` | Usuario | Linea, item, motivo si se indico |
| `PRECIO_SOBRESCRITO` | Usuario | Linea, precio calculado, precio aplicado, motivo obligatorio |
| `ALIAS_APRENDIDO` | Usuario | Item, texto guardado como alias |
| `COTIZACION_APROBADA` | Usuario | Totales congelados, moneda base, moneda de presentacion, tasa y fecha de la tasa, vigencia |
| `DOCUMENTO_GENERADO` | Sistema | Formato, version de la plantilla, hash del archivo |
| `COTIZACION_ENVIADA` | Usuario | Canal, formato entregado |
| `MARCADA_GANADA` | Usuario | Fecha, nota opcional |
| `MARCADA_PERDIDA` | Usuario | Motivo de perdida |
| `COTIZACION_VENCIDA` | Sistema | Fecha de vencimiento alcanzada |
| `COTIZACION_ANULADA` | Usuario | Motivo de anulacion |
| `COTIZACION_DUPLICADA` | Usuario | Identificador de la cotizacion origen o destino |

#### Por que los eventos son append-only

1. **Un registro que se puede editar no sirve como evidencia.** El valor de la bitacora esta en que
   nadie, ni siquiera un administrador, pueda cambiar la version de los hechos despues de que
   ocurrieron. Si un evento fuera actualizable, dejaria de responder la pregunta "que paso realmente" y
   pasaria a responder "que dice el sistema que paso hoy".
2. **Corregir un hecho es registrar otro hecho.** Si una linea se corrige dos veces, hay dos eventos
   `LINEA_CORREGIDA`. El estado actual de la linea vive en la tabla de lineas; la secuencia de cambios
   vive en la bitacora. Son dos preguntas distintas y cada una tiene su lugar.
3. **Las metricas dependen de la secuencia, no del estado final.** El tiempo desde la captura hasta la
   aprobacion es la diferencia entre `COTIZACION_CREADA` y `COTIZACION_APROBADA`. La tasa de resolucion
   automatica es la proporcion de `LINEA_RESUELTA_AUTOMATICA` frente a `LINEA_CORREGIDA` sobre la misma
   cotizacion. Los terminos que mas fallan salen del texto solicitado que figura en `LINEA_CORREGIDA` y
   en las lineas no encontradas. Ninguno de esos numeros se puede obtener mirando la fila de la
   cotizacion.
4. **Es la materia prima para mejorar el reconocimiento.** La vision del producto promete que cada
   correccion del operador mejora el reconocimiento futuro. Esa promesa se sostiene sobre datos, y los
   datos son los eventos `LINEA_CORREGIDA` y `ALIAS_APRENDIDO`.
5. **Insertar nunca bloquea.** Al no haber actualizaciones sobre la tabla, no hay contencion de filas ni
   trabajo adicional de mantenimiento por versiones muertas, aunque la tabla crezca.

Reglas de implementacion:

- La insercion de eventos ocurre dentro de la misma transaccion que la operacion que los provoca. Si la
  operacion se revierte, el evento no queda.
- No existe endpoint de modificacion ni de borrado de eventos. La entidad se declara sin operaciones de
  actualizacion.
- `datos` se valida con un esquema Zod por tipo de evento antes de persistir, de modo que la carga util
  no se degrade con el tiempo.
- Nunca se guardan credenciales ni el texto completo de la respuesta cruda del proveedor de IA en la
  bitacora: eso vive en `interpretaciones_solicitud`, segun
  `decisions/0003-pipeline-precotizacion.md`. La bitacora guarda la referencia y las metricas.
- Los indices son `(organizacionId, cotizacionId, ocurridoAt)` para la linea de tiempo de una cotizacion
  y `(organizacionId, tipo, ocurridoAt)` para las consultas de metricas.

### Congelamiento de datos historicos

Inactivar un item o corregir un precio **no puede alterar un documento ya emitido**. Como el catalogo es
mutable por definicion, la unica forma de garantizarlo es que la cotizacion no dependa del catalogo una
vez aprobada.

Al aprobar, cada linea copia a sus propias columnas los valores que el documento va a mostrar:

| Dato congelado | Origen | Por que |
|----------------|--------|---------|
| Descripcion del item | Nombre del item al momento de aprobar | Renombrar un item no puede cambiar lo que leyo el cliente |
| SKU, marca, categoria y unidad | Catalogo al momento de aprobar | Reorganizar el catalogo no reescribe documentos |
| Atributos mostrados | `items.atributos` al momento de aprobar | Las columnas de tipo atributo de la plantilla deben seguir teniendo valor |
| Precio unitario | Lista de precios aplicada | Actualizar la lista no revaloriza cotizaciones emitidas |
| Descuento aplicado e identificador de la regla | Motor de precios | El documento puede explicar por que se aplico ese descuento aunque la regla se haya inactivado |
| Impuesto y redondeo | Configuracion de cotizacion | Cambiar la configuracion no altera totales ya aprobados |
| Moneda base, moneda de presentacion, tasa y fecha de la tasa | `decisions/0008-moneda-base-y-presentacion.md` | Una cotizacion aprobada no cambia de valor porque se movio la tasa |
| Textos de la plantilla y version usada | `decisions/0006-plantillas-de-documento.md` | Reentregar el mismo documento produce el mismo archivo |

La linea conserva ademas la referencia al `itemId`, que sirve para navegar a la ficha actual y para las
metricas, pero **ningun dato mostrado en el documento se lee de esa referencia**. Si el item esta
inactivo, la cotizacion se muestra igual de completa que el dia que se emitio.

Complemento: `documentos_generados` guarda el hash del archivo y la version de la plantilla, de modo que
reentregar una cotizacion devuelve exactamente el mismo archivo sin volver a renderizar.

## Alternativas descartadas

### Tablas de auditoria genericas pobladas con disparadores de base de datos

Se evaluo una tabla unica que registre toda insercion, actualizacion y borrado de cualquier tabla,
poblada por disparadores, con los valores anterior y posterior en JSON.

**Pros:** cobertura total y automatica, imposible de olvidar, cero codigo en los servicios, funciona
incluso si alguien modifica datos con SQL directo.
**Contras:** registra cambios de columnas, no hechos de negocio. Una aprobacion aparece como una
actualizacion de la columna `estado` mas veinte actualizaciones de lineas, sin nombre ni intencion, y
reconstruir a partir de eso que "Maria aprobo la cotizacion 45 congelando la tasa del dia" es un
ejercicio de arqueologia. El usuario responsable no esta disponible en el disparador salvo que se
propague por una variable de sesion, lo que reintroduce la complejidad que
`decisions/0001-multi-tenancy-por-organizacion.md` descarto al rechazar Row Level Security. El volumen
crece de forma desproporcionada, la logica de auditoria queda fuera del repositorio de codigo y las
metricas del piloto seguirian sin poder calcularse.
**Descartada como mecanismo principal.** No se descarta como refuerzo futuro para tablas sensibles de
configuracion, donde el interes si es "que columna cambio".

### Event sourcing completo

Se evaluo que los eventos fueran la unica fuente de verdad y que el estado de la cotizacion se derivara
siempre reproduciendo su secuencia.

**Pros:** trazabilidad perfecta por construccion, estado reconstruible a cualquier punto del pasado,
posibilidad de derivar proyecciones nuevas sobre datos historicos.
**Contras:** obliga a versionar los eventos y a mantener migraciones de eventos antiguos para siempre;
toda consulta corriente, como listar cotizaciones con filtros por estado, cliente y fecha, requiere
proyecciones que hay que construir, reconstruir y mantener coherentes; una validacion que necesita el
estado actual pasa a depender de una reproduccion; y el equipo asumiria una complejidad de por vida para
un producto cuyo volumen inicial son decenas de cotizaciones diarias por organizacion.
**Descartada.** El modelo elegido conserva casi todo el beneficio: el estado vive en tablas normales,
comodas de consultar, y la historia vive en una bitacora append-only. La diferencia es que el estado no
se deriva de los eventos, y esa diferencia es exactamente el ahorro.

### Borrado logico con `deletedAt`

**Pros:** patron muy difundido, soportado de forma nativa por muchos ORM, una sola columna para todo.
**Contras:** confunde dos conceptos que en este dominio son distintos. "Este item ya no se vende" y
"esta cotizacion se anulo por un error de precio" no son el mismo hecho y no admiten el mismo
tratamiento: el primero no necesita motivo y es reversible con normalidad; el segundo exige motivo,
usuario y fecha, y es terminal. Ademas la semantica de "borrado" induce a un modelo mental equivocado:
el item inactivo **no esta borrado**, sigue siendo una referencia plenamente valida en documentos
emitidos, y llamarlo borrado lleva a que alguien lo excluya de una consulta de historial. Por ultimo, un
filtro automatico de `deletedAt` aplicado por el ORM en todas las consultas es justamente lo que rompe
las pantallas de historial, y desactivarlo caso por caso es mas fragil que filtrar de forma explicita.
**Descartada.** Se usan dos mecanismos con nombres que dicen lo que hacen: `estadoRegistro` para retirar
de uso y anulacion con motivo para invalidar un documento.

### Registrar la auditoria unicamente en los archivos de bitacora del servidor

**Pros:** nada que modelar, sin impacto en la base de datos.
**Contras:** los archivos de bitacora rotan y se pierden, no son consultables desde el producto, no
pueden filtrarse por organizacion y no sirven para alimentar una pantalla de historial ni un tablero de
metricas.
**Descartada.** Los eventos son datos del producto, no diagnostico de operacion.

## Consecuencias

- Ninguna pantalla del producto ofrece borrar. La interfaz habla de inactivar y de anular, y la guia de
  interfaz debe reflejar ese vocabulario.
- La base de datos crece de forma monotona. Se acepta: el volumen previsto es de decenas de cotizaciones
  diarias por organizacion y el costo de almacenamiento es irrelevante frente al valor de la
  trazabilidad. Si algun dia hiciera falta, se archivan eventos antiguos a una tabla historica, nunca se
  destruyen.
- Escribir un evento por cada accion relevante es trabajo adicional en cada servicio. Se mitiga con un
  servicio unico de registro de eventos que los modulos invocan dentro de su transaccion, no con codigo
  repetido.
- Las metricas del piloto se calculan con consultas sobre `cotizacion_eventos` y no requieren ninguna
  instrumentacion adicional ni un servicio de analitica externo.
- El congelamiento duplica datos entre el catalogo y las lineas de cotizacion. Es duplicacion
  deliberada: no es una desnormalizacion por rendimiento, es la condicion para que un documento emitido
  sea estable.
- Una linea de cotizacion aprobada puede mostrar una descripcion que ya no coincide con la ficha actual
  del item. Es el comportamiento correcto y la interfaz debe hacerlo evidente cuando se abre una
  cotizacion antigua.
- La revision de codigo incluye un punto explicito: toda operacion que cambia el estado de una
  cotizacion debe registrar su evento, y ningun servicio puede emitir una sentencia de borrado sobre
  datos de negocio.

## Referencias

- `docs/01-glosario.md`
- `docs/05-alcance-mvp.md`
- `docs/06-diseno-tecnico.md`
- `docs/specs/009-revision-aprobacion.md`
- `decisions/0001-multi-tenancy-por-organizacion.md`
- `decisions/0005-motor-de-precios.md`
- `decisions/0008-moneda-base-y-presentacion.md`

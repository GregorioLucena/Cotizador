# Glosario del dominio

Este documento fija el vocabulario del producto. Los nombres definidos aqui son los que se usan en
entidades, tablas, endpoints, permisos y textos de interfaz. Si un termino no esta aqui, no deberia
aparecer en el codigo.

## Regla de nomenclatura previa

Hay tres actores que en lenguaje coloquial se llamarian "cliente". Para evitar ambiguedad se usan
nombres distintos y excluyentes:

| Concepto real | Nombre en el sistema | Nunca lo llamamos |
|---------------|----------------------|-------------------|
| El negocio que contrata la plataforma | **Organizacion** | cliente, empresa, tenant |
| La persona que usa la plataforma | **Usuario** | operador, cuenta |
| Quien pide una cotizacion por WhatsApp | **Cliente** | comprador, contacto, cliente final |

---

## Terminos de plataforma

### Plataforma

La instalacion completa del producto, operada por un unico proveedor. Aloja a todas las
organizaciones. Un usuario con perfil de ambito plataforma puede administrar organizaciones; nunca
opera cotizaciones ajenas.

### Organizacion

Entidad tenant del sistema: el negocio que contrata el servicio (una ferreteria, una casa de
repuestos, un concesionario). Es la frontera de aislamiento de datos: catalogo, precios, clientes,
cotizaciones, plantillas y usuarios pertenecen siempre a una organizacion.

Toda tabla de datos operativos lleva la columna `organizacionId`.

### Sucursal

Punto de venta o deposito dentro de una organizacion. Una organizacion tiene al menos una sucursal
(la principal). Sirve para segmentar cotizaciones y, mas adelante, existencias. Un usuario puede
tener acceso a una o varias sucursales.

### Vertical

Rubro o giro de negocio al que pertenece una organizacion: `FERRETERIA`, `REPUESTOS`, `AUTOMOTRIZ`,
`GENERICO`. Determina que **pack de vertical** se aplica al provisionar la organizacion.

### Pack de vertical

Conjunto de datos semilla asociados a un vertical: definiciones de atributos, categorias sugeridas,
unidades de medida, sinonimos frecuentes y una plantilla de documento inicial. Vive versionado en
codigo y se **materializa como datos propios de la organizacion** al crearla. Ver
`decisions/0002-catalogo-generico-por-vertical.md`.

### Perfil

Conjunto nombrado de permisos. Los perfiles son globales de la plataforma y tienen un **ambito**:
`PLATAFORMA` u `ORGANIZACION`. Perfiles semilla: `Superadmin Plataforma`,
`Administrador Organizacion`, `Cotizador`.

### Permiso

Autorizacion atomica identificada por un codigo en formato `modulo.recurso.accion` (por ejemplo
`catalogo.items.crear`). Se evalua contra el contexto del usuario, admite comodin (`catalogo.*`).

### Contexto de organizacion

Objeto que acompaña cada peticion autenticada y contiene la identidad efectiva del usuario:
`usuarioId`, `organizacionId`, `sucursalIds`, `permisos`, `sucursalActivaId`, `sesionId`. Es la
unica fuente valida para filtrar por tenant. En codigo: `OrgContext`.

---

## Terminos de catalogo

### Item

Unidad vendible del catalogo de una organizacion. Deliberadamente no se llama "producto" porque
tambien representa servicios (mano de obra, instalacion) y unidades serializadas (un vehiculo
concreto).

### Tipo de item

- `FUNGIBLE`: unidades intercambiables que se cuentan o miden (un tubo, un kilo de clavos). Es el
  caso por defecto.
- `SERIALIZADO`: unidad unica identificable (un vehiculo con VIN, un motor con numero de serie). La
  cantidad cotizable es 1.
- `SERVICIO`: no tiene existencia fisica ni stock (instalacion, flete, diagnostico).

### Atributos del item

Datos estructurados propios del rubro, almacenados como documento JSON en el item y validados
contra las **definiciones de atributo** de la organizacion. Ejemplos: `{"diametro": "1/2\"",
"material": "PVC"}` en ferreteria, `{"posicion": "delantera"}` en repuestos.

### Definicion de atributo

Descripcion de un atributo disponible en el catalogo de una organizacion: codigo, etiqueta, tipo de
dato, opciones permitidas, si es obligatorio y si participa en la busqueda. Proviene del pack de
vertical y la organizacion puede modificarla o agregar propias.

### Alias

Forma alternativa con la que la gente pide un item ("tubo de media", "pega azul", "media pulgada").
Es el mecanismo principal de reconocimiento. Un alias puede ser `MANUAL` (cargado por el
administrador) o `APRENDIDO` (guardado cuando un operador corrige una linea y confirma que ese texto
corresponde a ese item).

### Aplicacion o compatibilidad

Registro que indica en que contexto aplica un item. Es una relacion uno a muchos con datos JSON
libres normalizados para busqueda: en repuestos representa marca, modelo y rango de años de vehiculo
compatible; en ferreteria normalmente no se usa.

### Texto de busqueda

Columna derivada de cada item que concatena nombre, SKU, marca, categoria, alias y atributos
buscables, normalizada (minusculas, sin acentos, sin signos). Es sobre esta columna que opera la
busqueda por similitud.

---

## Terminos de precios

### Lista de precios

Conjunto de precios aplicable a un segmento de clientes (publico, mayorista, obra, taller). Cada
lista tiene una moneda y puede tener vigencia. Una lista es la predeterminada de la organizacion.

### Precio de item

Precio de un item en una lista concreta. Un item puede no tener precio en una lista: en ese caso no
es cotizable con esa lista y la linea se marca para revision.

### Regla de descuento

Condicion evaluable que modifica el precio de una linea: descuento por cantidad minima, por
categoria, por marca o global. Se expresa como porcentaje, monto fijo o precio fijo, con prioridad y
vigencia. Ver `decisions/0005-motor-de-precios.md`.

### Moneda base

Moneda en la que estan expresados los precios del catalogo de la organizacion. Es la moneda de
calculo.

### Moneda de presentacion

Moneda opcional en la que tambien se muestra el total al cliente, convertida con una tasa de cambio.
La tasa aplicada **se congela** en la cotizacion al aprobarla, de modo que el documento nunca cambia
de valor despues de emitido.

### Tasa de cambio

Valor de conversion entre dos monedas, con fecha de vigencia y fuente (`MANUAL` u `AUTOMATICA`).
Editable por la organizacion.

---

## Terminos de cotizacion

### Cliente

Persona o empresa que solicita una cotizacion. Se identifica preferentemente por su numero de
WhatsApp. Tiene asignada una lista de precios, lo que evita decidir el precio a mano en cada
cotizacion. Puede ser anonimo: una cotizacion puede emitirse con solo un nombre libre.

### Solicitud

Registro del pedido tal como llego: el texto original pegado desde WhatsApp, su version normalizada,
el canal de origen, la fecha y quien lo capturo. Se conserva sin modificar para poder reprocesar e
investigar errores de interpretacion.

### Interpretacion

Resultado de pasar una solicitud por el proveedor de IA: las lineas extraidas en crudo, mas los
metadatos de la ejecucion (proveedor, modelo, version del prompt, latencia, tokens, costo estimado,
exito o error). Una solicitud puede tener varias interpretaciones si se reprocesa.

### Linea de pedido

Una necesidad detectada en el texto del cliente, con su descripcion tal como la escribio, la
cantidad y la unidad si las menciono. Es la salida del modelo de lenguaje y la entrada del motor de
resolucion.

### Resolucion

Proceso de asociar una linea de pedido con un item del catalogo. Produce un item elegido, una
**confianza** entre 0 y 1, y una lista de **candidatos** alternativos ordenados por puntaje.

### Estado de resolucion

Clasificacion de cada linea del borrador, que en la interfaz se traduce a un semaforo:

| Estado | Semaforo | Significado |
|--------|----------|-------------|
| `RESUELTA_AUTOMATICA` | Verde | Coincidencia confiable, se puede aprobar sin tocar |
| `SUGERIDA_REVISAR` | Ambar | Hay candidatos plausibles pero la confianza es intermedia |
| `NO_ENCONTRADA` | Rojo | No hay coincidencia razonable en el catalogo |
| `RESUELTA_MANUAL` | Verde | El operador eligio o corrigio el item |
| `AGREGADA_MANUAL` | Verde | Linea que el operador añadio, no proveniente del texto |

### Precotizacion

Sinonimo operativo de la cotizacion en estado borrador generada automaticamente a partir de una
solicitud. No es una entidad distinta: es una `Cotizacion` en estado `BORRADOR` con su solicitud e
interpretacion asociadas.

### Cotizacion

Documento comercial con folio, cliente, lineas, totales, moneda, vigencia y estado. Es la entidad
central del sistema.

### Folio

Identificador legible y secuencial de la cotizacion **por organizacion** (`#045`), independiente del
identificador tecnico. Su formato es configurable en la plantilla de documento.

### Estados de la cotizacion

| Estado | Significado | Transiciones validas |
|--------|-------------|----------------------|
| `BORRADOR` | Generada o en edicion, no vista por el cliente | `APROBADA`, `ANULADA` |
| `APROBADA` | Revisada y congelada por una persona | `ENVIADA`, `ANULADA` |
| `ENVIADA` | Entregada al cliente (texto o PDF) | `GANADA`, `PERDIDA`, `VENCIDA`, `ANULADA` |
| `GANADA` | El cliente compro | — |
| `PERDIDA` | El cliente no compro (con motivo) | — |
| `VENCIDA` | Paso su vigencia sin resultado | `GANADA`, `PERDIDA` |
| `ANULADA` | Invalidada con motivo, se conserva el registro | — |

Una cotizacion **nunca** se borra fisicamente. Aprobar congela precios, descuentos, tasa y textos.

### Vigencia

Plazo durante el cual la cotizacion mantiene sus precios (24, 48, 72 horas o el valor configurado).
Al vencer, la cotizacion pasa a `VENCIDA` y solo puede duplicarse, no editarse.

### Plantilla de documento

Configuracion declarativa por organizacion que define la identidad y el contenido del PDF y del
texto para WhatsApp: logo, colores, datos del encabezado, columnas visibles, formato de folio,
textos de saludo, condiciones y pie. No es HTML libre. Ver
`decisions/0006-plantillas-de-documento.md`.

### Documento generado

Archivo producido a partir de una cotizacion aprobada y una plantilla, con su version y hash. Sirve
para reentregar exactamente el mismo archivo sin volver a renderizar.

### Evento de cotizacion

Registro inmutable de algo que le paso a una cotizacion (creada, linea corregida, aprobada,
documento generado, enviada, marcada como ganada). Es la fuente de las metricas del piloto y la
bitacora de auditoria.

---

## Terminos tecnicos transversales

### Estado de registro

Campo `estadoRegistro` con valores `ACTIVO` e `INACTIVO` presente en las entidades de
configuracion y catalogo. Reemplaza el borrado fisico: un item inactivo no se puede cotizar pero
sigue siendo valido en cotizaciones historicas.

### Anulacion

Mecanismo de invalidacion para entidades transaccionales (cotizaciones). Marca `anulado`, guarda
fecha, usuario y motivo, y conserva el registro completo.

### Proveedor de IA

Componente intercambiable que interpreta el texto de la solicitud. Puede ser un servicio remoto, un
modelo local o un proveedor nulo que deshabilita la interpretacion automatica sin romper el flujo
manual. Ver `decisions/0004-proveedor-de-ia-abstraido.md`.

### Confianza

Numero entre 0 y 1 que expresa cuan segura es la resolucion de una linea. Se compara contra dos
umbrales configurables por organizacion (umbral automatico y umbral de descarte) para asignar el
estado de resolucion.

# ADR 0003: Pipeline de precotizacion en etapas separadas

## Estado

Aceptada — 2026-09-17

## Contexto

El nucleo del producto convierte un texto informal en una cotizacion con importes. La forma mas
rapida de construirlo seria enviar el texto y el catalogo a un modelo de lenguaje y pedirle la
cotizacion completa con precios y totales.

Esa opcion es inaceptable por razones de negocio, no solo tecnicas:

- Un modelo de lenguaje puede equivocarse en una multiplicacion o inventar un precio. Un precio
  incorrecto enviado a un cliente es un daño comercial real y potencialmente una perdida economica.
- Un catalogo de miles de items no cabe en el contexto y enviarlo en cada solicitud es costoso.
- El resultado no seria reproducible ni explicable: no se podria justificar ante el dueño del negocio
  de donde salio un monto.
- No se podria probar la logica de precios sin llamar a un servicio externo de pago.

La vision del producto establece una regla de oro: la IA propone, el catalogo cotiza, la persona
aprueba. Este ADR la convierte en estructura.

## Decision

La generacion de una precotizacion se implementa como un **pipeline de cinco etapas separadas,
independientes y auditables**. Cada etapa tiene una entrada y una salida definidas y se puede ejecutar
y probar de forma aislada.

```text
texto crudo del chat
   |
   v
[1] Normalizacion            deterministica, sin IA
   |  texto normalizado + metadatos detectados
   v
[2] Extraccion de lineas     unica etapa con IA
   |  lineas: { textoSolicitado, cantidad, unidad, notas }
   v
[3] Resolucion contra catalogo   deterministica, sin IA
   |  por linea: item elegido, confianza, candidatos alternativos
   v
[4] Calculo de precios       deterministica, pura, sin IA y sin base de datos
   |  por linea: precio unitario, descuento aplicado, subtotal
   |  totales: subtotal, descuento, impuesto, total, conversion
   v
[5] Ensamblado del borrador  persistencia
   |
   v
Cotizacion en estado BORRADOR con lineas y candidatos
```

### Etapa 1 — Normalizacion

Funcion pura sobre el texto: minusculas para comparacion, eliminacion de acentos, unificacion de
espacios, normalizacion de fracciones y medidas frecuentes (`1/2`, `½`, `media`), separacion de
lineas y viñetas, deteccion y descarte de saludos y ruido de chat (marcas de hora, nombres de
contacto, mensajes reenviados). Conserva el texto original intacto.

### Etapa 2 — Extraccion de lineas

Es la **unica** etapa que invoca el proveedor de IA. Su contrato es estricto:

- Entrada: el texto normalizado y la lista de unidades de medida validas de la organizacion.
- Salida: un arreglo de lineas con descripcion tal como la escribio el cliente, cantidad numerica y
  unidad si se menciona, mas notas del cliente si las hubiera.
- **Prohibido en la salida:** identificadores de items, precios, descuentos, totales, monedas o
  cualquier dato del catalogo. La salida se valida con un esquema Zod que rechaza campos no
  declarados; una respuesta con precios se considera fallo de la etapa.
- No recibe el catalogo. No necesita conocerlo.
- Si no puede determinar la cantidad, devuelve cantidad 1 y lo indica en las notas.

Cada ejecucion se persiste en `interpretaciones_solicitud` con proveedor, modelo, version del prompt,
latencia, tokens, costo estimado y resultado en crudo.

### Etapa 3 — Resolucion contra catalogo

Determinista y auditable, descrita en `0007-estrategia-de-matching.md`. Devuelve por cada linea el
item elegido, una confianza entre 0 y 1, el origen de la coincidencia y hasta cinco candidatos
alternativos con su puntaje.

### Etapa 4 — Calculo de precios

Funcion pura descrita en `0005-motor-de-precios.md`. Recibe las lineas resueltas, los precios y las
reglas ya cargadas, y devuelve importes. No accede a la base de datos, no depende del reloj salvo por
una fecha recibida como parametro y no tiene efectos secundarios.

### Etapa 5 — Ensamblado

Persiste en una unica transaccion la solicitud, la interpretacion, la cotizacion en borrador, sus
lineas, los candidatos y el evento inicial de historial.

## Invariantes

Estas condiciones no se pueden romper en ninguna version del producto:

1. Ningun importe de una cotizacion proviene, directa o indirectamente, de la salida de un modelo de
   lenguaje.
2. La etapa 4 se puede ejecutar sin red y sin proveedor de IA configurado.
3. Toda cotizacion en estado `APROBADA` tiene un usuario aprobador y una fecha de aprobacion
   registrados.
4. El texto original de la solicitud se conserva sin modificaciones mientras exista la cotizacion.
5. Si la etapa 2 falla, el flujo continua: se crea la cotizacion en borrador sin lineas y se informa
   al operador. El producto nunca queda bloqueado por el proveedor de IA.
6. Reprocesar una solicitud crea una interpretacion nueva; no sobrescribe la anterior.

## Alternativas descartadas

### Un solo prompt que devuelve la cotizacion completa

**Pros:** implementacion en horas, poco codigo.
**Contras:** importes no verificables, alucinacion de precios, costo por solicitud alto, imposible
probar sin el servicio externo, imposible explicar un monto al dueño del negocio.
**Descartada** por incompatibilidad con la regla de oro del producto.

### Dos etapas, con la IA eligiendo el item del catalogo

Se evaluo que la IA reciba una preseleccion de candidatos del catalogo y elija el correcto.
**Pros:** mejor desambiguacion en casos ambiguos que el puntaje textual resuelve mal.
**Contras:** duplica las llamadas y la latencia, introduce no determinismo en la eleccion del item y
complica explicar por que se eligio uno u otro.
**Descartada para el MVP** pero es la evolucion natural de la etapa 3 como paso de reordenamiento
opcional: el pipeline por etapas permite insertarla sin tocar el resto.

### Procesamiento asincrono con cola de trabajos

**Pros:** resistencia a picos, reintentos automaticos.
**Contras:** el operador espera el resultado en pantalla, por lo que la cola solo agrega latencia
percibida e infraestructura adicional.
**Descartada:** la generacion es sincrona con un tiempo limite configurado. Se revisara si aparecen
canales automaticos de entrada en la fase 3.

## Consecuencias

- El costo de IA por solicitud es acotado y predecible: una llamada con un prompt corto que no incluye
  el catalogo.
- El modulo de precios se prueba con casos de tabla, sin dobles de prueba de servicios externos.
- Es posible operar el producto con el proveedor de IA desactivado, en modo totalmente manual, lo que
  habilita una demostracion sin costo.
- Se puede cambiar de proveedor o modelo de IA sin tocar precios ni resolucion.
- Se puede medir la calidad del reconocimiento de forma objetiva, porque queda registrado que propuso
  la IA, que resolvio el sistema y que corrigio la persona.
- La contrapartida es mas piezas y mas tablas que una implementacion ingenua. Es un costo aceptado y
  es la razon principal de que el producto sea auditable.

## Referencias

- `docs/04-flujo-precotizacion.md` — el flujo con detalle de datos en cada etapa.
- `docs/specs/008-precotizacion-ia.md`
- `docs/specs/009-revision-aprobacion.md`
- `decisions/0004-proveedor-de-ia-abstraido.md`
- `decisions/0005-motor-de-precios.md`
- `decisions/0007-estrategia-de-matching.md`

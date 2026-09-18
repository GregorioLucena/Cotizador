# Alcance del MVP v1

## Objetivo de la version

Poner en produccion una plataforma donde el proveedor registra organizaciones y crea sus usuarios, y
donde cada organizacion puede cargar su catalogo, definir sus precios, pegar el mensaje de un cliente,
obtener un borrador de cotizacion generado por IA, corregirlo, aprobarlo y entregar el resultado como
texto para WhatsApp o como PDF con su propio formato.

El criterio de exito no es tecnico: una persona de mostrador debe poder emitir una cotizacion
completa y correcta en menos de un minuto, sin ayuda.

## Incluye

### Plataforma y seguridad

- Registro y administracion de organizaciones por parte del proveedor, con seleccion de vertical.
- Provisionamiento automatico de la organizacion al crearla: sucursal principal, unidades de medida,
  definiciones de atributos, categorias sugeridas, lista de precios predeterminada, configuracion de
  cotizacion y plantilla de documento, todo tomado del pack de vertical.
- Creacion de usuarios por organizacion con al menos dos perfiles diferenciados:
  `Administrador Organizacion` y `Cotizador`.
- Autenticacion con token de acceso corto y refresco en cookie, sesiones revocables.
- Autorizacion por permisos granulares con comodines.
- Aislamiento estricto por organizacion en toda consulta.

### Catalogo

- Alta, edicion e inactivacion de items con SKU opcional, nombre, descripcion, categoria, marca,
  unidad de medida, tipo de item y atributos propios del vertical.
- Categorias con un nivel de jerarquia, marcas y unidades de medida administrables.
- Definiciones de atributo administrables por la organizacion (heredadas del pack de vertical).
- Alias por item, manuales y aprendidos a partir de las correcciones del operador.
- Aplicaciones o compatibilidades por item, cargables y editables desde la ficha del item.
- Stock aproximado informativo, opcional por item, sin movimientos ni valorizacion.
- Busqueda del catalogo por texto con tolerancia a errores de escritura y acentos.

### Importacion

- Importacion de catalogo desde archivo Excel o CSV con mapeo de columnas, validacion previa,
  informe de errores por fila y modo de simulacion antes de confirmar.
- Importacion de precios por lista y de alias en el mismo formato.

### Precios

- Multiples listas de precios por organizacion, con moneda y vigencia.
- Precio por item y lista.
- Reglas de descuento por cantidad, categoria, marca o globales, con prioridad y vigencia.
- Moneda base de calculo y moneda de presentacion opcional con tasa de cambio editable.
- Configuracion de cotizacion: vigencia predeterminada, impuesto opcional, redondeo, texto de pie.

### Clientes

- Alta y edicion de clientes con nombre, WhatsApp, identificacion fiscal, lista de precios asignada y
  notas.
- Ultimas cotizaciones del cliente accesibles desde su ficha.

### Precotizacion e IA

- Captura de la solicitud pegando el texto del chat, con seleccion de cliente y lista de precios.
- Interpretacion del texto en lineas de pedido con descripcion, cantidad y unidad.
- Resolucion de cada linea contra el catalogo con confianza y candidatos alternativos.
- Semaforo por linea segun estado de resolucion.
- Trazabilidad completa de cada ejecucion de IA: proveedor, modelo, version de prompt, latencia,
  tokens y costo estimado.
- Degradacion controlada: si la IA no esta disponible o falla, se crea el borrador vacio y el
  operador arma la cotizacion manualmente.

### Revision y aprobacion

- Edicion de lineas del borrador: cambiar item, elegir un candidato, ajustar cantidad, sobrescribir
  precio con registro del motivo, quitar o agregar lineas.
- Opcion de guardar el texto original como alias del item al corregir una linea.
- Recalculo de totales, descuentos, impuesto y conversion de moneda en cada cambio.
- Aprobacion explicita que congela precios, descuentos, tasa y textos.
- Generacion del texto listo para pegar en WhatsApp.
- Generacion del PDF con la plantilla de la organizacion.
- Marcado del resultado como ganada o perdida con motivo, y anulacion con motivo.

### Documento

- Plantilla de documento por organizacion configurada de forma declarativa: logo, colores, datos del
  encabezado, columnas visibles y su orden, formato de folio, textos de saludo, condiciones y pie.
- Vista previa de la plantilla con datos de ejemplo.
- Reentrega del mismo archivo ya generado sin volver a renderizar.

### Historial y metricas

- Listado de cotizaciones con filtros por estado, cliente, rango de fechas y usuario.
- Reapertura de un borrador, duplicado de una cotizacion y recopiado del texto.
- Metricas del piloto: cantidad de cotizaciones por periodo, tiempo desde la captura hasta la
  aprobacion, tasa de lineas resueltas automaticamente, cotizaciones ganadas y perdidas, y los
  terminos que mas fallaron al resolverse.

## No incluye en esta version

| Fuera de alcance | Por que | Cuando |
|------------------|---------|--------|
| Bot automatico que responde dentro de WhatsApp | La aprobacion humana es parte del valor del producto | Fase 3, y solo como opcion |
| Integracion con WhatsApp Business API | Tiene costo por mensaje y complejidad de aprobacion de plantillas; el piloto se valida con copiar y pegar | Fase 3 |
| Interpretacion de notas de voz e imagenes de listas | Multiplica el costo por solicitud y requiere trabajo adicional de precision; primero hay que validar el texto | Fase 2 |
| Inventario real con movimientos, existencias y valorizacion | Es otro producto; aqui el stock es informativo | No planificado |
| Facturacion fiscal o electronica | Requiere cumplimiento normativo por pais | No planificado |
| Compras a proveedores y ordenes de compra | Fuera del problema que resolvemos | No planificado |
| Facturacion y cobro de la suscripcion dentro del producto | En el piloto la relacion comercial es directa | Fase 2 |
| Portal de autoservicio para el cliente comprador | Contradice la premisa de barrera cero para el comprador | No planificado |
| Busqueda semantica con embeddings | El reconocimiento por alias y similitud alcanza para un catalogo curado; la interfaz queda preparada | Fase 2, ver `decisions/0007-estrategia-de-matching.md` |
| Aplicacion movil nativa | La web responsive cubre el caso de mostrador | No planificado |
| Multi idioma en la interfaz | Todas las organizaciones del piloto son de habla hispana | Cuando exista demanda |

## Supuestos que sostienen el alcance

1. La organizacion esta dispuesta a cargar entre 150 y 300 items de mayor rotacion antes de empezar.
   Sin catalogo no hay producto.
2. El operador tiene el mensaje del cliente en un dispositivo desde el cual puede copiarlo y pegarlo.
3. La calidad del reconocimiento depende de la calidad de los alias. El sistema debe facilitar
   agregarlos, no exigirlos de entrada.
4. El volumen inicial por organizacion es de decenas de cotizaciones diarias, no miles. El diseño no
   optimiza para alta concurrencia todavia, pero no impide escalarla.

## Criterios de aceptacion del MVP

- Un usuario con perfil de plataforma puede registrar una organizacion nueva de cualquier vertical y
  esta queda operativa con su pack aplicado, sin intervencion manual en base de datos.
- Un administrador de organizacion puede importar un catalogo de 300 items desde Excel y ver el
  informe de errores antes de confirmar.
- Un cotizador puede pegar un mensaje de al menos cinco items en lenguaje coloquial y obtener un
  borrador con al menos el 70 por ciento de las lineas resueltas automaticamente sobre un catalogo
  con alias cargados.
- El total de la cotizacion se puede recalcular sin llamar al proveedor de IA y coincide con el
  calculo manual de las reglas configuradas.
- El PDF generado refleja el logo, los colores y los textos configurados por la organizacion.
- Ningun endpoint devuelve datos de una organizacion distinta a la del usuario autenticado.

## Documentos relacionados

- `00-vision.md` — por que existe el producto.
- `02-roadmap-sdd.md` — en que orden se especifica e implementa.
- `06-diseno-tecnico.md` — como se construye.

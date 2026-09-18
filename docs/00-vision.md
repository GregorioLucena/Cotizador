# Vision del producto

## Que estamos construyendo

**Cotizador** es una plataforma web multi-organizacion que convierte un mensaje informal de un
comprador ("necesito 2 tubos de media, 10 codos y un pegamento azul") en una cotizacion formal,
revisada por una persona y entregada como texto listo para WhatsApp o como PDF con la identidad
visual del negocio.

La plataforma la opera un unico proveedor (el dueño del producto) y se vende como servicio: cada
negocio que contrata se registra como una **organizacion** con sus propios usuarios, catalogo,
precios, plantillas de documento e historial. Ninguna organizacion ve datos de otra.

## El problema

Los negocios que venden por catalogo reciben pedidos de cotizacion por WhatsApp en lenguaje
coloquial y desordenado. Atenderlos a mano implica buscar precios uno por uno, aplicar descuentos
de memoria, calcular totales y responder mientras se atiende al publico. El resultado es tiempo
perdido, respuestas tardias, errores de precio y ventas que se escapan.

El problema no es exclusivo de las ferreterias: se repite en venta de repuestos, concesionarios de
vehiculos, distribuidoras de materiales, insumos agricolas y cualquier negocio con un catalogo
amplio y clientes que piden por nombre popular en lugar de por codigo.

## La propuesta de valor

1. **Velocidad.** El borrador de cotizacion se arma en segundos, no en minutos.
2. **Precision.** Los precios y descuentos salen del sistema, nunca de la memoria del vendedor.
3. **Control.** Nada llega al cliente sin aprobacion humana explicita.
4. **Trazabilidad.** Queda registro de lo cotizado, lo ganado y lo perdido.
5. **Aprendizaje.** Cada correccion del operador mejora el reconocimiento futuro del catalogo.

## Regla de oro

> **La IA propone. El catalogo cotiza. La persona aprueba.**

Esta frase no es un lema: es una restriccion de arquitectura. El modelo de lenguaje solo interpreta
que pidio el cliente (descripcion, cantidad, unidad). Los precios, los descuentos y los totales los
calcula un motor de reglas determinista a partir del catalogo y las listas de precios de la
organizacion. Ninguna cotizacion sale del sistema sin una aprobacion humana registrada.

Consecuencias directas de esta regla:

- Los importes se pueden recalcular y auditar sin volver a llamar al modelo.
- El motor de precios es testeable de forma unitaria y sin dependencias externas.
- Si el proveedor de IA falla, el operador puede armar la cotizacion manualmente y el producto sigue
  siendo util.

## Para quien es

| Actor | Quien es | Que hace en el sistema |
|-------|----------|------------------------|
| Proveedor de la plataforma | El dueño del producto | Registra organizaciones, crea sus usuarios iniciales, supervisa el servicio |
| Administrador de la organizacion | Dueño o encargado del negocio | Configura catalogo, precios, reglas, plantilla del documento y usuarios |
| Cotizador | Vendedor o persona de mostrador | Pega el mensaje, revisa el borrador, aprueba y envia |
| Cliente comprador | Quien pide la cotizacion | No usa el sistema: sigue escribiendo por WhatsApp como siempre |

El cliente comprador **nunca** accede a la plataforma y no descarga ninguna aplicacion. Esa es una
decision de producto deliberada: la barrera de adopcion debe ser cero para el comprador.

## Como se mantiene generico

El nucleo del producto es identico para todos los rubros: catalogo de items, reglas de precio,
interpretacion de un pedido en lenguaje natural y documento de cotizacion. Lo que cambia entre un
rubro y otro no es la logica, son los datos que la describen:

- Los **atributos** relevantes del item (diametro y material en ferreteria; marca, modelo y año de
  compatibilidad en repuestos; VIN y kilometraje en vehiculos).
- El **vocabulario** con el que la gente pide los productos.
- Las **unidades** de medida habituales.
- El **formato y los campos** del documento entregado.

Todo eso se resuelve con configuracion y semillas por rubro (los *packs de vertical*), no con codigo
condicional por tipo de negocio. Agregar un rubro nuevo debe ser un archivo de semilla, no un
despliegue con ramas `if (esFerreteria)`.

## Fuera de la vision (por ahora)

- Ser un ERP. No hay contabilidad, compras a proveedores ni inventario valorizado.
- Ser una facturadora fiscal. La cotizacion no es una factura.
- Ser un bot que responde solo. La aprobacion humana es parte del valor, no una limitacion
  temporal.

## Documentos relacionados

- `05-alcance-mvp.md` — que entra y que no entra en la primera version.
- `01-glosario.md` — vocabulario del dominio.
- `decisions/0003-pipeline-precotizacion.md` — como se materializa la regla de oro.

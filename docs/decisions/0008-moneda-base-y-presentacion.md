# ADR 0008: Moneda base de calculo y moneda de presentacion con tasa congelada

## Estado

Aceptada — 2026-09-17

## Contexto

En los mercados objetivo es habitual mantener los precios en una moneda fuerte y cobrar en moneda
local convertida a la tasa del dia. El caso de referencia son precios en dolares presentados tambien en
bolivares a la tasa oficial, pero el mismo patron aparece con otras monedas.

Los requisitos concretos son: los precios del catalogo deben mantenerse estables en una sola moneda; el
cliente debe ver el importe en la moneda con la que va a pagar; y una cotizacion emitida no puede
cambiar de valor porque la tasa se movio al dia siguiente.

## Decision

Cada organizacion define una **moneda base**, en la que se expresan todos los precios y se hacen todos
los calculos, y opcionalmente una **moneda de presentacion**, en la que se muestra el total convertido
con una tasa de cambio. La tasa aplicada **se congela en la cotizacion al aprobarla**.

### Reglas

1. Todos los precios del catalogo y de las listas estan en la moneda base de la organizacion. No existe
   precio en moneda de presentacion.
2. Las listas de precios tienen su propia moneda declarada, que debe coincidir con la moneda base. El
   campo existe para permitir en el futuro listas en otra moneda sin migrar el modelo.
3. El calculo completo (precio, descuento, impuesto, redondeo) se hace integramente en moneda base.
4. La conversion se aplica **solo al total**, no linea por linea. Asi el total mostrado en moneda de
   presentacion siempre es coherente y no aparecen diferencias de centavos por redondeo acumulado.
5. La tasa vigente se administra por organizacion, con fecha de vigencia y fuente. La fuente inicial es
   manual; el modelo admite una fuente automatica sin cambios.
6. Al aprobar una cotizacion se copian a la cotizacion la moneda base, la moneda de presentacion, el
   valor exacto de la tasa y su fecha. La cotizacion aprobada nunca vuelve a consultar la tasa vigente.
7. El documento indica de forma explicita la tasa y la fecha usadas cuando se muestra la moneda de
   presentacion, para evitar discusiones con el cliente.
8. Si la organizacion no configura moneda de presentacion, todo el sistema opera en una sola moneda sin
   pantallas ni campos adicionales.
9. Los importes se guardan como `numeric(18,4)` y las tasas como `numeric(18,6)`. Los importes viajan
   como cadena en la API.
10. Las monedas son un catalogo global de plataforma con codigo ISO, simbolo y cantidad de decimales de
    presentacion. La organizacion elige de ese catalogo, no crea monedas.

## Alternativas descartadas

### Multi moneda completo con precios por moneda y tabla de tasas historicas por par

**Pros:** cubre operaciones internacionales y precios diferenciados por moneda.
**Contras:** multiplica el mantenimiento del catalogo por cada moneda, obliga a decidir en cada consulta
que precio corresponde y ninguna organizacion del piloto lo necesita.
**Descartada.** El modelo actual con moneda por lista deja la puerta abierta.

### Una sola moneda por organizacion, sin conversion

**Pros:** el modelo mas simple.
**Contras:** no resuelve el caso real de los mercados objetivo, donde el cliente pregunta el monto en
moneda local.
**Descartada.**

### Convertir linea por linea a la moneda de presentacion

**Pros:** el cliente ve cada precio unitario en su moneda.
**Contras:** la suma de las lineas convertidas casi nunca coincide con el total convertido, y esa
diferencia genera desconfianza justo en el momento de cerrar la venta.
**Descartada.** Se convierte solo el total, y el detalle se muestra en moneda base.

### Obtener la tasa automaticamente de una fuente externa desde el MVP

**Pros:** menos trabajo manual diario.
**Contras:** dependencia de un servicio externo sin acuerdo de servicio, formatos que cambian y
responsabilidad implicita sobre un dato sensible.
**Descartada para el MVP.** La tasa se edita a mano en segundos y el modelo ya contempla la fuente
automatica.

## Consecuencias

- Una cotizacion aprobada es un documento estable: su valor no cambia nunca.
- Actualizar la tasa es una operacion trivial que no requiere tocar el catalogo.
- Hay que recordar al operador actualizar la tasa; la interfaz muestra la fecha de la ultima
  actualizacion y advierte si tiene mas de un dia.
- Las cotizaciones en borrador si reflejan la tasa vigente al momento de recalcular, lo que puede
  cambiar el total mostrado antes de aprobar. Es el comportamiento correcto y debe quedar visible.
- El reporte de ventas ganadas se expresa en moneda base, que es la unica comparable en el tiempo.

## Referencias

- `docs/specs/006-listas-precios-reglas.md`
- `decisions/0005-motor-de-precios.md`

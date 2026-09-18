# ADR 0005: Motor de precios determinista y puro

## Estado

Aceptada — 2026-09-17

## Contexto

El calculo del importe de una cotizacion combina varias fuentes: el precio del item en la lista
asignada al cliente, las reglas de descuento por cantidad, categoria, marca o globales, un impuesto
opcional, el redondeo configurado y la conversion a una moneda de presentacion.

Es la parte del sistema donde un error cuesta dinero de forma directa e inmediata. Tambien es la parte
que el dueño del negocio va a cuestionar linea por linea. Por lo tanto tiene que ser exacta,
explicable y facil de probar.

## Decision

El calculo de precios se implementa como un **modulo de funciones puras** en el paquete compartido,
sin acceso a base de datos, sin dependencias de framework y sin lectura del reloj del sistema.

```typescript
export function calcularCotizacion(
  entrada: EntradaCalculo,
): ResultadoCalculo;

export type EntradaCalculo = {
  lineas: LineaCalculo[];        // item, cantidad, precio base, categoria, marca
  reglas: ReglaDescuento[];      // ya filtradas por vigencia y lista
  configuracion: ConfiguracionCalculo; // impuesto, redondeo, modo de descuento
  fechaReferencia: string;       // recibida, nunca new Date() dentro del modulo
  tasa?: TasaConversion;
};
```

### Reglas de calculo

1. **Orden de aplicacion, fijo y documentado:** precio base de la lista, luego descuento por reglas,
   luego sobrescritura manual si existe, luego impuesto, luego redondeo, y por ultimo la conversion a
   moneda de presentacion.
2. **Una sola regla de descuento por linea.** Los descuentos no se acumulan. Se elige la regla de mayor
   prioridad; a igual prioridad, la de ambito mas especifico (item, luego categoria, luego marca,
   luego global); a igual especificidad, la de mayor beneficio para el cliente. La regla elegida se
   guarda en la linea, de modo que el documento puede explicar por que se aplico ese descuento.
3. **La sobrescritura manual del precio gana siempre** sobre reglas y lista, exige un motivo y se
   registra como evento. Al sobrescribir, no se aplica descuento adicional.
4. **Precision:** todos los importes se calculan con aritmetica decimal, nunca con numeros de punto
   flotante. Se almacenan como `numeric(18,4)` en base de datos y se transportan como cadena en la
   API para no perder precision en JavaScript.
5. **Redondeo:** se aplica una sola vez, al final de cada linea y luego al total, con los decimales y
   el modo configurados por la organizacion. El redondeo intermedio esta prohibido.
6. **Impuesto:** configurable por organizacion como porcentaje unico, con opcion de precios que ya lo
   incluyen. Si los precios lo incluyen, se calcula la base imponible por division, no se suma.
7. **Conversion de moneda:** el total en moneda de presentacion se calcula multiplicando el total en
   moneda base por la tasa. Nunca se convierten precios linea por linea, para que la suma mostrada
   coincida siempre con el total mostrado.
8. **Item sin precio en la lista:** no se inventa un precio ni se usa otra lista. La linea se marca
   como no cotizable y la cotizacion no puede aprobarse hasta resolverla.
9. **Congelamiento al aprobar:** al aprobar se copian a la cotizacion el precio unitario, el descuento
   aplicado, el identificador de la regla, el impuesto y la tasa. Cambiar la lista de precios o la tasa
   despues **no** altera ninguna cotizacion aprobada.

### Pruebas obligatorias

El modulo debe tener pruebas unitarias en formato de tabla que cubran como minimo: sin descuentos,
descuento por cantidad en el limite exacto del minimo, dos reglas en conflicto con la misma prioridad,
regla vencida que no debe aplicarse, precio sobrescrito manualmente, impuesto incluido y no incluido,
redondeo con cinco en el ultimo decimal, item sin precio, cantidad decimal en unidad que no admite
decimales, y conversion de moneda con tasa de varios decimales.

Ninguna prueba del motor de precios puede requerir base de datos, red ni contenedor.

## Alternativas descartadas

### Calcular en consultas SQL

**Pros:** un solo viaje a la base de datos, calculo cercano a los datos.
**Contras:** la logica de prioridad de reglas queda en SQL, imposible de probar unitariamente y muy
dificil de leer; el recalculo en la interfaz mientras el operador edita exigiria ir al servidor en
cada cambio.
**Descartada.**

### Motor de reglas configurable con expresiones evaluadas en tiempo de ejecucion

**Pros:** flexibilidad total para descuentos exoticos.
**Contras:** evaluar expresiones definidas por el usuario es un riesgo de seguridad y de soporte; el
comportamiento se vuelve impredecible y el 95 por ciento de los casos reales son descuentos por
cantidad y por segmento de cliente.
**Descartada.** Las reglas son declarativas y de tipos cerrados.

### Descuentos acumulativos en cascada

**Pros:** representa esquemas comerciales complejos.
**Contras:** el resultado depende del orden y es dificil de explicar al cliente; genera discusiones
sobre montos.
**Descartada.** Si aparece la necesidad, se resolvera con reglas de ambito mas especifico, no con
acumulacion.

## Consecuencias

- El mismo modulo se usa en el servidor para persistir y en el navegador para mostrar el recalculo
  inmediato mientras el operador edita, sin duplicar logica ni riesgo de discrepancia.
- Toda discusion sobre un monto se puede reproducir con una prueba unitaria.
- Los importes viajan como cadena en la API, lo que obliga a formatear explicitamente en la interfaz.
  Es una molestia menor a cambio de exactitud.
- Los descuentos no acumulativos pueden requerir explicacion comercial al cliente; se documenta en la
  especificacion de precios.

## Referencias

- `docs/specs/006-listas-precios-reglas.md`
- `docs/specs/009-revision-aprobacion.md`
- `decisions/0008-moneda-base-y-presentacion.md`

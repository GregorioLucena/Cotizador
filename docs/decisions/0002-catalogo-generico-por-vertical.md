# ADR 0002: Catalogo generico con atributos JSON y packs de vertical

## Estado

Aceptada — 2026-09-17

## Contexto

El producto debe servir a rubros distintos sin reescribirse: ferreteria, venta de repuestos,
concesionarios de vehiculos, distribuidoras. Cada rubro describe sus items con datos diferentes:

- Ferreteria: diametro, material, medida, presentacion.
- Repuestos: numero de parte original, posicion, lado, y compatibilidad con marca, modelo y año de
  vehiculo.
- Vehiculos: VIN, año, kilometraje, transmision, color.

Si el modelo de datos solo tiene nombre y precio, el producto no sirve para repuestos. Si el modelo
tiene columnas para todos los rubros, la tabla se vuelve una sabana de campos nulos. Si hay una tabla
de items por rubro, se duplica toda la logica de precios, resolucion y cotizacion.

Necesitamos que agregar un rubro nuevo sea agregar datos, no agregar codigo.

## Decision

Se adopta un **nucleo relacional fijo mas atributos en una columna JSON validada por definiciones de
atributo de la organizacion**, y **packs de vertical versionados en codigo que se materializan como
datos propios de la organizacion al provisionarla**.

### Nucleo fijo

La tabla `items` tiene columnas reales para todo lo que el sistema necesita para operar de forma
transversal: organizacion, SKU, nombre, descripcion, categoria, marca, unidad de medida, tipo de item,
stock aproximado, estado y auditoria. Ninguna de esas columnas depende del rubro.

### Atributos variables

Los datos propios del rubro viven en `items.atributos` como documento JSON con claves planas:

```json
{ "diametro": "1/2\"", "material": "PVC", "presentacion": "barra 3m" }
```

Reglas:

1. Cada clave del documento debe corresponder a una **definicion de atributo** activa de la
   organizacion. No se aceptan claves libres.
2. La validacion se hace con un esquema Zod construido dinamicamente a partir de las definiciones,
   antes de persistir.
3. Los tipos de dato soportados son `TEXTO`, `NUMERO`, `ENTERO`, `BOOLEANO`, `LISTA` (con opciones
   cerradas) y `RANGO_ANIO`. La lista es cerrada a proposito: cada tipo nuevo obliga a decidir como se
   valida, como se muestra y como participa en la busqueda.
4. Se indexa la columna con un indice GIN para permitir filtros por atributo.
5. Los atributos marcados como buscables se concatenan en la columna derivada de texto de busqueda
   del item.

### Compatibilidades como tabla propia

La compatibilidad de un item con vehiculos es una relacion de uno a muchos, no un atributo escalar.
Vive en una tabla `item_aplicaciones` con un documento JSON de datos y una columna normalizada de
texto para busqueda. Una ferreteria simplemente no la usa.

### Packs de vertical

Cada vertical se define como una semilla en codigo, en
`packages/database/src/seeds/verticales/<codigo>.ts`, que declara:

- definiciones de atributo con su tipo, opciones y si son buscables;
- categorias sugeridas;
- unidades de medida habituales;
- sinonimos frecuentes del rubro, usados como base para los alias;
- configuracion inicial de cotizacion;
- plantilla de documento inicial.

Al crear una organizacion se ejecuta el provisionamiento, que **copia** el contenido del pack a tablas
propias de esa organizacion en una unica transaccion. A partir de ese momento el pack no manda: la
organizacion es dueña de sus definiciones y puede modificarlas, desactivarlas o agregar propias.

## Alternativas descartadas

### Modelo fijo y simple, sin atributos variables

**Pros:** el modelo mas simple posible, consultas triviales, cero validacion dinamica.
**Contras:** imposible representar compatibilidad de repuestos o especificaciones de vehiculos; el
operador terminaria escribiendo todo en el nombre del item, degradando la resolucion.
**Descartada** porque incumple el requisito explicito de servir a varios rubros.

### Tablas de entidad, atributo y valor

**Pros:** pureza relacional, atributos consultables con SQL estandar y con integridad referencial.
**Contras:** cada item requiere tantas filas como atributos; mostrar una ficha exige pivotar; los
filtros combinados necesitan multiples uniones y el rendimiento cae rapido; el modelo se vuelve
dificil de leer para cualquier persona nueva.
**Descartada** por costo de complejidad y rendimiento desproporcionado frente al beneficio.

### Una tabla de items por vertical

**Pros:** columnas tipadas y explicitas por rubro, validacion en el motor.
**Contras:** duplica precios, resolucion, cotizacion y toda la logica asociada; agregar un rubro
significa migracion, entidades, servicios y pantallas nuevas; las consultas de plataforma requieren
uniones por rubro.
**Descartada** porque convierte cada rubro nuevo en un proyecto.

### Packs de vertical como tablas globales heredadas

Se evaluo mantener las definiciones del pack como filas globales que las organizaciones heredan
mediante una columna nulable de organizacion.
**Pros:** actualizar un pack propaga a todas las organizaciones del rubro.
**Contras:** toda consulta de catalogo necesitaria una condicion de union entre lo global y lo propio;
una organizacion no podria desactivar limpiamente algo heredado; el aislamiento por tenant se vuelve
menos evidente.
**Descartada** en favor de la materializacion por copia. Si en el futuro hace falta propagar mejoras
del pack, se hara con un comando explicito de sincronizacion que la organizacion pueda revisar.

## Consecuencias

- Agregar un vertical nuevo es escribir un archivo de semilla y registrarlo en el catalogo de
  verticales. No se toca el modelo de datos ni la logica.
- La validacion de atributos es dinamica, por lo que necesita pruebas propias: atributo desconocido,
  tipo incorrecto, opcion fuera de lista, obligatorio ausente.
- Las consultas por atributo son posibles pero no son el camino principal de busqueda; el camino
  principal es el texto de busqueda con alias.
- Dos organizaciones del mismo vertical pueden divergir en sus definiciones, lo que es deseable y
  esperado.
- No se puede imponer un cambio de pack retroactivamente sin una herramienta explicita, y eso es un
  costo aceptado.
- El vertical de la organizacion queda registrado como dato informativo y para el provisionamiento,
  pero **ninguna regla de negocio debe ramificar por vertical**. Si alguna vez hace falta, es señal de
  que falta una definicion de configuracion.

## Referencias

- `docs/03-verticales-y-packs.md` — contenido de cada pack.
- `docs/specs/003-maestras-catalogo.md`
- `docs/specs/004-catalogo-items.md`

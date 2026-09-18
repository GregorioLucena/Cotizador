# ADR 0007: Resolucion de items por alias y similitud textual

## Estado

Aceptada — 2026-09-17

## Contexto

El cliente escribe "tubo de media", "pega azul", "pastillas del corolla 2015" o "eso del lavamanos".
El sistema tiene que asociar cada una de esas expresiones con un item concreto del catalogo de la
organizacion, o admitir que no puede.

Esta etapa determina la utilidad percibida del producto: si la mayoria de las lineas quedan en rojo, el
operador siente que trabaja mas que antes. Tambien determina la confianza: una coincidencia incorrecta
que pase inadvertida es peor que una linea sin resolver, porque genera una cotizacion con el producto
equivocado.

## Decision

Se adopta una **cascada de estrategias deterministas sobre PostgreSQL**, ordenada de mayor a menor
precision, con puntaje explicito, umbrales configurables y candidatos alternativos siempre disponibles.

### Cascada de resolucion

| Orden | Estrategia | Como funciona | Puntaje base |
|-------|-----------|---------------|--------------|
| 1 | SKU exacto | El texto contiene un codigo que coincide con el SKU de un item | 1.00 |
| 2 | Alias exacto | Coincidencia exacta del texto normalizado con un alias del item | 0.98 |
| 3 | Alias por similitud | Similitud de trigramas contra los alias | 0.60 a 0.95 |
| 4 | Texto de busqueda por similitud | Similitud de trigramas contra nombre, marca, categoria y atributos buscables | 0.50 a 0.90 |
| 5 | Palabras clave con filtro de atributos | Coincidencia de terminos mas atributos detectados en el texto, por ejemplo una medida | 0.45 a 0.85 |

La cascada se detiene en la primera estrategia que produce un resultado por encima del umbral
automatico. Las estrategias restantes se ejecutan de todos modos, hasta un limite, para poblar la lista
de candidatos alternativos.

### Fundamento tecnico

- Extensiones de PostgreSQL: `pg_trgm` para similitud de trigramas y `unaccent` para normalizar
  acentos. Se habilitan en la primera migracion.
- Columna derivada `textoBusqueda` en `items`, mantenida por la aplicacion al guardar, que concatena
  nombre, SKU, marca, categoria, alias activos y atributos marcados como buscables, todo normalizado.
- Indices GIN con `gin_trgm_ops` sobre `items.textoBusqueda` y sobre `item_alias.normalizado`, ambos
  compuestos con `organizacionId` para que el filtro por tenant sea eficiente.
- Normalizacion consistente: la misma funcion pura normaliza el texto de la solicitud y el texto que
  se indexa. Es un requisito, no un detalle: si divergen, la busqueda falla de forma silenciosa.
- Diccionario de equivalencias de medidas y fracciones aplicado en la normalizacion, para que "media",
  "1/2" y "0.5" converjan a la misma representacion.

### Umbrales y estados

Dos umbrales configurables por organizacion, con valores iniciales:

- `umbralAutomatico` = 0.80. Igual o superior produce `RESUELTA_AUTOMATICA` (verde).
- `umbralDescarte` = 0.45. Entre ambos produce `SUGERIDA_REVISAR` (ambar). Por debajo produce
  `NO_ENCONTRADA` (rojo).

Regla de seguridad adicional: si los dos mejores candidatos difieren en menos de 0.05 de puntaje, la
linea **no** se marca como automatica aunque supere el umbral. Ante empate, decide la persona.

### Aprendizaje por correccion

Cuando el operador cambia el item de una linea, se ofrece guardar el texto solicitado como alias
`APRENDIDO` del item elegido. Es una accion afirmativa, nunca automatica: un alias incorrecto envenena
el reconocimiento futuro. Cada alias registra cuantas veces se uso, lo que permite depurarlos.

Ademas se registran los textos que quedaron sin resolver, para que el administrador pueda revisar la
lista de terminos que mas falla y decidir si crea alias o items nuevos.

## Alternativas descartadas

### Embeddings con pgvector desde el MVP

**Pros:** captura similitud semantica real, resuelve descripciones vagas mejor que cualquier metodo
lexico, tolera catalogos con nombres pobres.
**Contras:** requiere generar y mantener vectores por item, con costo por reindexado en cada cambio de
catalogo y en cada importacion masiva; agrega una dependencia de modelo de embeddings al camino
critico; el puntaje no es explicable ante el usuario; y no aporta gran cosa cuando existen alias
curados, que es el escenario esperado.
**Descartada para el MVP** de forma deliberada. La cascada esta definida como una lista ordenada de
estrategias detras de una interfaz `EstrategiaResolucion`, de modo que agregar una estrategia de
embeddings en fase 2 es añadir un elemento a la cascada, sin tocar el resto del pipeline.

### Que el modelo de lenguaje elija el item

**Pros:** aprovecha la comprension del lenguaje para desambiguar.
**Contras:** no escala a catalogos grandes porque habria que enviarlo en el contexto; el resultado no
es reproducible; y cada revision de una cotizacion antigua podria dar un item distinto.
**Descartada.** Ver `decisions/0003-pipeline-precotizacion.md`.

### Busqueda de texto completo con tsvector y tsquery

**Pros:** nativa, rapida, con soporte de diccionarios y radicacion en español.
**Contras:** exige coincidencia de palabras completas o prefijos, por lo que tolera mal los errores de
escritura, que son la norma en mensajes de WhatsApp; "tuvo" no encuentra "tubo".
**Descartada como mecanismo principal**, aunque se puede combinar mas adelante como estrategia
adicional de la cascada.

## Consecuencias

- El reconocimiento funciona sin dependencias externas ni costo por consulta, dentro de PostgreSQL.
- El puntaje es explicable: se puede mostrar por que se eligio un item y que alternativas habia.
- La calidad depende de la curacion de alias, por lo que la interfaz debe hacer trivial agregarlos y el
  producto debe medir cuantas lineas se resuelven solas.
- Habra casos de descripciones muy vagas que el sistema no resolvera. Es aceptable: la respuesta
  correcta ahi es dejarlos en rojo y que la persona decida, tal como ocurre hoy sin sistema.
- Es necesario un limite de resultados y un tiempo maximo de consulta para catalogos grandes, para que
  la generacion del borrador se mantenga por debajo de unos pocos segundos.

## Referencias

- `docs/04-flujo-precotizacion.md`
- `docs/specs/004-catalogo-items.md`
- `docs/specs/008-precotizacion-ia.md`

# Spec 010: Plantillas de documento

## Estado

Implementada — cerrada (2026-09-19)

## Objetivo

Definir la configuración declarativa de la plantilla de documento de una organización y el
comportamiento del renderizado que produce el PDF y el texto para WhatsApp a partir de una
cotización aprobada.

La plantilla es el único mecanismo por el cual el documento sale con la identidad del negocio: logo,
colores, datos fiscales, columnas visibles, formato de folio, textos y opciones del mensaje. No es
HTML libre ni un editor visual. Es un formulario validado con Zod, interpretado por un único
renderizador del lado del servidor, según `docs/decisions/0006-plantillas-de-documento.md`.

Esta especificación fija qué se configura, qué efecto tiene cada campo, cómo se versiona, cómo se
previsualiza, cómo se genera el PDF con hash y versión, y cómo se reentrega el mismo archivo sin
volver a renderizar. Ningún importe del documento proviene de un modelo de lenguaje: los totales
vienen de la cotización ya aprobada y congelada.

## Dependencias

| Documento | Aporta |
|-----------|--------|
| `docs/06-diseno-tecnico.md` | Tablas `plantillas_documento` y `documentos_generados`, permisos, endpoints y adaptador `GeneradorPdf` |
| `docs/decisions/0006-plantillas-de-documento.md` | Configuración declarativa, marcadores acotados, renderizador único y rechazo de HTML libre |
| `docs/decisions/0008-moneda-base-y-presentacion.md` | Total en moneda base, presentación opcional, tasa y fecha congeladas al aprobar |
| `docs/decisions/0011-auditoria-y-trazabilidad.md` | Congelamiento de textos y versión de plantilla; evento `DOCUMENTO_GENERADO` |
| `docs/specs/002-configuracion-organizacion.md` | Carga del logo, límites de archivo y `logoUrl` de la organización |
| `docs/specs/009-revision-aprobacion.md` | Aprobación humana, congelamiento de importes y generación del texto de entrega |

Esta especificación es consumida por `docs/specs/011-historial-y-metricas.md` para la reentrega del
documento desde el historial.

Requisitos previos de implementación:

1. Organización provisionada con al menos una plantilla predeterminada materializada desde el pack de
   vertical.
2. Adaptador de almacenamiento de archivos operativo.
3. Interfaz `GeneradorPdf` registrada y con tiempo máximo de ejecución configurable
   (`PDF_TIMEOUT_MS`).
4. Cotizaciones en estado `APROBADA` o posterior, según `docs/specs/009-revision-aprobacion.md`.

## Alcance MVP v1

Incluye:

- Consulta y edición de la plantilla predeterminada de la organización como configuración
  declarativa JSON validada.
- Bloques de configuración: identidad, estilo, folio, columnas (incluido `ATRIBUTO`), totales,
  textos y mensaje de WhatsApp.
- Marcadores acotados en textos: `{{cliente}}`, `{{folio}}`, `{{vigencia}}`, `{{total}}`,
  `{{organizacion}}`.
- Vista previa con el mismo renderizador que la generación final, sobre datos de ejemplo.
- Generación de PDF a partir de una cotización aprobada, con registro de hash, versión de plantilla
  y tamaño.
- Reentrega del archivo ya generado sin volver a renderizar.
- Versionado de la plantilla: cada guardado que altera la configuración incrementa `version`.
- Manejo de fallo y timeout del generador de PDF.
- Consumo del logo de la organización con los límites definidos en
  `docs/specs/002-configuracion-organizacion.md`.
- Generación del texto plano para WhatsApp a partir de la misma configuración.

No incluye en esta versión:

| Fuera de alcance | Motivo |
|------------------|--------|
| HTML o Handlebars libre por organización | Superficie de ataque y soporte de maquetación; descartado en ADR 0006 |
| Editor visual de plantillas | Es un producto en sí mismo y no aporta a cotizar rápido |
| Múltiples plantillas activas concurrentes por organización | El MVP usa una predeterminada; el modelo ya admite más filas |
| Regeneración automática de documentos ya emitidos al cambiar la plantilla | Una cotización aprobada no cambia; el archivo ya generado se conserva |
| Envío del PDF por WhatsApp Business API | Fuera del alcance del piloto; ver `docs/05-alcance-mvp.md` |
| Firmas digitales, marca de agua o códigos QR | Sin caso de uso validado en el piloto |
| Borrado físico de plantillas o de documentos generados | Prohibido en datos de negocio |

## Conceptos principales

| Concepto | Definicion operativa |
|----------|----------------------|
| Plantilla de documento | Configuración declarativa por organización que define identidad, estilo, columnas, totales, textos y opciones de WhatsApp |
| Configuracion | Documento JSON validado con Zod y almacenado en `plantillas_documento.configuracion` |
| Renderizador | Único motor del lado del servidor que interpreta la configuración y produce HTML intermedio y texto plano |
| GeneradorPdf | Adaptador externo detrás de interfaz que convierte el HTML en PDF; el dominio no importa el SDK |
| Documento generado | Archivo persistido con `hashContenido`, `plantillaVersion`, `rutaArchivo` y `tamanoBytes` |
| Vista previa | Renderizado con la misma plantilla HTML y datos de ejemplo, sin persistir archivo ni hash |
| Version | Entero monótono de la plantilla; se incrementa al guardar un cambio de configuración |
| Marcador | Sustitución acotada en textos (`{{cliente}}`, `{{folio}}`, `{{vigencia}}`, `{{total}}`, `{{organizacion}}`) |
| Columna ATRIBUTO | Columna de tabla cuyo valor se toma de un atributo del item congelado, identificado por `atributoCodigo` |
| Reentrega | Descarga del archivo ya generado sin invocar de nuevo al renderizador ni al `GeneradorPdf` |

### Por que no hay HTML libre

Permitir HTML o plantillas Handlebars por organización se descartó en
`docs/decisions/0006-plantillas-de-documento.md` por tres razones que esta especificación hace
invariantes:

1. Ejecutar plantillas provistas por el usuario abre inyección, exfiltración de datos y consumo
   descontrolado de recursos.
2. Cada organización con una maquetación rota se convierte en un ticket de soporte de diseño, no de
   producto.
3. Un cambio del modelo de datos rompería plantillas ajenas sin que el equipo pudiera garantizar
   compatibilidad.

La configuración declarativa con enumerados cerrados y un único renderizador evita esas tres
fallas. Ampliar el conjunto de columnas o campos es agregar un valor al enumerado y su renderizado,
no desplegar código por cliente.

## Datos requeridos

### Plantilla de documento

Tabla `plantillas_documento`.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Generado | `uuid` generado por la base de datos |
| `organizacionId` | Generado | Tomado de `ctx.organizacionId`, nunca de la entrada |
| `nombre` | Si | Texto de 2 a 80 caracteres. En el MVP suele ser `Predeterminada` |
| `esPredeterminada` | Generado | Booleano. Exactamente una plantilla activa predeterminada por organización |
| `version` | Generado | Entero que arranca en 1 al provisionar. Se incrementa en cada guardado de configuración |
| `configuracion` | Si | Documento JSON validado contra el esquema Zod del ADR 0006 |
| `estadoRegistro` | Generado | `ACTIVO` al crear. La inactivación de la predeterminada no está permitida en el MVP |
| `createdById`, `updatedById` | Generado | Tomados de `ctx.usuarioId` |

### Documento generado

Tabla `documentos_generados`.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Generado | `uuid` |
| `organizacionId` | Generado | Del contexto |
| `cotizacionId` | Si | Cotización de la misma organización en estado `APROBADA` o posterior |
| `plantillaId` | Si | Plantilla usada al generar |
| `plantillaVersion` | Si | Valor de `version` al momento de generar; no se actualiza después |
| `formato` | Si | Solo `PDF` en el MVP |
| `rutaArchivo` | Si | Ruta en el adaptador de almacenamiento |
| `hashContenido` | Si | Hash del archivo generado (SHA-256 en hexadecimal) |
| `tamanoBytes` | Si | Entero mayor que cero |
| `generadoPorId` | Si | Usuario que solicitó la generación |
| `createdAt` | Generado | Momento de la generación |

Una cotización admite como máximo un documento PDF vigente. Regenerar solo está permitido si aún no
existe documento, o si la generación anterior falló sin dejar registro exitoso. Un documento ya
emitido no se reemplaza: la cotización aprobada no cambia de valor ni de presentación entregada.

### Bloque `identidad`

Valores iniciales al provisionar: se copian de los datos de la organización cuando existen; el
`logoUrl` se lee de `organizaciones.logoUrl` al renderizar, no se duplica en la configuración salvo
que el administrador lo fije explícitamente en el bloque.

| Campo | Default | Efecto |
|-------|---------|--------|
| `nombreComercial` | Nombre de la organización | Encabezado principal del PDF y del mensaje |
| `razonSocial` | Razón social de la organización, si existe | Línea legal bajo el nombre comercial |
| `identificacionFiscal` | Identificación fiscal de la organización, si existe | Se muestra junto a la razón social |
| `direccion` | Dirección de la organización, si existe | Bloque de contacto del encabezado |
| `telefonos` | Arreglo vacío; se puede precargar con el teléfono de la organización | Hasta 3 teléfonos en el encabezado |
| `email` | Correo de la organización, si existe | Contacto del encabezado |
| `sitioWeb` | Ausente | Contacto opcional del encabezado |
| `logoUrl` | Ausente en la configuración; al renderizar se usa `organizaciones.logoUrl` si no hay valor propio | Imagen del encabezado. Sin logo, el documento se genera igual |

Límites del logo (carga en `docs/specs/002-configuracion-organizacion.md`): PNG, JPG o SVG; máximo
2 MB; mapa de bits mínimo 200 por 200 píxeles. La plantilla no vuelve a validar el archivo: consume
la URL vigente. Si la URL apunta a un archivo ausente, el renderizado omite el logo y registra
advertencia, sin fallar la generación.

### Bloque `estilo`

| Campo | Default | Efecto |
|-------|---------|--------|
| `colorPrimario` | `#146b45` | Color de encabezado, reglas y acentos del PDF |
| `colorTextoSobrePrimario` | `#ffffff` | Color del texto sobre el color primario |
| `tipografia` | `SANS` | `SANS` o `SERIF` en el HTML intermedio |
| `densidad` | `NORMAL` | `COMPACTA` reduce márgenes y cuerpo; `NORMAL` es el espaciado estándar |
| `tamanoPagina` | `CARTA` | `A4` o `CARTA` pasado al `GeneradorPdf` |

Los colores deben coincidir con el patrón `^#[0-9a-fA-F]{6}$`. Cualquier otro valor es error 400.

### Bloque `folio`

| Campo | Default | Efecto |
|-------|---------|--------|
| `prefijo` | `COT-` | Prefijo del folio legible (`COT-0045`) |
| `longitudNumero` | `4` | Relleno con ceros a la izquierda del número secuencial |

El número secuencial lo asigna `secuencias_folio` al crear la cotización. La plantilla solo formatea
la presentación. Cambiar el prefijo o la longitud afecta a cotizaciones nuevas, no a folios ya
asignados ni a documentos ya generados.

### Bloque `columnas`

Arreglo de al menos dos columnas. Cada elemento:

| Campo | Default | Efecto |
|-------|---------|--------|
| `campo` | Obligatorio, sin default | Enumerado cerrado: `ORDEN`, `SKU`, `DESCRIPCION`, `MARCA`, `ATRIBUTO`, `UNIDAD`, `CANTIDAD`, `PRECIO_UNITARIO`, `DESCUENTO`, `TOTAL_LINEA` |
| `etiqueta` | Obligatorio | Encabezado de columna en el PDF, máximo 30 caracteres |
| `atributoCodigo` | Ausente | Obligatorio cuando `campo` es `ATRIBUTO`. Código de una definición de atributo de la organización |
| `visible` | `true` | Si es falso, la columna no se renderiza |
| `orden` | Obligatorio | Entero que define el orden de izquierda a derecha |

Reglas del bloque:

1. Debe existir al menos una columna con `campo` `DESCRIPCION` y `visible` verdadero.
2. Debe existir al menos una columna con `campo` `TOTAL_LINEA` o `PRECIO_UNITARIO` visible, para que
   el documento muestre importes.
3. Si `campo` es `ATRIBUTO`, `atributoCodigo` es obligatorio. Si falta, error 400 con
   `COLUMNA_ATRIBUTO_SIN_CODIGO`.
4. El valor mostrado en una columna `ATRIBUTO` se toma de los atributos congelados de la línea al
   aprobar, nunca del catálogo vivo.
5. Dos columnas visibles no pueden compartir el mismo `orden`.
6. Una columna `ATRIBUTO` cuyo código no exista en las definiciones de la organización se acepta al
   guardar (el atributo pudo inactivarse después), pero al renderizar muestra celda vacía.

### Bloque `totales`

| Campo | Default | Efecto |
|-------|---------|--------|
| `mostrarSubtotal` | `true` | Muestra el subtotal en moneda base |
| `mostrarDescuento` | `true` | Muestra el descuento total en moneda base |
| `mostrarImpuesto` | `false` | Muestra el impuesto total cuando la cotización lo aplicó |
| `mostrarMonedaPresentacion` | `true` | Muestra el total convertido si la cotización tiene moneda de presentación |
| `mostrarTasaAplicada` | `true` | Muestra la tasa y su fecha junto al total de presentación |

Los importes se muestran como cadenas con 4 decimales en la API y se formatean para el PDF según el
`locale` de la organización. La conversión solo afecta al total, nunca línea por línea, según
`docs/decisions/0008-moneda-base-y-presentacion.md`.

### Bloque `textos`

| Campo | Default | Efecto |
|-------|---------|--------|
| `saludo` | Ausente | Párrafo inicial del PDF y, si aplica, del mensaje |
| `condiciones` | Ausente | Bloque de condiciones comerciales |
| `pie` | Ausente | Pie de página del PDF |
| `cierre` | Ausente | Frase final antes del pie |

Marcadores admitidos en cualquiera de estos textos: `{{cliente}}`, `{{folio}}`, `{{vigencia}}`,
`{{total}}`, `{{organizacion}}`. Cualquier otro marcador con forma `{{...}}` es error 400 con
`MARCADOR_NO_PERMITIDO`. Un texto sin marcadores es válido.

Sustitución al renderizar:

| Marcador | Valor |
|----------|-------|
| `{{cliente}}` | Nombre del cliente o `nombreClienteLibre` de la cotización |
| `{{folio}}` | Folio ya formateado de la cotización |
| `{{vigencia}}` | Fecha `vigenciaHasta` en el locale de la organización |
| `{{total}}` | Total en moneda base, formateado |
| `{{organizacion}}` | `identidad.nombreComercial` de la plantilla |

### Bloque `mensajeWhatsapp`

| Campo | Default | Efecto |
|-------|---------|--------|
| `incluirSaludo` | `true` | Incluye el saludo con marcadores resueltos |
| `incluirDetalleLineas` | `true` | Lista descripción, cantidad y total de línea |
| `incluirCondiciones` | `false` | Incluye el texto de condiciones |
| `maximoLineasDetalle` | `20` | Tope de líneas detalladas; el resto se resume como “y N ítems más” |

El mensaje y el PDF se producen desde la misma configuración para que no se contradigan. El mensaje
es texto plano: sin HTML, sin Markdown enriquecido.

## Reglas de negocio

### Alcance y aislamiento

1. Toda operación exige `ctx.organizacionId` no nulo. Un usuario de ámbito `PLATAFORMA` recibe error
   de contexto.
2. `organizacionId` se toma del contexto, nunca del cuerpo.
3. Una plantilla o un documento de otra organización responde 404 con el código de no encontrado
   correspondiente, sin revelar su existencia.
4. La verificación de permiso ocurre antes de cualquier acceso a datos.

### Configuracion declarativa

5. La configuración se valida completa con el esquema Zod del ADR 0006 antes de persistir. La
   entrada llega como `unknown`.
6. No se acepta ningún campo fuera del esquema. Un campo desconocido es error 400.
7. No se acepta HTML, CSS libre, scripts ni plantillas de terceros en ningún bloque. Los textos son
   cadenas planas con marcadores acotados.
8. Guardar una configuración válida incrementa `version` en uno dentro de la misma transacción.
9. Guardar una configuración idéntica a la vigente (comparación canónica del JSON) no incrementa
   `version` y responde 200 sin crear una versión nueva.
10. Cambiar la plantilla no regenera ni altera documentos ya generados ni cotizaciones aprobadas.
11. En el MVP existe exactamente una plantilla con `esPredeterminada` verdadero y `ACTIVO`. No se
    permite inactivarla ni crear una segunda predeterminada.

### Columnas y atributo

12. El enumerado de `campo` es cerrado. Ampliarlo es un cambio de producto, no de configuración.
13. La columna `ATRIBUTO` permite cubrir la variabilidad por rubro sin ramificar por vertical: un
    concesionario muestra VIN eligiendo el atributo; una ferretería muestra diámetro.
14. Al renderizar una cotización aprobada, los valores de columna se leen de las líneas congeladas,
    nunca del catálogo vivo.

### Vista previa

15. La vista previa usa el mismo renderizador HTML y la misma resolución de marcadores que la
    generación final.
16. La vista previa no invoca persistencia de `documentos_generados`, no calcula hash de archivo
    final y no registra evento `DOCUMENTO_GENERADO`.
17. La vista previa puede recibir la configuración del cuerpo (aún no guardada) o usar la guardada.
    Si el cuerpo trae configuración, se valida igual que un guardado.
18. Los datos de ejemplo de la vista previa son ficticios de la organización (cliente de ejemplo,
    líneas de ejemplo) y no exponen cotizaciones reales de otra organización.

### Generacion de PDF

19. Solo se genera PDF de una cotización en estado `APROBADA`, `ENVIADA`, `GANADA`, `PERDIDA` o
    `VENCIDA`. Un borrador o una anulada responde 422.
20. La generación usa la plantilla predeterminada activa y registra `plantillaId` y
    `plantillaVersion` en `documentos_generados`.
21. Tras generar, se calcula `hashContenido` del archivo, se guarda `tamanoBytes` y se inserta el
    evento de bitácora `DOCUMENTO_GENERADO` en la misma transacción que el registro del documento.
22. Si ya existe un documento PDF exitoso para esa cotización, `POST` de generación responde 409 con
    `DOCUMENTO_YA_GENERADO`. La reentrega usa `GET`.
23. El tiempo máximo de generación es `PDF_TIMEOUT_MS`. Al superar el tiempo, el adaptador cancela el
    proceso del navegador, no deja archivo parcial consultable y responde 502 con
    `PDF_TIMEOUT`.
24. Cualquier fallo del adaptador responde 502 con `PDF_GENERACION_FALLIDA`, sin crear fila en
    `documentos_generados` y sin evento de éxito. El operador puede reintentar.
25. El servicio de dominio no importa el SDK del navegador: solo consume `GeneradorPdf`.

### Reentrega

26. `GET` del documento devuelve el archivo almacenado cuya ruta está en `documentos_generados`.
27. La reentrega no vuelve a renderizar, no vuelve a llamar a `GeneradorPdf` y no recalcula totales.
28. Si el archivo falta en el almacenamiento pero el registro existe, responde 502 con
    `DOCUMENTO_ARCHIVO_AUSENTE` y no regenera en silencio: regenerar alteraría el hash histórico.

### Texto para WhatsApp

29. El texto se genera a demanda desde la configuración vigente de la plantilla y los datos
    congelados de la cotización aprobada.
30. El texto no se versiona como archivo binario en el MVP; si la plantilla cambia después, un
    nuevo `GET` del mensaje refleja la plantilla actual, pero el PDF ya emitido no cambia. Esta
    asimetría queda documentada y es aceptable porque el canal principal de evidencia es el PDF.

### Importes y moneda

31. Todos los importes del documento provienen de la cotización aprobada. Ninguno se recalcula al
    renderizar.
32. Los importes viajan en la API como cadenas con 4 decimales.
33. Si la cotización tiene moneda de presentación, el PDF muestra el total convertido solo cuando
    `mostrarMonedaPresentacion` es verdadero, junto con tasa y fecha si `mostrarTasaAplicada` es
    verdadero.

## Permisos

| Operacion | Permiso |
|-----------|---------|
| Listar y ver plantillas | `plantillas.ver` |
| Editar la plantilla | `plantillas.administrar` |
| Previsualizar la plantilla | `plantillas.administrar` |
| Generar el PDF de una cotización | `cotizaciones.generar_documento` |
| Obtener el texto para WhatsApp | `cotizaciones.generar_documento` |
| Descargar un documento ya generado | `cotizaciones.ver` |

Consecuencias del catálogo de perfiles:

1. El perfil `Administrador Organizacion` tiene `plantillas.*` y puede configurar la plantilla.
2. El perfil `Cotizador` no administra plantillas. Puede generar PDF y texto, y descargar documentos
   de cotizaciones que puede ver.
3. Un usuario de ámbito `PLATAFORMA` no opera plantillas ni documentos de ninguna organización.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/plantillas-documento` | `plantillas.ver` | Listado de plantillas de la organización |
| GET | `/api/plantillas-documento/:id` | `plantillas.ver` | Detalle con configuración y versión |
| PATCH | `/api/plantillas-documento/:id` | `plantillas.administrar` | Actualizar nombre o configuración |
| POST | `/api/plantillas-documento/:id/previsualizar` | `plantillas.administrar` | Vista previa con el mismo renderizador |
| POST | `/api/cotizaciones/:id/documento` | `cotizaciones.generar_documento` | Genera el PDF y registra hash y versión |
| GET | `/api/cotizaciones/:id/documento` | `cotizaciones.ver` | Reentrega el archivo ya generado |
| GET | `/api/cotizaciones/:id/mensaje` | `cotizaciones.generar_documento` | Texto listo para WhatsApp |

### Actualizacion de la plantilla

```typescript
// PATCH /api/plantillas-documento/:id
type ActualizarPlantillaInput = {
  nombre?: string;
  configuracion?: PlantillaDocumentoConfig; // esquema del ADR 0006
};

type PlantillaDocumentoDetalle = {
  id: string;
  nombre: string;
  esPredeterminada: boolean;
  version: number;
  configuracion: PlantillaDocumentoConfig;
  estadoRegistro: 'ACTIVO' | 'INACTIVO';
  updatedAt: string;
};
```

### Vista previa

```typescript
// POST /api/plantillas-documento/:id/previsualizar
type PrevisualizarPlantillaInput = {
  configuracion?: PlantillaDocumentoConfig; // si se omite, usa la guardada
  formato: 'HTML' | 'PDF' | 'TEXTO';
};

type PrevisualizarPlantillaResultado = {
  formato: 'HTML' | 'PDF' | 'TEXTO';
  contenidoBase64?: string; // PDF
  html?: string;            // HTML intermedio del mismo renderizador
  texto?: string;           // mensaje WhatsApp de ejemplo
  advertencias: string[];   // por ejemplo LOGO_AUSENTE
};
```

### Generacion y reentrega

```typescript
// POST /api/cotizaciones/:id/documento
type DocumentoGeneradoDetalle = {
  id: string;
  cotizacionId: string;
  plantillaId: string;
  plantillaVersion: number;
  formato: 'PDF';
  hashContenido: string;
  tamanoBytes: number;
  createdAt: string;
};
```

`GET /api/cotizaciones/:id/documento` responde con el binario del PDF y cabeceras de tipo de
contenido y nombre de archivo basado en el folio. No recalcula ni re-renderiza.

Los importes en cualquier payload auxiliar viajan como cadenas con 4 decimales.

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `PLANTILLA_NO_ENCONTRADA` | La plantilla no existe o pertenece a otra organización. Responde 404 |
| `PLANTILLA_CONFIGURACION_INVALIDA` | El JSON no cumple el esquema Zod. Responde 400 |
| `MARCADOR_NO_PERMITIDO` | Un texto contiene un marcador distinto de los cinco admitidos. Responde 400 |
| `COLUMNA_ATRIBUTO_SIN_CODIGO` | Una columna `ATRIBUTO` no informa `atributoCodigo`. Responde 400 |
| `COLUMNAS_INSUFICIENTES` | Hay menos de dos columnas o falta `DESCRIPCION` visible. Responde 400 |
| `COLUMNAS_ORDEN_DUPLICADO` | Dos columnas visibles comparten el mismo `orden`. Responde 400 |
| `COLOR_INVALIDO` | Un color no cumple el patrón hexadecimal de 6 dígitos. Responde 400 |
| `PLANTILLA_PREDETERMINADA_NO_INACTIVABLE` | Se intenta inactivar la predeterminada. Responde 422 |
| `COTIZACION_NO_ENCONTRADA` | La cotización no existe o es de otra organización. Responde 404 |
| `COTIZACION_NO_APROBADA` | Se pide PDF o mensaje sobre un borrador o una anulada. Responde 422 |
| `DOCUMENTO_YA_GENERADO` | Ya existe un PDF exitoso para esa cotización. Responde 409 |
| `DOCUMENTO_NO_ENCONTRADO` | Se pide descarga y aún no hay documento generado. Responde 404 |
| `DOCUMENTO_ARCHIVO_AUSENTE` | El registro existe pero el archivo no está en el almacenamiento. Responde 502 |
| `PDF_TIMEOUT` | La generación supera `PDF_TIMEOUT_MS`. Responde 502 |
| `PDF_GENERACION_FALLIDA` | El adaptador falla por causa distinta al timeout. Responde 502 |

La advertencia `LOGO_AUSENTE` no es error: viaja en `advertencias` de una vista previa o generación
exitosa cuando no hay logo usable.

## Experiencia de usuario

### Pantalla de plantilla

1. Un único formulario por bloques: identidad, estilo, folio, columnas, totales, textos y WhatsApp.
2. Cada bloque muestra el efecto del campo en una frase corta junto al control, no en un manual
   aparte.
3. El selector de columnas permite agregar una columna `ATRIBUTO` eligiendo el código desde las
   definiciones activas de la organización.
4. Los marcadores se insertan con botones junto a cada campo de texto; escribir un marcador
   desconocido muestra el error al guardar.
5. No hay editor de código HTML ni vista de “código fuente” de la plantilla.

### Vista previa

1. Un botón “Vista previa” abre el resultado del mismo renderizador (HTML embebido o PDF).
2. La vista previa refleja cambios aún no guardados cuando el administrador lo solicita.
3. Lo que se ve en la vista previa es lo que se entrega: mismo motor, mismos marcadores, mismos
   totales de ejemplo.

### Generacion desde la cotizacion

1. Tras aprobar, el cotizador puede generar el PDF y copiar el texto de WhatsApp.
2. Si la generación falla o hace timeout, el mensaje explica que puede reintentar y que la
   cotización sigue aprobada e intacta.
3. Si el PDF ya existe, la acción principal es “Descargar” (reentrega), no “Generar de nuevo”.

## Criterios de aceptacion

### Configuracion y validacion

#### CA-001: Lectura de la plantilla predeterminada

Dado un usuario con permiso `plantillas.ver` y una organización provisionada, cuando consulta
`GET /api/plantillas-documento`, entonces recibe al menos la plantilla con `esPredeterminada`
verdadero, `version` mayor o igual a 1 y una `configuracion` que cumple el esquema del ADR 0006.

#### CA-002: Guardado incrementa la version

Dado un usuario con permiso `plantillas.administrar` y una plantilla en `version` 3, cuando guarda
un cambio válido en `estilo.colorPrimario`, entonces la respuesta es 200, `version` queda en 4 y la
configuración persistida refleja el color nuevo.

#### CA-003: Guardado identico no incrementa version

Dada una plantilla cuya configuración canónica es C, cuando el usuario envía exactamente C de
nuevo, entonces la respuesta es 200, `version` no cambia y no se altera `updatedAt` por un falso
cambio de contenido.

#### CA-004: Marcador no permitido rechazado

Dado un texto de saludo que contiene `{{descuento}}`, cuando el usuario guarda la plantilla,
entonces la respuesta es 400 con código `MARCADOR_NO_PERMITIDO`, el detalle nombra `descuento` y la
configuración anterior permanece intacta.

#### CA-005: Columna ATRIBUTO sin codigo

Dada una columna con `campo` `ATRIBUTO` y sin `atributoCodigo`, cuando el usuario guarda, entonces
la respuesta es 400 con código `COLUMNA_ATRIBUTO_SIN_CODIGO` y no se persiste el cambio.

#### CA-006: HTML libre rechazado

Dado un intento de enviar en `textos.pie` una cadena que incluye etiquetas HTML como
`<script>alert(1)</script>`, cuando el esquema valida la configuración, entonces o bien las
etiquetas se tratan como texto plano sin ejecutarse nunca en el renderizador, o la validación las
rechaza; en ningún caso el renderizador interpreta HTML provisto por la organización como marcado
ejecutable. La especificación fija: los textos se escapan al interpolar en la plantilla HTML del
servidor.

#### CA-007: Columna ATRIBUTO renderiza valor congelado

Dada una plantilla con columna `ATRIBUTO` y `atributoCodigo` `diametro`, y una cotización aprobada
cuya línea congeló `diametro` en `1/2"`, cuando se genera el PDF, entonces esa celda muestra
`1/2"` aunque el item del catálogo haya cambiado después el atributo a `3/4"`.

### Vista previa

#### CA-008: Vista previa usa el mismo renderizador

Dada una configuración con `colorPrimario` `#003366` y saludo `Hola {{cliente}}`, cuando se
solicita previsualización en formato HTML y después se genera el PDF de una cotización aprobada con
la misma configuración guardada, entonces el HTML intermedio de ambos flujos proviene del mismo
motor y el saludo resuelve el marcador `{{cliente}}` en ambos.

#### CA-009: Vista previa no persiste documento

Dado un usuario que ejecuta `POST /api/plantillas-documento/:id/previsualizar`, cuando la operación
termina con éxito, entonces no existe fila nueva en `documentos_generados` y no se inserta evento
`DOCUMENTO_GENERADO`.

### Generacion, hash, version y reentrega

#### CA-010: Generacion registra hash y version

Dada una cotización `APROBADA` sin documento previo y una plantilla en `version` 5, cuando un
usuario con `cotizaciones.generar_documento` ejecuta `POST /api/cotizaciones/:id/documento`,
entonces se crea `documentos_generados` con `plantillaVersion` 5, `hashContenido` no vacío,
`tamanoBytes` mayor que cero, formato `PDF`, y se inserta el evento `DOCUMENTO_GENERADO`.

#### CA-011: Reentrega sin re-render

Dado un documento ya generado con hash H, cuando un usuario descarga con
`GET /api/cotizaciones/:id/documento` dos veces, entonces ambas respuestas devuelven el mismo
binario con hash H, no se invoca `GeneradorPdf` y no se crea un segundo registro.

#### CA-012: Documento ya generado no se regenera

Dada una cotización con documento PDF exitoso, cuando se vuelve a llamar
`POST /api/cotizaciones/:id/documento`, entonces la respuesta es 409 con código
`DOCUMENTO_YA_GENERADO` y el archivo original permanece con el mismo hash.

#### CA-013: Cambio de plantilla no altera PDF emitido

Dada una cotización con PDF generado bajo `plantillaVersion` 2, cuando un administrador cambia el
color primario y la plantilla pasa a `version` 3, entonces el `GET` del documento sigue devolviendo
el archivo original con `plantillaVersion` 2 y el mismo `hashContenido`.

### Fallo, timeout y logo

#### CA-014: Timeout del generador

Dado un adaptador `GeneradorPdf` configurado con `PDF_TIMEOUT_MS` y una generación que excede ese
tiempo, cuando se solicita el PDF, entonces la respuesta es 502 con código `PDF_TIMEOUT`, no queda
fila en `documentos_generados`, el proceso del navegador se cierra y un reintento posterior puede
crear el documento.

#### CA-015: Fallo del generador

Dado un adaptador que falla de inmediato, cuando se solicita el PDF, entonces la respuesta es 502
con código `PDF_GENERACION_FALLIDA`, la cotización permanece `APROBADA` sin cambios de importes y no
hay documento persistido.

#### CA-016: Documento sin logo

Dada una organización sin `logoUrl` y una plantilla válida, cuando se genera el PDF de una
cotización aprobada, entonces la generación es exitosa, el encabezado omite la imagen y la
respuesta o el evento pueden incluir la advertencia `LOGO_AUSENTE`.

#### CA-017: Limites de logo heredados

Dado el módulo de configuración de la organización, cuando se intenta cargar un logo de 5 MB o un
JPG de 100 por 100 píxeles, entonces el rechazo ocurre en
`docs/specs/002-configuracion-organizacion.md` con `LOGO_DEMASIADO_GRANDE` o
`LOGO_DIMENSIONES_INSUFICIENTES`, y la plantilla nunca recibe una URL de un archivo rechazado.

### WhatsApp, permisos e importes

#### CA-018: Mensaje WhatsApp coherente con la plantilla

Dada una plantilla con `incluirSaludo` verdadero, `incluirDetalleLineas` verdadero y
`maximoLineasDetalle` 2, y una cotización aprobada con 5 líneas, cuando se obtiene
`GET /api/cotizaciones/:id/mensaje`, entonces el texto incluye el saludo resuelto, detalla 2 líneas
y resume las 3 restantes, sin HTML.

#### CA-019: Cotizador no administra plantilla

Dado un usuario con perfil `Cotizador`, cuando intenta `PATCH /api/plantillas-documento/:id`,
entonces la respuesta es 403, y cuando genera el PDF de una cotización aprobada de su organización,
entonces la respuesta es 201 o 200 según el contrato de creación.

#### CA-020: Borrador no genera PDF

Dada una cotización en estado `BORRADOR`, cuando se solicita `POST /api/cotizaciones/:id/documento`,
entonces la respuesta es 422 con código `COTIZACION_NO_APROBADA` y no se crea documento.

#### CA-021: Importes del PDF son los congelados

Dada una cotización aprobada con total `"1500.5000"` y tasa congelada, cuando se genera el PDF y
después cambia la tasa vigente de la organización, entonces el PDF muestra el total
`"1500.5000"` y, si aplica presentación, la tasa congelada, nunca la tasa nueva.

### Aislamiento

#### CA-022: Aislamiento entre organizaciones

Dado un usuario autenticado de la organización A y una plantilla, un documento generado y una
cotización de la organización B, cuando intenta leerlos, editarlos, previsualizarlos, generar PDF o
descargar el documento por identificador, entonces todas las respuestas son 404 con el código de no
encontrado correspondiente, ningún registro de B se modifica y ninguna respuesta revela su
existencia.

## Verificacion requerida para cierre

- [ ] Un usuario de la organización A no puede leer ni modificar plantillas ni documentos de la
      organización B, y recibe 404 en listados, detalle, preview, generación y descarga.
- [ ] El esquema Zod rechaza marcadores desconocidos, colores inválidos, menos de dos columnas,
      columna `ATRIBUTO` sin código y campos fuera del esquema.
- [ ] Los textos de la organización se escapan al interpolar en el HTML del servidor; no se ejecuta
      HTML libre.
- [ ] Guardar un cambio incrementa `version`; guardar la misma configuración canónica no la
      incrementa.
- [ ] La vista previa y la generación final comparten el mismo renderizador, verificado con una
      aserción de igualdad del HTML intermedio sobre los mismos datos de ejemplo.
- [ ] La vista previa no crea filas en `documentos_generados` ni eventos `DOCUMENTO_GENERADO`.
- [ ] La generación exitosa persiste hash SHA-256, `plantillaVersion`, `tamanoBytes` y el evento de
      bitácora en la misma transacción.
- [ ] La reentrega devuelve el mismo binario sin invocar `GeneradorPdf` (verificado con un doble
      del adaptador que falla si se llama).
- [ ] Un segundo `POST` de generación sobre documento existente responde 409.
- [ ] Timeout y fallo del adaptador responden 502, cierran el proceso del navegador y permiten
      reintento sin dejar archivo parcial consultable.
- [ ] Una cotización aprobada conserva importes y tasa congelados en el PDF aunque cambien catálogo,
      plantilla o tasa vigente.
- [ ] El perfil `Cotizador` recibe 403 al editar plantillas y puede generar y descargar documentos.
- [ ] Un usuario de ámbito `PLATAFORMA` recibe error de contexto en todas las operaciones de este
      módulo.
- [ ] Los importes en API viajan como cadenas con 4 decimales.

## Preguntas abiertas

| Tema | Pregunta | Impacto si se decide mal | Nota 2026-09-19 |
|------|----------|--------------------------|-----------------|
| Asimetria mensaje vs PDF | Si el texto de WhatsApp debe congelarse también al generar el PDF | Un mensaje recopiado después de editar la plantilla puede diferir del PDF emitido | MVP: el mensaje refleja la plantilla vigente; el PDF no cambia. Sin congelar texto. |
| Multiples plantillas | Si el MVP debe bloquear la creación de plantillas adicionales aunque el modelo las admita | Confusión sobre cuál se usa al generar | MVP: no hay endpoint de creación; solo editar la predeterminada. |
| Regeneracion de emergencia | Si un administrador de plataforma puede forzar regeneración cuando el archivo falta en almacenamiento | Pérdida de evidencia vs. imposibilidad de reentregar | MVP: `DOCUMENTO_ARCHIVO_AUSENTE` sin regeneración silenciosa. |
| Precarga de identidad | Si al editar la plantilla los campos vacíos se rellenan siempre desde `organizaciones` o solo al provisionar | Divergencia entre ficha de organización y encabezado del documento | Solo al provisionar; el logo vivo se lee de `organizaciones.logoUrl` al renderizar si la plantilla no fija `logoUrl`. |
| Nombre del archivo | Referencia en spec 002 a `010-plantilla-documento.md` (singular) vs este archivo `010-plantillas-documento.md` | Enlaces rotos entre documentos | Corregir enlaces en spec 002 cuando se toque ese doc. |
| GeneradorPdf en local | ¿Mock determinista vs Chromium/puppeteer en desarrollo? | Preview HTML completa; PDF mock no refleja tipografía real | MVP: `GeneradorPdfMock` por defecto (bytes PDF mínimos válidos). Interfaz lista para adaptador Chromium. |

## Decisiones MVP v1

1. La plantilla es configuración declarativa validada con Zod; no hay HTML libre por organización.
2. Un único renderizador del servidor produce HTML, PDF (vía `GeneradorPdf`) y texto de WhatsApp.
3. Los marcadores admitidos son exactamente `{{cliente}}`, `{{folio}}`, `{{vigencia}}`,
   `{{total}}` y `{{organizacion}}`.
4. La columna `ATRIBUTO` exige `atributoCodigo` y lee valores congelados de la línea.
5. La vista previa usa el mismo renderizador y no persiste documento ni evento.
6. El PDF generado guarda `hashContenido` y `plantillaVersion`; la reentrega no re-renderiza.
7. Un documento exitoso no se regenera; un segundo intento responde 409.
8. Timeout y fallo del generador responden 502, no dejan registro exitoso y permiten reintento.
9. Cambiar la plantilla no altera cotizaciones aprobadas ni PDFs ya emitidos.
10. El logo se carga en la configuración de la organización (máx. 2 MB; mín. 200×200 en mapa de
    bits); sin logo el documento se genera igual.
11. Exactamente una plantilla predeterminada activa por organización en el MVP.
12. Ningún importe del documento proviene de un modelo de lenguaje; solo de la cotización aprobada.
13. Los importes viajan como cadenas con 4 decimales.
14. Ninguna regla ramifica por vertical: el rubro se cubre con columnas `ATRIBUTO` y datos semilla.

## Cierre de implementación

**Fecha:** 2026-09-19

### Entregables

| Área | Archivos / rutas |
|------|------------------|
| Shared | `schemas/plantilla-documento.schemas.ts`, `errors/plantilla.errors.ts`, `documentos/*` (renderizador, GeneradorPdf, almacenamiento) |
| Database | Entidad `DocumentoGenerado`, migración `1783000000000-DocumentosGenerados`, columnas `atributosCongelados` / `marcaCongelada` en líneas |
| API | Módulo `plantillas`; endpoints plantillas + `POST/GET …/cotizaciones/:id/documento`; mensaje vía renderizador |
| Web | `/configuracion/plantilla`; botones Generar/Descargar PDF en detalle de cotización |

### Verificación de criterios de aceptación

| CA | Resultado |
|----|-----------|
| CA-001 Lectura predeterminada | Implementado (`GET /api/plantillas-documento`) |
| CA-002/003 Versionado | Incrementa solo si `canonicalJson` cambia |
| CA-004/005 Marcador y ATRIBUTO | Zod + errores específicos |
| CA-006 Escape HTML | `escapeHtml` en renderizador; prueba unitaria |
| CA-007 Atributo congelado | Congelado al aprobar; PDF lee `atributosCongelados` |
| CA-008/009 Vista previa | Mismo `renderizarDocumento`; no persiste |
| CA-010–013 Generación/reentrega | Hash SHA-256, evento, 409, sin re-render en GET |
| CA-014/015 Timeout/fallo | Mapeo a `PDF_TIMEOUT` / `PDF_GENERACION_FALLIDA` |
| CA-016/017 Logo | Advertencia `LOGO_AUSENTE`; límites en spec 002 |
| CA-018 WhatsApp | Mismo motor; `maximoLineasDetalle` |
| CA-019–022 Permisos/estados/aislamiento | `requirePermission` + 404 por org |

### Cómo generar PDF en local

1. Migrar: `pnpm --filter @cotizador/database db:migration:run`
2. Arrancar API con `ALMACENAMIENTO` (o default `storage/`) y opcional `PDF_TIMEOUT_MS=30000`
3. Aprobar una cotización → `POST /api/cotizaciones/:id/documento` → archivo en `storage/documentos/{orgId}/{cotizacionId}.pdf`
4. Reentrega: `GET /api/cotizaciones/:id/documento`
5. El adaptador por defecto es `GeneradorPdfMock` (PDF mínimo válido). La maquetación real se verifica con vista previa HTML.

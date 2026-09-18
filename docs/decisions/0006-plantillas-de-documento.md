# ADR 0006: Plantillas de documento declarativas

## Estado

Aceptada — 2026-09-17

## Contexto

Cada organizacion necesita que la cotizacion salga con su identidad: su logo, sus colores, sus datos
fiscales, sus condiciones comerciales y las columnas que le importan. Un concesionario querra mostrar
VIN y año; una ferreteria querra mostrar unidad y presentacion; una casa de repuestos querra mostrar
numero de parte y compatibilidad.

El requisito es que el formato sea **configurable por organizacion**, sin que eso implique desplegar
codigo por cliente ni convertir el soporte en un servicio de maquetacion.

## Decision

La plantilla de documento es una **configuracion declarativa validada con Zod**, almacenada como JSON
por organizacion, interpretada por un unico renderizador del lado del servidor que produce HTML y de
ahi PDF.

### Estructura de la configuracion

```typescript
export const plantillaDocumentoConfigSchema = z.object({
  identidad: z.object({
    nombreComercial: z.string().max(120),
    razonSocial: z.string().max(160).optional(),
    identificacionFiscal: z.string().max(40).optional(),
    direccion: z.string().max(240).optional(),
    telefonos: z.array(z.string().max(40)).max(3).default([]),
    email: z.string().email().optional(),
    sitioWeb: z.string().max(120).optional(),
    logoUrl: z.string().max(500).optional(),
  }),
  estilo: z.object({
    colorPrimario: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#146b45'),
    colorTextoSobrePrimario: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
    tipografia: z.enum(['SANS', 'SERIF']).default('SANS'),
    densidad: z.enum(['COMPACTA', 'NORMAL']).default('NORMAL'),
    tamanoPagina: z.enum(['A4', 'CARTA']).default('CARTA'),
  }),
  folio: z.object({
    prefijo: z.string().max(10).default('COT-'),
    longitudNumero: z.number().int().min(1).max(10).default(4),
  }),
  columnas: z.array(z.object({
    campo: z.enum([
      'ORDEN', 'SKU', 'DESCRIPCION', 'MARCA', 'ATRIBUTO', 'UNIDAD',
      'CANTIDAD', 'PRECIO_UNITARIO', 'DESCUENTO', 'TOTAL_LINEA',
    ]),
    etiqueta: z.string().max(30),
    atributoCodigo: z.string().max(40).optional(), // requerido si campo = ATRIBUTO
    visible: z.boolean().default(true),
    orden: z.number().int(),
  })).min(2),
  totales: z.object({
    mostrarSubtotal: z.boolean().default(true),
    mostrarDescuento: z.boolean().default(true),
    mostrarImpuesto: z.boolean().default(false),
    mostrarMonedaPresentacion: z.boolean().default(true),
    mostrarTasaAplicada: z.boolean().default(true),
  }),
  textos: z.object({
    saludo: z.string().max(300).optional(),
    condiciones: z.string().max(1200).optional(),
    pie: z.string().max(400).optional(),
    cierre: z.string().max(200).optional(),
  }),
  mensajeWhatsapp: z.object({
    incluirSaludo: z.boolean().default(true),
    incluirDetalleLineas: z.boolean().default(true),
    incluirCondiciones: z.boolean().default(false),
    maximoLineasDetalle: z.number().int().min(1).max(50).default(20),
  }),
});
```

Los textos admiten marcadores acotados y validados: `{{cliente}}`, `{{folio}}`, `{{vigencia}}`,
`{{total}}`, `{{organizacion}}`. Cualquier otro marcador es un error de validacion.

### Renderizado

- Una unica plantilla HTML del lado del servidor consume la configuracion. No hay HTML por
  organizacion.
- La conversion a PDF se hace con un navegador sin interfaz grafica, en un servicio dedicado
  encapsulado detras de una interfaz `GeneradorPdf`, de modo que se pueda sustituir la herramienta sin
  tocar el dominio.
- El mismo motor produce el texto plano para WhatsApp a partir de la misma configuracion, para que el
  mensaje y el PDF nunca se contradigan.
- El archivo generado se guarda con su hash y la version de la plantilla usada, para poder reentregar
  exactamente el mismo documento sin volver a renderizar.

## Alternativas descartadas

### HTML o Handlebars libre por organizacion

**Pros:** flexibilidad total, cualquier diseño es posible.
**Contras:** ejecutar plantillas provistas por el usuario es una superficie de ataque (inyeccion,
exfiltracion de datos, consumo de recursos); cada organizacion con su plantilla rota se convierte en un
ticket de soporte de maquetacion; imposible garantizar que un cambio del modelo de datos no rompa
plantillas ajenas.
**Descartada.**

### Generacion directa de PDF con una libreria de composicion en codigo

**Pros:** no requiere navegador sin interfaz, menor consumo de memoria, despliegue mas liviano.
**Contras:** el control de maquetacion es mas rigido, el trabajo de diseño es mayor y la vista previa
en la interfaz no puede reutilizar el mismo renderizado.
**Descartada** pero anotada como plan alternativo si el navegador sin interfaz resulta problematico en
el entorno de despliegue. La interfaz `GeneradorPdf` existe justamente para permitir el cambio.

### Un editor visual de plantillas dentro del producto

**Pros:** maxima autonomia del cliente.
**Contras:** es un producto en si mismo y no aporta al problema central de cotizar rapido.
**Descartada.** La configuracion declarativa con vista previa cubre la necesidad real.

## Consecuencias

- Un cliente nuevo se configura en minutos completando un formulario, sin desplegar nada.
- El conjunto de columnas y campos disponibles es cerrado, lo que limita casos exoticos. Es aceptable y
  ampliar el conjunto es agregar un valor al enumerado mas su renderizado.
- La columna de tipo atributo permite cubrir la variabilidad por rubro sin ampliar el enumerado: un
  concesionario muestra VIN eligiendo el atributo correspondiente.
- Se necesita un navegador sin interfaz en la imagen de la aplicacion, lo que aumenta su tamaño. Se
  documenta en la infraestructura.
- La vista previa usa el mismo renderizador que la generacion final, por lo que lo que se ve es lo que
  se entrega.

## Referencias

- `docs/specs/010-plantillas-documento.md`
- `docs/09-guia-ux-ui.md`

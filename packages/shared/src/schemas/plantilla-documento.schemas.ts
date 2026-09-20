import { z } from 'zod';

/** Marcadores acotados admitidos en textos (ADR 0006 / spec 010). */
export const MARCADORES_PLANTILLA = [
  'cliente',
  'folio',
  'vigencia',
  'total',
  'organizacion',
] as const;

export type MarcadorPlantilla = (typeof MARCADORES_PLANTILLA)[number];

export const CAMPOS_COLUMNA_PLANTILLA = [
  'ORDEN',
  'SKU',
  'DESCRIPCION',
  'MARCA',
  'ATRIBUTO',
  'UNIDAD',
  'CANTIDAD',
  'PRECIO_UNITARIO',
  'DESCUENTO',
  'TOTAL_LINEA',
] as const;

export type CampoColumnaPlantilla = (typeof CAMPOS_COLUMNA_PLANTILLA)[number];

const colorHexSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'COLOR_INVALIDO');

const columnaPlantillaSchema = z
  .object({
    campo: z.enum(CAMPOS_COLUMNA_PLANTILLA),
    etiqueta: z.string().trim().min(1).max(30),
    atributoCodigo: z.string().trim().max(40).optional(),
    visible: z.boolean().default(true),
    orden: z.number().int(),
  })
  .superRefine((col, ctx) => {
    if (col.campo === 'ATRIBUTO' && !col.atributoCodigo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COLUMNA_ATRIBUTO_SIN_CODIGO',
        path: ['atributoCodigo'],
      });
    }
  });

const RE_MARCADOR = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extraerMarcadores(texto: string): string[] {
  const encontrados: string[] = [];
  RE_MARCADOR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_MARCADOR.exec(texto)) !== null) {
    encontrados.push(m[1]);
  }
  return encontrados;
}

export function validarMarcadoresTexto(
  texto: string | undefined,
  path: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  if (!texto) return;
  const permitidos = new Set<string>(MARCADORES_PLANTILLA);
  for (const nombre of extraerMarcadores(texto)) {
    if (!permitidos.has(nombre)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MARCADOR_NO_PERMITIDO',
        path,
        params: { marcador: nombre },
      });
    }
  }
}

/**
 * Configuración declarativa de plantilla de documento (ADR 0006).
 * `strict` rechaza campos desconocidos.
 */
export const plantillaDocumentoConfigSchema = z
  .object({
    identidad: z
      .object({
        nombreComercial: z.string().trim().min(1).max(120),
        razonSocial: z.string().trim().max(160).optional(),
        identificacionFiscal: z.string().trim().max(40).optional(),
        direccion: z.string().trim().max(240).optional(),
        telefonos: z.array(z.string().trim().max(40)).max(3).default([]),
        email: z
          .union([z.string().trim().email().max(254), z.literal('')])
          .optional()
          .transform((v) => (v === '' || v === undefined ? undefined : v)),
        sitioWeb: z.string().trim().max(120).optional(),
        logoUrl: z.string().trim().max(500).optional(),
      })
      .strict(),
    estilo: z
      .object({
        colorPrimario: colorHexSchema.default('#146b45'),
        colorTextoSobrePrimario: colorHexSchema.default('#ffffff'),
        tipografia: z.enum(['SANS', 'SERIF']).default('SANS'),
        densidad: z.enum(['COMPACTA', 'NORMAL']).default('NORMAL'),
        tamanoPagina: z.enum(['A4', 'CARTA']).default('CARTA'),
      })
      .strict(),
    folio: z
      .object({
        prefijo: z.string().max(10).default('COT-'),
        longitudNumero: z.number().int().min(1).max(10).default(4),
      })
      .strict(),
    columnas: z.array(columnaPlantillaSchema).min(2),
    totales: z
      .object({
        mostrarSubtotal: z.boolean().default(true),
        mostrarDescuento: z.boolean().default(true),
        mostrarImpuesto: z.boolean().default(false),
        mostrarMonedaPresentacion: z.boolean().default(true),
        mostrarTasaAplicada: z.boolean().default(true),
      })
      .strict(),
    textos: z
      .object({
        saludo: z.string().max(300).optional(),
        condiciones: z.string().max(1200).optional(),
        pie: z.string().max(400).optional(),
        cierre: z.string().max(200).optional(),
      })
      .strict(),
    mensajeWhatsapp: z
      .object({
        incluirSaludo: z.boolean().default(true),
        incluirDetalleLineas: z.boolean().default(true),
        incluirCondiciones: z.boolean().default(false),
        maximoLineasDetalle: z.number().int().min(1).max(50).default(20),
      })
      .strict(),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    validarMarcadoresTexto(cfg.textos.saludo, ['textos', 'saludo'], ctx);
    validarMarcadoresTexto(
      cfg.textos.condiciones,
      ['textos', 'condiciones'],
      ctx,
    );
    validarMarcadoresTexto(cfg.textos.pie, ['textos', 'pie'], ctx);
    validarMarcadoresTexto(cfg.textos.cierre, ['textos', 'cierre'], ctx);

    const visibles = cfg.columnas.filter((c) => c.visible);
    if (visibles.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COLUMNAS_INSUFICIENTES',
        path: ['columnas'],
      });
    }

    const tieneDescripcion = visibles.some((c) => c.campo === 'DESCRIPCION');
    if (!tieneDescripcion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COLUMNAS_INSUFICIENTES',
        path: ['columnas'],
        params: { motivo: 'Falta columna DESCRIPCION visible' },
      });
    }

    const tieneImporte = visibles.some(
      (c) => c.campo === 'TOTAL_LINEA' || c.campo === 'PRECIO_UNITARIO',
    );
    if (!tieneImporte) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COLUMNAS_INSUFICIENTES',
        path: ['columnas'],
        params: {
          motivo: 'Falta columna TOTAL_LINEA o PRECIO_UNITARIO visible',
        },
      });
    }

    const ordenes = new Set<number>();
    for (const col of visibles) {
      if (ordenes.has(col.orden)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'COLUMNAS_ORDEN_DUPLICADO',
          path: ['columnas'],
          params: { orden: col.orden },
        });
        break;
      }
      ordenes.add(col.orden);
    }
  });

export type PlantillaDocumentoConfig = z.infer<
  typeof plantillaDocumentoConfigSchema
>;

export const actualizarPlantillaDocumentoSchema = z
  .object({
    nombre: z.string().trim().min(2).max(80).optional(),
    configuracion: plantillaDocumentoConfigSchema.optional(),
  })
  .strict()
  .refine((v) => v.nombre !== undefined || v.configuracion !== undefined, {
    message: 'Debe enviar nombre o configuracion',
  });

export const previsualizarPlantillaSchema = z
  .object({
    configuracion: plantillaDocumentoConfigSchema.optional(),
    formato: z.enum(['HTML', 'PDF', 'TEXTO']),
  })
  .strict();

/**
 * Comparación canónica de configuración JSON (claves ordenadas).
 * Usada para no incrementar versión si el contenido es idéntico.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(ordenarClaves(value));
}

function ordenarClaves(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(ordenarClaves);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = ordenarClaves(obj[key]);
    }
    return out;
  }
  return value;
}

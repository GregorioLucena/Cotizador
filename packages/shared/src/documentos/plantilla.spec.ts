import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  plantillaDocumentoConfigSchema,
} from '../schemas/plantilla-documento.schemas';
import {
  escapeHtml,
  renderizarDocumento,
  datosEjemploPlantilla,
} from '../documentos/renderizador-plantilla';
import { GeneradorPdfMock } from '../documentos/generador-pdf';

const cfgBase = {
  identidad: { nombreComercial: 'Ferretería Demo', telefonos: [] as string[] },
  estilo: {
    colorPrimario: '#146b45',
    colorTextoSobrePrimario: '#ffffff',
    tipografia: 'SANS' as const,
    densidad: 'NORMAL' as const,
    tamanoPagina: 'CARTA' as const,
  },
  folio: { prefijo: 'COT-', longitudNumero: 4 },
  columnas: [
    { campo: 'DESCRIPCION' as const, etiqueta: 'Desc', visible: true, orden: 1 },
    {
      campo: 'TOTAL_LINEA' as const,
      etiqueta: 'Total',
      visible: true,
      orden: 2,
    },
  ],
  totales: {
    mostrarSubtotal: true,
    mostrarDescuento: true,
    mostrarImpuesto: false,
    mostrarMonedaPresentacion: true,
    mostrarTasaAplicada: true,
  },
  textos: { saludo: 'Hola {{cliente}}' },
  mensajeWhatsapp: {
    incluirSaludo: true,
    incluirDetalleLineas: true,
    incluirCondiciones: false,
    maximoLineasDetalle: 20,
  },
};

describe('plantillaDocumentoConfigSchema', () => {
  it('acepta configuración válida', () => {
    const r = plantillaDocumentoConfigSchema.parse(cfgBase);
    expect(r.identidad.nombreComercial).toBe('Ferretería Demo');
  });

  it('rechaza marcador no permitido', () => {
    const r = plantillaDocumentoConfigSchema.safeParse({
      ...cfgBase,
      textos: { saludo: 'Hola {{descuento}}' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === 'MARCADOR_NO_PERMITIDO')).toBe(
        true,
      );
    }
  });

  it('rechaza ATRIBUTO sin código', () => {
    const r = plantillaDocumentoConfigSchema.safeParse({
      ...cfgBase,
      columnas: [
        ...cfgBase.columnas,
        { campo: 'ATRIBUTO', etiqueta: 'Attr', visible: true, orden: 3 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('canonicalJson es estable ante orden de claves', () => {
    const a = canonicalJson({ b: 1, a: 2 });
    const b = canonicalJson({ a: 2, b: 1 });
    expect(a).toBe(b);
  });
});

describe('renderizarDocumento', () => {
  it('escapa HTML en textos de la organización', () => {
    const cfg = plantillaDocumentoConfigSchema.parse({
      ...cfgBase,
      textos: { pie: '<script>alert(1)</script>' },
    });
    const render = renderizarDocumento(cfg, datosEjemploPlantilla('Demo'));
    expect(render.html).toContain(escapeHtml('<script>alert(1)</script>'));
    expect(render.html).not.toContain('<script>alert(1)</script>');
  });

  it('resuelve {{cliente}} en saludo', () => {
    const cfg = plantillaDocumentoConfigSchema.parse(cfgBase);
    const datos = datosEjemploPlantilla('Demo');
    const render = renderizarDocumento(cfg, datos);
    expect(render.html).toContain('Hola Cliente de ejemplo');
    expect(render.textoWhatsapp).toContain('Hola Cliente de ejemplo');
  });
});

describe('GeneradorPdfMock', () => {
  it('produce bytes PDF válidos', async () => {
    const gen = new GeneradorPdfMock();
    const { bytes } = await gen.generar('<html><body>hola</body></html>');
    expect(bytes.length).toBeGreaterThan(50);
    expect(bytes.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  });
});

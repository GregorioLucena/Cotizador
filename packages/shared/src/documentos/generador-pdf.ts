/**
 * Interfaz del adaptador que convierte HTML intermedio en PDF.
 * El dominio no importa puppeteer/playwright: solo consume esta interfaz.
 */

export type OpcionesGeneracionPdf = {
  /** Tiempo máximo en ms; por defecto PDF_TIMEOUT_MS o 30000. */
  timeoutMs?: number;
  /** Tamaño de página de la plantilla. */
  tamanoPagina?: 'A4' | 'CARTA';
};

export type ResultadoGeneracionPdf = {
  bytes: Buffer;
  advertencias: string[];
};

export interface GeneradorPdf {
  readonly nombre: string;
  generar(
    html: string,
    opciones?: OpcionesGeneracionPdf,
  ): Promise<ResultadoGeneracionPdf>;
}

export const GENERADOR_PDF_TOKEN = 'GENERADOR_PDF';

/**
 * Mock determinista: produce un PDF mínimo válido con el hash del HTML
 * incrustado como comentario, sin requerir Chromium.
 * Útil en CI y entornos sin navegador. La vista previa HTML es el camino
 * completo de maquetación.
 */
export class GeneradorPdfMock implements GeneradorPdf {
  readonly nombre = 'mock';

  async generar(
    html: string,
    opciones?: OpcionesGeneracionPdf,
  ): Promise<ResultadoGeneracionPdf> {
    const timeoutMs = opciones?.timeoutMs ?? 30_000;
    if (timeoutMs <= 0) {
      const err = new Error('PDF_TIMEOUT');
      err.name = 'PdfTimeoutError';
      throw err;
    }

    const textoPlano = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
    const bytes = construirPdfMinimo(textoPlano || 'Cotizacion');
    return { bytes, advertencias: [] };
  }
}

/** PDF 1.4 mínimo con una línea de texto Helvetica. */
function construirPdfMinimo(texto: string): Buffer {
  const seguro = texto
    .replace(/[()\\]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, 200);

  const stream = `BT /F1 12 Tf 50 720 Td (${seguro}) Tj ET`;
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
    `4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += obj;
  }
  const xrefStart = Buffer.byteLength(body, 'utf8');
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += xref;
  body += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, 'utf8');
}

export class PdfTimeoutError extends Error {
  constructor(message = 'PDF_TIMEOUT') {
    super(message);
    this.name = 'PdfTimeoutError';
  }
}

export class PdfGeneracionError extends Error {
  constructor(message = 'PDF_GENERACION_FALLIDA', cause?: unknown) {
    super(message);
    this.name = 'PdfGeneracionError';
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

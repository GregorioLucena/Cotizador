import { existsSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
import {
  type GeneradorPdf,
  type OpcionesGeneracionPdf,
  type ResultadoGeneracionPdf,
  PdfGeneracionError,
  PdfTimeoutError,
} from '@cotizador/shared';

/**
 * Adaptador Chromium detrás de `GeneradorPdf`.
 * Usa el binario del sistema (puppeteer-core no descarga Chrome).
 * Ver docs/12-infraestructura-docker.md y ADR 0006 / 0012.
 */
export class GeneradorPdfChromium implements GeneradorPdf {
  readonly nombre = 'chromium';

  constructor(private readonly executablePath: string) {}

  async generar(
    html: string,
    opciones?: OpcionesGeneracionPdf,
  ): Promise<ResultadoGeneracionPdf> {
    const timeoutMs = opciones?.timeoutMs ?? 30_000;
    if (timeoutMs <= 0) {
      throw new PdfTimeoutError();
    }

    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        executablePath: this.executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--font-render-hinting=medium',
        ],
      });

      const page = await browser.newPage();
      page.setDefaultTimeout(timeoutMs);

      await Promise.race([
        page.setContent(html, { waitUntil: 'domcontentloaded' }),
        rechazoPorTimeout(timeoutMs),
      ]);

      const format = opciones?.tamanoPagina === 'A4' ? 'A4' : 'Letter';
      const bytes = await Promise.race([
        page.pdf({
          format,
          printBackground: true,
          preferCSSPageSize: false,
          margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
          timeout: timeoutMs,
        }),
        rechazoPorTimeout(timeoutMs),
      ]);

      return { bytes: Buffer.from(bytes), advertencias: [] };
    } catch (err) {
      if (
        err instanceof PdfTimeoutError ||
        (err as Error)?.name === 'PdfTimeoutError' ||
        (err as Error)?.message === 'PDF_TIMEOUT'
      ) {
        throw new PdfTimeoutError();
      }
      throw new PdfGeneracionError(
        'PDF_GENERACION_FALLIDA',
        err instanceof Error ? err : undefined,
      );
    } finally {
      if (browser) {
        await browser.close().catch(() => undefined);
      }
    }
  }
}

function rechazoPorTimeout(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new PdfTimeoutError()), timeoutMs);
  });
}

/**
 * Resuelve el ejecutable de Chromium/Chrome/Edge.
 * Prioridad: CHROMIUM_PATH → PUPPETEER_EXECUTABLE_PATH → rutas típicas.
 */
export function resolverExecutableChromium(): string | null {
  const desdeEnv =
    process.env.CHROMIUM_PATH?.trim() ||
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (desdeEnv && existsSync(desdeEnv)) return desdeEnv;

  const candidatos = [
    // Linux (imagen Alpine / Debian de la API)
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  for (const ruta of candidatos) {
    if (existsSync(ruta)) return ruta;
  }
  return null;
}

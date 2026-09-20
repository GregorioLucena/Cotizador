import type { PlantillaDocumentoConfig } from '../schemas/plantilla-documento.schemas';
import { MARCADORES_PLANTILLA } from '../schemas/plantilla-documento.schemas';

export type LineaRenderDocumento = {
  orden: number;
  sku?: string | null;
  descripcion: string;
  marca?: string | null;
  unidadCodigo?: string | null;
  cantidad: string;
  precioUnitario: string;
  descuentoMonto?: string | null;
  totalLinea: string;
  /** Atributos congelados al aprobar (clave = código definición). */
  atributos?: Record<string, unknown> | null;
};

export type DatosRenderDocumento = {
  clienteNombre: string;
  folio: string;
  vigenciaHasta?: string | null;
  locale?: string;
  monedaBaseCodigo: string;
  subtotal: string;
  descuentoTotal: string;
  impuestoTotal?: string | null;
  total: string;
  totalPresentacion?: string | null;
  monedaPresentacionCodigo?: string | null;
  tasaAplicada?: string | null;
  tasaFecha?: string | null;
  /** Logo efectivo: plantilla.identidad.logoUrl o organizaciones.logoUrl. */
  logoUrlEfectivo?: string | null;
  lineas: LineaRenderDocumento[];
  textoCondicionesCotizacion?: string | null;
  textoPieCotizacion?: string | null;
};

export type ResultadoRenderDocumento = {
  html: string;
  textoWhatsapp: string;
  advertencias: string[];
};

/** Escapa texto para interpolar en HTML del servidor (nunca interpreta HTML de org). */
export function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolverMarcadores(
  plantilla: string,
  valores: Record<(typeof MARCADORES_PLANTILLA)[number], string>,
): string {
  return plantilla.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_m, nombre: string) => {
      if (nombre in valores) {
        return valores[nombre as keyof typeof valores];
      }
      return '';
    },
  );
}

function formatearImporteLocale(
  valor: string,
  locale: string,
  decimales = 2,
): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return valor;
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(n);
  } catch {
    return n.toFixed(decimales);
  }
}

function formatearFechaLocale(
  iso: string | null | undefined,
  locale: string,
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

function valorAtributo(
  attrs: Record<string, unknown> | null | undefined,
  codigo: string | undefined,
): string {
  if (!attrs || !codigo) return '';
  const v = attrs[codigo];
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function celdaColumna(
  col: PlantillaDocumentoConfig['columnas'][number],
  linea: LineaRenderDocumento,
  locale: string,
): string {
  switch (col.campo) {
    case 'ORDEN':
      return String(linea.orden);
    case 'SKU':
      return linea.sku ?? '';
    case 'DESCRIPCION':
      return linea.descripcion;
    case 'MARCA':
      return linea.marca ?? '';
    case 'ATRIBUTO':
      return valorAtributo(linea.atributos, col.atributoCodigo);
    case 'UNIDAD':
      return linea.unidadCodigo ?? '';
    case 'CANTIDAD':
      return formatearImporteLocale(linea.cantidad, locale, 4).replace(
        /,?0+$/,
        (m) => (m.includes(',') || m.includes('.') ? m.replace(/0+$/, '').replace(/[.,]$/, '') : m),
      ) || linea.cantidad;
    case 'PRECIO_UNITARIO':
      return formatearImporteLocale(linea.precioUnitario, locale);
    case 'DESCUENTO':
      return formatearImporteLocale(linea.descuentoMonto ?? '0', locale);
    case 'TOTAL_LINEA':
      return formatearImporteLocale(linea.totalLinea, locale);
    default:
      return '';
  }
}

/**
 * Datos de ejemplo para vista previa (nunca cotizaciones reales ajenas).
 */
export function datosEjemploPlantilla(
  nombreOrganizacion: string,
): DatosRenderDocumento {
  return {
    clienteNombre: 'Cliente de ejemplo',
    folio: 'COT-0001',
    vigenciaHasta: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    locale: 'es-VE',
    monedaBaseCodigo: 'USD',
    subtotal: '150.0000',
    descuentoTotal: '10.0000',
    impuestoTotal: '0.0000',
    total: '140.0000',
    totalPresentacion: '5110.0000',
    monedaPresentacionCodigo: 'VES',
    tasaAplicada: '36.5000',
    tasaFecha: new Date().toISOString().slice(0, 10),
    logoUrlEfectivo: null,
    lineas: [
      {
        orden: 1,
        sku: 'TOR-001',
        descripcion: 'Tornillo hex 1/4"',
        marca: 'Genérica',
        unidadCodigo: 'und',
        cantidad: '10.0000',
        precioUnitario: '5.0000',
        descuentoMonto: '0.0000',
        totalLinea: '50.0000',
        atributos: { presentacion: 'Caja x100', diametro: '1/4"' },
      },
      {
        orden: 2,
        sku: 'TUB-012',
        descripcion: 'Tubo PVC 1/2"',
        marca: 'Genérica',
        unidadCodigo: 'm',
        cantidad: '20.0000',
        precioUnitario: '4.5000',
        descuentoMonto: '0.0000',
        totalLinea: '90.0000',
        atributos: { presentacion: 'Barra 6m', diametro: '1/2"' },
      },
    ],
  };
}

/**
 * Único renderizador del servidor: HTML intermedio + texto WhatsApp
 * a partir de la misma configuración declarativa.
 */
export function renderizarDocumento(
  config: PlantillaDocumentoConfig,
  datos: DatosRenderDocumento,
): ResultadoRenderDocumento {
  const advertencias: string[] = [];
  const locale = datos.locale ?? 'es-VE';
  const id = config.identidad;
  const estilo = config.estilo;
  const totales = config.totales;
  const textos = config.textos;
  const wa = config.mensajeWhatsapp;

  const logoUrl = datos.logoUrlEfectivo ?? id.logoUrl ?? null;
  if (!logoUrl) {
    advertencias.push('LOGO_AUSENTE');
  }

  const totalFmt = `${formatearImporteLocale(datos.total, locale)} ${datos.monedaBaseCodigo}`;
  const marcadores = {
    cliente: datos.clienteNombre,
    folio: datos.folio,
    vigencia: formatearFechaLocale(datos.vigenciaHasta, locale),
    total: totalFmt,
    organizacion: id.nombreComercial,
  };

  const saludoResuelto = textos.saludo
    ? resolverMarcadores(textos.saludo, marcadores)
    : '';
  const condicionesResuelto = textos.condiciones
    ? resolverMarcadores(textos.condiciones, marcadores)
    : '';
  const pieResuelto = textos.pie
    ? resolverMarcadores(textos.pie, marcadores)
    : '';
  const cierreResuelto = textos.cierre
    ? resolverMarcadores(textos.cierre, marcadores)
    : '';

  const columnasVisibles = [...config.columnas]
    .filter((c) => c.visible)
    .sort((a, b) => a.orden - b.orden);

  const densPad = estilo.densidad === 'COMPACTA' ? '8px 12px' : '12px 16px';
  const fontFamily =
    estilo.tipografia === 'SERIF'
      ? 'Georgia, "Times New Roman", serif'
      : 'system-ui, -apple-system, "Segoe UI", sans-serif';

  const filasHtml = datos.lineas
    .map((linea) => {
      const celdas = columnasVisibles
        .map(
          (col) =>
            `<td style="padding:${densPad};border-bottom:1px solid #e5e7eb;font-size:12px;">${escapeHtml(celdaColumna(col, linea, locale))}</td>`,
        )
        .join('');
      return `<tr>${celdas}</tr>`;
    })
    .join('\n');

  const thHtml = columnasVisibles
    .map(
      (col) =>
        `<th style="padding:${densPad};text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:${escapeHtml(estilo.colorTextoSobrePrimario)};background:${escapeHtml(estilo.colorPrimario)};">${escapeHtml(col.etiqueta)}</th>`,
    )
    .join('');

  const bloqueTotales: string[] = [];
  if (totales.mostrarSubtotal) {
    bloqueTotales.push(
      `<div>Subtotal: ${escapeHtml(formatearImporteLocale(datos.subtotal, locale))} ${escapeHtml(datos.monedaBaseCodigo)}</div>`,
    );
  }
  if (totales.mostrarDescuento) {
    bloqueTotales.push(
      `<div>Descuento: ${escapeHtml(formatearImporteLocale(datos.descuentoTotal, locale))} ${escapeHtml(datos.monedaBaseCodigo)}</div>`,
    );
  }
  if (totales.mostrarImpuesto && datos.impuestoTotal != null) {
    bloqueTotales.push(
      `<div>Impuesto: ${escapeHtml(formatearImporteLocale(datos.impuestoTotal, locale))} ${escapeHtml(datos.monedaBaseCodigo)}</div>`,
    );
  }
  bloqueTotales.push(
    `<div style="font-weight:700;font-size:16px;margin-top:6px;">Total: ${escapeHtml(totalFmt)}</div>`,
  );
  if (
    totales.mostrarMonedaPresentacion &&
    datos.totalPresentacion &&
    datos.monedaPresentacionCodigo
  ) {
    let ref = `Total ref.: ${escapeHtml(formatearImporteLocale(datos.totalPresentacion, locale))} ${escapeHtml(datos.monedaPresentacionCodigo)}`;
    if (
      totales.mostrarTasaAplicada &&
      datos.tasaAplicada &&
      datos.tasaFecha
    ) {
      ref += ` (tasa ${escapeHtml(datos.tasaAplicada)} del ${escapeHtml(datos.tasaFecha)})`;
    }
    bloqueTotales.push(`<div style="font-size:12px;color:#555;">${ref}</div>`);
  }

  const telefonos = (id.telefonos ?? []).filter(Boolean).join(' · ');
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" style="max-height:64px;max-width:180px;object-fit:contain;" />`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(datos.folio)} — ${escapeHtml(id.nombreComercial)}</title>
<style>
  body { margin: 0; font-family: ${fontFamily}; color: #1a1a1a; background: #fff; }
  .page { max-width: 800px; margin: 0 auto; padding: ${estilo.densidad === 'COMPACTA' ? '24px' : '36px'}; }
</style>
</head>
<body>
<div class="page">
  <header style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:3px solid ${escapeHtml(estilo.colorPrimario)};padding-bottom:16px;margin-bottom:20px;">
    <div>
      ${logoHtml}
      <h1 style="margin:8px 0 4px;font-size:22px;color:${escapeHtml(estilo.colorPrimario)};">${escapeHtml(id.nombreComercial)}</h1>
      ${id.razonSocial ? `<div style="font-size:12px;">${escapeHtml(id.razonSocial)}${id.identificacionFiscal ? ` · ${escapeHtml(id.identificacionFiscal)}` : ''}</div>` : ''}
      ${id.direccion ? `<div style="font-size:12px;color:#555;">${escapeHtml(id.direccion)}</div>` : ''}
      ${telefonos || id.email || id.sitioWeb ? `<div style="font-size:12px;color:#555;margin-top:4px;">${escapeHtml([telefonos, id.email, id.sitioWeb].filter(Boolean).join(' · '))}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#666;">Cotización</div>
      <div style="font-size:20px;font-weight:700;">${escapeHtml(datos.folio)}</div>
      <div style="font-size:12px;margin-top:8px;">Cliente: ${escapeHtml(datos.clienteNombre)}</div>
      ${datos.vigenciaHasta ? `<div style="font-size:12px;">Vigencia: ${escapeHtml(marcadores.vigencia)}</div>` : ''}
    </div>
  </header>

  ${saludoResuelto ? `<p style="font-size:14px;line-height:1.5;">${escapeHtml(saludoResuelto)}</p>` : ''}

  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
    <thead><tr>${thHtml}</tr></thead>
    <tbody>${filasHtml}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;">
    <div style="min-width:220px;font-size:13px;line-height:1.6;">
      ${bloqueTotales.join('\n')}
    </div>
  </div>

  ${(datos.textoCondicionesCotizacion || condicionesResuelto) ? `<section style="margin-top:28px;font-size:12px;color:#444;"><strong>Condiciones</strong><p>${escapeHtml(datos.textoCondicionesCotizacion || condicionesResuelto)}</p></section>` : ''}
  ${cierreResuelto ? `<p style="margin-top:16px;font-size:13px;">${escapeHtml(cierreResuelto)}</p>` : ''}
  ${(datos.textoPieCotizacion || pieResuelto) ? `<footer style="margin-top:32px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#666;">${escapeHtml(datos.textoPieCotizacion || pieResuelto)}</footer>` : ''}
</div>
</body>
</html>`;

  // Texto WhatsApp (plano, sin HTML)
  const bloquesWa: string[] = [];
  if (wa.incluirSaludo) {
    const saludoWa =
      saludoResuelto ||
      `Hola ${datos.clienteNombre}, te cotizo (${datos.folio}):`;
    bloquesWa.push(saludoWa);
  }
  if (wa.incluirDetalleLineas && datos.lineas.length > 0) {
    const max = wa.maximoLineasDetalle;
    const visibles = datos.lineas.slice(0, max);
    const lineasTexto = visibles.map((l, i) => {
      const desc = l.descripcion.trim() || 'Item';
      return `${i + 1}. ${desc} — ${l.cantidad} ${l.unidadCodigo ?? 'und'} × ${l.precioUnitario} = ${l.totalLinea} ${datos.monedaBaseCodigo}`;
    });
    if (datos.lineas.length > max) {
      lineasTexto.push(
        `… y ${datos.lineas.length - max} ítems más`,
      );
    }
    bloquesWa.push(lineasTexto.join('\n'));
  }

  const totalesWa: string[] = [];
  if (totales.mostrarSubtotal) {
    totalesWa.push(
      `Subtotal: ${datos.subtotal} ${datos.monedaBaseCodigo}`,
    );
  }
  if (totales.mostrarDescuento) {
    totalesWa.push(
      `Descuento: ${datos.descuentoTotal} ${datos.monedaBaseCodigo}`,
    );
  }
  if (totales.mostrarImpuesto && datos.impuestoTotal != null) {
    totalesWa.push(
      `Impuesto: ${datos.impuestoTotal} ${datos.monedaBaseCodigo}`,
    );
  }
  totalesWa.push(`Total: ${datos.total} ${datos.monedaBaseCodigo}`);
  if (
    totales.mostrarMonedaPresentacion &&
    datos.totalPresentacion &&
    datos.monedaPresentacionCodigo
  ) {
    let lineaRef = `Total ref.: ${datos.totalPresentacion} ${datos.monedaPresentacionCodigo}`;
    if (
      totales.mostrarTasaAplicada &&
      datos.tasaAplicada &&
      datos.tasaFecha
    ) {
      lineaRef += ` (tasa ${datos.tasaAplicada} del ${datos.tasaFecha})`;
    }
    totalesWa.push(lineaRef);
  }
  bloquesWa.push(totalesWa.join('\n'));

  const cierreWa: string[] = [];
  if (datos.vigenciaHasta) {
    cierreWa.push(`Vigencia: ${marcadores.vigencia}`);
  }
  const cond =
    datos.textoCondicionesCotizacion?.trim() || condicionesResuelto.trim();
  if (wa.incluirCondiciones && cond) {
    cierreWa.push(`Condiciones: ${cond}`);
  }
  if (cierreResuelto) cierreWa.push(cierreResuelto);
  const pie = datos.textoPieCotizacion?.trim() || pieResuelto.trim();
  if (pie) cierreWa.push(pie);
  if (cierreWa.length > 0) bloquesWa.push(cierreWa.join('\n'));

  return {
    html,
    textoWhatsapp: bloquesWa.join('\n\n'),
    advertencias,
  };
}

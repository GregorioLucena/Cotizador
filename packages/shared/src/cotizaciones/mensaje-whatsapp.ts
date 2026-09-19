/**
 * Arma el texto plano para pegar en WhatsApp a partir de una cotización
 * ya congelada (aprobada o posterior) y textos de plantilla/configuración.
 * Función pura: no consulta BD ni tasa vigente.
 */

export type LineaMensajeWhatsApp = {
  descripcion: string;
  cantidad: string;
  unidadCodigo: string;
  precioUnitario: string;
  totalLinea: string;
};

export type TextosPlantillaWhatsApp = {
  /** Plantilla con `{nombre}` / `{cliente}`; si falta, se usa saludo por defecto. */
  saludo?: string | null;
  condiciones?: string | null;
  pie?: string | null;
};

export type OpcionesMensajeWhatsApp = {
  incluirSaludo?: boolean;
  incluirDetalleLineas?: boolean;
  incluirCondiciones?: boolean;
  maximoLineasDetalle?: number;
  mostrarSubtotal?: boolean;
  mostrarDescuento?: boolean;
  mostrarImpuesto?: boolean;
  mostrarMonedaPresentacion?: boolean;
  mostrarTasaAplicada?: boolean;
};

export type EntradaMensajeWhatsApp = {
  nombreCliente: string;
  lineas: LineaMensajeWhatsApp[];
  subtotal: string;
  descuentoTotal: string;
  impuestoTotal?: string | null;
  total: string;
  monedaBaseCodigo: string;
  totalPresentacion?: string | null;
  monedaPresentacionCodigo?: string | null;
  tasaAplicada?: string | null;
  tasaFecha?: string | null;
  /** Horas de vigencia a mostrar; si no hay, se omite la línea. */
  vigenciaHoras?: number | null;
  textos: TextosPlantillaWhatsApp;
  /** Condiciones congeladas en la cotización; tienen prioridad sobre plantilla. */
  textoCondicionesCotizacion?: string | null;
  textoPieCotizacion?: string | null;
  opciones?: OpcionesMensajeWhatsApp;
};

const SALUDO_DEFAULT = 'Hola {nombre}, te cotizo:';

function aplicarPlantilla(
  plantilla: string,
  nombreCliente: string,
): string {
  return plantilla
    .replaceAll('{nombre}', nombreCliente)
    .replaceAll('{cliente}', nombreCliente);
}

/**
 * Formatea total de presentación estilo ejemplo: `4.095,00 Bs`.
 * Si no hay decimales de moneda, usa el string tal cual con código.
 */
function formatearPresentacion(
  totalPresentacion: string,
  codigo: string,
): string {
  const n = Number(totalPresentacion);
  if (!Number.isFinite(n)) {
    return `${totalPresentacion} ${codigo}`;
  }
  const partes = n.toFixed(2).split('.');
  const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${entero},${partes[1]} ${codigo}`;
}

export function armarMensajeWhatsApp(entrada: EntradaMensajeWhatsApp): string {
  const opts = entrada.opciones ?? {};
  const incluirSaludo = opts.incluirSaludo !== false;
  const incluirDetalle = opts.incluirDetalleLineas !== false;
  const incluirCondiciones = opts.incluirCondiciones !== false;
  const maxLineas = opts.maximoLineasDetalle ?? 40;
  const mostrarSubtotal = opts.mostrarSubtotal !== false;
  const mostrarDescuento = opts.mostrarDescuento !== false;
  const mostrarImpuesto = opts.mostrarImpuesto === true;
  const mostrarPresentacion = opts.mostrarMonedaPresentacion !== false;
  const mostrarTasa = opts.mostrarTasaAplicada !== false;

  const bloques: string[] = [];

  if (incluirSaludo) {
    const plantilla = entrada.textos.saludo?.trim() || SALUDO_DEFAULT;
    bloques.push(aplicarPlantilla(plantilla, entrada.nombreCliente));
  }

  if (incluirDetalle && entrada.lineas.length > 0) {
    const visibles = entrada.lineas.slice(0, maxLineas);
    const lineasTexto = visibles.map((l, i) => {
      const desc = l.descripcion.trim() || 'Item';
      return `${i + 1}. ${desc} — ${l.cantidad} ${l.unidadCodigo} × ${l.precioUnitario} = ${l.totalLinea} ${entrada.monedaBaseCodigo}`;
    });
    if (entrada.lineas.length > maxLineas) {
      lineasTexto.push(
        `… y ${entrada.lineas.length - maxLineas} línea(s) más`,
      );
    }
    bloques.push(lineasTexto.join('\n'));
  }

  const totales: string[] = [];
  if (mostrarSubtotal) {
    totales.push(
      `Subtotal: ${entrada.subtotal} ${entrada.monedaBaseCodigo}`,
    );
  }
  if (mostrarDescuento) {
    totales.push(
      `Descuento: ${entrada.descuentoTotal} ${entrada.monedaBaseCodigo}`,
    );
  }
  if (mostrarImpuesto && entrada.impuestoTotal != null) {
    totales.push(
      `Impuesto: ${entrada.impuestoTotal} ${entrada.monedaBaseCodigo}`,
    );
  }
  totales.push(`Total: ${entrada.total} ${entrada.monedaBaseCodigo}`);

  if (
    mostrarPresentacion &&
    entrada.totalPresentacion &&
    entrada.monedaPresentacionCodigo
  ) {
    const ref = formatearPresentacion(
      entrada.totalPresentacion,
      entrada.monedaPresentacionCodigo,
    );
    let lineaRef = `Total ref.: ${ref}`;
    if (mostrarTasa && entrada.tasaAplicada && entrada.tasaFecha) {
      lineaRef += ` (tasa ${entrada.tasaAplicada} del ${entrada.tasaFecha})`;
    }
    totales.push(lineaRef);
  }
  bloques.push(totales.join('\n'));

  const cierre: string[] = [];
  if (entrada.vigenciaHoras != null && entrada.vigenciaHoras > 0) {
    cierre.push(`Vigencia: ${entrada.vigenciaHoras} horas`);
  }

  const condiciones =
    entrada.textoCondicionesCotizacion?.trim() ||
    entrada.textos.condiciones?.trim() ||
    '';
  if (incluirCondiciones && condiciones) {
    cierre.push(`Condiciones: ${condiciones}`);
  }

  const pie =
    entrada.textoPieCotizacion?.trim() || entrada.textos.pie?.trim() || '';
  if (pie) {
    cierre.push(pie);
  }

  if (cierre.length > 0) {
    bloques.push(cierre.join('\n'));
  }

  return bloques.join('\n\n');
}

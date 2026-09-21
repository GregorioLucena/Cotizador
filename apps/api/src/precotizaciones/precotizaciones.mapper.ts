import {
  CanalSolicitud,
  Cotizacion,
  CotizacionEvento,
  CotizacionLinea,
  CotizacionLineaCandidato,
  EstadoCotizacion,
  EstadoRegistro,
  EstadoResolucionLinea,
  EstadoSolicitud,
  InterpretacionSolicitud,
  OrigenMatch,
  Solicitud,
  TipoEventoCotizacion,
  type Item,
} from '@cotizador/database';
import { formatConfianza, formatImporte } from '@cotizador/shared';

export function mapCotizacionDetalle(
  cotizacion: Cotizacion,
  lineas: CotizacionLinea[],
  candidatosPorLinea: Map<string, CotizacionLineaCandidato[]>,
  itemsPorId: Map<string, Item>,
  documentoGenerado?: {
    id: string;
    plantillaVersion: number;
    hashContenido: string;
    tamanoBytes: number;
    createdAt: string;
  } | null,
  textoOriginal?: string | null,
) {
  return {
    id: cotizacion.id,
    folio: cotizacion.folio,
    folioNumero: cotizacion.folioNumero,
    estado: cotizacion.estado,
    solicitudId: cotizacion.solicitudId ?? null,
    textoOriginal: textoOriginal ?? null,
    clienteId: cotizacion.clienteId ?? null,
    nombreClienteLibre: cotizacion.nombreClienteLibre ?? null,
    telefonoClienteLibre: cotizacion.telefonoClienteLibre ?? null,
    listaPrecioId: cotizacion.listaPrecioId,
    sucursalId: cotizacion.sucursalId,
    monedaBaseId: cotizacion.monedaBaseId,
    monedaPresentacionId: cotizacion.monedaPresentacionId ?? null,
    tasaAplicada: cotizacion.tasaAplicada ?? null,
    tasaFecha: cotizacion.tasaFecha ?? null,
    vigenciaHasta: cotizacion.vigenciaHasta
      ? cotizacion.vigenciaHasta.toISOString()
      : null,
    subtotal: formatImporte(cotizacion.subtotal ?? '0'),
    descuentoTotal: formatImporte(cotizacion.descuentoTotal ?? '0'),
    impuestoTotal: formatImporte(cotizacion.impuestoTotal ?? '0'),
    total: formatImporte(cotizacion.total ?? '0'),
    totalPresentacion:
      cotizacion.totalPresentacion != null
        ? formatImporte(cotizacion.totalPresentacion)
        : null,
    porcentajeImpuestoAplicado: formatImporte(
      cotizacion.porcentajeImpuestoAplicado ?? '0',
    ),
    observaciones: cotizacion.observaciones ?? null,
    textoCondiciones: cotizacion.textoCondiciones ?? null,
    textoPie: cotizacion.textoPie ?? null,
    aprobadaPorId: cotizacion.aprobadaPorId ?? null,
    aprobadaAt: cotizacion.aprobadaAt
      ? cotizacion.aprobadaAt.toISOString()
      : null,
    enviadaAt: cotizacion.enviadaAt
      ? cotizacion.enviadaAt.toISOString()
      : null,
    resultadoAt: cotizacion.resultadoAt
      ? cotizacion.resultadoAt.toISOString()
      : null,
    motivoPerdida: cotizacion.motivoPerdida ?? null,
    anulado: cotizacion.anulado,
    anuladoAt: cotizacion.anuladoAt
      ? cotizacion.anuladoAt.toISOString()
      : null,
    motivoAnulacion: cotizacion.motivoAnulacion ?? null,
    cotizacionOrigenId: cotizacion.cotizacionOrigenId ?? null,
    documentoGenerado: documentoGenerado ?? null,
    createdAt: cotizacion.createdAt.toISOString(),
    updatedAt: cotizacion.updatedAt.toISOString(),
    lineas: lineas
      .filter((l) => l.activa !== false)
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((l) => {
        const item = l.itemId ? itemsPorId.get(l.itemId) : undefined;
        const cands = candidatosPorLinea.get(l.id) ?? [];
        return {
          id: l.id,
          orden: l.orden,
          textoSolicitado: l.textoSolicitado,
          itemId: l.itemId ?? null,
          descripcion: l.descripcion ?? item?.nombre ?? null,
          sku: l.sku ?? item?.sku ?? null,
          unidadMedidaId: l.unidadMedidaId ?? null,
          cantidad: formatImporte(l.cantidad),
          precioLista:
            l.precioLista != null ? formatImporte(l.precioLista) : null,
          precioUnitario:
            l.precioUnitario != null ? formatImporte(l.precioUnitario) : null,
          descuentoMonto: formatImporte(l.descuentoMonto ?? '0'),
          descuentoPorcentaje:
            l.descuentoPorcentaje != null
              ? formatImporte(l.descuentoPorcentaje)
              : null,
          precioSobrescrito: l.precioSobrescrito,
          motivoSobrescritura: l.motivoSobrescritura ?? null,
          reglaDescuentoId: l.reglaDescuentoId ?? null,
          subtotal: l.subtotal != null ? formatImporte(l.subtotal) : null,
          total: l.total != null ? formatImporte(l.total) : null,
          estadoResolucion: l.estadoResolucion,
          confianza: formatConfianza(Number(l.confianza ?? 0)),
          origenMatch: l.origenMatch ?? null,
          notas: l.notas ?? null,
          candidatos: cands
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .map((c) => ({
              itemId: c.itemId,
              puntaje: formatConfianza(Number(c.puntaje)),
              origenMatch: c.origenMatch,
              orden: c.orden,
              nombre: itemsPorId.get(c.itemId)?.nombre ?? null,
            })),
        };
      }),
  };
}

export function mapInterpretacionResumen(i: InterpretacionSolicitud) {
  return {
    id: i.id,
    exito: i.exito,
    proveedor: i.proveedor,
    modelo: i.modelo,
    versionPrompt: i.versionPrompt,
    latenciaMs: i.latenciaMs,
    advertencias: Array.isArray(i.advertencias)
      ? (i.advertencias as string[])
      : [],
    errorCodigo: i.errorCodigo ?? null,
  };
}

export function resumenResolucion(lineas: CotizacionLinea[]) {
  let resueltasAutomaticas = 0;
  let sugeridas = 0;
  let noEncontradas = 0;
  for (const l of lineas) {
    if (l.estadoResolucion === EstadoResolucionLinea.RESUELTA_AUTOMATICA) {
      resueltasAutomaticas += 1;
    } else if (l.estadoResolucion === EstadoResolucionLinea.SUGERIDA_REVISAR) {
      sugeridas += 1;
    } else if (l.estadoResolucion === EstadoResolucionLinea.NO_ENCONTRADA) {
      noEncontradas += 1;
    }
  }
  return {
    lineasTotales: lineas.length,
    resueltasAutomaticas,
    sugeridas,
    noEncontradas,
  };
}

export {
  CanalSolicitud,
  Cotizacion,
  CotizacionEvento,
  CotizacionLinea,
  CotizacionLineaCandidato,
  EstadoCotizacion,
  EstadoRegistro,
  EstadoResolucionLinea,
  EstadoSolicitud,
  InterpretacionSolicitud,
  OrigenMatch,
  Solicitud,
  TipoEventoCotizacion,
};

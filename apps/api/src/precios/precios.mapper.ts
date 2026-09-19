import type { ListaPrecio, PrecioItem, ReglaDescuento, TasaCambio } from '@cotizador/database';

export function mapListaPrecio(lista: ListaPrecio) {
  return {
    id: lista.id,
    organizacionId: lista.organizacionId,
    nombre: lista.nombre,
    codigo: lista.codigo,
    monedaId: lista.monedaId,
    esPredeterminada: lista.esPredeterminada,
    vigenciaDesde: lista.vigenciaDesde ?? null,
    vigenciaHasta: lista.vigenciaHasta ?? null,
    estadoRegistro: lista.estadoRegistro,
    createdAt: lista.createdAt,
    updatedAt: lista.updatedAt,
  };
}

export function mapPrecioItem(precio: PrecioItem) {
  return {
    id: precio.id,
    listaPrecioId: precio.listaPrecioId,
    itemId: precio.itemId,
    precio: precio.precio,
    estadoRegistro: precio.estadoRegistro,
    createdAt: precio.createdAt,
    updatedAt: precio.updatedAt,
  };
}

export function mapReglaDescuento(regla: ReglaDescuento) {
  return {
    id: regla.id,
    organizacionId: regla.organizacionId,
    listaPrecioId: regla.listaPrecioId ?? null,
    nombre: regla.nombre,
    ambito: regla.ambito,
    referenciaId: regla.referenciaId ?? null,
    cantidadMinima: regla.cantidadMinima,
    cantidadMaxima: regla.cantidadMaxima ?? null,
    tipoDescuento: regla.tipoDescuento,
    valor: regla.valor,
    prioridad: regla.prioridad,
    vigenciaDesde: regla.vigenciaDesde ?? null,
    vigenciaHasta: regla.vigenciaHasta ?? null,
    estadoRegistro: regla.estadoRegistro,
    createdAt: regla.createdAt,
    updatedAt: regla.updatedAt,
  };
}

export function mapTasaCambio(tasa: TasaCambio) {
  return {
    id: tasa.id,
    organizacionId: tasa.organizacionId,
    monedaOrigenId: tasa.monedaOrigenId,
    monedaDestinoId: tasa.monedaDestinoId,
    valor: tasa.valor,
    fechaVigencia: tasa.fechaVigencia,
    fuente: tasa.fuente,
    estadoRegistro: tasa.estadoRegistro,
    createdAt: tasa.createdAt,
    updatedAt: tasa.updatedAt,
  };
}

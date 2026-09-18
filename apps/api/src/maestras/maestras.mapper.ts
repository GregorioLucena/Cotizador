import type {
  Categoria,
  DefinicionAtributo,
  Marca,
  UnidadMedida,
} from '@cotizador/database';

export function mapUnidadMedida(u: UnidadMedida) {
  return {
    id: u.id,
    codigo: u.codigo,
    nombre: u.nombre,
    permiteDecimales: u.permiteDecimales,
    estadoRegistro: u.estadoRegistro,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export function mapCategoria(c: Categoria) {
  return {
    id: c.id,
    nombre: c.nombre,
    categoriaPadreId: c.categoriaPadreId ?? null,
    orden: c.orden,
    estadoRegistro: c.estadoRegistro,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function mapMarca(m: Marca) {
  return {
    id: m.id,
    nombre: m.nombre,
    estadoRegistro: m.estadoRegistro,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export function mapDefinicionAtributo(d: DefinicionAtributo) {
  return {
    id: d.id,
    codigo: d.codigo,
    etiqueta: d.etiqueta,
    tipoDato: d.tipoDato,
    opciones: d.opciones ?? null,
    unidadSugerida: d.unidadSugerida ?? null,
    requerido: d.requerido,
    usarEnBusqueda: d.usarEnBusqueda,
    orden: d.orden,
    estadoRegistro: d.estadoRegistro,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

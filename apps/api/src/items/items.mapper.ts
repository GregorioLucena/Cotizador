import type {
  Item,
  ItemAlias,
  ItemAplicacion,
  Categoria,
  Marca,
  UnidadMedida,
} from '@cotizador/database';

export function mapAlias(a: ItemAlias) {
  return {
    id: a.id,
    alias: a.alias,
    normalizado: a.normalizado,
    origen: a.origen,
    vecesUsado: a.vecesUsado,
    estadoRegistro: a.estadoRegistro,
  };
}

export function mapAplicacion(ap: ItemAplicacion) {
  return {
    id: ap.id,
    datos: ap.datos,
    textoNormalizado: ap.textoNormalizado,
    estadoRegistro: ap.estadoRegistro,
  };
}

export function mapItemResumen(item: Item & {
  marca?: Marca | null;
  categoria?: Categoria | null;
  unidadMedida?: UnidadMedida;
}) {
  return {
    id: item.id,
    sku: item.sku ?? null,
    nombre: item.nombre,
    tipoItem: item.tipoItem,
    categoria: item.categoria
      ? { id: item.categoria.id, nombre: item.categoria.nombre }
      : item.categoriaId
        ? { id: item.categoriaId, nombre: null }
        : null,
    marca: item.marca
      ? { id: item.marca.id, nombre: item.marca.nombre }
      : item.marcaId
        ? { id: item.marcaId, nombre: null }
        : null,
    unidadMedida: item.unidadMedida
      ? {
          id: item.unidadMedida.id,
          codigo: item.unidadMedida.codigo,
          permiteDecimales: item.unidadMedida.permiteDecimales,
        }
      : { id: item.unidadMedidaId, codigo: '', permiteDecimales: false },
    estadoRegistro: item.estadoRegistro,
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function mapItemDetalle(
  item: Item,
  extras: {
    categoria: Categoria | null;
    padre: Categoria | null;
    marca: Marca | null;
    unidadMedida: UnidadMedida;
    alias: ItemAlias[];
    aplicaciones: ItemAplicacion[];
    advertencias?: string[];
  },
) {
  return {
    id: item.id,
    sku: item.sku ?? null,
    nombre: item.nombre,
    descripcion: item.descripcion ?? null,
    categoria: extras.categoria
      ? {
          id: extras.categoria.id,
          nombre: extras.categoria.nombre,
          padre: extras.padre?.nombre ?? null,
        }
      : null,
    marca: extras.marca
      ? { id: extras.marca.id, nombre: extras.marca.nombre }
      : null,
    unidadMedida: {
      id: extras.unidadMedida.id,
      codigo: extras.unidadMedida.codigo,
      permiteDecimales: extras.unidadMedida.permiteDecimales,
    },
    tipoItem: item.tipoItem,
    atributos: item.atributos ?? {},
    controlaStock: item.controlaStock,
    stockAproximado: item.controlaStock
      ? (item.stockAproximado ?? null)
      : null,
    estadoRegistro: item.estadoRegistro,
    alias: extras.alias.map(mapAlias),
    aplicaciones: extras.aplicaciones
      .filter((a) => a.estadoRegistro === 'ACTIVO')
      .map(mapAplicacion),
    advertencias: extras.advertencias ?? [],
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

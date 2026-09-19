export enum EstadoRegistro {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
}

export enum AmbitoPerfil {
  PLATAFORMA = 'PLATAFORMA',
  ORGANIZACION = 'ORGANIZACION',
}

export enum TipoDatoAtributo {
  TEXTO = 'TEXTO',
  NUMERO = 'NUMERO',
  ENTERO = 'ENTERO',
  BOOLEANO = 'BOOLEANO',
  LISTA = 'LISTA',
  RANGO_ANIO = 'RANGO_ANIO',
}

export enum ModoRedondeo {
  NORMAL = 'NORMAL',
  ARRIBA = 'ARRIBA',
  ABAJO = 'ABAJO',
}

export enum TipoItem {
  FUNGIBLE = 'FUNGIBLE',
  SERIALIZADO = 'SERIALIZADO',
  SERVICIO = 'SERVICIO',
}

export enum OrigenAlias {
  MANUAL = 'MANUAL',
  IMPORTADO = 'IMPORTADO',
  APRENDIDO = 'APRENDIDO',
}

export enum TipoImportacion {
  ITEMS = 'ITEMS',
  PRECIOS = 'PRECIOS',
  ALIAS = 'ALIAS',
}

export enum EstadoImportacion {
  CARGADA = 'CARGADA',
  VALIDADA = 'VALIDADA',
  CONFIRMADA = 'CONFIRMADA',
  FALLIDA = 'FALLIDA',
  CANCELADA = 'CANCELADA',
}

export enum AmbitoReglaDescuento {
  ITEM = 'ITEM',
  CATEGORIA = 'CATEGORIA',
  MARCA = 'MARCA',
  GLOBAL = 'GLOBAL',
}

export enum TipoDescuento {
  PORCENTAJE = 'PORCENTAJE',
  MONTO_FIJO = 'MONTO_FIJO',
  PRECIO_FIJO = 'PRECIO_FIJO',
}

export enum FuenteTasaCambio {
  MANUAL = 'MANUAL',
  AUTOMATICA = 'AUTOMATICA',
}

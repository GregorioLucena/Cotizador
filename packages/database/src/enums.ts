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

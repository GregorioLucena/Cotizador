export type ItemResumen = {
  id: string;
  sku: string | null;
  nombre: string;
  tipoItem: 'FUNGIBLE' | 'SERIALIZADO' | 'SERVICIO';
  categoria: { id: string; nombre: string | null } | null;
  marca: { id: string; nombre: string | null } | null;
  unidadMedida: { id: string; codigo: string; permiteDecimales: boolean };
  estadoRegistro: 'ACTIVO' | 'INACTIVO';
  updatedAt: string;
};

export type ItemAlias = {
  id: string;
  alias: string;
  normalizado: string;
  origen: 'MANUAL' | 'IMPORTADO' | 'APRENDIDO';
  vecesUsado: number;
  estadoRegistro: 'ACTIVO' | 'INACTIVO';
};

export type ItemAplicacion = {
  id: string;
  datos: Record<string, unknown>;
  textoNormalizado: string;
  estadoRegistro?: string;
};

export type ItemDetalle = {
  id: string;
  sku: string | null;
  nombre: string;
  descripcion: string | null;
  categoria: { id: string; nombre: string; padre: string | null } | null;
  marca: { id: string; nombre: string } | null;
  unidadMedida: { id: string; codigo: string; permiteDecimales: boolean };
  tipoItem: 'FUNGIBLE' | 'SERIALIZADO' | 'SERVICIO';
  atributos: Record<string, unknown>;
  controlaStock: boolean;
  stockAproximado: string | null;
  estadoRegistro: 'ACTIVO' | 'INACTIVO';
  alias: ItemAlias[];
  aplicaciones: ItemAplicacion[];
  advertencias: string[];
  createdAt: string;
  updatedAt: string;
};

export type DefinicionAtributoOpcion = {
  id: string;
  codigo: string;
  etiqueta: string;
  tipoDato: 'TEXTO' | 'NUMERO' | 'ENTERO' | 'BOOLEANO' | 'LISTA' | 'RANGO_ANIO';
  opciones: string[] | null;
  unidadSugerida: string | null;
  requerido: boolean;
  usarEnBusqueda: boolean;
  orden: number;
  estadoRegistro: string;
};

export type MaestraOpcion = { id: string; nombre: string; codigo?: string };

export const TIPO_ITEM_LABEL: Record<string, string> = {
  FUNGIBLE: 'Fungible',
  SERIALIZADO: 'Serializado',
  SERVICIO: 'Servicio',
};

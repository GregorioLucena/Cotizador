/** Version de los packs de vertical. Se reporta en el resumen de provisionamiento. */
export const PACK_VERSION = '1.0.0';

export type CodigoVertical = 'FERRETERIA' | 'REPUESTOS' | 'AUTOMOTRIZ' | 'GENERICO';

export type TipoDatoPack =
  | 'TEXTO'
  | 'NUMERO'
  | 'ENTERO'
  | 'BOOLEANO'
  | 'LISTA'
  | 'RANGO_ANIO';

export type ModoRedondeoPack = 'NORMAL' | 'ARRIBA' | 'ABAJO';

export type CampoColumnaPlantilla =
  | 'ORDEN'
  | 'SKU'
  | 'DESCRIPCION'
  | 'MARCA'
  | 'ATRIBUTO'
  | 'UNIDAD'
  | 'CANTIDAD'
  | 'PRECIO_UNITARIO'
  | 'DESCUENTO'
  | 'TOTAL_LINEA';

/** Se copia a `unidades_medida`. */
export type PackUnidadMedida = {
  codigo: string;
  nombre: string;
  permiteDecimales: boolean;
};

/** Se copia a `definiciones_atributo`. */
export type PackDefinicionAtributo = {
  codigo: string;
  etiqueta: string;
  tipoDato: TipoDatoPack;
  opciones?: string[];
  unidadSugerida?: string;
  requerido: boolean;
  usarEnBusqueda: boolean;
  orden: number;
};

/** Se copia a `categorias`. Un solo nivel de jerarquia. */
export type PackCategoria = {
  nombre: string;
  orden: number;
  subcategorias?: Array<{ nombre: string; orden: number }>;
};

/**
 * Insumo para alias del catalogo. No se persiste como fila propia al provisionar
 * (ver docs/03-verticales-y-packs.md).
 */
export type PackSinonimo = {
  texto: string;
  destinoTipo: 'CATEGORIA' | 'TERMINO';
  destino: string;
};

/** Se copia a `configuraciones_cotizacion`. */
export type PackConfiguracionCotizacion = {
  vigenciaHorasPredeterminada: number;
  aplicaImpuesto: boolean;
  porcentajeImpuesto: string;
  preciosIncluyenImpuesto: boolean;
  decimalesRedondeo: number;
  modoRedondeo: ModoRedondeoPack;
  mostrarDescuentoDetallado: boolean;
  permiteSobrescribirPrecio: boolean;
};

export type PackColumnaPlantilla = {
  campo: CampoColumnaPlantilla;
  etiqueta: string;
  atributoCodigo?: string;
  visible?: boolean;
  orden: number;
};

/**
 * Parcial de `plantillaDocumentoConfigSchema` (ADR 0006).
 * El bloque `identidad` no lo declara el pack: se completa en el provisionamiento.
 */
export type PackPlantillaDocumento = {
  estilo: {
    colorPrimario: string;
    colorTextoSobrePrimario: string;
    tipografia: 'SANS' | 'SERIF';
    densidad: 'COMPACTA' | 'NORMAL';
    tamanoPagina: 'A4' | 'CARTA';
  };
  folio: {
    prefijo: string;
    longitudNumero: number;
  };
  columnas: PackColumnaPlantilla[];
  totales: {
    mostrarSubtotal: boolean;
    mostrarDescuento: boolean;
    mostrarImpuesto: boolean;
    mostrarMonedaPresentacion: boolean;
    mostrarTasaAplicada: boolean;
  };
  textos: {
    saludo?: string;
    condiciones?: string;
    pie?: string;
    cierre?: string;
  };
  mensajeWhatsapp: {
    incluirSaludo: boolean;
    incluirDetalleLineas: boolean;
    incluirCondiciones: boolean;
    maximoLineasDetalle: number;
  };
};

export type PackVertical = {
  codigo: CodigoVertical;
  nombre: string;
  unidadesMedida: PackUnidadMedida[];
  definicionesAtributo: PackDefinicionAtributo[];
  categorias: PackCategoria[];
  sinonimos: PackSinonimo[];
  configuracionCotizacion: PackConfiguracionCotizacion;
  plantillaDocumento: PackPlantillaDocumento;
  usaAplicaciones: boolean;
};

export type PackResumen = {
  codigo: CodigoVertical;
  nombre: string;
  usaAplicaciones: boolean;
  conteos: {
    unidadesMedida: number;
    definicionesAtributo: number;
    categorias: number;
    subcategorias: number;
    sinonimos: number;
  };
};

/** Valores comunes de estilo/folio/totales/whatsapp para todos los packs. */
export function plantillaBase(
  columnas: PackColumnaPlantilla[],
  opciones?: {
    mostrarImpuesto?: boolean;
    mostrarDescuento?: boolean;
  },
): PackPlantillaDocumento {
  return {
    estilo: {
      colorPrimario: '#146b45',
      colorTextoSobrePrimario: '#ffffff',
      tipografia: 'SANS',
      densidad: 'NORMAL',
      tamanoPagina: 'CARTA',
    },
    folio: {
      prefijo: 'COT-',
      longitudNumero: 4,
    },
    columnas,
    totales: {
      mostrarSubtotal: true,
      mostrarDescuento: opciones?.mostrarDescuento ?? true,
      mostrarImpuesto: opciones?.mostrarImpuesto ?? false,
      mostrarMonedaPresentacion: true,
      mostrarTasaAplicada: true,
    },
    textos: {},
    mensajeWhatsapp: {
      incluirSaludo: true,
      incluirDetalleLineas: true,
      incluirCondiciones: false,
      maximoLineasDetalle: 20,
    },
  };
}

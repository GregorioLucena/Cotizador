import { plantillaBase, type PackVertical } from './tipos';

export const packGenerico: PackVertical = {
  codigo: 'GENERICO',
  nombre: 'Generico',
  usaAplicaciones: false,
  unidadesMedida: [
    { codigo: 'UND', nombre: 'Unidad', permiteDecimales: false },
    { codigo: 'M', nombre: 'Metro', permiteDecimales: true },
    { codigo: 'KG', nombre: 'Kilogramo', permiteDecimales: true },
    { codigo: 'LT', nombre: 'Litro', permiteDecimales: true },
  ],
  definicionesAtributo: [
    {
      codigo: 'modelo',
      etiqueta: 'Modelo',
      tipoDato: 'TEXTO',
      requerido: false,
      usarEnBusqueda: true,
      orden: 1,
    },
    {
      codigo: 'presentacion',
      etiqueta: 'Presentacion',
      tipoDato: 'TEXTO',
      requerido: false,
      usarEnBusqueda: false,
      orden: 2,
    },
  ],
  categorias: [
    {
      nombre: 'Productos',
      orden: 1,
      subcategorias: [{ nombre: 'Sin clasificar', orden: 1 }],
    },
    {
      nombre: 'Servicios',
      orden: 2,
      subcategorias: [{ nombre: 'Sin clasificar', orden: 1 }],
    },
  ],
  sinonimos: [],
  configuracionCotizacion: {
    vigenciaHorasPredeterminada: 48,
    aplicaImpuesto: false,
    porcentajeImpuesto: '0.0000',
    preciosIncluyenImpuesto: false,
    decimalesRedondeo: 2,
    modoRedondeo: 'NORMAL',
    mostrarDescuentoDetallado: true,
    permiteSobrescribirPrecio: true,
  },
  plantillaDocumento: plantillaBase([
    { campo: 'ORDEN', etiqueta: '#', orden: 1 },
    { campo: 'DESCRIPCION', etiqueta: 'Descripcion', orden: 2 },
    { campo: 'CANTIDAD', etiqueta: 'Cant.', orden: 3 },
    { campo: 'PRECIO_UNITARIO', etiqueta: 'Precio', orden: 4 },
    { campo: 'TOTAL_LINEA', etiqueta: 'Total', orden: 5 },
  ]),
};

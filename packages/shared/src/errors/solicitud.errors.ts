import {
  AppError,
  BusinessRuleError,
  NotFoundError,
} from './classes';

export function solicitudNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'SOLICITUD_NO_ENCONTRADA',
    'No se encontró la solicitud indicada.',
  );
}

export function solicitudTextoVacio(): AppError {
  return new AppError(
    'SOLICITUD_TEXTO_VACIO',
    'El texto de la solicitud no puede estar vacío.',
    400,
    { campo: 'textoOriginal' },
  );
}

export function solicitudTextoDemasiadoLargo(): AppError {
  return new AppError(
    'SOLICITUD_TEXTO_DEMASIADO_LARGO',
    'El texto supera el máximo permitido.',
    400,
    { campo: 'textoOriginal', max: 4000 },
  );
}

export function solicitudTextoSinContenido(): AppError {
  return new AppError(
    'SOLICITUD_TEXTO_SIN_CONTENIDO',
    'Tras normalizar el texto no queda contenido útil de pedido.',
    400,
    { campo: 'textoOriginal' },
  );
}

/** Alias de aceptación de la spec 008 (mismo significado que SOLICITUD_TEXTO_*). */
export function textoSolicitudVacio(): AppError {
  return solicitudTextoVacio();
}

export function textoSolicitudDemasiadoLargo(): AppError {
  return solicitudTextoDemasiadoLargo();
}

export function textoSolicitudSinContenido(): AppError {
  return solicitudTextoSinContenido();
}

export function clienteONombreRequerido(): AppError {
  return new AppError(
    'CLIENTE_O_NOMBRE_REQUERIDO',
    'Indique un cliente registrado o un nombre libre.',
    400,
  );
}

export function clienteInactivo(): BusinessRuleError {
  return new BusinessRuleError(
    'CLIENTE_INACTIVO',
    'El cliente indicado está inactivo.',
  );
}

export function listaPrecioNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'LISTA_PRECIO_NO_ENCONTRADA',
    'No se encontró la lista de precios indicada.',
  );
}

export function listaPrecioCapturaInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'LISTA_PRECIO_INACTIVA',
    'La lista de precios está inactiva.',
  );
}

export function listaPrecioNoResoluble(): BusinessRuleError {
  return new BusinessRuleError(
    'LISTA_PRECIO_NO_RESOLUBLE',
    'No hay lista de precios informada, del cliente ni predeterminada.',
  );
}

export function sucursalNoAccesible(): BusinessRuleError {
  return new BusinessRuleError(
    'SUCURSAL_NO_ACCESIBLE',
    'No tiene acceso a la sucursal indicada.',
  );
}

export {
  cotizacionNoEncontrada,
  folioNoDisponible,
} from './cotizacion.errors';

/** Códigos de interpretación fallida (no abortan el HTTP 201 del pipeline). */
export const CODIGOS_IA = {
  DESACTIVADA: 'IA_DESACTIVADA',
  TIMEOUT: 'IA_TIMEOUT',
  PROVEEDOR_NO_DISPONIBLE: 'IA_PROVEEDOR_NO_DISPONIBLE',
  SALIDA_INVALIDA: 'IA_SALIDA_INVALIDA',
  ERROR_INTERNO: 'IA_ERROR_INTERNO',
  SIN_LINEAS: 'IA_SIN_LINEAS',
} as const;

export type CodigoIa = (typeof CODIGOS_IA)[keyof typeof CODIGOS_IA];

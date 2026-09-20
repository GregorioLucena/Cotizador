import {
  AppError,
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from './classes';

export function cotizacionNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'COTIZACION_NO_ENCONTRADA',
    'No se encontró la cotización indicada.',
  );
}

export function cotizacionEstadoInvalido(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'COTIZACION_ESTADO_INVALIDO',
    'La operación no aplica al estado actual de la cotización.',
    details,
  );
}

export function transicionEstadoInvalida(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'TRANSICION_ESTADO_INVALIDA',
    'Esa transición de estado no está permitida.',
    details,
  );
}

export function cotizacionSinLineas(): BusinessRuleError {
  return new BusinessRuleError(
    'COTIZACION_SIN_LINEAS',
    'No se puede aprobar una cotización sin líneas.',
  );
}

export function lineasSinResolver(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'LINEAS_SIN_RESOLVER',
    'Hay líneas sin resolver o sin item asignado.',
    details,
  );
}

export function lineasSinPrecio(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'LINEAS_SIN_PRECIO',
    'Hay líneas sin precio cotizable.',
    details,
  );
}

export function lineaNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'LINEA_NO_ENCONTRADA',
    'No se encontró la línea indicada.',
  );
}

export function borradorNoEditable(): BusinessRuleError {
  return new BusinessRuleError(
    'BORRADOR_NO_EDITABLE',
    'Solo se pueden editar cotizaciones en borrador.',
  );
}

export function itemNoCotizable(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'ITEM_NO_COTIZABLE',
    'No se puede usar un item inactivo en el borrador.',
    details,
  );
}

export function cantidadInvalida(details?: unknown): AppError {
  return new AppError(
    'CANTIDAD_INVALIDA',
    'La cantidad de la línea no es válida.',
    400,
    details,
  );
}

export function cantidadNoEntera(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'CANTIDAD_NO_ENTERA',
    'La unidad no admite cantidades decimales.',
    details,
  );
}

export function cantidadIncompatibleConUnidad(
  details?: unknown,
): BusinessRuleError {
  return new BusinessRuleError(
    'CANTIDAD_INCOMPATIBLE_CON_UNIDAD',
    'La cantidad actual no es compatible con la unidad elegida.',
    details,
  );
}

export function serializadoCantidadInvalida(
  details?: unknown,
): BusinessRuleError {
  return new BusinessRuleError(
    'SERIALIZADO_CANTIDAD_INVALIDA',
    'Un item serializado solo admite cantidad 1.',
    details,
  );
}

export function sobrescrituraNoPermitida(
  status: 403 | 422 = 403,
  details?: unknown,
): AppError {
  if (status === 403) {
    return new ForbiddenError(
      'SOBRESCRITURA_NO_PERMITIDA',
      'No tiene permiso para sobrescribir el precio de una línea.',
    );
  }
  return new BusinessRuleError(
    'SOBRESCRITURA_NO_PERMITIDA',
    'La organización no permite sobrescribir precios.',
    details,
  );
}

export function motivoSobrescrituraRequerido(): AppError {
  return new AppError(
    'MOTIVO_SOBRESCRITURA_REQUERIDO',
    'Indique el motivo de la sobrescritura de precio (mínimo 10 caracteres).',
    400,
  );
}

export function motivoAnulacionRequerido(): AppError {
  return new AppError(
    'MOTIVO_ANULACION_REQUERIDO',
    'Indique un motivo de anulación de al menos diez caracteres.',
    400,
  );
}

export function motivoPerdidaRequerido(): AppError {
  return new AppError(
    'MOTIVO_PERDIDA_REQUERIDO',
    'Indique un motivo de pérdida de al menos diez caracteres.',
    400,
  );
}

export function totalesDesfasados(totalesServidor: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'TOTALES_DESFASADOS',
    'Los totales del cliente no coinciden con el cálculo del servidor.',
    { totalesServidor },
  );
}

export function folioNoDisponible(): BusinessRuleError {
  return new BusinessRuleError(
    'FOLIO_NO_DISPONIBLE',
    'No se pudo asignar el folio de la cotización.',
  );
}

export function mensajeWhatsAppNoDisponible(
  details?: unknown,
): BusinessRuleError {
  return new BusinessRuleError(
    'COTIZACION_NO_APROBADA',
    'Solo se genera el mensaje de cotizaciones aprobadas o posteriores no anuladas.',
    details,
  );
}

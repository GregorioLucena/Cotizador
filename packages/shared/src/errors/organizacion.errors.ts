import {
  AppError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from './classes';

export function organizacionNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'ORGANIZACION_NO_ENCONTRADA',
    'No se encontró la organización indicada.',
  );
}

export function organizacionNombreDuplicado(): ConflictError {
  return new ConflictError(
    'ORGANIZACION_NOMBRE_DUPLICADO',
    'Ya existe una organización con ese nombre.',
  );
}

export function organizacionIdentificacionDuplicada(): ConflictError {
  return new ConflictError(
    'ORGANIZACION_IDENTIFICACION_DUPLICADA',
    'Ya existe una organización con esa identificación fiscal.',
  );
}

export function organizacionInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'ORGANIZACION_INACTIVA',
    'La organización está inactiva.',
  );
}

export function organizacionPackNoDisponible(): BusinessRuleError {
  return new BusinessRuleError(
    'ORGANIZACION_PACK_NO_DISPONIBLE',
    'No hay un pack disponible para el vertical elegido.',
  );
}

export function organizacionProvisionamientoFallido(details?: unknown): AppError {
  return new AppError(
    'ORGANIZACION_PROVISIONAMIENTO_FALLIDO',
    'No se pudo provisionar la organización. No se creó ningún dato.',
    500,
    details,
  );
}

export function organizacionVerticalNoModificable(): BusinessRuleError {
  return new BusinessRuleError(
    'ORGANIZACION_VERTICAL_NO_MODIFICABLE',
    'El vertical no se puede cambiar porque la organización ya fue provisionada.',
  );
}

export function organizacionYaTieneAdministrador(): ConflictError {
  return new ConflictError(
    'ORGANIZACION_YA_TIENE_ADMINISTRADOR',
    'Esta organización ya tiene un administrador. Los usuarios se administran desde la organización.',
  );
}

export function organizacionMonedaPresentacionIgualABase(): AppError {
  return new AppError(
    'ORGANIZACION_MONEDA_PRESENTACION_IGUAL_A_BASE',
    'La moneda de presentación debe ser distinta de la moneda base.',
    400,
  );
}

export function organizacionUmbralesIncoherentes(): BusinessRuleError {
  return new BusinessRuleError(
    'ORGANIZACION_UMBRALES_INCOHERENTES',
    'El umbral de descarte debe ser menor que el umbral automático.',
  );
}

export function contextoPlataformaRequerido(): ForbiddenError {
  return new ForbiddenError(
    'CONTEXTO_PLATAFORMA_REQUERIDO',
    'Esta operación requiere el ámbito de plataforma.',
  );
}

export function verticalInactivo(): AppError {
  return new AppError(
    'ORGANIZACION_VERTICAL_INVALIDO',
    'El vertical indicado no es válido.',
    400,
  );
}

export function monedaInactiva(): AppError {
  return new AppError(
    'ORGANIZACION_VERTICAL_INVALIDO',
    'La moneda indicada no está activa.',
    400,
  );
}

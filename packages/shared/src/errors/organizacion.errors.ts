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

export function organizacionConfiguracionAusente(): BusinessRuleError {
  return new BusinessRuleError(
    'ORGANIZACION_CONFIGURACION_AUSENTE',
    'Falta la configuración de cotización de la organización.',
  );
}

export function organizacionUmbralFueraDeRango(): AppError {
  return new AppError(
    'ORGANIZACION_UMBRAL_FUERA_DE_RANGO',
    'Los umbrales deben estar entre 0 y 1.',
    400,
  );
}

export function organizacionCambioMonedaBaseNoConfirmado(): BusinessRuleError {
  return new BusinessRuleError(
    'ORGANIZACION_CAMBIO_MONEDA_BASE_NO_CONFIRMADO',
    'Confirme de forma explícita el cambio de moneda base.',
  );
}

export function organizacionLogoFormatoNoSoportado(): AppError {
  return new AppError(
    'ORGANIZACION_LOGO_FORMATO_NO_SOPORTADO',
    'El logo debe ser PNG, JPG o SVG.',
    400,
  );
}

export function organizacionLogoDemasiadoGrande(): AppError {
  return new AppError(
    'ORGANIZACION_LOGO_DEMASIADO_GRANDE',
    'El logo no puede superar 2 MB.',
    400,
  );
}

export function organizacionLogoDimensionesInsuficientes(): AppError {
  return new AppError(
    'ORGANIZACION_LOGO_DIMENSIONES_INSUFICIENTES',
    'El logo debe medir al menos 200 por 200 píxeles.',
    400,
  );
}

export function organizacionSucursalNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'ORGANIZACION_SUCURSAL_NO_ENCONTRADA',
    'No se encontró la sucursal indicada.',
  );
}

export function organizacionSucursalNombreDuplicado(): ConflictError {
  return new ConflictError(
    'ORGANIZACION_SUCURSAL_NOMBRE_DUPLICADO',
    'Ya existe una sucursal con ese nombre.',
  );
}

export function organizacionSucursalCodigoDuplicado(): ConflictError {
  return new ConflictError(
    'ORGANIZACION_SUCURSAL_CODIGO_DUPLICADO',
    'Ya existe una sucursal con ese código.',
  );
}

export function organizacionSucursalPrincipalNoInactivable(): BusinessRuleError {
  return new BusinessRuleError(
    'ORGANIZACION_SUCURSAL_PRINCIPAL_NO_INACTIVABLE',
    'No se puede inactivar la sucursal principal.',
  );
}

export function organizacionSucursalEnUso(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'ORGANIZACION_SUCURSAL_EN_USO',
    'No se puede inactivar: hay usuarios que quedarían sin sucursal.',
    details,
  );
}

export function impuestoPorcentajeRequerido(): BusinessRuleError {
  return new BusinessRuleError(
    'IMPUESTO_PORCENTAJE_REQUERIDO',
    'Indique el porcentaje de impuesto o desactive su aplicación.',
  );
}

export function listaPrecioInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'LISTA_INACTIVA',
    'La lista de precios está inactiva.',
  );
}

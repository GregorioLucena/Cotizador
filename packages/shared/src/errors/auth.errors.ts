import {
  AppError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from './classes';

export function credencialesInvalidas(): UnauthorizedError {
  return new UnauthorizedError(
    'AUTH_CREDENCIALES_INVALIDAS',
    'Correo o contraseña incorrectos.',
  );
}

export function sesionInvalida(): UnauthorizedError {
  return new UnauthorizedError(
    'AUTH_SESION_INVALIDA',
    'Su sesión no es válida. Vuelva a iniciar sesión.',
  );
}

export function cambioPasswordRequerido(): ForbiddenError {
  return new ForbiddenError(
    'AUTH_CAMBIO_PASSWORD_REQUERIDO',
    'Debe cambiar su contraseña antes de continuar.',
  );
}

export function passwordActualIncorrecta(): AppError {
  return new AppError(
    'AUTH_PASSWORD_ACTUAL_INCORRECTA',
    'La contraseña actual no es correcta.',
    400,
  );
}

export function passwordIgualALaAnterior(): BusinessRuleError {
  return new BusinessRuleError(
    'AUTH_PASSWORD_IGUAL_A_LA_ANTERIOR',
    'La contraseña nueva debe ser distinta de la actual.',
  );
}

export function contextoOrganizacionRequerido(): ForbiddenError {
  return new ForbiddenError(
    'CONTEXTO_ORGANIZACION_REQUERIDO',
    'Esta operación requiere el contexto de una organización.',
  );
}

export function usuarioNoEncontrado(): NotFoundError {
  return new NotFoundError('USUARIO_NO_ENCONTRADO', 'No se encontró el usuario indicado.');
}

export function usuarioEmailDuplicado(): ConflictError {
  return new ConflictError('USUARIO_EMAIL_DUPLICADO', 'Ya existe un usuario con ese correo.');
}

export function usuarioSinPerfil(): BusinessRuleError {
  return new BusinessRuleError(
    'USUARIO_SIN_PERFIL',
    'El usuario debe tener al menos un perfil.',
  );
}

export function usuarioSinSucursal(): BusinessRuleError {
  return new BusinessRuleError(
    'USUARIO_SIN_SUCURSAL',
    'El usuario debe tener al menos una sucursal.',
  );
}

export function perfilAmbitoIncompatible(): BusinessRuleError {
  return new BusinessRuleError(
    'USUARIO_PERFIL_AMBITO_INCOMPATIBLE',
    'El perfil no corresponde al ámbito del usuario.',
  );
}

export function autogestionPerfilesProhibida(): BusinessRuleError {
  return new BusinessRuleError(
    'USUARIO_AUTOGESTION_PERFILES_PROHIBIDA',
    'No puede modificar sus propios perfiles.',
  );
}

export function autoinactivacionProhibida(): BusinessRuleError {
  return new BusinessRuleError(
    'USUARIO_AUTOINACTIVACION_PROHIBIDA',
    'No puede inactivarse a sí mismo.',
  );
}

export function ultimoAdministrador(): BusinessRuleError {
  return new BusinessRuleError(
    'USUARIO_ULTIMO_ADMINISTRADOR',
    'No se puede quitar el último administrador activo de la organización.',
  );
}

export function sucursalInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'AUTH_SUCURSAL_INACTIVA',
    'La sucursal seleccionada no está activa.',
  );
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(
    details?: unknown,
    message = 'Los datos enviados no son válidos. Revise los campos e intente de nuevo.',
  ) {
    super('VALIDACION_FALLIDA', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    code = 'NO_AUTENTICADO',
    message = 'Debe iniciar sesión para continuar.',
  ) {
    super(code, message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(
    code = 'SIN_PERMISO',
    message = 'No tiene permiso para realizar esta acción.',
  ) {
    super(code, message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(
    code = 'RECURSO_NO_ENCONTRADO',
    message = 'No se encontró el recurso solicitado.',
  ) {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 409, details);
    this.name = 'ConflictError';
  }
}

export class BusinessRuleError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 422, details);
    this.name = 'BusinessRuleError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    code = 'SERVICIO_EXTERNO_NO_DISPONIBLE',
    message = 'Un servicio externo no está disponible. Intente más tarde.',
    details?: unknown,
  ) {
    super(code, message, 502, details);
    this.name = 'ExternalServiceError';
  }
}

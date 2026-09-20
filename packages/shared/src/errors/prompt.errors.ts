import {
  AppError,
  BusinessRuleError,
  ConflictError,
  ExternalServiceError,
  NotFoundError,
} from './classes';

export function promptNoEncontrado(): NotFoundError {
  return new NotFoundError(
    'PROMPT_NO_ENCONTRADO',
    'No se encontró la versión de prompt indicada.',
  );
}

export function promptSoloBorradorEditable(): BusinessRuleError {
  return new BusinessRuleError(
    'PROMPT_SOLO_BORRADOR_EDITABLE',
    'Solo se puede editar una versión en borrador.',
  );
}

export function promptEstadoInvalido(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'PROMPT_ESTADO_INVALIDO',
    'La operación no aplica al estado actual de la versión.',
    details,
  );
}

export function promptCodigoDuplicado(codigo: string): ConflictError {
  return new ConflictError(
    'PROMPT_CODIGO_DUPLICADO',
    'Ya existe una versión con ese código.',
    { codigo },
  );
}

export function promptPoliticaInvalida(details?: unknown): AppError {
  return new AppError(
    'PROMPT_POLITICA_INVALIDA',
    'La política de extracción no es válida.',
    400,
    details,
  );
}

export function promptEvaluacionSinMuestras(): BusinessRuleError {
  return new BusinessRuleError(
    'PROMPT_EVALUACION_SIN_MUESTRAS',
    'No hay interpretaciones históricas suficientes para evaluar.',
  );
}

export function openaiApiKeyAusente(): ExternalServiceError {
  return new ExternalServiceError(
    'OPENAI_API_KEY_AUSENTE',
    'Falta la clave de OpenAI en la configuración de la plataforma.',
  );
}

/**
 * Importación de catálogo (spec 005).
 * Códigos canónicos en docs/08-catalogo-errores.md.
 */
import {
  AppError,
  BusinessRuleError,
  NotFoundError,
} from './classes';

export function importacionNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'IMPORTACION_NO_ENCONTRADA',
    'No se encontró la importación indicada.',
  );
}

export function importacionEstadoInvalido(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'IMPORTACION_ESTADO_INVALIDO',
    'La importación no admite esta acción en su estado actual.',
    details,
  );
}

export function importacionMapeoInvalido(details?: unknown): AppError {
  return new AppError(
    'IMPORTACION_MAPEO_INVALIDO',
    'El mapeo de columnas es incompleto o incorrecto.',
    400,
    details,
  );
}

/** Spec 005: mismo caso que mapeo inválido; código explícito de mapeo incompleto. */
export function importacionMapeoIncompleto(campos: string[]): AppError {
  return new AppError(
    'IMPORTACION_MAPEO_INCOMPLETO',
    'El mapeo de columnas es incompleto o incorrecto.',
    400,
    { camposFaltantes: campos },
  );
}

export function importacionFormatoNoSoportado(): AppError {
  return new AppError(
    'IMPORTACION_FORMATO_NO_SOPORTADO',
    'El formato de archivo no está admitido. Use .csv o .xlsx.',
    400,
  );
}

export function importacionArchivoDemasiadoGrande(): AppError {
  return new AppError(
    'IMPORTACION_ARCHIVO_DEMASIADO_GRANDE',
    'El archivo supera el tamaño máximo de 5 MB.',
    400,
  );
}

export function importacionArchivoInvalido(details?: unknown): AppError {
  return new AppError(
    'IMPORTACION_ARCHIVO_INVALIDO',
    'El archivo no se pudo leer o no es un formato admitido.',
    400,
    details,
  );
}

export function importacionArchivoVacio(): AppError {
  return new AppError(
    'IMPORTACION_ARCHIVO_VACIO',
    'El archivo no contiene filas de datos.',
    400,
  );
}

export function importacionCabeceraInvalida(): AppError {
  return new AppError(
    'IMPORTACION_CABECERA_INVALIDA',
    'No se reconoce la fila de cabecera del archivo.',
    400,
  );
}

export function importacionLimiteFilas(): AppError {
  return new AppError(
    'IMPORTACION_LIMITE_FILAS',
    'El archivo supera el máximo de 2000 filas de datos.',
    400,
  );
}

export function importacionSinFilasValidas(): BusinessRuleError {
  return new BusinessRuleError(
    'IMPORTACION_SIN_FILAS_VALIDAS',
    'No hay filas válidas para confirmar.',
  );
}

export function importacionYaConfirmada(): BusinessRuleError {
  return new BusinessRuleError(
    'IMPORTACION_YA_CONFIRMADA',
    'Esta importación ya fue confirmada.',
  );
}

export function importacionCancelada(): BusinessRuleError {
  return new BusinessRuleError(
    'IMPORTACION_CANCELADA',
    'La importación está cancelada y no se puede continuar.',
  );
}

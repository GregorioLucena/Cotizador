import { AppError, NotFoundError } from './classes';

export function periodoInvalido(details?: unknown): AppError {
  return new AppError(
    'PERIODO_INVALIDO',
    'El periodo indicado no es válido. Revise las fechas desde y hasta.',
    400,
    details,
  );
}

export function sucursalNoEncontradaHistorial(): NotFoundError {
  return new NotFoundError(
    'SUCURSAL_NO_ENCONTRADA',
    'No se encontró la sucursal indicada.',
  );
}

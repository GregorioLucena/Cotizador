import {
  AppError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from './classes';

export function clienteNoEncontrado(): NotFoundError {
  return new NotFoundError(
    'CLIENTE_NO_ENCONTRADO',
    'No se encontró el cliente indicado.',
  );
}

export function clienteWhatsappDuplicado(): ConflictError {
  return new ConflictError(
    'CLIENTE_WHATSAPP_DUPLICADO',
    'Ya existe un cliente con ese número de WhatsApp.',
  );
}

export function clienteYaInactivo(): BusinessRuleError {
  return new BusinessRuleError(
    'CLIENTE_YA_INACTIVO',
    'El cliente ya está inactivo.',
  );
}

export function clienteListaInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'CLIENTE_LISTA_INACTIVA',
    'La lista de precios asignada al cliente no está activa.',
  );
}

export function clienteNombreRequerido(): AppError {
  return new AppError(
    'CLIENTE_NOMBRE_REQUERIDO',
    'El nombre del cliente es obligatorio.',
    400,
    { campo: 'nombre' },
  );
}

export function whatsappFormatoInvalido(): AppError {
  return new AppError(
    'WHATSAPP_FORMATO_INVALIDO',
    'El número de WhatsApp no tiene un formato válido.',
    400,
    { campo: 'telefonoWhatsapp' },
  );
}

export function whatsappSinCodigoPais(): AppError {
  return new AppError(
    'WHATSAPP_SIN_CODIGO_PAIS',
    'Indique el número con código de país (por ejemplo +58…).',
    400,
    { campo: 'telefonoWhatsapp' },
  );
}

/** Código de advertencia (no error HTTP) al reutilizar por WhatsApp. */
export const CLIENTE_REUTILIZADO_POR_WHATSAPP = 'CLIENTE_REUTILIZADO_POR_WHATSAPP';

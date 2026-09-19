import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from './classes';

export function listaNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'LISTA_NO_ENCONTRADA',
    'No se encontró la lista de precios indicada.',
  );
}

export function listaCodigoDuplicado(): ConflictError {
  return new ConflictError(
    'LISTA_CODIGO_DUPLICADO',
    'Ya existe una lista con ese código.',
  );
}

export function listaInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'LISTA_INACTIVA',
    'La lista de precios está inactiva.',
  );
}

export function listaPredeterminadaRequerida(): BusinessRuleError {
  return new BusinessRuleError(
    'LISTA_PREDETERMINADA_REQUERIDA',
    'La organización debe tener una lista de precios predeterminada.',
  );
}

export function listaVigenciaInvalida(): ValidationError {
  return new ValidationError(
    { campo: 'vigenciaHasta' },
    'El rango de vigencia de la lista no es válido.',
  );
}

export function listaMonedaInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'LISTA_MONEDA_INACTIVA',
    'La moneda de la lista no está activa.',
  );
}

export function listaMonedaDistintaDeBase(): BusinessRuleError {
  return new BusinessRuleError(
    'LISTA_MONEDA_DISTINTA_DE_BASE',
    'La moneda de la lista debe coincidir con la moneda base de la organización.',
  );
}

export function precioNoEncontrado(): NotFoundError {
  return new NotFoundError(
    'PRECIO_NO_ENCONTRADO',
    'No se encontró el precio indicado.',
  );
}

export function precioInvalido(details?: unknown): ValidationError {
  return new ValidationError(
    details ?? { campo: 'precio' },
    'El precio debe ser mayor que cero y con formato decimal válido.',
  );
}

export function precioNegativo(): ValidationError {
  return new ValidationError(
    { campo: 'precio' },
    'El precio no puede ser negativo.',
  );
}

export function precioFormatoInvalido(): ValidationError {
  return new ValidationError(
    { campo: 'precio' },
    'El precio debe ser una cantidad decimal válida.',
  );
}

export function precioItemInactivo(): BusinessRuleError {
  return new BusinessRuleError(
    'PRECIO_ITEM_INACTIVO',
    'No se puede asignar precio a un item inactivo.',
  );
}

export function precioAusenteEnLista(): BusinessRuleError {
  return new BusinessRuleError(
    'PRECIO_AUSENTE_EN_LISTA',
    'El item no tiene precio en la lista aplicada.',
  );
}

export function reglaNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'REGLA_NO_ENCONTRADA',
    'No se encontró la regla de descuento indicada.',
  );
}

export function reglaAmbitoInvalido(): ValidationError {
  return new ValidationError(
    { campo: 'ambito' },
    'El ámbito o la referencia de la regla no son válidos.',
  );
}

export function reglaReferenciaRequerida(): ValidationError {
  return new ValidationError(
    { campo: 'referenciaId' },
    'Indique la referencia según el ámbito de la regla.',
  );
}

export function reglaValorInvalido(): ValidationError {
  return new ValidationError(
    { campo: 'valor' },
    'El valor del descuento no es válido.',
  );
}

export function reglaVigenciaInvalida(): ValidationError {
  return new ValidationError(
    { campo: 'vigenciaHasta' },
    'El rango de vigencia de la regla no es válido.',
  );
}

export function reglaCantidadInvalida(): ValidationError {
  return new ValidationError(
    { campo: 'cantidadMaxima' },
    'El rango de cantidades de la regla no es válido.',
  );
}

export function reglaInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'REGLA_INACTIVA',
    'La regla de descuento está inactiva.',
  );
}

export function tasaNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'TASA_NO_ENCONTRADA',
    'No se encontró la tasa de cambio indicada.',
  );
}

export function tasaValorInvalido(): ValidationError {
  return new ValidationError(
    { campo: 'valor' },
    'El valor de la tasa debe ser mayor que cero.',
  );
}

export function tasaMonedasIguales(): ValidationError {
  return new ValidationError(
    { campo: 'monedaDestinoId' },
    'Las monedas de origen y destino deben ser distintas.',
  );
}

export function tasaDuplicada(): ConflictError {
  return new ConflictError(
    'TASA_DUPLICADA',
    'Ya existe una tasa para ese par de monedas en esa fecha.',
  );
}

export function tasaNoDisponible(): BusinessRuleError {
  return new BusinessRuleError(
    'TASA_NO_DISPONIBLE',
    'No hay tasa vigente para convertir a la moneda de presentación.',
  );
}

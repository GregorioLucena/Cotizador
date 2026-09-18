import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from './classes';

export function unidadMedidaNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'UNIDAD_MEDIDA_NO_ENCONTRADA',
    'No se encontró la unidad de medida indicada.',
  );
}

export function unidadMedidaCodigoDuplicado(): ConflictError {
  return new ConflictError(
    'UNIDAD_MEDIDA_CODIGO_DUPLICADO',
    'Ya existe una unidad con ese código.',
  );
}

export function categoriaNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'CATEGORIA_NO_ENCONTRADA',
    'No se encontró la categoría indicada.',
  );
}

export function categoriaNombreDuplicado(): ConflictError {
  return new ConflictError(
    'CATEGORIA_NOMBRE_DUPLICADO',
    'Ya existe una categoría con ese nombre.',
  );
}

export function categoriaProfundidadExcedida(): BusinessRuleError {
  return new BusinessRuleError(
    'CATEGORIA_PROFUNDIDAD_EXCEDIDA',
    'Solo se admite un nivel de subcategorías.',
  );
}

export function categoriaPadreInvalido(): BusinessRuleError {
  return new BusinessRuleError(
    'CATEGORIA_PADRE_INVALIDO',
    'El padre debe ser una categoría raíz activa.',
  );
}

export function marcaNoEncontrada(): NotFoundError {
  return new NotFoundError('MARCA_NO_ENCONTRADA', 'No se encontró la marca indicada.');
}

export function marcaNombreDuplicado(): ConflictError {
  return new ConflictError(
    'MARCA_NOMBRE_DUPLICADO',
    'Ya existe una marca con ese nombre.',
  );
}

export function definicionAtributoNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'DEFINICION_ATRIBUTO_NO_ENCONTRADA',
    'No se encontró la definición de atributo indicada.',
  );
}

export function definicionCodigoDuplicado(): ConflictError {
  return new ConflictError(
    'DEFINICION_CODIGO_DUPLICADO',
    'Ya existe una definición con ese código.',
  );
}

export function definicionCodigoInmutable(): BusinessRuleError {
  return new BusinessRuleError(
    'DEFINICION_CODIGO_INMUTABLE',
    'El código de la definición no se puede cambiar.',
  );
}

export function definicionTipoInmutable(): BusinessRuleError {
  return new BusinessRuleError(
    'DEFINICION_TIPO_INMUTABLE',
    'El tipo de dato no se puede cambiar porque el atributo ya está en uso.',
  );
}

export function definicionOpcionesRequeridas(): ValidationError {
  return new ValidationError(
    { campo: 'opciones' },
    'Indique al menos una opción para el tipo LISTA.',
  );
}

export function definicionOpcionEnUso(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'DEFINICION_OPCION_EN_USO',
    'No se puede quitar una opción que ya usan items.',
    details,
  );
}

export function maestraEnUso(details?: unknown): BusinessRuleError {
  return new BusinessRuleError(
    'MAESTRA_EN_USO',
    'No se puede inactivar o cambiar: hay items activos que la usan.',
    details,
  );
}

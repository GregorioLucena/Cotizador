import {
  AppError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from './classes';

export function itemNoEncontrado(): NotFoundError {
  return new NotFoundError(
    'ITEM_NO_ENCONTRADO',
    'No se encontró el item indicado.',
  );
}

export function itemSkuDuplicado(details?: { itemId: string }): ConflictError {
  return new ConflictError(
    'ITEM_SKU_DUPLICADO',
    'Ya existe un item con ese SKU en la organización.',
    details,
  );
}

export function itemYaInactivo(): BusinessRuleError {
  return new BusinessRuleError(
    'ITEM_YA_INACTIVO',
    'El item ya está inactivo.',
  );
}

export function itemServicioNoAdmiteStock(): BusinessRuleError {
  return new BusinessRuleError(
    'ITEM_SERVICIO_NO_ADMITE_STOCK',
    'Un servicio no admite control de stock.',
  );
}

export function itemSerializadoStockInvalido(): BusinessRuleError {
  return new BusinessRuleError(
    'ITEM_SERIALIZADO_STOCK_INVALIDO',
    'Un item serializado solo admite stock 0 o 1.',
  );
}

export function itemStockNegativo(): AppError {
  return new AppError(
    'ITEM_STOCK_NEGATIVO',
    'El stock aproximado no puede ser negativo.',
    400,
  );
}

export function itemAtributosInvalidos(errores: unknown[]): AppError {
  return new AppError(
    'ITEM_ATRIBUTO_TIPO_INVALIDO',
    'El valor del atributo no corresponde al tipo definido.',
    400,
    { errores },
  );
}

/** Acumula varios errores de atributo en una sola respuesta 400. */
export function itemAtributosErroresAcumulados(errores: unknown[]): AppError {
  const primero = errores[0] as { code?: string; message?: string } | undefined;
  return new AppError(
    primero?.code ?? 'ITEM_ATRIBUTO_TIPO_INVALIDO',
    primero?.message ??
      'Hay atributos inválidos. Revise los campos e intente de nuevo.',
    400,
    { errores },
  );
}

export function itemAtributosLimiteExcedido(): BusinessRuleError {
  return new BusinessRuleError(
    'ITEM_ATRIBUTOS_LIMITE_EXCEDIDO',
    'El item supera el máximo de atributos permitidos.',
  );
}

export function itemBusquedaConsultaMuyCorta(): AppError {
  return new AppError(
    'ITEM_BUSQUEDA_CONSULTA_MUY_CORTA',
    'Escriba al menos dos caracteres para buscar.',
    400,
  );
}

export function itemRegeneracionMasivaRequerida(): BusinessRuleError {
  return new BusinessRuleError(
    'ITEM_REGENERACION_MASIVA_REQUERIDA',
    'El cambio afecta demasiados items; ejecute la reindexación del catálogo.',
  );
}

export function aliasNoEncontrado(): NotFoundError {
  return new NotFoundError(
    'ALIAS_NO_ENCONTRADO',
    'No se encontró el alias indicado.',
  );
}

export function aliasDuplicado(): ConflictError {
  return new ConflictError(
    'ALIAS_DUPLICADO',
    'Ese alias ya existe en este item.',
  );
}

export function aliasMuyCorto(): AppError {
  return new AppError(
    'ALIAS_MUY_CORTO',
    'El alias es demasiado corto.',
    400,
  );
}

export function aliasLimiteExcedido(): BusinessRuleError {
  return new BusinessRuleError(
    'ALIAS_LIMITE_EXCEDIDO',
    'El item alcanzó el máximo de alias activos.',
  );
}

export function aliasAprendidoSinConfirmacion(): BusinessRuleError {
  return new BusinessRuleError(
    'ALIAS_APRENDIDO_SIN_CONFIRMACION',
    'Confirme de forma explícita para guardar el alias aprendido.',
  );
}

export function categoriaInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'CATEGORIA_INACTIVA',
    'La categoría está inactiva y no se puede asignar.',
  );
}

export function marcaInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'MARCA_INACTIVA',
    'La marca está inactiva y no se puede asignar.',
  );
}

export function unidadMedidaInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'UNIDAD_MEDIDA_INACTIVA',
    'La unidad de medida está inactiva y no se puede asignar.',
  );
}

export function aplicacionNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'APLICACION_NO_ENCONTRADA',
    'No se encontró la aplicación indicada.',
  );
}

export function aplicacionDatosInvalidos(details?: unknown): AppError {
  return new AppError(
    'APLICACION_DATOS_INVALIDOS',
    'Los datos de la aplicación no son válidos.',
    400,
    details,
  );
}

export function aplicacionDuplicada(): ConflictError {
  return new ConflictError(
    'APLICACION_DUPLICADA',
    'Ya existe una aplicación equivalente en este item.',
  );
}

export function aplicacionRangoExcesivo(): BusinessRuleError {
  return new BusinessRuleError(
    'APLICACION_RANGO_EXCESIVO',
    'El rango de años no puede superar 60 años.',
  );
}

export function terminoNoEncontrado(): NotFoundError {
  return new NotFoundError(
    'TERMINO_NO_ENCONTRADO',
    'No se encontró el término no resuelto.',
  );
}

export function terminoYaCerrado(): BusinessRuleError {
  return new BusinessRuleError(
    'TERMINO_YA_CERRADO',
    'El término ya fue cerrado.',
  );
}

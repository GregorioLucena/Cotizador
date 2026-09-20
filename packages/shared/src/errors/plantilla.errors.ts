import {
  AppError,
  BusinessRuleError,
  ConflictError,
  ExternalServiceError,
  NotFoundError,
} from './classes';

export function plantillaNoEncontrada(): NotFoundError {
  return new NotFoundError(
    'PLANTILLA_NO_ENCONTRADA',
    'No se encontró la plantilla de documento indicada.',
  );
}

export function plantillaConfiguracionInvalida(details?: unknown): AppError {
  return new AppError(
    'PLANTILLA_CONFIGURACION_INVALIDA',
    'La configuración de la plantilla no es válida.',
    400,
    details,
  );
}

export function marcadorNoPermitido(marcador: string): AppError {
  return new AppError(
    'MARCADOR_NO_PERMITIDO',
    `El marcador {{${marcador}}} no está permitido.`,
    400,
    { marcador },
  );
}

export function columnaAtributoSinCodigo(): AppError {
  return new AppError(
    'COLUMNA_ATRIBUTO_SIN_CODIGO',
    'Una columna ATRIBUTO debe indicar atributoCodigo.',
    400,
  );
}

export function columnasInsuficientes(details?: unknown): AppError {
  return new AppError(
    'COLUMNAS_INSUFICIENTES',
    'La plantilla debe tener al menos dos columnas con DESCRIPCION e importes visibles.',
    400,
    details,
  );
}

export function columnasOrdenDuplicado(details?: unknown): AppError {
  return new AppError(
    'COLUMNAS_ORDEN_DUPLICADO',
    'Dos columnas visibles no pueden compartir el mismo orden.',
    400,
    details,
  );
}

export function colorInvalido(details?: unknown): AppError {
  return new AppError(
    'COLOR_INVALIDO',
    'Los colores deben ser hexadecimales de seis dígitos (#RRGGBB).',
    400,
    details,
  );
}

export function plantillaPredeterminadaNoInactivable(): BusinessRuleError {
  return new BusinessRuleError(
    'PLANTILLA_PREDETERMINADA_NO_INACTIVABLE',
    'No se puede inactivar la plantilla predeterminada.',
  );
}

export function plantillaPredeterminadaRequerida(): BusinessRuleError {
  return new BusinessRuleError(
    'PLANTILLA_PREDETERMINADA_REQUERIDA',
    'Debe existir una plantilla predeterminada activa para generar el documento.',
  );
}

export function plantillaInactiva(): BusinessRuleError {
  return new BusinessRuleError(
    'PLANTILLA_INACTIVA',
    'La plantilla está inactiva.',
  );
}

export function cotizacionNoAprobadaParaDocumento(
  details?: unknown,
): BusinessRuleError {
  return new BusinessRuleError(
    'COTIZACION_NO_APROBADA',
    'Solo se genera documento de cotizaciones aprobadas o posteriores no anuladas.',
    details,
  );
}

export function documentoYaGenerado(details?: unknown): ConflictError {
  return new ConflictError(
    'DOCUMENTO_YA_GENERADO',
    'Ya existe un PDF generado para esta cotización. Use la descarga.',
    details,
  );
}

export function documentoNoEncontrado(): NotFoundError {
  return new NotFoundError(
    'DOCUMENTO_NO_ENCONTRADO',
    'Aún no hay un documento generado para esta cotización.',
  );
}

export function documentoArchivoAusente(): ExternalServiceError {
  return new ExternalServiceError(
    'DOCUMENTO_ARCHIVO_AUSENTE',
    'El registro del documento existe pero el archivo no está en el almacenamiento.',
  );
}

export function pdfTimeout(details?: unknown): ExternalServiceError {
  return new ExternalServiceError(
    'PDF_TIMEOUT',
    'La generación del PDF agotó el tiempo de espera.',
    details,
  );
}

export function pdfGeneracionFallida(details?: unknown): ExternalServiceError {
  return new ExternalServiceError(
    'PDF_GENERACION_FALLIDA',
    'No se pudo generar el PDF. Intente de nuevo.',
    details,
  );
}

export function documentoAlmacenamientoNoDisponible(
  details?: unknown,
): ExternalServiceError {
  return new ExternalServiceError(
    'DOCUMENTO_ALMACENAMIENTO_NO_DISPONIBLE',
    'No se pudo guardar o leer el archivo del documento.',
    details,
  );
}

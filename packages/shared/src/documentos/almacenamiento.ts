/**
 * Interfaz mínima de almacenamiento de archivos (logos, PDFs, importaciones).
 * Implementación típica: filesystem local bajo ALMACENAMIENTO o storage/.
 */

export interface AlmacenamientoArchivos {
  /** Guarda bytes en una ruta relativa; retorna la ruta relativa normalizada. */
  guardar(buffer: Buffer, pathRelativo: string): Promise<string>;
  /** Lee un archivo previamente guardado. */
  leer(pathRelativo: string): Promise<Buffer>;
  /** Conserva el archivo (no-op permitido); no borra documentos de negocio. */
  eliminar?(pathRelativo: string): Promise<void>;
  /** URL pública relativa si aplica (p. ej. /api/uploads/...). */
  urlPublica?(pathRelativo: string): string;
}

export const ALMACENAMIENTO_TOKEN = 'ALMACENAMIENTO_ARCHIVOS';

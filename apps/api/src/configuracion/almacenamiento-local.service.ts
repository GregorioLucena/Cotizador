import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import type { AlmacenamientoArchivos } from '@cotizador/shared';

@Injectable()
export class AlmacenamientoLocalService implements AlmacenamientoArchivos {
  raiz(): string {
    if (process.env.ALMACENAMIENTO) {
      return normalize(process.env.ALMACENAMIENTO);
    }
    if (process.env.UPLOAD_DIR) {
      return normalize(process.env.UPLOAD_DIR);
    }
    return join(process.cwd(), 'storage');
  }

  private absoluto(pathRelativo: string): string {
    const relativo = pathRelativo.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    return join(this.raiz(), relativo);
  }

  /**
   * Guarda un buffer en una ruta relativa a la raíz de uploads.
   * No elimina archivos previos al reemplazar.
   */
  async guardar(buffer: Buffer, pathRelativo: string): Promise<string> {
    const relativo = pathRelativo.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    const absoluto = this.absoluto(relativo);
    await mkdir(dirname(absoluto), { recursive: true });
    await writeFile(absoluto, buffer);
    return relativo;
  }

  /** Lee un archivo previamente guardado por ruta relativa. */
  async leer(pathRelativo: string): Promise<Buffer> {
    return readFile(this.absoluto(pathRelativo));
  }

  /**
   * Conserva el archivo físico (los documentos pueden referenciarlo).
   * No-op intencional.
   */
  async eliminar(_pathRelativo: string): Promise<void> {
    return;
  }

  urlPublica(pathRelativo: string): string {
    const limpio = pathRelativo.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    return `/api/uploads/${limpio}`;
  }
}

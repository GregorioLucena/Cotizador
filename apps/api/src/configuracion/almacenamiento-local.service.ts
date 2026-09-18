import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

@Injectable()
export class AlmacenamientoLocalService {
  raiz(): string {
    return process.env.UPLOAD_DIR
      ? normalize(process.env.UPLOAD_DIR)
      : join(process.cwd(), 'uploads');
  }

  /**
   * Guarda un buffer en una ruta relativa a la raíz de uploads.
   * No elimina archivos previos al reemplazar.
   */
  async guardar(buffer: Buffer, pathRelativo: string): Promise<string> {
    const relativo = pathRelativo.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    const absoluto = join(this.raiz(), relativo);
    await mkdir(dirname(absoluto), { recursive: true });
    await writeFile(absoluto, buffer);
    return relativo;
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

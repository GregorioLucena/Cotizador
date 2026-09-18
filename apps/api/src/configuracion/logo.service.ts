import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type OrgContext,
  PERMISOS,
  organizacionLogoDemasiadoGrande,
  organizacionLogoDimensionesInsuficientes,
  organizacionLogoFormatoNoSoportado,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { AlmacenamientoLocalService } from './almacenamiento-local.service';
import { ConfiguracionOrganizacionService } from './configuracion-organizacion.service';
import { dimensionesBitmap } from './logo-dimensiones';

const MAX_BYTES = 2 * 1024 * 1024;
const MIME_PERMITIDOS = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);

@Injectable()
export class LogoService {
  constructor(
    private readonly almacenamiento: AlmacenamientoLocalService,
    private readonly configuracionOrganizacion: ConfiguracionOrganizacionService,
  ) {}

  async subir(ctx: OrgContext, file: Express.Multer.File | undefined) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CONFIGURACION_ORGANIZACION_ADMINISTRAR);

    if (!file?.buffer?.length) {
      throw organizacionLogoFormatoNoSoportado();
    }

    const mime = file.mimetype;
    if (!MIME_PERMITIDOS.has(mime)) {
      throw organizacionLogoFormatoNoSoportado();
    }
    if (file.size > MAX_BYTES || file.buffer.length > MAX_BYTES) {
      throw organizacionLogoDemasiadoGrande();
    }

    if (mime === 'image/png' || mime === 'image/jpeg') {
      const dims = dimensionesBitmap(file.buffer, mime);
      if (!dims || dims.width < 200 || dims.height < 200) {
        throw organizacionLogoDimensionesInsuficientes();
      }
    }

    const ext =
      mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'svg';
    const relativo = `logos/${ctx.organizacionId}/${randomUUID()}.${ext}`;
    await this.almacenamiento.guardar(file.buffer, relativo);
    const logoUrl = this.almacenamiento.urlPublica(relativo);
    return this.configuracionOrganizacion.actualizarLogoUrl(ctx, logoUrl);
  }

  async eliminar(ctx: OrgContext) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CONFIGURACION_ORGANIZACION_ADMINISTRAR);
    return this.configuracionOrganizacion.actualizarLogoUrl(ctx, null);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { LIMITE_TAMANO_ARCHIVO_BYTES } from '@cotizador/shared';
import type { Request } from 'express';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { MultipartArchivoInterceptor } from '../common/interceptors/multipart-archivo.interceptor';
import { ImportacionesService } from './importaciones.service';

type CargarImportacionBody = {
  tipo?: string;
  mapeoColumnas?: string;
  nombreHoja?: string;
};

function cuerpoCarga(body: unknown, req: Request): CargarImportacionBody {
  const raw =
    (body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : null) ??
    (req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : {}) ??
    {};
  return {
    tipo: typeof raw.tipo === 'string' ? raw.tipo : undefined,
    mapeoColumnas:
      typeof raw.mapeoColumnas === 'string' ? raw.mapeoColumnas : undefined,
    nombreHoja:
      typeof raw.nombreHoja === 'string' ? raw.nombreHoja : undefined,
  };
}

@Controller('importaciones')
export class ImportacionesController {
  constructor(private readonly importaciones: ImportacionesService) {}

  @Get('plantilla')
  async plantilla(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const { filename, content } = await this.importaciones.plantilla(ctx, query);
    const type =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return new StreamableFile(content, {
      type,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.importaciones.listar(ctx, query);
    return { data };
  }

  @Get(':id')
  async obtener(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.importaciones.obtener(ctx, id);
    return { data };
  }

  @Post('inspeccionar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    MultipartArchivoInterceptor('archivo', LIMITE_TAMANO_ARCHIVO_BYTES),
  )
  async inspeccionar(
    @OrgCtx() ctx: OrgContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.importaciones.inspeccionar(ctx, file);
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    MultipartArchivoInterceptor('archivo', LIMITE_TAMANO_ARCHIVO_BYTES),
  )
  async cargar(
    @OrgCtx() ctx: OrgContext,
    @Body() body: unknown,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const data = await this.importaciones.cargar(
      ctx,
      cuerpoCarga(body, req),
      file,
    );
    return { data };
  }

  @Post(':id/validar')
  @HttpCode(HttpStatus.OK)
  async validar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.importaciones.validar(ctx, id);
    return { data };
  }

  @Post(':id/confirmar')
  @HttpCode(HttpStatus.OK)
  async confirmar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.importaciones.confirmar(ctx, id, body);
    return { data };
  }

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  async cancelar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.importaciones.cancelar(ctx, id);
    return { data };
  }
}

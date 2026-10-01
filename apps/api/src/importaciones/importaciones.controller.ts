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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { OrgContext } from '@cotizador/shared';
import { LIMITE_TAMANO_ARCHIVO_BYTES } from '@cotizador/shared';
import { memoryStorage } from 'multer';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { ImportacionesService } from './importaciones.service';

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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: LIMITE_TAMANO_ARCHIVO_BYTES },
    }),
  )
  async cargar(
    @OrgCtx() ctx: OrgContext,
    @Body() body: { tipo?: string; mapeoColumnas?: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.importaciones.cargar(ctx, body, file);
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

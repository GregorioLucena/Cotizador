import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { PlantillasDocumentoService } from '../plantillas/plantillas-documento.service';
import { CotizacionesRevisionService } from './cotizaciones-revision.service';
import { PrecotizacionesService } from './precotizaciones.service';

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(
    private readonly service: PrecotizacionesService,
    private readonly revision: CotizacionesRevisionService,
    private readonly plantillas: PlantillasDocumentoService,
  ) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.service.listarCotizaciones(ctx, query);
    return { data };
  }

  @Get(':id')
  async obtener(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.service.obtenerCotizacion(ctx, id);
    return { data };
  }

  @Patch(':id')
  async editarCabecera(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.revision.editarCabecera(ctx, id, body);
    return { data };
  }

  @Post(':id/lineas')
  async agregarLinea(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.revision.agregarLinea(ctx, id, body);
    return { data };
  }

  @Patch(':id/lineas/:lineaId')
  async editarLinea(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineaId', ParseUUIDPipe) lineaId: string,
    @Body() body: unknown,
  ) {
    const data = await this.revision.editarLinea(ctx, id, lineaId, body);
    return { data };
  }

  @Delete(':id/lineas/:lineaId')
  async eliminarLinea(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineaId', ParseUUIDPipe) lineaId: string,
  ) {
    const data = await this.revision.eliminarLinea(ctx, id, lineaId);
    return { data };
  }

  @Post(':id/recalcular')
  async recalcular(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.revision.recalcular(ctx, id, body);
    return { data };
  }

  @Post(':id/aprobar')
  async aprobar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.revision.aprobar(ctx, id, body);
    return { data };
  }

  @Get(':id/mensaje')
  async mensaje(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.plantillas.mensajeDesdePlantilla(ctx, id);
    return { data };
  }

  @Post(':id/documento')
  async generarDocumento(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.plantillas.generarDocumento(ctx, id);
    return { data };
  }

  @Get(':id/documento')
  async descargarDocumento(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { buffer, filename } = await this.plantillas.descargarDocumento(
      ctx,
      id,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  /** Spec / diseño: `/enviada`. Alias `/enviar` no expuesto. */
  @Post(':id/enviada')
  async marcarEnviada(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.revision.marcarEnviada(ctx, id);
    return { data };
  }

  @Post(':id/resultado')
  async resultado(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.revision.registrarResultado(ctx, id, body);
    return { data };
  }

  @Post(':id/anular')
  async anular(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.revision.anular(ctx, id, body);
    return { data };
  }

  @Post(':id/duplicar')
  async duplicar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.revision.duplicar(ctx, id);
    return { data };
  }

  @Get(':id/eventos')
  async eventos(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.revision.listarEventos(ctx, id);
    return { data };
  }
}

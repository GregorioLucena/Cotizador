import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  Cliente,
  Cotizacion,
  CotizacionEvento,
  CotizacionLinea,
  DocumentoGenerado,
  EstadoCotizacion,
  EstadoRegistro,
  FormatoDocumento,
  Moneda,
  Organizacion,
  PlantillaDocumento,
  TipoEventoCotizacion,
  UnidadMedida,
} from '@cotizador/database';
import {
  type DatosRenderDocumento,
  type GeneradorPdf,
  type OrgContext,
  type PlantillaDocumentoConfig,
  GENERADOR_PDF_TOKEN,
  PERMISOS,
  PdfGeneracionError,
  PdfTimeoutError,
  actualizarPlantillaDocumentoSchema,
  canonicalJson,
  cotizacionNoAprobadaParaDocumento,
  cotizacionNoEncontrada,
  documentoAlmacenamientoNoDisponible,
  documentoArchivoAusente,
  documentoNoEncontrado,
  documentoYaGenerado,
  plantillaConfiguracionInvalida,
  plantillaDocumentoConfigSchema,
  plantillaNoEncontrada,
  plantillaPredeterminadaRequerida,
  pdfGeneracionFallida,
  pdfTimeout,
  previsualizarPlantillaSchema,
  renderizarDocumento,
  datosEjemploPlantilla,
  requireOrganizacionContext,
  requirePermission,
  columnaAtributoSinCodigo,
  columnasInsuficientes,
  columnasOrdenDuplicado,
  colorInvalido,
  marcadorNoPermitido,
} from '@cotizador/shared';
import { ZodError } from 'zod';
import { AlmacenamientoLocalService } from '../configuracion/almacenamiento-local.service';
import { aplicarVencimientoPerezoso } from '../precotizaciones/cotizacion-vencimiento';

const ESTADOS_DOCUMENTO: EstadoCotizacion[] = [
  EstadoCotizacion.APROBADA,
  EstadoCotizacion.ENVIADA,
  EstadoCotizacion.GANADA,
  EstadoCotizacion.PERDIDA,
  EstadoCotizacion.VENCIDA,
];

@Injectable()
export class PlantillasDocumentoService {
  constructor(
    @InjectRepository(PlantillaDocumento)
    private readonly plantillaRepo: Repository<PlantillaDocumento>,
    @InjectRepository(Organizacion)
    private readonly orgRepo: Repository<Organizacion>,
    @InjectRepository(Cotizacion)
    private readonly cotizacionRepo: Repository<Cotizacion>,
    @InjectRepository(CotizacionLinea)
    private readonly lineaRepo: Repository<CotizacionLinea>,
    @InjectRepository(DocumentoGenerado)
    private readonly documentoRepo: Repository<DocumentoGenerado>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(UnidadMedida)
    private readonly unidadRepo: Repository<UnidadMedida>,
    @InjectRepository(Moneda)
    private readonly monedaRepo: Repository<Moneda>,
    private readonly almacenamiento: AlmacenamientoLocalService,
    private readonly dataSource: DataSource,
    @Inject(GENERADOR_PDF_TOKEN)
    private readonly generadorPdf: GeneradorPdf,
  ) {}

  async listar(ctx: OrgContext) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PLANTILLAS_VER);
    const items = await this.plantillaRepo.find({
      where: { organizacionId: ctx.organizacionId },
      order: { esPredeterminada: 'DESC', nombre: 'ASC' },
    });
    return items.map((p) => this.mapDetalle(p));
  }

  async obtener(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PLANTILLAS_VER);
    const plantilla = await this.cargarPlantilla(ctx.organizacionId, id);
    return this.mapDetalle(plantilla);
  }

  async actualizar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PLANTILLAS_ADMINISTRAR);

    let input: ReturnType<typeof actualizarPlantillaDocumentoSchema.parse>;
    try {
      input = actualizarPlantillaDocumentoSchema.parse(body ?? {});
    } catch (err) {
      throw this.mapearErrorZod(err);
    }

    const plantilla = await this.cargarPlantilla(ctx.organizacionId, id);

    if (input.nombre !== undefined) {
      plantilla.nombre = input.nombre;
    }

    if (input.configuracion !== undefined) {
      const nuevaCanon = canonicalJson(input.configuracion);
      const vigenteCanon = canonicalJson(plantilla.configuracion);
      if (nuevaCanon !== vigenteCanon) {
        plantilla.configuracion = input.configuracion;
        plantilla.version += 1;
        plantilla.updatedById = ctx.usuarioId;
        await this.plantillaRepo.save(plantilla);
      } else if (input.nombre !== undefined) {
        plantilla.updatedById = ctx.usuarioId;
        await this.plantillaRepo.save(plantilla);
      }
      // Config idéntica: no toca updatedAt por falso cambio de contenido
    } else if (input.nombre !== undefined) {
      plantilla.updatedById = ctx.usuarioId;
      await this.plantillaRepo.save(plantilla);
    }

    const fresca = await this.cargarPlantilla(ctx.organizacionId, id);
    return this.mapDetalle(fresca);
  }

  async previsualizar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PLANTILLAS_ADMINISTRAR);

    let input: ReturnType<typeof previsualizarPlantillaSchema.parse>;
    try {
      input = previsualizarPlantillaSchema.parse(body ?? {});
    } catch (err) {
      throw this.mapearErrorZod(err);
    }

    const plantilla = await this.cargarPlantilla(ctx.organizacionId, id);
    const org = await this.orgRepo.findOneOrFail({
      where: { id: ctx.organizacionId },
    });

    let config: PlantillaDocumentoConfig;
    try {
      config = plantillaDocumentoConfigSchema.parse(
        input.configuracion ?? plantilla.configuracion,
      );
    } catch (err) {
      throw this.mapearErrorZod(err);
    }

    const datos = datosEjemploPlantilla(org.nombre);
    datos.locale = org.locale;
    datos.logoUrlEfectivo =
      config.identidad.logoUrl ?? org.logoUrl ?? null;

    const render = renderizarDocumento(config, datos);

    if (input.formato === 'HTML') {
      return {
        formato: 'HTML' as const,
        html: render.html,
        advertencias: render.advertencias,
      };
    }
    if (input.formato === 'TEXTO') {
      return {
        formato: 'TEXTO' as const,
        texto: render.textoWhatsapp,
        advertencias: render.advertencias,
      };
    }

    try {
      const pdf = await this.generadorPdf.generar(render.html, {
        timeoutMs: this.pdfTimeoutMs(),
        tamanoPagina: config.estilo.tamanoPagina,
      });
      return {
        formato: 'PDF' as const,
        contenidoBase64: pdf.bytes.toString('base64'),
        html: render.html,
        advertencias: [...render.advertencias, ...pdf.advertencias],
      };
    } catch (err) {
      throw this.mapearErrorPdf(err);
    }
  }

  async generarDocumento(ctx: OrgContext, cotizacionId: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_GENERAR_DOCUMENTO);
    const orgId = ctx.organizacionId;

    const cotizacion = await this.cargarCotizacion(orgId, cotizacionId);
    this.assertEstadoDocumento(cotizacion);

    const existente = await this.documentoRepo.findOne({
      where: {
        organizacionId: orgId,
        cotizacionId,
        formato: FormatoDocumento.PDF,
      },
    });
    if (existente) {
      throw documentoYaGenerado({ documentoId: existente.id });
    }

    const plantilla = await this.plantillaRepo.findOne({
      where: {
        organizacionId: orgId,
        esPredeterminada: true,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
    if (!plantilla) {
      throw plantillaPredeterminadaRequerida();
    }

    let config: PlantillaDocumentoConfig;
    try {
      config = plantillaDocumentoConfigSchema.parse(plantilla.configuracion);
    } catch (err) {
      throw this.mapearErrorZod(err);
    }

    const org = await this.orgRepo.findOneOrFail({ where: { id: orgId } });
    const datos = await this.datosDesdeCotizacion(org, cotizacion, config);
    const render = renderizarDocumento(config, datos);

    let pdfBytes: Buffer;
    try {
      const pdf = await this.generadorPdf.generar(render.html, {
        timeoutMs: this.pdfTimeoutMs(),
        tamanoPagina: config.estilo.tamanoPagina,
      });
      pdfBytes = pdf.bytes;
    } catch (err) {
      throw this.mapearErrorPdf(err);
    }

    if (!pdfBytes || pdfBytes.length === 0) {
      throw pdfGeneracionFallida({ motivo: 'PDF vacío' });
    }

    const hash = createHash('sha256').update(pdfBytes).digest('hex');
    const ruta = `documentos/${orgId}/${cotizacionId}.pdf`;

    try {
      await this.almacenamiento.guardar(pdfBytes, ruta);
    } catch (err) {
      throw documentoAlmacenamientoNoDisponible({
        causa: err instanceof Error ? err.message : String(err),
      });
    }

    const documento = await this.documentoRepo.manager.transaction(
      async (manager) => {
        const doc = await manager.save(
          DocumentoGenerado,
          manager.create(DocumentoGenerado, {
            organizacionId: orgId,
            cotizacionId,
            plantillaId: plantilla.id,
            plantillaVersion: plantilla.version,
            formato: FormatoDocumento.PDF,
            rutaArchivo: ruta,
            hashContenido: hash,
            tamanoBytes: pdfBytes.length,
            generadoPorId: ctx.usuarioId,
          }),
        );
        await manager.save(
          CotizacionEvento,
          manager.create(CotizacionEvento, {
            organizacionId: orgId,
            cotizacionId,
            tipo: TipoEventoCotizacion.DOCUMENTO_GENERADO,
            descripcion: 'PDF de cotización generado',
            datos: {
              documentoId: doc.id,
              formato: FormatoDocumento.PDF,
              plantillaId: plantilla.id,
              plantillaVersion: plantilla.version,
              hashContenido: hash,
              tamanoBytes: pdfBytes.length,
              advertencias: render.advertencias,
            },
            usuarioId: ctx.usuarioId,
          }),
        );
        return doc;
      },
    );

    return {
      id: documento.id,
      cotizacionId: documento.cotizacionId,
      plantillaId: documento.plantillaId,
      plantillaVersion: documento.plantillaVersion,
      formato: documento.formato,
      hashContenido: documento.hashContenido,
      tamanoBytes: documento.tamanoBytes,
      createdAt: documento.createdAt.toISOString(),
      advertencias: render.advertencias,
    };
  }

  async descargarDocumento(
    ctx: OrgContext,
    cotizacionId: string,
  ): Promise<{ buffer: Buffer; folio: string; filename: string }> {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_VER);
    const orgId = ctx.organizacionId;

    const cotizacion = await this.cargarCotizacion(orgId, cotizacionId);
    const documento = await this.documentoRepo.findOne({
      where: {
        organizacionId: orgId,
        cotizacionId,
        formato: FormatoDocumento.PDF,
      },
    });
    if (!documento) {
      throw documentoNoEncontrado();
    }

    let buffer: Buffer;
    try {
      buffer = await this.almacenamiento.leer(documento.rutaArchivo);
    } catch {
      throw documentoArchivoAusente();
    }

    const filename = `${cotizacion.folio.replace(/[^\w.-]+/g, '_')}.pdf`;
    return { buffer, folio: cotizacion.folio, filename };
  }

  async mensajeDesdePlantilla(ctx: OrgContext, cotizacionId: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_GENERAR_DOCUMENTO);
    const orgId = ctx.organizacionId;

    const cotizacion = await this.cargarCotizacion(orgId, cotizacionId);
    this.assertEstadoDocumento(cotizacion);

    const plantilla = await this.plantillaRepo.findOne({
      where: {
        organizacionId: orgId,
        esPredeterminada: true,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
    if (!plantilla) {
      throw plantillaPredeterminadaRequerida();
    }

    const config = plantillaDocumentoConfigSchema.parse(
      plantilla.configuracion,
    );
    const org = await this.orgRepo.findOneOrFail({ where: { id: orgId } });
    const datos = await this.datosDesdeCotizacion(org, cotizacion, config);
    const render = renderizarDocumento(config, datos);

    return {
      texto: render.textoWhatsapp,
      cotizacionId: cotizacion.id,
      folio: cotizacion.folio,
      estado: cotizacion.estado,
      generadoAt: new Date().toISOString(),
    };
  }

  async documentoResumen(orgId: string, cotizacionId: string) {
    const doc = await this.documentoRepo.findOne({
      where: {
        organizacionId: orgId,
        cotizacionId,
        formato: FormatoDocumento.PDF,
      },
    });
    if (!doc) return null;
    return {
      id: doc.id,
      plantillaVersion: doc.plantillaVersion,
      hashContenido: doc.hashContenido,
      tamanoBytes: doc.tamanoBytes,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  private async datosDesdeCotizacion(
    org: Organizacion,
    cotizacion: Cotizacion,
    config: PlantillaDocumentoConfig,
  ): Promise<DatosRenderDocumento> {
    const lineas = await this.lineaRepo.find({
      where: {
        organizacionId: org.id,
        cotizacionId: cotizacion.id,
        activa: true,
      },
      order: { orden: 'ASC' },
    });

    const unidadIds = [
      ...new Set(
        lineas
          .map((l) => l.unidadMedidaId)
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    const unidades =
      unidadIds.length > 0
        ? await this.unidadRepo.find({ where: { id: In(unidadIds) } })
        : [];
    const unidadPorId = new Map(unidades.map((u) => [u.id, u]));

    const monedaIds = [
      cotizacion.monedaBaseId,
      cotizacion.monedaPresentacionId,
    ].filter((x): x is string => Boolean(x));
    const monedas = await this.monedaRepo.find({
      where: { id: In(monedaIds) },
    });
    const monedaPorId = new Map(monedas.map((m) => [m.id, m]));

    let clienteNombre =
      cotizacion.nombreClienteLibre?.trim() || 'Cliente';
    if (cotizacion.clienteId) {
      const cliente = await this.clienteRepo.findOne({
        where: { id: cotizacion.clienteId, organizacionId: org.id },
      });
      if (cliente) clienteNombre = cliente.nombre;
    }

    return {
      clienteNombre,
      folio: cotizacion.folio,
      vigenciaHasta: cotizacion.vigenciaHasta?.toISOString() ?? null,
      locale: org.locale,
      monedaBaseCodigo:
        monedaPorId.get(cotizacion.monedaBaseId)?.codigoIso ?? 'USD',
      subtotal: String(cotizacion.subtotal),
      descuentoTotal: String(cotizacion.descuentoTotal),
      impuestoTotal: String(cotizacion.impuestoTotal),
      total: String(cotizacion.total),
      totalPresentacion: cotizacion.totalPresentacion
        ? String(cotizacion.totalPresentacion)
        : null,
      monedaPresentacionCodigo: cotizacion.monedaPresentacionId
        ? (monedaPorId.get(cotizacion.monedaPresentacionId)?.codigoIso ??
          null)
        : null,
      tasaAplicada: cotizacion.tasaAplicada ?? null,
      tasaFecha: cotizacion.tasaFecha ?? null,
      logoUrlEfectivo:
        config.identidad.logoUrl ?? org.logoUrl ?? null,
      textoCondicionesCotizacion: cotizacion.textoCondiciones ?? null,
      textoPieCotizacion: cotizacion.textoPie ?? null,
      lineas: lineas.map((l) => ({
        orden: l.orden,
        sku: l.sku,
        descripcion: l.descripcion ?? l.textoSolicitado,
        marca: l.marcaCongelada ?? null,
        unidadCodigo: l.unidadMedidaId
          ? (unidadPorId.get(l.unidadMedidaId)?.codigo ?? 'und')
          : 'und',
        cantidad: String(l.cantidad),
        precioUnitario: String(l.precioUnitario ?? '0.0000'),
        descuentoMonto: String(l.descuentoMonto ?? '0.0000'),
        totalLinea: String(l.total ?? l.subtotal ?? '0.0000'),
        atributos: l.atributosCongelados ?? null,
      })),
    };
  }

  private assertEstadoDocumento(cotizacion: Cotizacion) {
    if (
      cotizacion.anulado ||
      cotizacion.estado === EstadoCotizacion.ANULADA ||
      cotizacion.estado === EstadoCotizacion.BORRADOR ||
      !ESTADOS_DOCUMENTO.includes(cotizacion.estado)
    ) {
      throw cotizacionNoAprobadaParaDocumento({ estado: cotizacion.estado });
    }
  }

  private async cargarCotizacion(orgId: string, id: string) {
    const cotizacion = await this.cotizacionRepo.findOne({
      where: { id, organizacionId: orgId },
    });
    if (!cotizacion) throw cotizacionNoEncontrada();
    await aplicarVencimientoPerezoso(this.dataSource, cotizacion);
    return cotizacion;
  }

  private async cargarPlantilla(orgId: string, id: string) {
    const plantilla = await this.plantillaRepo.findOne({
      where: { id, organizacionId: orgId },
    });
    if (!plantilla) throw plantillaNoEncontrada();
    return plantilla;
  }

  private mapDetalle(p: PlantillaDocumento) {
    return {
      id: p.id,
      nombre: p.nombre,
      esPredeterminada: p.esPredeterminada,
      version: p.version,
      configuracion: p.configuracion,
      estadoRegistro: p.estadoRegistro,
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private pdfTimeoutMs(): number {
    const raw = process.env.PDF_TIMEOUT_MS;
    const n = raw ? Number(raw) : 30_000;
    return Number.isFinite(n) && n > 0 ? n : 30_000;
  }

  private mapearErrorPdf(err: unknown): never {
    if (err instanceof PdfTimeoutError || (err as Error)?.name === 'PdfTimeoutError') {
      throw pdfTimeout();
    }
    if (
      err instanceof PdfGeneracionError ||
      (err as Error)?.message === 'PDF_TIMEOUT'
    ) {
      if ((err as Error).message === 'PDF_TIMEOUT') throw pdfTimeout();
      throw pdfGeneracionFallida({
        causa: err instanceof Error ? err.message : String(err),
      });
    }
    throw pdfGeneracionFallida({
      causa: err instanceof Error ? err.message : String(err),
    });
  }

  private mapearErrorZod(err: unknown): never {
    if (!(err instanceof ZodError)) {
      throw plantillaConfiguracionInvalida(err);
    }
    for (const issue of err.issues) {
      const msg = issue.message;
      if (msg === 'MARCADOR_NO_PERMITIDO') {
        const marcador =
          (issue as { params?: { marcador?: string } }).params?.marcador ??
          'desconocido';
        throw marcadorNoPermitido(marcador);
      }
      if (msg === 'COLUMNA_ATRIBUTO_SIN_CODIGO') {
        throw columnaAtributoSinCodigo();
      }
      if (msg === 'COLUMNAS_INSUFICIENTES') {
        throw columnasInsuficientes(issue);
      }
      if (msg === 'COLUMNAS_ORDEN_DUPLICADO') {
        throw columnasOrdenDuplicado(issue);
      }
      if (msg === 'COLOR_INVALIDO' || issue.code === 'invalid_string') {
        const path = issue.path.join('.');
        if (path.includes('color') || msg === 'COLOR_INVALIDO') {
          throw colorInvalido(issue);
        }
      }
    }
    throw plantillaConfiguracionInvalida(err.flatten());
  }
}

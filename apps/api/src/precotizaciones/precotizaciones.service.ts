import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CanalSolicitud,
  Cliente,
  ConfiguracionCotizacion,
  Cotizacion,
  CotizacionEvento,
  CotizacionLinea,
  CotizacionLineaCandidato,
  DocumentoGenerado,
  EstadoCotizacion,
  EstadoRegistro,
  EstadoResolucionLinea,
  EstadoSolicitud,
  FormatoDocumento,
  InterpretacionSolicitud,
  Item,
  ItemAlias,
  ListaPrecio,
  Organizacion,
  OrigenMatch,
  PlantillaDocumento,
  PrecioItem,
  ReglaDescuento,
  SecuenciaFolio,
  Solicitud,
  Sucursal,
  TasaCambio,
  TerminoNoResuelto,
  TipoEventoCotizacion,
  UnidadMedida,
  Usuario,
} from '@cotizador/database';
import {
  type OrgContext,
  type ReglaDescuentoCalculo,
  PERMISOS,
  calcularCotizacion,
  clienteInactivo,
  clienteNoEncontrado,
  clienteONombreRequerido,
  cotizacionNoEncontrada,
  crearPrecotizacionSchema,
  formatConfianza,
  formatImporte,
  folioNoDisponible,
  formatearFolio,
  listaPrecioCapturaInactiva,
  listaPrecioNoEncontrada,
  listaPrecioNoResoluble,
  listarCotizacionesQuerySchema,
  MAX_TEXTO_SOLICITUD,
  normalizarTexto,
  normalizarTextoSolicitud,
  periodoInvalido,
  reprocesarPrecotizacionSchema,
  requireOrganizacionContext,
  requirePermission,
  solicitudNoEncontrada,
  solicitudTextoDemasiadoLargo,
  solicitudTextoSinContenido,
  solicitudTextoVacio,
  sucursalNoAccesible,
  sucursalNoEncontradaHistorial,
} from '@cotizador/shared';
import { DataSource, In, Repository } from 'typeorm';
import {
  aplicarVencimientoPerezoso,
  marcarVencidasPendientesOrganizacion,
} from './cotizacion-vencimiento';
import { ExtraccionIaService } from './extraccion-ia.service';
import {
  mapCotizacionDetalle,
  mapInterpretacionResumen,
  resumenResolucion,
} from './precotizaciones.mapper';
import { ResolucionCatalogoService } from './resolucion-catalogo.service';

type FolioConfig = { prefijo?: string; longitudNumero?: number };

@Injectable()
export class PrecotizacionesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly extraccion: ExtraccionIaService,
    private readonly resolucion: ResolucionCatalogoService,
    @InjectRepository(Solicitud)
    private readonly solicitudRepo: Repository<Solicitud>,
    @InjectRepository(Cotizacion)
    private readonly cotizacionRepo: Repository<Cotizacion>,
    @InjectRepository(CotizacionLinea)
    private readonly lineaRepo: Repository<CotizacionLinea>,
    @InjectRepository(CotizacionLineaCandidato)
    private readonly candidatoRepo: Repository<CotizacionLineaCandidato>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(InterpretacionSolicitud)
    private readonly interpretacionRepo: Repository<InterpretacionSolicitud>,
    @InjectRepository(DocumentoGenerado)
    private readonly documentoRepo: Repository<DocumentoGenerado>,
  ) {}

  async crear(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_CREAR);

    const input = crearPrecotizacionSchema.parse(body);
    const textoOriginal = input.textoOriginal.trim();
    if (!textoOriginal) throw solicitudTextoVacio();
    if (textoOriginal.length > MAX_TEXTO_SOLICITUD) {
      throw solicitudTextoDemasiadoLargo();
    }
    if (!input.clienteId && !input.nombreClienteLibre?.trim()) {
      throw clienteONombreRequerido();
    }

    const textoNormalizado = normalizarTextoSolicitud(textoOriginal);
    if (!textoNormalizado) throw solicitudTextoSinContenido();

    const orgId = ctx.organizacionId!;
    const captura = await this.resolverCaptura(ctx, {
      clienteId: input.clienteId,
      nombreClienteLibre: input.nombreClienteLibre,
      telefonoClienteLibre: input.telefonoClienteLibre,
      listaPrecioId: input.listaPrecioId,
      sucursalId: input.sucursalId,
      canal: input.canal ?? 'WHATSAPP_PEGADO',
    });

    return this.ejecutarPipeline(ctx, {
      solicitudExistente: null,
      textoOriginal,
      textoNormalizado,
      ...captura,
    });
  }

  async reprocesar(ctx: OrgContext, solicitudId: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_CREAR);

    const input = reprocesarPrecotizacionSchema.parse(body ?? {});
    const orgId = ctx.organizacionId!;

    const solicitud = await this.solicitudRepo.findOne({
      where: { id: solicitudId, organizacionId: orgId },
    });
    if (!solicitud) throw solicitudNoEncontrada();

    const captura = await this.resolverCaptura(ctx, {
      clienteId: solicitud.clienteId ?? undefined,
      nombreClienteLibre: undefined,
      telefonoClienteLibre: undefined,
      listaPrecioId: input.listaPrecioId,
      sucursalId: input.sucursalId ?? solicitud.sucursalId ?? undefined,
      canal: solicitud.canal,
      // En reproceso, si no hay cliente, se recupera nombre libre de la última cotización
      recuperarLibreDeSolicitud: true,
      solicitudId: solicitud.id,
    });

    // Si la captura no trajo nombre libre y no hay cliente, buscar en cotización previa
    if (!captura.clienteId && !captura.nombreClienteLibre) {
      const prev = await this.cotizacionRepo.findOne({
        where: { solicitudId: solicitud.id, organizacionId: orgId },
        order: { createdAt: 'DESC' },
      });
      captura.nombreClienteLibre = prev?.nombreClienteLibre ?? 'Cliente';
      captura.telefonoClienteLibre = prev?.telefonoClienteLibre ?? null;
    }

    return this.ejecutarPipeline(ctx, {
      solicitudExistente: solicitud,
      textoOriginal: solicitud.textoOriginal,
      textoNormalizado: solicitud.textoNormalizado,
      ...captura,
    });
  }

  async listarCotizaciones(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_VER);

    const parsed = listarCotizacionesQuerySchema.safeParse(query);
    if (!parsed.success) {
      const desdeHasta = parsed.error.issues.some(
        (i) => i.path[0] === 'desde' || i.path[0] === 'hasta',
      );
      if (desdeHasta) throw periodoInvalido(parsed.error.flatten());
      throw parsed.error;
    }
    const input = parsed.data;
    if (
      input.desde &&
      input.hasta &&
      input.desde.getTime() > input.hasta.getTime()
    ) {
      throw periodoInvalido({ desde: input.desde, hasta: input.hasta });
    }

    const orgId = ctx.organizacionId!;

    if (input.clienteId) {
      const cliente = await this.dataSource.getRepository(Cliente).findOne({
        where: { id: input.clienteId, organizacionId: orgId },
      });
      if (!cliente) throw clienteNoEncontrado();
    }

    if (input.sucursalId) {
      if (!ctx.sucursalIds.includes(input.sucursalId)) {
        throw sucursalNoEncontradaHistorial();
      }
      const sucursal = await this.dataSource.getRepository(Sucursal).findOne({
        where: { id: input.sucursalId, organizacionId: orgId },
      });
      if (!sucursal) throw sucursalNoEncontradaHistorial();
    }

    const vencidasMarcadas = await marcarVencidasPendientesOrganizacion(
      this.dataSource,
      orgId,
    );

    const qb = this.cotizacionRepo
      .createQueryBuilder('c')
      .leftJoin(Cliente, 'cli', 'cli.id = c.clienteId AND cli.organizacionId = c.organizacionId')
      .where('c.organizacionId = :orgId', { orgId });

    if (input.estado?.length) {
      qb.andWhere('c.estado IN (:...estados)', { estados: input.estado });
    }

    if (input.clienteId) {
      qb.andWhere('c.clienteId = :clienteId', { clienteId: input.clienteId });
    }

    if (input.desde) {
      qb.andWhere('c.createdAt >= :desde', { desde: input.desde });
    }
    if (input.hasta) {
      qb.andWhere('c.createdAt <= :hasta', { hasta: input.hasta });
    }

    if (input.usuarioId) {
      if (input.rolUsuario === 'APROBADOR') {
        qb.andWhere('c.aprobadaPorId = :usuarioId', {
          usuarioId: input.usuarioId,
        });
      } else {
        qb.andWhere('c.createdById = :usuarioId', {
          usuarioId: input.usuarioId,
        });
      }
    }

    if (input.sucursalId) {
      qb.andWhere('c.sucursalId = :sucursalId', {
        sucursalId: input.sucursalId,
      });
    }

    if (input.anulado === true) {
      qb.andWhere('c.anulado = true');
    }

    if (input.search) {
      const term = `%${input.search}%`;
      qb.andWhere(
        `(c.folio ILIKE :term OR COALESCE(cli.nombre, c.nombreClienteLibre, '') ILIKE :term)`,
        { term },
      );
    }

    qb.orderBy('c.createdAt', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);

    const [rows, total] = await qb.getManyAndCount();

    // Relajar joins: TypeORM no hidrata cli/u en la entidad Cotizacion;
    // pedimos nombres en una pasada aparte si hace falta.
    const clienteIds = [
      ...new Set(
        rows
          .map((c) => c.clienteId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const usuarioIds = [
      ...new Set(
        rows
          .map((c) => c.createdById)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const clientes =
      clienteIds.length > 0
        ? await this.dataSource.getRepository(Cliente).find({
            where: { id: In(clienteIds), organizacionId: orgId },
          })
        : [];
    const usuarios =
      usuarioIds.length > 0
        ? await this.dataSource.getRepository(Usuario).find({
            where: { id: In(usuarioIds) },
          })
        : [];
    const clientePorId = new Map(clientes.map((c) => [c.id, c]));
    const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));

    const items = rows.map((c) => {
      const cli = c.clienteId ? clientePorId.get(c.clienteId) : undefined;
      const usr = c.createdById ? usuarioPorId.get(c.createdById) : undefined;
      return {
        id: c.id,
        folio: c.folio,
        folioNumero: c.folioNumero,
        estado: c.estado,
        total: formatImporte(c.total ?? '0'),
        anulado: c.anulado,
        clienteId: c.clienteId ?? null,
        nombreCliente:
          cli?.nombre?.trim() || c.nombreClienteLibre?.trim() || null,
        sucursalId: c.sucursalId,
        vigenciaHasta: c.vigenciaHasta
          ? c.vigenciaHasta.toISOString()
          : null,
        createdAt: c.createdAt.toISOString(),
        createdById: c.createdById ?? null,
        aprobadaPorId: c.aprobadaPorId ?? null,
        usuarioNombre: usr?.nombreCompleto ?? null,
      };
    });

    return {
      items,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit) || 0,
      },
      vencidasMarcadas,
    };
  }

  async obtenerCotizacion(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_VER);

    const orgId = ctx.organizacionId!;
    const cotizacion = await this.cotizacionRepo.findOne({
      where: { id, organizacionId: orgId },
    });
    if (!cotizacion) throw cotizacionNoEncontrada();

    await aplicarVencimientoPerezoso(this.dataSource, cotizacion);

    const { detalle, lineas } = await this.cargarDetalle(orgId, cotizacion);

    const eventos = await this.dataSource.getRepository(CotizacionEvento).find({
      where: { cotizacionId: cotizacion.id, organizacionId: orgId },
      order: { createdAt: 'ASC' },
    });

    let interpretacion = null;
    if (cotizacion.solicitudId) {
      const ultima = await this.interpretacionRepo.findOne({
        where: {
          solicitudId: cotizacion.solicitudId,
          organizacionId: orgId,
        },
        order: { createdAt: 'DESC' },
      });
      if (ultima) interpretacion = mapInterpretacionResumen(ultima);
    }

    return {
      cotizacion: detalle,
      interpretacion,
      resumen: resumenResolucion(lineas),
      eventos: eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        descripcion: e.descripcion ?? null,
        datos: e.datos ?? null,
        usuarioId: e.usuarioId ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  private async ejecutarPipeline(
    ctx: OrgContext,
    params: {
      solicitudExistente: Solicitud | null;
      textoOriginal: string;
      textoNormalizado: string;
      clienteId: string | null;
      nombreClienteLibre: string | null;
      telefonoClienteLibre: string | null;
      listaPrecioId: string;
      sucursalId: string;
      canal: CanalSolicitud | string;
      organizacion: Organizacion;
      configuracion: ConfiguracionCotizacion;
      unidadesValidas: string[];
      folioConfig: FolioConfig;
      fechaReferencia: string;
      tasa: { valor: string; fecha: string } | null;
    },
  ) {
    const orgId = ctx.organizacionId!;

    // Etapa 2 — extracción (fuera de la TX de persistencia; el fallo se persiste)
    const extraccion = await this.extraccion.extraer({
      textoNormalizado: params.textoNormalizado,
      unidadesValidas: params.unidadesValidas,
      usaIa: params.organizacion.usaIa,
      verticalCodigo: params.organizacion.vertical?.codigo ?? null,
      nombreVertical: params.organizacion.vertical?.nombre ?? null,
    });

    // Etapa 3 — resolución
    const umbrales = {
      umbralAutomatico: Number(params.organizacion.umbralAutomatico),
      umbralDescarte: Number(params.organizacion.umbralDescarte),
    };

    type LineaResuelta = {
      textoSolicitado: string;
      cantidad: string;
      unidadCodigo?: string;
      notas?: string;
      resolucion: Awaited<ReturnType<ResolucionCatalogoService['resolverLinea']>>;
    };

    const lineasResueltas: LineaResuelta[] = [];
    if (extraccion.exito) {
      for (const linea of extraccion.lineas) {
        const resolucion = await this.resolucion.resolverLinea(
          orgId,
          linea.textoSolicitado,
          umbrales,
        );
        lineasResueltas.push({
          textoSolicitado: linea.textoSolicitado,
          cantidad: Number(linea.cantidad.replace(',', '.')).toFixed(4),
          unidadCodigo: linea.unidad,
          notas: linea.notas,
          resolucion,
        });
      }
    }

    // Cargar items y precios para el motor
    const itemIds = [
      ...new Set(
        lineasResueltas
          .map((l) => l.resolucion.itemId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const items =
      itemIds.length > 0
        ? await this.itemRepo.find({
            where: { id: In(itemIds), organizacionId: orgId },
            relations: ['unidadMedida'],
          })
        : [];
    const itemsPorId = new Map(items.map((i) => [i.id, i]));

    const precios =
      itemIds.length > 0
        ? await this.dataSource.getRepository(PrecioItem).find({
            where: {
              organizacionId: orgId,
              listaPrecioId: params.listaPrecioId,
              itemId: In(itemIds),
              estadoRegistro: EstadoRegistro.ACTIVO,
            },
          })
        : [];
    const precioPorItem = new Map(precios.map((p) => [p.itemId, p.precio]));

    const reglasEnt = await this.dataSource.getRepository(ReglaDescuento).find({
      where: {
        organizacionId: orgId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
    const reglas: ReglaDescuentoCalculo[] = reglasEnt.map((r) => ({
      id: r.id,
      listaPrecioId: r.listaPrecioId,
      ambito: r.ambito,
      referenciaId: r.referenciaId,
      cantidadMinima: r.cantidadMinima,
      cantidadMaxima: r.cantidadMaxima,
      tipoDescuento: r.tipoDescuento,
      valor: r.valor,
      prioridad: r.prioridad,
      vigenciaDesde: r.vigenciaDesde,
      vigenciaHasta: r.vigenciaHasta,
      estadoRegistro: r.estadoRegistro,
      nombre: r.nombre,
    }));

    // Unidades por código
    const unidades = await this.dataSource.getRepository(UnidadMedida).find({
      where: { organizacionId: orgId, estadoRegistro: EstadoRegistro.ACTIVO },
    });
    const unidadPorCodigo = new Map(
      unidades.map((u) => [u.codigo.toUpperCase(), u]),
    );

    // Etapa 4 — motor de precios (solo líneas con item)
    const lineasMotor = lineasResueltas
      .filter((l) => l.resolucion.itemId)
      .map((l) => {
        const item = itemsPorId.get(l.resolucion.itemId!)!;
        return {
          id: l.textoSolicitado,
          itemId: item.id,
          cantidad: l.cantidad,
          precioLista: precioPorItem.get(item.id) ?? null,
          categoriaId: item.categoriaId,
          marcaId: item.marcaId,
          listaPrecioId: params.listaPrecioId,
        };
      });

    const calculo = calcularCotizacion({
      lineas: lineasMotor,
      reglas,
      configuracion: {
        aplicaImpuesto: params.configuracion.aplicaImpuesto,
        porcentajeImpuesto: params.configuracion.porcentajeImpuesto,
        preciosIncluyenImpuesto: params.configuracion.preciosIncluyenImpuesto,
        decimalesRedondeo: params.configuracion.decimalesRedondeo,
        modoRedondeo: params.configuracion.modoRedondeo,
      },
      fechaReferencia: params.fechaReferencia,
      tasa: params.tasa ? { valor: params.tasa.valor } : null,
    });

    const calculoPorTexto = new Map(
      calculo.lineas.map((l) => [l.id ?? l.itemId, l]),
    );

    // Etapa 5 — ensamblado transaccional
    const resultado = await this.dataSource.transaction(async (manager) => {
      let solicitud = params.solicitudExistente;
      if (!solicitud) {
        solicitud = manager.create(Solicitud, {
          organizacionId: orgId,
          sucursalId: params.sucursalId,
          clienteId: params.clienteId,
          canal: params.canal as CanalSolicitud,
          textoOriginal: params.textoOriginal,
          textoNormalizado: params.textoNormalizado,
          estado: extraccion.exito
            ? EstadoSolicitud.INTERPRETADA
            : EstadoSolicitud.FALLIDA,
          recibidaAt: new Date(),
          createdById: ctx.usuarioId,
          updatedById: ctx.usuarioId,
        });
        await manager.save(solicitud);
      } else {
        solicitud.estado = extraccion.exito
          ? EstadoSolicitud.INTERPRETADA
          : EstadoSolicitud.FALLIDA;
        solicitud.updatedById = ctx.usuarioId;
        await manager.save(solicitud);
      }

      const interpretacion = manager.create(InterpretacionSolicitud, {
        organizacionId: orgId,
        solicitudId: solicitud.id,
        proveedor: extraccion.proveedor,
        modelo: extraccion.modelo,
        versionPrompt: extraccion.versionPrompt,
        exito: extraccion.exito,
        resultado: extraccion.resultadoCrudo,
        advertencias: extraccion.advertencias,
        errorCodigo: extraccion.errorCodigo,
        errorDetalle: extraccion.errorDetalle,
        latenciaMs: extraccion.latenciaMs,
        tokensEntrada: extraccion.tokensEntrada ?? null,
        tokensSalida: extraccion.tokensSalida ?? null,
        costoEstimado: extraccion.costoEstimado ?? null,
        createdById: ctx.usuarioId,
      });
      await manager.save(interpretacion);

      // Folio con bloqueo de fila
      let secuencia = await manager
        .createQueryBuilder(SecuenciaFolio, 's')
        .setLock('pessimistic_write')
        .where('s.organizacionId = :orgId', { orgId })
        .getOne();
      if (!secuencia) {
        secuencia = manager.create(SecuenciaFolio, {
          organizacionId: orgId,
          ultimoNumero: 0,
        });
        await manager.save(secuencia);
        secuencia = await manager
          .createQueryBuilder(SecuenciaFolio, 's')
          .setLock('pessimistic_write')
          .where('s.organizacionId = :orgId', { orgId })
          .getOne();
      }
      if (!secuencia) {
        throw folioNoDisponible();
      }
      secuencia.ultimoNumero += 1;
      await manager.save(secuencia);
      const folioNumero = secuencia.ultimoNumero;
      const folio = formatearFolio(folioNumero, params.folioConfig);

      const descuentoTotal = calculo.lineas.reduce(
        (acc, l) => acc + Number(l.descuentoMonto || 0),
        0,
      );

      const cotizacion = manager.create(Cotizacion, {
        organizacionId: orgId,
        sucursalId: params.sucursalId,
        folioNumero,
        folio,
        solicitudId: solicitud.id,
        clienteId: params.clienteId,
        nombreClienteLibre: params.clienteId
          ? null
          : params.nombreClienteLibre,
        telefonoClienteLibre: params.clienteId
          ? null
          : params.telefonoClienteLibre,
        listaPrecioId: params.listaPrecioId,
        monedaBaseId: params.organizacion.monedaBaseId,
        monedaPresentacionId: params.organizacion.monedaPresentacionId ?? null,
        tasaAplicada: params.tasa?.valor ?? null,
        tasaFecha: params.tasa?.fecha ?? null,
        estado: EstadoCotizacion.BORRADOR,
        vigenciaHasta: null,
        subtotal: calculo.subtotal,
        descuentoTotal: formatImporte(descuentoTotal),
        impuestoTotal: calculo.impuestoTotal,
        total: calculo.total,
        totalPresentacion: calculo.totalPresentacion,
        porcentajeImpuestoAplicado: params.configuracion.aplicaImpuesto
          ? formatImporte(params.configuracion.porcentajeImpuesto)
          : formatImporte(0),
        createdById: ctx.usuarioId,
        updatedById: ctx.usuarioId,
      });
      await manager.save(cotizacion);

      const lineasGuardadas: CotizacionLinea[] = [];
      const candidatosMap = new Map<string, CotizacionLineaCandidato[]>();
      const aliasIdsAIncrementar = new Set<string>();

      for (let i = 0; i < lineasResueltas.length; i++) {
        const lr = lineasResueltas[i];
        const item = lr.resolucion.itemId
          ? itemsPorId.get(lr.resolucion.itemId)
          : undefined;
        const calc = calculoPorTexto.get(lr.textoSolicitado);

        let unidadMedidaId = item?.unidadMedidaId ?? null;
        if (lr.unidadCodigo) {
          const u = unidadPorCodigo.get(lr.unidadCodigo.toUpperCase());
          if (u) unidadMedidaId = u.id;
        }

        const estadoResolucion = lr.resolucion
          .estadoResolucion as EstadoResolucionLinea;

        const linea = manager.create(CotizacionLinea, {
          organizacionId: orgId,
          cotizacionId: cotizacion.id,
          orden: i + 1,
          textoSolicitado: lr.textoSolicitado,
          itemId: lr.resolucion.itemId,
          descripcion: item?.nombre ?? null,
          sku: item?.sku ?? null,
          unidadMedidaId,
          cantidad: lr.cantidad,
          precioLista: calc?.precioLista ?? null,
          precioUnitario: calc?.precioUnitario ?? null,
          reglaDescuentoId: calc?.reglaDescuentoId ?? null,
          descuentoMonto: calc?.descuentoMonto ?? formatImporte(0),
          subtotal: calc?.subtotal ?? null,
          total: calc?.subtotal ?? null,
          estadoResolucion,
          confianza: formatConfianza(lr.resolucion.confianza),
          origenMatch: lr.resolucion.origenMatch
            ? (lr.resolucion.origenMatch as OrigenMatch)
            : null,
          notas: lr.notas ?? null,
          activa: true,
          createdById: ctx.usuarioId,
          updatedById: ctx.usuarioId,
        });
        await manager.save(linea);
        lineasGuardadas.push(linea);

        if (lr.resolucion.aliasIdUsado) {
          aliasIdsAIncrementar.add(lr.resolucion.aliasIdUsado);
        }

        const cands: CotizacionLineaCandidato[] = [];
        for (let o = 0; o < lr.resolucion.candidatos.length; o++) {
          const c = lr.resolucion.candidatos[o];
          const cand = manager.create(CotizacionLineaCandidato, {
            organizacionId: orgId,
            cotizacionLineaId: linea.id,
            itemId: c.itemId,
            puntaje: formatConfianza(c.puntaje),
            origenMatch: c.origenMatch as OrigenMatch,
            orden: o + 1,
          });
          await manager.save(cand);
          cands.push(cand);
        }
        candidatosMap.set(linea.id, cands);

        // Términos no resueltos
        if (estadoResolucion === EstadoResolucionLinea.NO_ENCONTRADA) {
          const textoNorm = normalizarTexto(lr.textoSolicitado);
          if (textoNorm) {
            let termino = await manager.findOne(TerminoNoResuelto, {
              where: { organizacionId: orgId, textoNormalizado: textoNorm },
            });
            if (termino) {
              termino.vecesVisto += 1;
              termino.ultimaVezAt = new Date();
              termino.ejemploOriginal = lr.textoSolicitado;
              termino.updatedById = ctx.usuarioId;
              await manager.save(termino);
            } else {
              termino = manager.create(TerminoNoResuelto, {
                organizacionId: orgId,
                textoNormalizado: textoNorm,
                ejemploOriginal: lr.textoSolicitado,
                vecesVisto: 1,
                ultimaVezAt: new Date(),
                estadoRegistro: EstadoRegistro.ACTIVO,
                createdById: ctx.usuarioId,
                updatedById: ctx.usuarioId,
              });
              await manager.save(termino);
            }
          }
        }
      }

      for (const aliasId of aliasIdsAIncrementar) {
        await manager.increment(ItemAlias, { id: aliasId }, 'vecesUsado', 1);
      }

      await manager.save(
        manager.create(CotizacionEvento, {
          organizacionId: orgId,
          cotizacionId: cotizacion.id,
          tipo: TipoEventoCotizacion.CREADA,
          descripcion: 'Cotización borrador creada por precotización',
          datos: { solicitudId: solicitud.id, interpretacionId: interpretacion.id },
          usuarioId: ctx.usuarioId,
        }),
      );

      if (extraccion.exito) {
        await manager.save(
          manager.create(CotizacionEvento, {
            organizacionId: orgId,
            cotizacionId: cotizacion.id,
            tipo: TipoEventoCotizacion.INTERPRETADA,
            descripcion: 'Interpretación de solicitud exitosa',
            datos: {
              interpretacionId: interpretacion.id,
              lineas: lineasGuardadas.length,
            },
            usuarioId: ctx.usuarioId,
          }),
        );
      }

      return { cotizacion, interpretacion, lineas: lineasGuardadas, candidatosMap };
    });

    // Completar mapa de items de candidatos
    const candItemIds = [
      ...new Set(
        [...resultado.candidatosMap.values()]
          .flat()
          .map((c) => c.itemId),
      ),
    ];
    const missing = candItemIds.filter((id) => !itemsPorId.has(id));
    if (missing.length > 0) {
      const extra = await this.itemRepo.find({
        where: { id: In(missing), organizacionId: orgId },
      });
      for (const i of extra) itemsPorId.set(i.id, i);
    }

    const detalle = mapCotizacionDetalle(
      resultado.cotizacion,
      resultado.lineas,
      resultado.candidatosMap,
      itemsPorId,
    );

    return {
      cotizacion: detalle,
      interpretacion: mapInterpretacionResumen(resultado.interpretacion),
      resumen: resumenResolucion(resultado.lineas),
    };
  }

  private async resolverCaptura(
    ctx: OrgContext,
    input: {
      clienteId?: string;
      nombreClienteLibre?: string;
      telefonoClienteLibre?: string;
      listaPrecioId?: string;
      sucursalId?: string;
      canal: CanalSolicitud | string;
      recuperarLibreDeSolicitud?: boolean;
      solicitudId?: string;
    },
  ) {
    const orgId = ctx.organizacionId!;

    const organizacion = await this.dataSource
      .getRepository(Organizacion)
      .findOne({
        where: { id: orgId },
        relations: { vertical: true },
      });
    if (!organizacion) throw solicitudNoEncontrada();

    const configuracion = await this.dataSource
      .getRepository(ConfiguracionCotizacion)
      .findOne({ where: { organizacionId: orgId } });
    if (!configuracion) throw listaPrecioNoResoluble();

    // Sucursal
    let sucursalId = input.sucursalId ?? ctx.sucursalActivaId;
    if (!sucursalId) throw sucursalNoAccesible();
    if (!ctx.sucursalIds.includes(sucursalId)) throw sucursalNoAccesible();

    // Cliente
    let clienteId: string | null = null;
    let nombreClienteLibre: string | null =
      input.nombreClienteLibre?.trim() ?? null;
    let telefonoClienteLibre: string | null =
      input.telefonoClienteLibre?.trim() ?? null;
    let listaDelCliente: string | null = null;

    if (input.clienteId) {
      const cliente = await this.dataSource.getRepository(Cliente).findOne({
        where: { id: input.clienteId, organizacionId: orgId },
      });
      if (!cliente) throw clienteNoEncontrado();
      if (cliente.estadoRegistro !== EstadoRegistro.ACTIVO) {
        throw clienteInactivo();
      }
      clienteId = cliente.id;
      listaDelCliente = cliente.listaPrecioId ?? null;
    }

    // Lista de precios
    let listaPrecioId = input.listaPrecioId ?? null;
    if (listaPrecioId) {
      const lista = await this.dataSource.getRepository(ListaPrecio).findOne({
        where: { id: listaPrecioId, organizacionId: orgId },
      });
      if (!lista) throw listaPrecioNoEncontrada();
      if (lista.estadoRegistro !== EstadoRegistro.ACTIVO) {
        throw listaPrecioCapturaInactiva();
      }
    } else if (listaDelCliente) {
      const lista = await this.dataSource.getRepository(ListaPrecio).findOne({
        where: { id: listaDelCliente, organizacionId: orgId },
      });
      if (lista && lista.estadoRegistro === EstadoRegistro.ACTIVO) {
        listaPrecioId = lista.id;
      }
    }
    if (!listaPrecioId) {
      listaPrecioId = configuracion.listaPrecioPredeterminadaId ?? null;
      if (!listaPrecioId) {
        const pred = await this.dataSource.getRepository(ListaPrecio).findOne({
          where: {
            organizacionId: orgId,
            esPredeterminada: true,
            estadoRegistro: EstadoRegistro.ACTIVO,
          },
        });
        listaPrecioId = pred?.id ?? null;
      }
    }
    if (!listaPrecioId) throw listaPrecioNoResoluble();

    const unidades = await this.dataSource.getRepository(UnidadMedida).find({
      where: { organizacionId: orgId, estadoRegistro: EstadoRegistro.ACTIVO },
    });
    const unidadesValidas = unidades.map((u) => u.codigo);

    const plantilla = await this.dataSource
      .getRepository(PlantillaDocumento)
      .findOne({
        where: {
          organizacionId: orgId,
          esPredeterminada: true,
          estadoRegistro: EstadoRegistro.ACTIVO,
        },
      });
    const folioConfig = extraerFolioConfig(plantilla?.configuracion);

    const ahora = new Date();
    const fechaReferencia = ahora.toISOString().slice(0, 10);

    let tasa: { valor: string; fecha: string } | null = null;
    if (
      organizacion.monedaPresentacionId &&
      organizacion.monedaPresentacionId !== organizacion.monedaBaseId
    ) {
      const t = await this.dataSource
        .getRepository(TasaCambio)
        .createQueryBuilder('t')
        .where('t.organizacionId = :orgId', { orgId })
        .andWhere('t.monedaOrigenId = :origen', {
          origen: organizacion.monedaBaseId,
        })
        .andWhere('t.monedaDestinoId = :destino', {
          destino: organizacion.monedaPresentacionId,
        })
        .andWhere('t.estadoRegistro = :estado', {
          estado: EstadoRegistro.ACTIVO,
        })
        .andWhere('t.fechaVigencia <= :fecha', { fecha: fechaReferencia })
        .orderBy('t.fechaVigencia', 'DESC')
        .getOne();
      if (t) {
        tasa = { valor: t.valor, fecha: t.fechaVigencia };
      }
    }

    return {
      clienteId,
      nombreClienteLibre,
      telefonoClienteLibre,
      listaPrecioId,
      sucursalId,
      canal: input.canal,
      organizacion,
      configuracion,
      unidadesValidas,
      folioConfig,
      fechaReferencia,
      tasa,
    };
  }

  private async cargarDetalle(orgId: string, cotizacion: Cotizacion) {
    const lineas = await this.lineaRepo.find({
      where: {
        cotizacionId: cotizacion.id,
        organizacionId: orgId,
        activa: true,
      },
      order: { orden: 'ASC' },
    });
    const lineaIds = lineas.map((l) => l.id);
    const candidatos =
      lineaIds.length > 0
        ? await this.candidatoRepo.find({
            where: { cotizacionLineaId: In(lineaIds), organizacionId: orgId },
            order: { orden: 'ASC' },
          })
        : [];
    const candidatosMap = new Map<string, CotizacionLineaCandidato[]>();
    for (const c of candidatos) {
      const list = candidatosMap.get(c.cotizacionLineaId) ?? [];
      list.push(c);
      candidatosMap.set(c.cotizacionLineaId, list);
    }

    const itemIds = [
      ...new Set([
        ...lineas.map((l) => l.itemId).filter((id): id is string => Boolean(id)),
        ...candidatos.map((c) => c.itemId),
      ]),
    ];
    const items =
      itemIds.length > 0
        ? await this.itemRepo.find({
            where: { id: In(itemIds), organizacionId: orgId },
          })
        : [];
    const itemsPorId = new Map(items.map((i) => [i.id, i]));

    const documento = await this.documentoRepo.findOne({
      where: {
        organizacionId: orgId,
        cotizacionId: cotizacion.id,
        formato: FormatoDocumento.PDF,
      },
    });
    const documentoGenerado = documento
      ? {
          id: documento.id,
          plantillaVersion: documento.plantillaVersion,
          hashContenido: documento.hashContenido,
          tamanoBytes: documento.tamanoBytes,
          createdAt: documento.createdAt.toISOString(),
        }
      : null;

    return {
      detalle: mapCotizacionDetalle(
        cotizacion,
        lineas,
        candidatosMap,
        itemsPorId,
        documentoGenerado,
      ),
      lineas,
    };
  }
}

function extraerFolioConfig(
  configuracion: Record<string, unknown> | undefined,
): FolioConfig {
  if (!configuracion || typeof configuracion !== 'object') return {};
  const folio = configuracion.folio as
    | { prefijo?: string; longitudNumero?: number }
    | undefined;
  if (!folio) return {};
  return {
    prefijo: folio.prefijo,
    longitudNumero: folio.longitudNumero,
  };
}

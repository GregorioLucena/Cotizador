import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Cliente,
  ConfiguracionCotizacion,
  Cotizacion,
  CotizacionEvento,
  CotizacionLinea,
  CotizacionLineaCandidato,
  EstadoCotizacion,
  EstadoRegistro,
  EstadoResolucionLinea,
  Item,
  ListaPrecio,
  Marca,
  Moneda,
  Organizacion,
  OrigenAlias,
  OrigenMatch,
  PlantillaDocumento,
  PrecioItem,
  ReglaDescuento,
  SecuenciaFolio,
  TasaCambio,
  TipoEventoCotizacion,
  TipoItem,
  UnidadMedida,
} from '@cotizador/database';
import {
  type OrgContext,
  type ReglaDescuentoCalculo,
  type ResultadoCalculoCotizacion,
  MOTIVO_MIN_LENGTH,
  PERMISOS,
  agregarLineaCotizacionSchema,
  anularCotizacionSchema,
  aprobarCotizacionSchema,
  armarMensajeWhatsApp,
  borradorNoEditable,
  calcularCotizacion,
  cantidadIncompatibleConUnidad,
  cantidadInvalida,
  cantidadNoEntera,
  clienteInactivo,
  clienteNoEncontrado,
  cotizacionEstadoInvalido,
  cotizacionNoEncontrada,
  cotizacionSinLineas,
  editarCabeceraCotizacionSchema,
  editarLineaCotizacionSchema,
  folioNoDisponible,
  formatImporte,
  formatearFolio,
  formatConfianza,
  hasPermission,
  itemNoCotizable,
  itemNoEncontrado,
  lineaNoEncontrada,
  lineasSinPrecio,
  lineasSinResolver,
  listaPrecioCapturaInactiva,
  listaPrecioNoEncontrada,
  mensajeWhatsAppNoDisponible,
  motivoAnulacionRequerido,
  motivoPerdidaRequerido,
  motivoSobrescrituraRequerido,
  recalcularCotizacionSchema,
  registrarResultadoCotizacionSchema,
  requireOrganizacionContext,
  requirePermission,
  serializadoCantidadInvalida,
  sobrescrituraNoPermitida,
  totalesDesfasados,
  transicionEstadoInvalida,
  unidadMedidaInactiva,
} from '@cotizador/shared';
import { DataSource, In, Repository } from 'typeorm';
import { AliasService } from '../items/alias.service';
import { aplicarVencimientoPerezoso } from './cotizacion-vencimiento';
import { PrecotizacionesService } from './precotizaciones.service';

type FolioConfig = { prefijo?: string; longitudNumero?: number };

type TotalesParciales = { subtotal: string; total: string };
type TotalesCompletos = TotalesParciales & {
  descuentoTotal: string;
  impuestoTotal: string;
  totalPresentacion?: string | null;
};

function absDiff(a: string | number, b: string | number): number {
  return Math.abs(Number(a) - Number(b));
}

function toleranciaImporte(decimalesRedondeo: number): number {
  const escala = Math.max(0, Math.min(4, decimalesRedondeo));
  return 10 ** -escala;
}

function esCantidadEntera(cantidad: string): boolean {
  return Number.isInteger(Number(cantidad));
}

@Injectable()
export class CotizacionesRevisionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly precotizaciones: PrecotizacionesService,
    private readonly aliasService: AliasService,
    @InjectRepository(Cotizacion)
    private readonly cotizacionRepo: Repository<Cotizacion>,
    @InjectRepository(CotizacionLinea)
    private readonly lineaRepo: Repository<CotizacionLinea>,
    @InjectRepository(CotizacionLineaCandidato)
    private readonly candidatoRepo: Repository<CotizacionLineaCandidato>,
    @InjectRepository(CotizacionEvento)
    private readonly eventoRepo: Repository<CotizacionEvento>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
  ) {}

  async editarCabecera(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_EDITAR);
    const input = editarCabeceraCotizacionSchema.parse(body ?? {});
    const orgId = ctx.organizacionId!;

    const cotizacion = await this.cargarCotizacionBorrador(orgId, id);
    const contexto = await this.cargarContextoCalculo(orgId, cotizacion);

    if (input.listaPrecioId && input.listaPrecioId !== cotizacion.listaPrecioId) {
      const lista = await this.dataSource.getRepository(ListaPrecio).findOne({
        where: { id: input.listaPrecioId, organizacionId: orgId },
      });
      if (!lista) throw listaPrecioNoEncontrada();
      if (lista.estadoRegistro !== EstadoRegistro.ACTIVO) {
        throw listaPrecioCapturaInactiva();
      }
      cotizacion.listaPrecioId = lista.id;
      // Recargar precios con la nueva lista
      Object.assign(
        contexto,
        await this.cargarContextoCalculo(orgId, cotizacion),
      );
    }

    if (input.clienteId !== undefined) {
      if (input.clienteId === null) {
        cotizacion.clienteId = null;
      } else {
        const cliente = await this.dataSource.getRepository(Cliente).findOne({
          where: { id: input.clienteId, organizacionId: orgId },
        });
        if (!cliente) throw clienteNoEncontrado();
        if (cliente.estadoRegistro !== EstadoRegistro.ACTIVO) {
          throw clienteInactivo();
        }
        cotizacion.clienteId = cliente.id;
        cotizacion.nombreClienteLibre = null;
        cotizacion.telefonoClienteLibre = null;
      }
    }
    if (input.nombreClienteLibre !== undefined && !cotizacion.clienteId) {
      cotizacion.nombreClienteLibre = input.nombreClienteLibre;
    }
    if (input.telefonoClienteLibre !== undefined && !cotizacion.clienteId) {
      cotizacion.telefonoClienteLibre = input.telefonoClienteLibre;
    }
    if (input.observaciones !== undefined) {
      cotizacion.observaciones = input.observaciones;
    }
    if (input.textoCondiciones !== undefined) {
      cotizacion.textoCondiciones = input.textoCondiciones;
    }
    if (input.textoPie !== undefined) {
      cotizacion.textoPie = input.textoPie;
    }

    const lineas = await this.lineasActivas(orgId, cotizacion.id);
    const calculo = await this.recalcularYAplicar(
      ctx,
      cotizacion,
      lineas,
      contexto,
      {
        totalesCliente: input.totalesCliente,
        eventoTipo: TipoEventoCotizacion.RECALCULADA,
        eventoDescripcion: 'Cabecera actualizada y totales recalculados',
        eventoDatos: {
          listaPrecioId: cotizacion.listaPrecioId,
          clienteId: cotizacion.clienteId,
        },
      },
    );
    void calculo;
    return this.precotizaciones.obtenerCotizacion(ctx, cotizacion.id);
  }

  async agregarLinea(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_EDITAR);
    const input = agregarLineaCotizacionSchema.parse(body);
    const orgId = ctx.organizacionId!;

    const cotizacion = await this.cargarCotizacionBorrador(orgId, id);
    const item = await this.asegurarItemCotizable(orgId, input.itemId);
    const contexto = await this.cargarContextoCalculo(orgId, cotizacion);

    let unidadMedidaId = input.unidadMedidaId ?? item.unidadMedidaId;
    const unidad = await this.asegurarUnidad(orgId, unidadMedidaId);
    unidadMedidaId = unidad.id;

    const cantidad = this.normalizarCantidad(input.cantidad);
    this.validarCantidad(cantidad, unidad, item);

    const lineas = await this.lineasActivas(orgId, cotizacion.id);
    const orden =
      lineas.reduce((max, l) => Math.max(max, l.orden), 0) + 1;

    const nueva = this.lineaRepo.create({
      organizacionId: orgId,
      cotizacionId: cotizacion.id,
      orden,
      textoSolicitado: input.textoSolicitado?.trim() || item.nombre,
      itemId: item.id,
      descripcion: item.nombre,
      sku: item.sku,
      unidadMedidaId,
      cantidad,
      estadoResolucion: EstadoResolucionLinea.AGREGADA_MANUAL,
      confianza: formatConfianza(1),
      origenMatch: OrigenMatch.MANUAL,
      notas: input.notas ?? null,
      precioSobrescrito: false,
      descuentoMonto: formatImporte(0),
      activa: true,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });

    await this.dataSource.transaction(async (manager) => {
      await manager.save(nueva);
      lineas.push(nueva);
      await this.persistirRecalculo(manager, ctx, cotizacion, lineas, contexto, {
        totalesCliente: input.totalesCliente,
        eventos: [
          {
            tipo: TipoEventoCotizacion.LINEA_AGREGADA,
            descripcion: `Línea agregada: ${item.nombre}`,
            datos: { lineaId: nueva.id, itemId: item.id, cantidad },
          },
        ],
      });
    });

    return this.precotizaciones.obtenerCotizacion(ctx, cotizacion.id);
  }

  async editarLinea(
    ctx: OrgContext,
    id: string,
    lineaId: string,
    body: unknown,
  ) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_EDITAR);
    const input = editarLineaCotizacionSchema.parse(body);
    const orgId = ctx.organizacionId!;

    const cotizacion = await this.cargarCotizacionBorrador(orgId, id);
    const linea = await this.lineaRepo.findOne({
      where: {
        id: lineaId,
        cotizacionId: cotizacion.id,
        organizacionId: orgId,
        activa: true,
      },
    });
    if (!linea) throw lineaNoEncontrada();

    const contexto = await this.cargarContextoCalculo(orgId, cotizacion);
    const config = contexto.configuracion;
    const eventos: Array<{
      tipo: TipoEventoCotizacion;
      descripcion: string;
      datos: Record<string, unknown>;
    }> = [];

    let aliasAdvertencia: string | null = null;
    let itemCambiado = false;
    const itemAnteriorId = linea.itemId;

    // Elegir candidato
    if (input.candidatoItemId) {
      const cand = await this.candidatoRepo.findOne({
        where: {
          cotizacionLineaId: linea.id,
          itemId: input.candidatoItemId,
          organizacionId: orgId,
        },
      });
      if (!cand) throw itemNoEncontrado();
      const item = await this.asegurarItemCotizable(orgId, cand.itemId);
      this.asignarItemManual(linea, item);
      itemCambiado = true;
      eventos.push({
        tipo: TipoEventoCotizacion.LINEA_CORREGIDA,
        descripcion: `Candidato elegido: ${item.nombre}`,
        datos: {
          lineaId: linea.id,
          itemId: item.id,
          puntaje: cand.puntaje,
          origen: 'candidato',
        },
      });
    } else if (input.itemId) {
      const item = await this.asegurarItemCotizable(orgId, input.itemId);
      this.asignarItemManual(linea, item);
      itemCambiado = true;
      eventos.push({
        tipo: TipoEventoCotizacion.LINEA_CORREGIDA,
        descripcion: `Item asignado: ${item.nombre}`,
        datos: { lineaId: linea.id, itemId: item.id, origen: 'busqueda' },
      });
    }

    if (input.unidadMedidaId) {
      const unidad = await this.asegurarUnidad(orgId, input.unidadMedidaId);
      const cantidadActual = input.cantidad
        ? this.normalizarCantidad(input.cantidad)
        : formatImporte(linea.cantidad);
      if (!unidad.permiteDecimales && !this.esEntera(cantidadActual)) {
        throw cantidadIncompatibleConUnidad({
          cantidad: cantidadActual,
          unidadMedidaId: unidad.id,
        });
      }
      linea.unidadMedidaId = unidad.id;
    }

    if (input.cantidad !== undefined) {
      const cantidad = this.normalizarCantidad(input.cantidad);
      const unidadId = linea.unidadMedidaId;
      if (!unidadId) throw cantidadInvalida({ motivo: 'sin_unidad' });
      const unidad = await this.asegurarUnidad(orgId, unidadId);
      const item = linea.itemId
        ? await this.itemRepo.findOne({
            where: { id: linea.itemId, organizacionId: orgId },
          })
        : null;
      this.validarCantidad(cantidad, unidad, item);
      linea.cantidad = cantidad;
      if (!eventos.some((e) => e.tipo === TipoEventoCotizacion.LINEA_CORREGIDA)) {
        eventos.push({
          tipo: TipoEventoCotizacion.LINEA_CORREGIDA,
          descripcion: 'Cantidad actualizada',
          datos: { lineaId: linea.id, cantidad },
        });
      }
    }

    if (input.quitarSobrescritura) {
      linea.precioSobrescrito = false;
      linea.motivoSobrescritura = null;
      eventos.push({
        tipo: TipoEventoCotizacion.PRECIO_SOBRESCRITO,
        descripcion: 'Sobrescritura de precio retirada',
        datos: { lineaId: linea.id, quitada: true },
      });
    } else if (input.precioUnitario !== undefined) {
      if (!hasPermission(ctx, PERMISOS.COTIZACIONES_SOBRESCRIBIR_PRECIO)) {
        throw sobrescrituraNoPermitida(403);
      }
      if (!config.permiteSobrescribirPrecio) {
        throw sobrescrituraNoPermitida(422);
      }
      const motivo = input.motivoSobrescritura?.trim() ?? '';
      if (motivo.length < MOTIVO_MIN_LENGTH) {
        throw motivoSobrescrituraRequerido();
      }
      linea.precioSobrescrito = true;
      linea.motivoSobrescritura = motivo;
      linea.precioUnitario = formatImporte(input.precioUnitario);
      eventos.push({
        tipo: TipoEventoCotizacion.PRECIO_SOBRESCRITO,
        descripcion: 'Precio unitario sobrescrito',
        datos: {
          lineaId: linea.id,
          precioUnitario: linea.precioUnitario,
          motivo,
        },
      });
    }

    // Alias aprendido
    if (
      input.guardarAlias === true &&
      itemCambiado &&
      linea.itemId &&
      linea.textoSolicitado?.trim()
    ) {
      requirePermission(ctx, PERMISOS.CATALOGO_ALIAS_ADMINISTRAR);
      try {
        const alias = await this.aliasService.crearAliasInterno(
          ctx as OrgContext & { organizacionId: string },
          linea.itemId,
          linea.textoSolicitado,
          OrigenAlias.APRENDIDO,
          true,
        );
        eventos.push({
          tipo: TipoEventoCotizacion.ALIAS_APRENDIDO,
          descripcion: `Alias aprendido: ${linea.textoSolicitado}`,
          datos: {
            aliasId: alias.id,
            itemId: linea.itemId,
            texto: linea.textoSolicitado,
            itemAnteriorId,
          },
        });
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: string }).code)
            : '';
        if (code === 'ALIAS_DUPLICADO') {
          aliasAdvertencia = 'ALIAS_YA_EXISTE';
        } else {
          throw err;
        }
      }
    }

    linea.updatedById = ctx.usuarioId;
    const lineas = await this.lineasActivas(orgId, cotizacion.id);
    const idx = lineas.findIndex((l) => l.id === linea.id);
    if (idx >= 0) lineas[idx] = linea;
    else lineas.push(linea);

    await this.dataSource.transaction(async (manager) => {
      await manager.save(linea);
      await this.persistirRecalculo(manager, ctx, cotizacion, lineas, contexto, {
        totalesCliente: input.totalesCliente,
        eventos:
          eventos.length > 0
            ? eventos
            : [
                {
                  tipo: TipoEventoCotizacion.RECALCULADA,
                  descripcion: 'Línea actualizada',
                  datos: { lineaId: linea.id },
                },
              ],
      });
    });

    const detalle = await this.precotizaciones.obtenerCotizacion(
      ctx,
      cotizacion.id,
    );
    if (aliasAdvertencia) {
      return { ...detalle, advertencias: [aliasAdvertencia] };
    }
    return detalle;
  }

  async eliminarLinea(ctx: OrgContext, id: string, lineaId: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_EDITAR);
    const orgId = ctx.organizacionId!;

    const cotizacion = await this.cargarCotizacionBorrador(orgId, id);
    const linea = await this.lineaRepo.findOne({
      where: {
        id: lineaId,
        cotizacionId: cotizacion.id,
        organizacionId: orgId,
        activa: true,
      },
    });
    if (!linea) throw lineaNoEncontrada();

    const contexto = await this.cargarContextoCalculo(orgId, cotizacion);
    linea.activa = false;
    linea.updatedById = ctx.usuarioId;

    const lineas = (await this.lineasActivas(orgId, cotizacion.id)).filter(
      (l) => l.id !== linea.id,
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.save(linea);
      await this.persistirRecalculo(manager, ctx, cotizacion, lineas, contexto, {
        eventos: [
          {
            tipo: TipoEventoCotizacion.LINEA_ELIMINADA,
            descripcion: `Línea eliminada: ${linea.textoSolicitado}`,
            datos: {
              lineaId: linea.id,
              itemId: linea.itemId,
              textoSolicitado: linea.textoSolicitado,
              total: linea.total,
            },
          },
        ],
      });
    });

    return this.precotizaciones.obtenerCotizacion(ctx, cotizacion.id);
  }

  async recalcular(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_EDITAR);
    const input = recalcularCotizacionSchema.parse(body ?? {});
    const orgId = ctx.organizacionId!;

    const cotizacion = await this.cargarCotizacionBorrador(orgId, id);
    const contexto = await this.cargarContextoCalculo(orgId, cotizacion, true);
    const lineas = await this.lineasActivas(orgId, cotizacion.id);

    await this.dataSource.transaction(async (manager) => {
      await this.persistirRecalculo(manager, ctx, cotizacion, lineas, contexto, {
        totalesCliente: input.totalesCliente,
        eventos: [
          {
            tipo: TipoEventoCotizacion.RECALCULADA,
            descripcion: 'Recálculo solicitado',
            datos: {},
          },
        ],
      });
    });

    return this.precotizaciones.obtenerCotizacion(ctx, cotizacion.id);
  }

  async aprobar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_APROBAR);
    const input = aprobarCotizacionSchema.parse(body ?? {});
    const orgId = ctx.organizacionId!;

    const cotizacion = await this.cargarCotizacion(orgId, id);
    if (cotizacion.estado !== EstadoCotizacion.BORRADOR) {
      throw cotizacionEstadoInvalido({ estado: cotizacion.estado });
    }

    const contexto = await this.cargarContextoCalculo(orgId, cotizacion, true);
    const lineas = await this.lineasActivas(orgId, cotizacion.id);
    if (lineas.length === 0) throw cotizacionSinLineas();

    const sinResolver = lineas.filter(
      (l) =>
        l.estadoResolucion === EstadoResolucionLinea.NO_ENCONTRADA ||
        !l.itemId,
    );
    if (sinResolver.length > 0) {
      throw lineasSinResolver({
        lineaIds: sinResolver.map((l) => l.id),
      });
    }

    // Validar cantidades
    for (const linea of lineas) {
      if (!linea.unidadMedidaId) throw cantidadInvalida({ lineaId: linea.id });
      const unidad = contexto.unidadesPorId.get(linea.unidadMedidaId);
      const item = linea.itemId
        ? contexto.itemsPorId.get(linea.itemId)
        : undefined;
      if (!unidad) throw cantidadInvalida({ lineaId: linea.id });
      this.validarCantidad(formatImporte(linea.cantidad), unidad, item ?? null);
    }

    const calculo = this.ejecutarMotor(lineas, contexto);
    this.aplicarCalculoALineas(lineas, calculo);
    this.aplicarCalculoACabecera(cotizacion, calculo, contexto);

    const sinPrecio = lineas.filter(
      (l) => l.precioUnitario == null || Number(l.precioUnitario) <= 0,
    );
    if (sinPrecio.length > 0) {
      throw lineasSinPrecio({ lineaIds: sinPrecio.map((l) => l.id) });
    }

    if (input.totalesCliente) {
      this.verificarTotalesCompletos(
        input.totalesCliente,
        cotizacion,
        contexto.configuracion.decimalesRedondeo,
      );
    }

    const ahora = new Date();
    const horas = contexto.configuracion.vigenciaHorasPredeterminada;
    cotizacion.estado = EstadoCotizacion.APROBADA;
    cotizacion.aprobadaPorId = ctx.usuarioId;
    cotizacion.aprobadaAt = ahora;
    cotizacion.vigenciaHasta = new Date(
      ahora.getTime() + horas * 60 * 60 * 1000,
    );
    cotizacion.updatedById = ctx.usuarioId;

    // Congelar descripción/SKU/atributos/marca al aprobar (spec 010)
    const marcaIds = [
      ...new Set(
        lineas
          .map((l) => {
            const item = l.itemId
              ? contexto.itemsPorId.get(l.itemId)
              : undefined;
            return item?.marcaId ?? null;
          })
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    const marcas =
      marcaIds.length > 0
        ? await this.dataSource.getRepository(Marca).find({
            where: { id: In(marcaIds), organizacionId: orgId },
          })
        : [];
    const marcaPorId = new Map(marcas.map((m) => [m.id, m.nombre]));

    for (const linea of lineas) {
      const item = linea.itemId
        ? contexto.itemsPorId.get(linea.itemId)
        : undefined;
      if (item) {
        linea.descripcion = item.nombre;
        linea.sku = item.sku;
        linea.atributosCongelados = {
          ...((item.atributos as Record<string, unknown>) ?? {}),
        };
        linea.marcaCongelada = item.marcaId
          ? (marcaPorId.get(item.marcaId) ?? null)
          : null;
      }
      linea.updatedById = ctx.usuarioId;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(cotizacion);
      await manager.save(lineas);
      await manager.save(
        manager.create(CotizacionEvento, {
          organizacionId: orgId,
          cotizacionId: cotizacion.id,
          tipo: TipoEventoCotizacion.APROBADA,
          descripcion: 'Cotización aprobada; importes y tasa congelados',
          datos: {
            total: cotizacion.total,
            tasaAplicada: cotizacion.tasaAplicada,
            vigenciaHasta: cotizacion.vigenciaHasta?.toISOString(),
          },
          usuarioId: ctx.usuarioId,
        }),
      );
    });

    return this.precotizaciones.obtenerCotizacion(ctx, cotizacion.id);
  }

  async mensajeWhatsApp(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_GENERAR_DOCUMENTO);
    const orgId = ctx.organizacionId!;

    const cotizacion = await this.cargarCotizacion(orgId, id);
    const estadosOk: EstadoCotizacion[] = [
      EstadoCotizacion.APROBADA,
      EstadoCotizacion.ENVIADA,
      EstadoCotizacion.GANADA,
      EstadoCotizacion.PERDIDA,
      EstadoCotizacion.VENCIDA,
    ];
    if (
      cotizacion.anulado ||
      cotizacion.estado === EstadoCotizacion.ANULADA ||
      cotizacion.estado === EstadoCotizacion.BORRADOR ||
      !estadosOk.includes(cotizacion.estado)
    ) {
      throw mensajeWhatsAppNoDisponible({ estado: cotizacion.estado });
    }

    const lineas = await this.lineasActivas(orgId, cotizacion.id);
    const unidades = await this.dataSource.getRepository(UnidadMedida).find({
      where: { organizacionId: orgId },
    });
    const unidadPorId = new Map(unidades.map((u) => [u.id, u]));

    const monedas = await this.dataSource.getRepository(Moneda).find({
      where: {
        id: In(
          [
            cotizacion.monedaBaseId,
            cotizacion.monedaPresentacionId,
          ].filter((x): x is string => Boolean(x)),
        ),
      },
    });
    const monedaPorId = new Map(monedas.map((m) => [m.id, m]));
    const monedaBase = monedaPorId.get(cotizacion.monedaBaseId);
    const monedaPres = cotizacion.monedaPresentacionId
      ? monedaPorId.get(cotizacion.monedaPresentacionId)
      : undefined;

    const plantilla = await this.dataSource
      .getRepository(PlantillaDocumento)
      .findOne({
        where: {
          organizacionId: orgId,
          esPredeterminada: true,
          estadoRegistro: EstadoRegistro.ACTIVO,
        },
      });
    const cfg = (plantilla?.configuracion ?? {}) as Record<string, unknown>;
    const textosCfg = (cfg.textos ?? {}) as {
      saludo?: string;
      condiciones?: string;
      pie?: string;
    };
    const waCfg = (cfg.mensajeWhatsapp ?? {}) as {
      incluirSaludo?: boolean;
      incluirDetalleLineas?: boolean;
      incluirCondiciones?: boolean;
      maximoLineasDetalle?: number;
    };
    const totalesCfg = (cfg.totales ?? {}) as {
      mostrarSubtotal?: boolean;
      mostrarDescuento?: boolean;
      mostrarImpuesto?: boolean;
      mostrarMonedaPresentacion?: boolean;
      mostrarTasaAplicada?: boolean;
    };

    let nombreCliente =
      cotizacion.nombreClienteLibre?.trim() || 'Cliente';
    if (cotizacion.clienteId) {
      const cliente = await this.dataSource.getRepository(Cliente).findOne({
        where: { id: cotizacion.clienteId, organizacionId: orgId },
      });
      if (cliente) nombreCliente = cliente.nombre;
    }

    const configCot = await this.dataSource
      .getRepository(ConfiguracionCotizacion)
      .findOne({ where: { organizacionId: orgId } });

    const texto = armarMensajeWhatsApp({
      nombreCliente,
      lineas: lineas.map((l) => ({
        descripcion: l.descripcion ?? l.textoSolicitado,
        cantidad: formatImporte(l.cantidad),
        unidadCodigo: l.unidadMedidaId
          ? (unidadPorId.get(l.unidadMedidaId)?.codigo ?? 'und')
          : 'und',
        precioUnitario: formatImporte(l.precioUnitario ?? 0),
        totalLinea: formatImporte(l.total ?? l.subtotal ?? 0),
      })),
      subtotal: formatImporte(cotizacion.subtotal),
      descuentoTotal: formatImporte(cotizacion.descuentoTotal),
      impuestoTotal: formatImporte(cotizacion.impuestoTotal),
      total: formatImporte(cotizacion.total),
      monedaBaseCodigo: monedaBase?.codigoIso ?? 'USD',
      totalPresentacion: cotizacion.totalPresentacion
        ? formatImporte(cotizacion.totalPresentacion)
        : null,
      monedaPresentacionCodigo: monedaPres?.codigoIso ?? null,
      tasaAplicada: cotizacion.tasaAplicada ?? null,
      tasaFecha: cotizacion.tasaFecha ?? null,
      vigenciaHoras: configCot?.vigenciaHorasPredeterminada ?? null,
      textos: {
        saludo: textosCfg.saludo,
        condiciones: textosCfg.condiciones,
        pie: textosCfg.pie,
      },
      textoCondicionesCotizacion: cotizacion.textoCondiciones,
      textoPieCotizacion: cotizacion.textoPie,
      opciones: {
        ...waCfg,
        ...totalesCfg,
      },
    });

    return {
      texto,
      cotizacionId: cotizacion.id,
      folio: cotizacion.folio,
      estado: cotizacion.estado,
      generadoAt: new Date().toISOString(),
    };
  }

  async marcarEnviada(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_REGISTRAR_RESULTADO);
    const orgId = ctx.organizacionId!;
    const cotizacion = await this.cargarCotizacion(orgId, id);

    if (cotizacion.estado !== EstadoCotizacion.APROBADA) {
      throw transicionEstadoInvalida({
        desde: cotizacion.estado,
        hacia: EstadoCotizacion.ENVIADA,
      });
    }

    cotizacion.estado = EstadoCotizacion.ENVIADA;
    cotizacion.enviadaAt = new Date();
    cotizacion.updatedById = ctx.usuarioId;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(cotizacion);
      await manager.save(
        manager.create(CotizacionEvento, {
          organizacionId: orgId,
          cotizacionId: cotizacion.id,
          tipo: TipoEventoCotizacion.ENVIADA,
          descripcion: 'Cotización marcada como enviada',
          datos: {},
          usuarioId: ctx.usuarioId,
        }),
      );
    });

    return this.precotizaciones.obtenerCotizacion(ctx, cotizacion.id);
  }

  async registrarResultado(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_REGISTRAR_RESULTADO);
    const input = registrarResultadoCotizacionSchema.parse(body);
    const orgId = ctx.organizacionId!;
    const cotizacion = await this.cargarCotizacion(orgId, id);

    const origenesOk = [EstadoCotizacion.ENVIADA, EstadoCotizacion.VENCIDA];
    if (!origenesOk.includes(cotizacion.estado)) {
      throw transicionEstadoInvalida({
        desde: cotizacion.estado,
        hacia: input.resultado,
      });
    }

    if (input.resultado === 'PERDIDA') {
      const motivo = input.motivoPerdida?.trim() ?? '';
      if (motivo.length < MOTIVO_MIN_LENGTH) throw motivoPerdidaRequerido();
      cotizacion.estado = EstadoCotizacion.PERDIDA;
      cotizacion.motivoPerdida = motivo;
      cotizacion.resultadoAt = new Date();
      cotizacion.updatedById = ctx.usuarioId;

      await this.dataSource.transaction(async (manager) => {
        await manager.save(cotizacion);
        await manager.save(
          manager.create(CotizacionEvento, {
            organizacionId: orgId,
            cotizacionId: cotizacion.id,
            tipo: TipoEventoCotizacion.MARCADA_PERDIDA,
            descripcion: 'Cotización marcada como perdida',
            datos: { motivo },
            usuarioId: ctx.usuarioId,
          }),
        );
      });
    } else {
      cotizacion.estado = EstadoCotizacion.GANADA;
      cotizacion.resultadoAt = new Date();
      cotizacion.updatedById = ctx.usuarioId;

      await this.dataSource.transaction(async (manager) => {
        await manager.save(cotizacion);
        await manager.save(
          manager.create(CotizacionEvento, {
            organizacionId: orgId,
            cotizacionId: cotizacion.id,
            tipo: TipoEventoCotizacion.MARCADA_GANADA,
            descripcion: 'Cotización marcada como ganada',
            datos: {},
            usuarioId: ctx.usuarioId,
          }),
        );
      });
    }

    return this.precotizaciones.obtenerCotizacion(ctx, cotizacion.id);
  }

  async anular(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_ANULAR);
    const input = anularCotizacionSchema.parse(body);
    const motivo = input.motivoAnulacion.trim();
    if (motivo.length < MOTIVO_MIN_LENGTH) throw motivoAnulacionRequerido();

    const orgId = ctx.organizacionId!;
    const cotizacion = await this.cargarCotizacion(orgId, id);

    const anulables = [
      EstadoCotizacion.BORRADOR,
      EstadoCotizacion.APROBADA,
      EstadoCotizacion.ENVIADA,
    ];
    if (!anulables.includes(cotizacion.estado) || cotizacion.anulado) {
      throw transicionEstadoInvalida({
        desde: cotizacion.estado,
        hacia: EstadoCotizacion.ANULADA,
      });
    }

    cotizacion.estado = EstadoCotizacion.ANULADA;
    cotizacion.anulado = true;
    cotizacion.anuladoAt = new Date();
    cotizacion.anuladoById = ctx.usuarioId;
    cotizacion.motivoAnulacion = motivo;
    cotizacion.updatedById = ctx.usuarioId;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(cotizacion);
      await manager.save(
        manager.create(CotizacionEvento, {
          organizacionId: orgId,
          cotizacionId: cotizacion.id,
          tipo: TipoEventoCotizacion.ANULADA,
          descripcion: 'Cotización anulada',
          datos: { motivo },
          usuarioId: ctx.usuarioId,
        }),
      );
    });

    return this.precotizaciones.obtenerCotizacion(ctx, cotizacion.id);
  }

  async duplicar(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_CREAR);
    const orgId = ctx.organizacionId!;

    const origen = await this.cargarCotizacion(orgId, id);
    const lineasOrigen = await this.lineasActivas(orgId, origen.id);

    // Plantilla borrador con misma cabecera comercial básica
    const borrador = this.cotizacionRepo.create({
      organizacionId: orgId,
      sucursalId: origen.sucursalId,
      folioNumero: 0,
      folio: '',
      solicitudId: origen.solicitudId ?? null,
      clienteId: origen.clienteId ?? null,
      nombreClienteLibre: origen.nombreClienteLibre ?? null,
      telefonoClienteLibre: origen.telefonoClienteLibre ?? null,
      listaPrecioId: origen.listaPrecioId,
      monedaBaseId: origen.monedaBaseId,
      monedaPresentacionId: origen.monedaPresentacionId ?? null,
      tasaAplicada: null,
      tasaFecha: null,
      estado: EstadoCotizacion.BORRADOR,
      textoCondiciones: origen.textoCondiciones ?? null,
      textoPie: origen.textoPie ?? null,
      observaciones: origen.observaciones ?? null,
      cotizacionOrigenId: origen.id,
      subtotal: formatImporte(0),
      descuentoTotal: formatImporte(0),
      impuestoTotal: formatImporte(0),
      total: formatImporte(0),
      porcentajeImpuestoAplicado: formatImporte(0),
      anulado: false,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });

    const contexto = await this.cargarContextoCalculo(orgId, borrador, true);
    borrador.tasaAplicada = contexto.tasa?.valor ?? null;
    borrador.tasaFecha = contexto.tasa?.fecha ?? null;

    const nuevasLineas: CotizacionLinea[] = [];
    for (let i = 0; i < lineasOrigen.length; i++) {
      const src = lineasOrigen[i];
      nuevasLineas.push(
        this.lineaRepo.create({
          organizacionId: orgId,
          cotizacionId: '', // se asigna tras guardar cabecera
          orden: i + 1,
          textoSolicitado: src.textoSolicitado,
          itemId: src.itemId,
          descripcion: src.descripcion,
          sku: src.sku,
          unidadMedidaId: src.unidadMedidaId,
          cantidad: formatImporte(src.cantidad),
          precioSobrescrito: false,
          motivoSobrescritura: null,
          estadoResolucion:
            src.estadoResolucion === EstadoResolucionLinea.AGREGADA_MANUAL
              ? EstadoResolucionLinea.AGREGADA_MANUAL
              : src.itemId
                ? EstadoResolucionLinea.RESUELTA_MANUAL
                : EstadoResolucionLinea.NO_ENCONTRADA,
          confianza: src.confianza,
          origenMatch: src.itemId ? OrigenMatch.MANUAL : src.origenMatch,
          notas: src.notas,
          descuentoMonto: formatImporte(0),
          activa: true,
          createdById: ctx.usuarioId,
          updatedById: ctx.usuarioId,
        }),
      );
    }

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

    const nuevaId = await this.dataSource.transaction(async (manager) => {
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
      if (!secuencia) throw folioNoDisponible();
      secuencia.ultimoNumero += 1;
      await manager.save(secuencia);
      borrador.folioNumero = secuencia.ultimoNumero;
      borrador.folio = formatearFolio(secuencia.ultimoNumero, folioConfig);
      await manager.save(borrador);

      for (const l of nuevasLineas) {
        l.cotizacionId = borrador.id;
      }

      await this.enriquecerContextoConItems(orgId, contexto, nuevasLineas);
      const calculo = this.ejecutarMotor(nuevasLineas, contexto);
      this.aplicarCalculoALineas(nuevasLineas, calculo);
      this.aplicarCalculoACabecera(borrador, calculo, contexto);
      await manager.save(borrador);
      await manager.save(nuevasLineas);

      await manager.save(
        manager.create(CotizacionEvento, {
          organizacionId: orgId,
          cotizacionId: origen.id,
          tipo: TipoEventoCotizacion.DUPLICADA,
          descripcion: `Duplicada como ${borrador.folio}`,
          datos: { cotizacionNuevaId: borrador.id, folio: borrador.folio },
          usuarioId: ctx.usuarioId,
        }),
      );
      await manager.save(
        manager.create(CotizacionEvento, {
          organizacionId: orgId,
          cotizacionId: borrador.id,
          tipo: TipoEventoCotizacion.CREADA,
          descripcion: `Creada por duplicado de ${origen.folio}`,
          datos: { cotizacionOrigenId: origen.id },
          usuarioId: ctx.usuarioId,
        }),
      );

      return borrador.id;
    });

    return this.precotizaciones.obtenerCotizacion(ctx, nuevaId);
  }

  async listarEventos(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.COTIZACIONES_VER);
    const orgId = ctx.organizacionId!;
    await this.cargarCotizacion(orgId, id);

    const eventos = await this.eventoRepo.find({
      where: { cotizacionId: id, organizacionId: orgId },
      order: { createdAt: 'ASC' },
    });

    return eventos.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      descripcion: e.descripcion ?? null,
      datos: e.datos ?? null,
      usuarioId: e.usuarioId ?? null,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  // ─── helpers ───────────────────────────────────────────────────────────

  private async cargarCotizacion(
    orgId: string,
    id: string,
  ): Promise<Cotizacion> {
    const cotizacion = await this.cotizacionRepo.findOne({
      where: { id, organizacionId: orgId },
    });
    if (!cotizacion) throw cotizacionNoEncontrada();
    await aplicarVencimientoPerezoso(this.dataSource, cotizacion);
    return cotizacion;
  }

  private async cargarCotizacionBorrador(
    orgId: string,
    id: string,
  ): Promise<Cotizacion> {
    const cotizacion = await this.cargarCotizacion(orgId, id);
    if (cotizacion.estado !== EstadoCotizacion.BORRADOR) {
      throw borradorNoEditable();
    }
    return cotizacion;
  }

  private async lineasActivas(
    orgId: string,
    cotizacionId: string,
  ): Promise<CotizacionLinea[]> {
    return this.lineaRepo.find({
      where: { organizacionId: orgId, cotizacionId, activa: true },
      order: { orden: 'ASC' },
    });
  }

  private async asegurarItemCotizable(
    orgId: string,
    itemId: string,
  ): Promise<Item> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, organizacionId: orgId },
    });
    if (!item) throw itemNoEncontrado();
    if (item.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw itemNoCotizable({ itemId });
    }
    return item;
  }

  private async asegurarUnidad(
    orgId: string,
    unidadMedidaId: string,
  ): Promise<UnidadMedida> {
    const unidad = await this.dataSource.getRepository(UnidadMedida).findOne({
      where: { id: unidadMedidaId, organizacionId: orgId },
    });
    if (!unidad || unidad.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw unidadMedidaInactiva();
    }
    return unidad;
  }

  private asignarItemManual(linea: CotizacionLinea, item: Item): void {
    linea.itemId = item.id;
    linea.descripcion = item.nombre;
    linea.sku = item.sku;
    if (!linea.unidadMedidaId) {
      linea.unidadMedidaId = item.unidadMedidaId;
    }
    linea.estadoResolucion = EstadoResolucionLinea.RESUELTA_MANUAL;
    linea.origenMatch = OrigenMatch.MANUAL;
    linea.confianza = formatConfianza(1);
  }

  private normalizarCantidad(cantidad: string): string {
    return formatImporte(cantidad.replace(',', '.'));
  }

  private esEntera(cantidad: string): boolean {
    return esCantidadEntera(cantidad);
  }

  private validarCantidad(
    cantidad: string,
    unidad: UnidadMedida,
    item: Item | null | undefined,
  ): void {
    const n = Number(cantidad);
    if (!(n > 0)) throw cantidadInvalida({ cantidad });
    if (!unidad.permiteDecimales && !this.esEntera(cantidad)) {
      throw cantidadNoEntera({ cantidad, unidadMedidaId: unidad.id });
    }
    if (item?.tipoItem === TipoItem.SERIALIZADO && n !== 1) {
      throw serializadoCantidadInvalida({ cantidad });
    }
  }

  private async cargarContextoCalculo(
    orgId: string,
    cotizacion: Cotizacion,
    refrescarTasa = false,
  ) {
    const organizacion = await this.dataSource
      .getRepository(Organizacion)
      .findOneOrFail({ where: { id: orgId } });
    const configuracion = await this.dataSource
      .getRepository(ConfiguracionCotizacion)
      .findOneOrFail({ where: { organizacionId: orgId } });

    const lineasTmp = await this.lineasActivas(orgId, cotizacion.id).catch(
      () => [] as CotizacionLinea[],
    );
    // Si la cotización aún no tiene id (duplicado), lineas vacías
    const itemIdsFromParam: string[] = [];

    const itemIds = [
      ...new Set([
        ...lineasTmp
          .map((l) => l.itemId)
          .filter((x): x is string => Boolean(x)),
        ...itemIdsFromParam,
      ]),
    ];

    const items =
      itemIds.length > 0
        ? await this.itemRepo.find({
            where: { id: In(itemIds), organizacionId: orgId },
          })
        : [];
    // También cargar todos los items que puedan necesitarse después — se amplía en ejecutarMotor

    const precios =
      itemIds.length > 0
        ? await this.dataSource.getRepository(PrecioItem).find({
            where: {
              organizacionId: orgId,
              listaPrecioId: cotizacion.listaPrecioId,
              itemId: In(itemIds),
              estadoRegistro: EstadoRegistro.ACTIVO,
            },
          })
        : [];

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

    const unidades = await this.dataSource.getRepository(UnidadMedida).find({
      where: { organizacionId: orgId },
    });

    const fechaReferencia = new Date().toISOString().slice(0, 10);
    let tasa: { valor: string; fecha: string } | null = null;

    if (
      refrescarTasa ||
      !cotizacion.tasaAplicada ||
      cotizacion.estado === EstadoCotizacion.BORRADOR
    ) {
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
        if (t) tasa = { valor: t.valor, fecha: t.fechaVigencia };
      }
    } else if (cotizacion.tasaAplicada) {
      tasa = {
        valor: cotizacion.tasaAplicada,
        fecha: cotizacion.tasaFecha ?? fechaReferencia,
      };
    }

    return {
      organizacion,
      configuracion,
      itemsPorId: new Map(items.map((i) => [i.id, i])),
      precioPorItem: new Map(precios.map((p) => [p.itemId, p.precio])),
      reglas,
      unidadesPorId: new Map(unidades.map((u) => [u.id, u])),
      fechaReferencia,
      tasa,
      listaPrecioId: cotizacion.listaPrecioId,
    };
  }

  private async enriquecerContextoConItems(
    orgId: string,
    contexto: Awaited<ReturnType<typeof this.cargarContextoCalculo>>,
    lineas: CotizacionLinea[],
  ) {
    const missing = lineas
      .map((l) => l.itemId)
      .filter((id): id is string => Boolean(id) && !contexto.itemsPorId.has(id!));
    if (missing.length === 0) return;
    const items = await this.itemRepo.find({
      where: { id: In(missing), organizacionId: orgId },
    });
    for (const i of items) contexto.itemsPorId.set(i.id, i);
    const precios = await this.dataSource.getRepository(PrecioItem).find({
      where: {
        organizacionId: orgId,
        listaPrecioId: contexto.listaPrecioId,
        itemId: In(missing),
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
    for (const p of precios) contexto.precioPorItem.set(p.itemId, p.precio);
  }

  private ejecutarMotor(
    lineas: CotizacionLinea[],
    contexto: Awaited<ReturnType<typeof this.cargarContextoCalculo>>,
  ): ResultadoCalculoCotizacion {
    const lineasMotor = lineas
      .filter((l) => l.itemId && l.activa !== false)
      .map((l) => {
        const item = contexto.itemsPorId.get(l.itemId!);
        return {
          id: l.id,
          itemId: l.itemId!,
          cantidad: formatImporte(l.cantidad),
          precioLista: contexto.precioPorItem.get(l.itemId!) ?? null,
          categoriaId: item?.categoriaId ?? null,
          marcaId: item?.marcaId ?? null,
          listaPrecioId: contexto.listaPrecioId,
          precioSobrescrito: l.precioSobrescrito
            ? formatImporte(l.precioUnitario ?? 0)
            : null,
        };
      });

    return calcularCotizacion({
      lineas: lineasMotor,
      reglas: contexto.reglas,
      configuracion: {
        aplicaImpuesto: contexto.configuracion.aplicaImpuesto,
        porcentajeImpuesto: contexto.configuracion.porcentajeImpuesto,
        preciosIncluyenImpuesto:
          contexto.configuracion.preciosIncluyenImpuesto,
        decimalesRedondeo: contexto.configuracion.decimalesRedondeo,
        modoRedondeo: contexto.configuracion.modoRedondeo,
      },
      fechaReferencia: contexto.fechaReferencia,
      tasa: contexto.tasa ? { valor: contexto.tasa.valor } : null,
    });
  }

  private aplicarCalculoALineas(
    lineas: CotizacionLinea[],
    calculo: ResultadoCalculoCotizacion,
  ): void {
    const porId = new Map(calculo.lineas.map((l) => [l.id ?? l.itemId, l]));
    for (const linea of lineas) {
      if (!linea.itemId || linea.activa === false) {
        linea.precioLista = null;
        if (!linea.precioSobrescrito) linea.precioUnitario = null;
        linea.descuentoMonto = formatImporte(0);
        linea.subtotal = null;
        linea.total = null;
        linea.reglaDescuentoId = null;
        continue;
      }
      const calc = porId.get(linea.id) ?? porId.get(linea.itemId);
      if (!calc) continue;
      linea.precioLista = calc.precioLista;
      if (!linea.precioSobrescrito) {
        linea.precioUnitario = calc.precioUnitario;
      }
      linea.descuentoMonto = calc.descuentoMonto;
      linea.subtotal = calc.subtotal;
      linea.total = calc.subtotal;
      linea.reglaDescuentoId = calc.reglaDescuentoId;
    }
  }

  private aplicarCalculoACabecera(
    cotizacion: Cotizacion,
    calculo: ResultadoCalculoCotizacion,
    contexto: Awaited<ReturnType<typeof this.cargarContextoCalculo>>,
  ): void {
    const descuentoTotal = calculo.lineas.reduce(
      (acc, l) => acc + Number(l.descuentoMonto || 0),
      0,
    );
    cotizacion.subtotal = calculo.subtotal;
    cotizacion.descuentoTotal = formatImporte(descuentoTotal);
    cotizacion.impuestoTotal = calculo.impuestoTotal;
    cotizacion.total = calculo.total;
    cotizacion.totalPresentacion = calculo.totalPresentacion;
    cotizacion.porcentajeImpuestoAplicado = contexto.configuracion
      .aplicaImpuesto
      ? formatImporte(contexto.configuracion.porcentajeImpuesto)
      : formatImporte(0);
    if (contexto.tasa) {
      cotizacion.tasaAplicada = contexto.tasa.valor;
      cotizacion.tasaFecha = contexto.tasa.fecha;
    }
  }

  private tolerancia(decimalesRedondeo: number): number {
    return toleranciaImporte(decimalesRedondeo);
  }

  private verificarTotalesParciales(
    cliente: TotalesParciales,
    cotizacion: Cotizacion,
    decimales: number,
  ): void {
    const tol = this.tolerancia(decimales);
    const ok =
      absDiff(cliente.subtotal, cotizacion.subtotal) <= tol &&
      absDiff(cliente.total, cotizacion.total) <= tol;
    if (!ok) {
      throw totalesDesfasados({
        subtotal: formatImporte(cotizacion.subtotal),
        descuentoTotal: formatImporte(cotizacion.descuentoTotal),
        impuestoTotal: formatImporte(cotizacion.impuestoTotal),
        total: formatImporte(cotizacion.total),
        totalPresentacion:
          cotizacion.totalPresentacion != null
            ? formatImporte(cotizacion.totalPresentacion)
            : null,
      });
    }
  }

  private verificarTotalesCompletos(
    cliente: TotalesCompletos,
    cotizacion: Cotizacion,
    decimales: number,
  ): void {
    const tol = this.tolerancia(decimales);
    const diffs = [
      absDiff(cliente.subtotal, cotizacion.subtotal),
      absDiff(cliente.descuentoTotal, cotizacion.descuentoTotal),
      absDiff(cliente.impuestoTotal, cotizacion.impuestoTotal),
      absDiff(cliente.total, cotizacion.total),
    ];
    if (
      cliente.totalPresentacion != null &&
      cotizacion.totalPresentacion != null
    ) {
      diffs.push(
        absDiff(cliente.totalPresentacion, cotizacion.totalPresentacion),
      );
    }
    if (diffs.some((d) => d > tol)) {
      throw totalesDesfasados({
        subtotal: formatImporte(cotizacion.subtotal),
        descuentoTotal: formatImporte(cotizacion.descuentoTotal),
        impuestoTotal: formatImporte(cotizacion.impuestoTotal),
        total: formatImporte(cotizacion.total),
        totalPresentacion:
          cotizacion.totalPresentacion != null
            ? formatImporte(cotizacion.totalPresentacion)
            : null,
      });
    }
  }

  private async recalcularYAplicar(
    ctx: OrgContext,
    cotizacion: Cotizacion,
    lineas: CotizacionLinea[],
    contexto: Awaited<ReturnType<typeof this.cargarContextoCalculo>>,
    opts: {
      totalesCliente?: TotalesParciales;
      eventoTipo: TipoEventoCotizacion;
      eventoDescripcion: string;
      eventoDatos: Record<string, unknown>;
    },
  ) {
    await this.dataSource.transaction(async (manager) => {
      await this.persistirRecalculo(
        manager,
        ctx,
        cotizacion,
        lineas,
        contexto,
        {
          totalesCliente: opts.totalesCliente,
          eventos: [
            {
              tipo: opts.eventoTipo,
              descripcion: opts.eventoDescripcion,
              datos: opts.eventoDatos,
            },
          ],
        },
      );
    });
  }

  private async persistirRecalculo(
    manager: import('typeorm').EntityManager,
    ctx: OrgContext,
    cotizacion: Cotizacion,
    lineas: CotizacionLinea[],
    contexto: Awaited<ReturnType<typeof this.cargarContextoCalculo>>,
    opts: {
      totalesCliente?: TotalesParciales;
      eventos: Array<{
        tipo: TipoEventoCotizacion;
        descripcion: string;
        datos: Record<string, unknown>;
      }>;
    },
  ) {
    await this.enriquecerContextoConItems(
      cotizacion.organizacionId,
      contexto,
      lineas,
    );
    const calculo = this.ejecutarMotor(lineas, contexto);
    this.aplicarCalculoALineas(lineas, calculo);
    this.aplicarCalculoACabecera(cotizacion, calculo, contexto);
    cotizacion.updatedById = ctx.usuarioId;

    if (opts.totalesCliente) {
      this.verificarTotalesParciales(
        opts.totalesCliente,
        cotizacion,
        contexto.configuracion.decimalesRedondeo,
      );
    }

    await manager.save(cotizacion);
    const activas = lineas.filter((l) => l.activa !== false);
    if (activas.length > 0) await manager.save(activas);

    for (const ev of opts.eventos) {
      await manager.save(
        manager.create(CotizacionEvento, {
          organizacionId: cotizacion.organizacionId,
          cotizacionId: cotizacion.id,
          tipo: ev.tipo,
          descripcion: ev.descripcion,
          datos: ev.datos,
          usuarioId: ctx.usuarioId,
        }),
      );
    }
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

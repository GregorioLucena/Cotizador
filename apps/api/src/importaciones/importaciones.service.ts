import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Categoria,
  DefinicionAtributo,
  EstadoImportacion,
  EstadoRegistro,
  ImportacionCatalogo,
  Item,
  ItemAlias,
  ListaPrecio,
  Marca,
  OrigenAlias,
  PrecioItem,
  TipoImportacion,
  TipoItem,
  UnidadMedida,
} from '@cotizador/database';
import {
  AppError,
  CAMPOS_OBLIGATORIOS_MAPEO,
  LIMITE_ALIAS_POR_CELDA,
  LIMITE_FILAS_IMPORTACION,
  LIMITE_TAMANO_ARCHIVO_BYTES,
  type MapeoColumnas,
  type OrgContext,
  PERMISOS,
  confirmarImportacionSchema,
  importacionArchivoDemasiadoGrande,
  importacionArchivoInvalido,
  importacionCancelada,
  importacionEstadoInvalido,
  importacionFormatoNoSoportado,
  importacionLimiteFilas,
  importacionMapeoIncompleto,
  importacionNoEncontrada,
  importacionSinFilasValidas,
  importacionYaConfirmada,
  listarImportacionesQuerySchema,
  mapeoColumnasSchema,
  normalizarCodigoUnidad,
  normalizarNombreComparacion,
  normalizarTexto,
  plantillaImportacionQuerySchema,
  requireOrganizacionContext,
  requirePermission,
  tipoImportacionSchema,
  validarAtributos,
} from '@cotizador/shared';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AlmacenamientoLocalService } from '../configuracion/almacenamiento-local.service';
import { ItemsUsoHelper } from '../maestras/items-uso.helper';
import {
  ArchivoParserService,
  type ArchivoParseado,
} from './archivo-parser.service';
import {
  mapImportacion,
  type ErrorFilaImportacionDto,
  type ResumenImportacionDto,
} from './importaciones.mapper';

const COLUMNAS_BASE: Record<TipoImportacion, string[]> = {
  [TipoImportacion.ITEMS]: [
    'sku',
    'nombre',
    'descripcion',
    'categoria',
    'marca',
    'unidadCodigo',
    'tipoItem',
    'controlaStock',
    'stockAproximado',
    'precioLista',
    'listaPrecioCodigo',
    'alias',
  ],
  [TipoImportacion.PRECIOS]: ['sku', 'listaPrecioCodigo', 'precio'],
  [TipoImportacion.ALIAS]: ['sku', 'alias'],
};

const TIPOS_ITEM = new Set(['FUNGIBLE', 'SERIALIZADO', 'SERVICIO']);
const PRECIO_REGEX = /^\d+(\.\d{1,4})?$/;

type FilaError = ErrorFilaImportacionDto;

type ContextoMaestras = {
  unidadesPorCodigo: Map<string, UnidadMedida>;
  marcasPorNombre: Map<string, Marca>;
  categorias: Categoria[];
  listasPorCodigo: Map<string, ListaPrecio>;
  listaPredeterminada: ListaPrecio | null;
  itemsPorSku: Map<string, Item>;
  definiciones: DefinicionAtributo[];
  aliasActivosPorItem: Map<string, Set<string>>;
};

type FilaItemsResuelta = {
  fila: number;
  esActualizacion: boolean;
  itemExistente: Item | null;
  sku: string | null;
  nombre: string;
  descripcion: string | null;
  unidadId: string;
  categoriaId: string | null;
  marcaId: string | null;
  tipoItem: TipoItem;
  controlaStock: boolean;
  stockAproximado: string | null;
  atributos: Record<string, unknown>;
  alias: string[];
  precioLista: string | null;
  listaPrecioId: string | null;
  advertencias: string[];
};

type FilaPreciosResuelta = {
  fila: number;
  itemId: string;
  listaPrecioId: string;
  precio: string;
  esActualizacion: boolean;
};

type FilaAliasResuelta = {
  fila: number;
  itemId: string;
  alias: string;
  normalizado: string;
  advertencias: string[];
};

type ResultadoValidacion = {
  errores: FilaError[];
  filasValidas: number;
  filasConError: number;
  resumen: ResumenImportacionDto;
  items: FilaItemsResuelta[];
  precios: FilaPreciosResuelta[];
  alias: FilaAliasResuelta[];
};

@Injectable()
export class ImportacionesService {
  constructor(
    @InjectRepository(ImportacionCatalogo)
    private readonly importacionRepo: Repository<ImportacionCatalogo>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(ItemAlias)
    private readonly aliasRepo: Repository<ItemAlias>,
    @InjectRepository(PrecioItem)
    private readonly precioRepo: Repository<PrecioItem>,
    @InjectRepository(ListaPrecio)
    private readonly listaRepo: Repository<ListaPrecio>,
    @InjectRepository(UnidadMedida)
    private readonly unidadRepo: Repository<UnidadMedida>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(Marca)
    private readonly marcaRepo: Repository<Marca>,
    @InjectRepository(DefinicionAtributo)
    private readonly definicionRepo: Repository<DefinicionAtributo>,
    private readonly parser: ArchivoParserService,
    private readonly almacenamiento: AlmacenamientoLocalService,
    private readonly itemsUso: ItemsUsoHelper,
    private readonly dataSource: DataSource,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_IMPORTAR);

    const input = listarImportacionesQuerySchema.parse(query);
    const qb = this.importacionRepo
      .createQueryBuilder('i')
      .where('i.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (input.tipo) {
      qb.andWhere('i.tipo = :tipo', { tipo: input.tipo });
    }
    if (input.estado) {
      qb.andWhere('i.estado = :estado', { estado: input.estado });
    }

    qb.orderBy('i.createdAt', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(mapImportacion),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit) || 0,
      },
    };
  }

  async obtener(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_IMPORTAR);
    const imp = await this.buscar(ctx.organizacionId!, id);
    return mapImportacion(imp);
  }

  async cargar(
    ctx: OrgContext,
    body: { tipo?: string; mapeoColumnas?: string },
    file: Express.Multer.File | undefined,
  ) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_IMPORTAR);

    const tipo = tipoImportacionSchema.parse(body.tipo) as TipoImportacion;
    let mapeoRaw: unknown;
    try {
      mapeoRaw =
        typeof body.mapeoColumnas === 'string'
          ? JSON.parse(body.mapeoColumnas)
          : body.mapeoColumnas;
    } catch {
      throw importacionMapeoIncompleto(['mapeoColumnas']);
    }
    const mapeo = mapeoColumnasSchema.parse(mapeoRaw) as MapeoColumnas;
    this.assertMapeoCompleto(tipo, mapeo);

    if (!file?.buffer?.length) {
      throw importacionArchivoInvalido({ motivo: 'archivo_ausente' });
    }
    if (
      file.size > LIMITE_TAMANO_ARCHIVO_BYTES ||
      file.buffer.length > LIMITE_TAMANO_ARCHIVO_BYTES
    ) {
      throw importacionArchivoDemasiadoGrande();
    }

    const nombreArchivo = file.originalname || 'archivo';
    const ext = this.parser.extension(nombreArchivo);
    if (ext !== 'csv' && ext !== 'xlsx') {
      throw importacionFormatoNoSoportado();
    }

    const parseado = await this.parser.parsear(file.buffer, nombreArchivo);
    if (parseado.filas.length > LIMITE_FILAS_IMPORTACION) {
      throw importacionLimiteFilas();
    }

    const id = randomUUID();
    const seguro = nombreArchivo.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
    const archivoPath = `importaciones/${ctx.organizacionId}/${id}-${seguro}`;
    await this.almacenamiento.guardar(file.buffer, archivoPath);

    const imp = this.importacionRepo.create({
      id,
      organizacionId: ctx.organizacionId!,
      tipo,
      nombreArchivo,
      archivoPath,
      mapeoColumnas: mapeo,
      estado: EstadoImportacion.CARGADA,
      filasTotales: parseado.filas.length,
      filasValidas: 0,
      filasConError: 0,
      erroresDetalle: null,
      resumen: null,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });

    await this.importacionRepo.save(imp);
    return mapImportacion(imp);
  }

  async validar(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_IMPORTAR);

    const orgId = ctx.organizacionId!;
    const imp = await this.buscar(orgId, id);

    if (imp.estado === EstadoImportacion.CANCELADA) {
      throw importacionCancelada();
    }
    if (imp.estado !== EstadoImportacion.CARGADA) {
      throw importacionEstadoInvalido({ estado: imp.estado });
    }

    try {
      const buffer = await this.almacenamiento.leer(imp.archivoPath);
      const parseado = await this.parser.parsear(buffer, imp.nombreArchivo);

      if (parseado.filas.length > LIMITE_FILAS_IMPORTACION) {
        imp.estado = EstadoImportacion.FALLIDA;
        imp.filasTotales = parseado.filas.length;
        imp.filasValidas = 0;
        imp.filasConError = parseado.filas.length;
        imp.erroresDetalle = [
          {
            fila: 0,
            codigo: 'IMPORTACION_LIMITE_FILAS',
            mensaje: 'El archivo supera el máximo de 2000 filas de datos.',
          },
        ];
        imp.updatedById = ctx.usuarioId;
        await this.importacionRepo.save(imp);
        throw importacionLimiteFilas();
      }

      const resultado = await this.validarFilas(orgId, imp, parseado);
      imp.estado = EstadoImportacion.VALIDADA;
      imp.filasTotales = parseado.filas.length;
      imp.filasValidas = resultado.filasValidas;
      imp.filasConError = resultado.filasConError;
      imp.erroresDetalle = resultado.errores;
      imp.resumen = resultado.resumen ?? null;
      imp.updatedById = ctx.usuarioId;
      await this.importacionRepo.save(imp);
      return mapImportacion(imp);
    } catch (err) {
      if (
        err instanceof AppError &&
        (err.code === 'IMPORTACION_LIMITE_FILAS' ||
          err.code === 'IMPORTACION_ESTADO_INVALIDO' ||
          err.code === 'IMPORTACION_CANCELADA' ||
          err.code === 'IMPORTACION_NO_ENCONTRADA')
      ) {
        throw err;
      }
      if (err instanceof AppError) {
        imp.estado = EstadoImportacion.FALLIDA;
        imp.erroresDetalle = [
          {
            fila: 0,
            codigo: err.code,
            mensaje: err.message,
          },
        ];
        imp.updatedById = ctx.usuarioId;
        await this.importacionRepo.save(imp);
        throw err;
      }
      imp.estado = EstadoImportacion.FALLIDA;
      imp.updatedById = ctx.usuarioId;
      await this.importacionRepo.save(imp);
      throw importacionArchivoInvalido({
        causa: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async confirmar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_IMPORTAR);

    const orgId = ctx.organizacionId!;
    const input = confirmarImportacionSchema.parse(body ?? {});
    const simular = input.simular === true;
    const imp = await this.buscar(orgId, id);

    if (imp.estado === EstadoImportacion.CONFIRMADA) {
      throw importacionYaConfirmada();
    }
    if (imp.estado === EstadoImportacion.CANCELADA) {
      throw importacionCancelada();
    }
    if (imp.estado !== EstadoImportacion.VALIDADA) {
      throw importacionEstadoInvalido({ estado: imp.estado });
    }

    const buffer = await this.almacenamiento.leer(imp.archivoPath);
    const parseado = await this.parser.parsear(buffer, imp.nombreArchivo);
    const resultado = await this.validarFilas(orgId, imp, parseado);

    if (resultado.filasValidas === 0) {
      throw importacionSinFilasValidas();
    }

    const resumen = this.construirResumenConfirmacion(resultado, simular);

    if (simular) {
      imp.resumen = resumen;
      imp.updatedById = ctx.usuarioId;
      await this.importacionRepo.save(imp);
      return mapImportacion(imp);
    }

    await this.dataSource.transaction(async (manager) => {
      if (imp.tipo === TipoImportacion.ITEMS) {
        await this.persistirItems(manager, orgId, ctx.usuarioId, resultado.items);
      } else if (imp.tipo === TipoImportacion.PRECIOS) {
        await this.persistirPrecios(
          manager,
          orgId,
          ctx.usuarioId,
          resultado.precios,
        );
      } else {
        await this.persistirAlias(manager, orgId, ctx.usuarioId, resultado.alias);
      }

      imp.estado = EstadoImportacion.CONFIRMADA;
      imp.filasValidas = resultado.filasValidas;
      imp.filasConError = resultado.filasConError;
      imp.erroresDetalle = resultado.errores;
      imp.resumen = resumen;
      imp.updatedById = ctx.usuarioId;
      await manager.save(ImportacionCatalogo, imp);
    });

    return mapImportacion(imp);
  }

  async cancelar(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_IMPORTAR);

    const imp = await this.buscar(ctx.organizacionId!, id);
    const permitidos = new Set([
      EstadoImportacion.CARGADA,
      EstadoImportacion.VALIDADA,
      EstadoImportacion.FALLIDA,
    ]);
    if (!permitidos.has(imp.estado)) {
      throw importacionEstadoInvalido({ estado: imp.estado });
    }

    imp.estado = EstadoImportacion.CANCELADA;
    imp.updatedById = ctx.usuarioId;
    await this.importacionRepo.save(imp);
    return mapImportacion(imp);
  }

  async plantilla(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_IMPORTAR);

    const { tipo } = plantillaImportacionQuerySchema.parse(query);
    const columnas = [...COLUMNAS_BASE[tipo as TipoImportacion]];

    if (tipo === 'ITEMS') {
      const defs = await this.definicionRepo.find({
        where: {
          organizacionId: ctx.organizacionId!,
          estadoRegistro: EstadoRegistro.ACTIVO,
        },
        order: { orden: 'ASC', codigo: 'ASC' },
      });
      for (const d of defs) {
        columnas.push(`atributo:${d.codigo}`);
      }
    }

    const csv = `${columnas.join(',')}\n`;
    const filename = `plantilla-importacion-${tipo.toLowerCase()}.csv`;
    return { filename, content: Buffer.from(csv, 'utf-8') };
  }

  private assertMapeoCompleto(tipo: TipoImportacion, mapeo: MapeoColumnas) {
    const obligatorios = CAMPOS_OBLIGATORIOS_MAPEO[tipo];
    const faltantes = obligatorios.filter((c) => mapeo[c] === undefined);
    if (faltantes.length > 0) {
      throw importacionMapeoIncompleto(faltantes);
    }
  }

  private async buscar(
    organizacionId: string,
    id: string,
  ): Promise<ImportacionCatalogo> {
    const imp = await this.importacionRepo.findOne({
      where: { id, organizacionId },
    });
    if (!imp) throw importacionNoEncontrada();
    return imp;
  }

  private valorCampo(
    fila: Record<string, string>,
    cabeceras: string[],
    mapeo: MapeoColumnas,
    campo: string,
  ): string {
    const ref = mapeo[campo];
    if (ref === undefined) return '';
    if (typeof ref === 'number') {
      const cab = cabeceras[ref];
      return cab ? (fila[cab] ?? '').trim() : '';
    }
    return (fila[String(ref)] ?? '').trim();
  }

  private async cargarMaestras(organizacionId: string): Promise<ContextoMaestras> {
    const [unidades, marcas, categorias, listas, items, definiciones] =
      await Promise.all([
        this.unidadRepo.find({
          where: {
            organizacionId,
            estadoRegistro: EstadoRegistro.ACTIVO,
          },
        }),
        this.marcaRepo.find({
          where: {
            organizacionId,
            estadoRegistro: EstadoRegistro.ACTIVO,
          },
        }),
        this.categoriaRepo.find({
          where: {
            organizacionId,
            estadoRegistro: EstadoRegistro.ACTIVO,
          },
        }),
        this.listaRepo.find({
          where: {
            organizacionId,
            estadoRegistro: EstadoRegistro.ACTIVO,
          },
        }),
        this.itemRepo.find({ where: { organizacionId } }),
        this.definicionRepo.find({
          where: {
            organizacionId,
            estadoRegistro: EstadoRegistro.ACTIVO,
          },
        }),
      ]);

    const unidadesPorCodigo = new Map(
      unidades.map((u) => [normalizarCodigoUnidad(u.codigo), u]),
    );
    const marcasPorNombre = new Map(
      marcas.map((m) => [normalizarNombreComparacion(m.nombre), m]),
    );
    const listasPorCodigo = new Map(
      listas.map((l) => [l.codigo.trim().toUpperCase(), l]),
    );
    const listaPredeterminada =
      listas.find((l) => l.esPredeterminada) ?? null;
    const itemsPorSku = new Map<string, Item>();
    for (const it of items) {
      if (it.sku) {
        itemsPorSku.set(it.sku.trim().toUpperCase(), it);
      }
    }

    const itemIds = items.map((i) => i.id);
    const aliasActivosPorItem = new Map<string, Set<string>>();
    if (itemIds.length > 0) {
      const alias = await this.aliasRepo.find({
        where: {
          organizacionId,
          itemId: In(itemIds),
          estadoRegistro: EstadoRegistro.ACTIVO,
        },
      });
      for (const a of alias) {
        let set = aliasActivosPorItem.get(a.itemId);
        if (!set) {
          set = new Set();
          aliasActivosPorItem.set(a.itemId, set);
        }
        set.add(a.normalizado);
      }
    }

    return {
      unidadesPorCodigo,
      marcasPorNombre,
      categorias,
      listasPorCodigo,
      listaPredeterminada,
      itemsPorSku,
      definiciones,
      aliasActivosPorItem,
    };
  }

  private async validarFilas(
    organizacionId: string,
    imp: ImportacionCatalogo,
    parseado: ArchivoParseado,
  ): Promise<ResultadoValidacion> {
    const mapeo = imp.mapeoColumnas as MapeoColumnas;
    const maestras = await this.cargarMaestras(organizacionId);
    const errores: FilaError[] = [];
    const items: FilaItemsResuelta[] = [];
    const precios: FilaPreciosResuelta[] = [];
    const alias: FilaAliasResuelta[] = [];
    const advertenciasGlobales: string[] = [];

    const clavesDuplicadas = this.detectarClavesDuplicadas(
      imp.tipo,
      parseado,
      mapeo,
    );

    let altas = 0;
    let actualizaciones = 0;

    for (let i = 0; i < parseado.filas.length; i++) {
      const numFila = i + 1;
      const fila = parseado.filas[i];
      const erroresAntes = errores.length;

      if (imp.tipo === TipoImportacion.ITEMS) {
        const res = this.validarFilaItems(
          numFila,
          fila,
          parseado.cabeceras,
          mapeo,
          maestras,
          clavesDuplicadas,
          errores,
        );
        if (errores.length === erroresAntes && res) {
          items.push(res);
          if (res.esActualizacion) actualizaciones++;
          else altas++;
          advertenciasGlobales.push(...res.advertencias);
        }
      } else if (imp.tipo === TipoImportacion.PRECIOS) {
        const res = this.validarFilaPrecios(
          numFila,
          fila,
          parseado.cabeceras,
          mapeo,
          maestras,
          clavesDuplicadas,
          errores,
        );
        if (errores.length === erroresAntes && res) {
          precios.push(res);
          if (res.esActualizacion) actualizaciones++;
          else altas++;
        }
      } else {
        const res = this.validarFilaAlias(
          numFila,
          fila,
          parseado.cabeceras,
          mapeo,
          maestras,
          clavesDuplicadas,
          errores,
          advertenciasGlobales,
        );
        if (errores.length === erroresAntes && res) {
          alias.push(res);
          altas++;
          advertenciasGlobales.push(...res.advertencias);
        }
      }
    }

    const filasConError = new Set(errores.map((e) => e.fila)).size;
    const filasValidas = parseado.filas.length - filasConError;

    return {
      errores,
      filasValidas,
      filasConError,
      resumen: {
        altas,
        actualizaciones,
        omitidas: filasConError,
        advertencias:
          advertenciasGlobales.length > 0
            ? [...new Set(advertenciasGlobales)]
            : undefined,
      },
      items,
      precios,
      alias,
    };
  }

  private detectarClavesDuplicadas(
    tipo: TipoImportacion,
    parseado: ArchivoParseado,
    mapeo: MapeoColumnas,
  ): Set<string> {
    const ocurrencias = new Map<string, number>();
    for (let i = 0; i < parseado.filas.length; i++) {
      const fila = parseado.filas[i];
      const skuRaw = this.valorCampo(fila, parseado.cabeceras, mapeo, 'sku');
      if (!skuRaw) continue;
      const sku = skuRaw.toUpperCase();
      let clave = sku;
      if (tipo === TipoImportacion.PRECIOS) {
        const lista = this.valorCampo(
          fila,
          parseado.cabeceras,
          mapeo,
          'listaPrecioCodigo',
        ).toUpperCase();
        clave = `${sku}::${lista}`;
      } else if (tipo === TipoImportacion.ALIAS) {
        const alias = this.valorCampo(fila, parseado.cabeceras, mapeo, 'alias');
        clave = `${sku}::${normalizarTexto(alias)}`;
      }
      ocurrencias.set(clave, (ocurrencias.get(clave) ?? 0) + 1);
    }
    return new Set(
      [...ocurrencias.entries()]
        .filter(([, n]) => n > 1)
        .map(([k]) => k),
    );
  }

  private claveDuplicadoFila(
    tipo: TipoImportacion,
    sku: string,
    fila: Record<string, string>,
    cabeceras: string[],
    mapeo: MapeoColumnas,
  ): string {
    if (tipo === TipoImportacion.PRECIOS) {
      const lista = this.valorCampo(
        fila,
        cabeceras,
        mapeo,
        'listaPrecioCodigo',
      ).toUpperCase();
      return `${sku}::${lista}`;
    }
    if (tipo === TipoImportacion.ALIAS) {
      const alias = this.valorCampo(fila, cabeceras, mapeo, 'alias');
      return `${sku}::${normalizarTexto(alias)}`;
    }
    return sku;
  }

  private validarFilaItems(
    numFila: number,
    fila: Record<string, string>,
    cabeceras: string[],
    mapeo: MapeoColumnas,
    m: ContextoMaestras,
    clavesDuplicadas: Set<string>,
    errores: FilaError[],
  ): FilaItemsResuelta | null {
    const skuRaw = this.valorCampo(fila, cabeceras, mapeo, 'sku');
    const sku = skuRaw ? skuRaw.toUpperCase() : null;

    if (sku && clavesDuplicadas.has(sku)) {
      errores.push({
        fila: numFila,
        campo: 'sku',
        codigo: 'SKU_DUPLICADO_EN_ARCHIVO',
        mensaje: 'El SKU aparece más de una vez; corrija el archivo.',
        valorRecibido: skuRaw,
      });
    }

    const nombre = this.valorCampo(fila, cabeceras, mapeo, 'nombre');
    if (!nombre || nombre.length < 3 || nombre.length > 200) {
      errores.push({
        fila: numFila,
        campo: 'nombre',
        codigo: 'NOMBRE_REQUERIDO',
        mensaje: 'El nombre es obligatorio (3 a 200 caracteres).',
        valorRecibido: nombre || undefined,
      });
    }

    const descripcionRaw = this.valorCampo(fila, cabeceras, mapeo, 'descripcion');
    let descripcion: string | null = null;
    if (descripcionRaw) {
      if (descripcionRaw.length > 2000) {
        errores.push({
          fila: numFila,
          campo: 'descripcion',
          codigo: 'DESCRIPCION_INVALIDA',
          mensaje: 'La descripción no puede superar 2000 caracteres.',
          valorRecibido: descripcionRaw.slice(0, 80),
        });
      } else {
        descripcion = descripcionRaw;
      }
    }

    const unidadCodigo = this.valorCampo(fila, cabeceras, mapeo, 'unidadCodigo');
    let unidadId = '';
    if (!unidadCodigo) {
      errores.push({
        fila: numFila,
        campo: 'unidadCodigo',
        codigo: 'UNIDAD_NO_ENCONTRADA',
        mensaje: 'La unidad de medida es obligatoria.',
      });
    } else {
      const unidad = m.unidadesPorCodigo.get(normalizarCodigoUnidad(unidadCodigo));
      if (!unidad) {
        errores.push({
          fila: numFila,
          campo: 'unidadCodigo',
          codigo: 'UNIDAD_NO_ENCONTRADA',
          mensaje: 'No se encontró una unidad activa con ese código.',
          valorRecibido: unidadCodigo,
        });
      } else {
        unidadId = unidad.id;
      }
    }

    const categoriaRaw = this.valorCampo(fila, cabeceras, mapeo, 'categoria');
    let categoriaId: string | null = null;
    if (categoriaRaw) {
      const cat = this.resolverCategoriaPorNombre(m.categorias, categoriaRaw);
      if (!cat) {
        errores.push({
          fila: numFila,
          campo: 'categoria',
          codigo: 'CATEGORIA_NO_ENCONTRADA',
          mensaje: 'No se encontró una categoría activa con ese nombre.',
          valorRecibido: categoriaRaw,
        });
      } else {
        categoriaId = cat.id;
      }
    }

    const marcaRaw = this.valorCampo(fila, cabeceras, mapeo, 'marca');
    let marcaId: string | null = null;
    if (marcaRaw) {
      const marca = m.marcasPorNombre.get(normalizarNombreComparacion(marcaRaw));
      if (!marca) {
        errores.push({
          fila: numFila,
          campo: 'marca',
          codigo: 'MARCA_NO_ENCONTRADA',
          mensaje: 'No se encontró una marca activa con ese nombre.',
          valorRecibido: marcaRaw,
        });
      } else {
        marcaId = marca.id;
      }
    }

    const tipoRaw = this.valorCampo(fila, cabeceras, mapeo, 'tipoItem');
    let tipoItem = TipoItem.FUNGIBLE;
    if (tipoRaw) {
      const upper = tipoRaw.toUpperCase();
      if (!TIPOS_ITEM.has(upper)) {
        errores.push({
          fila: numFila,
          campo: 'tipoItem',
          codigo: 'TIPO_ITEM_INVALIDO',
          mensaje: 'El tipo de item no es válido.',
          valorRecibido: tipoRaw,
        });
      } else {
        tipoItem = upper as TipoItem;
      }
    }

    const controlaRaw = this.valorCampo(fila, cabeceras, mapeo, 'controlaStock');
    const controlaStock = controlaRaw
      ? this.parseBoolean(controlaRaw) ?? false
      : false;
    if (controlaRaw && this.parseBoolean(controlaRaw) === null) {
      errores.push({
        fila: numFila,
        campo: 'controlaStock',
        codigo: 'CONTROLA_STOCK_INVALIDO',
        mensaje: 'controlaStock debe ser true/false o si/no.',
        valorRecibido: controlaRaw,
      });
    }

    const stockRaw = this.valorCampo(fila, cabeceras, mapeo, 'stockAproximado');
    let stockAproximado: string | null = null;
    if (stockRaw) {
      if (!PRECIO_REGEX.test(stockRaw) || Number(stockRaw) < 0) {
        errores.push({
          fila: numFila,
          campo: 'stockAproximado',
          codigo: 'STOCK_INVALIDO',
          mensaje: 'El stock aproximado no es un decimal válido.',
          valorRecibido: stockRaw,
        });
      } else {
        stockAproximado = Number(stockRaw).toFixed(4);
      }
    }

    const atributos: Record<string, unknown> = {};
    for (const [campo, _ref] of Object.entries(mapeo)) {
      if (!campo.startsWith('atributo:')) continue;
      const codigo = campo.slice('atributo:'.length);
      const valor = this.valorCampo(fila, cabeceras, mapeo, campo);
      if (valor !== '') {
        atributos[codigo] = this.parseValorAtributo(valor, codigo, m.definiciones);
      }
    }

    let atributosValidados: Record<string, unknown> = {};
    try {
      atributosValidados = validarAtributos(
        atributos,
        m.definiciones.map((d) => ({
          codigo: d.codigo,
          tipoDato: d.tipoDato as
            | 'TEXTO'
            | 'NUMERO'
            | 'ENTERO'
            | 'BOOLEANO'
            | 'LISTA'
            | 'RANGO_ANIO',
          opciones: d.opciones ?? null,
          requerido: d.requerido,
        })),
      );
    } catch (err) {
      this.acumularErroresAtributo(numFila, err, errores);
    }

    const aliasRaw = this.valorCampo(fila, cabeceras, mapeo, 'alias');
    const aliasList: string[] = [];
    if (aliasRaw) {
      const partes = aliasRaw
        .split('|')
        .map((a) => a.trim())
        .filter(Boolean);
      if (partes.length > LIMITE_ALIAS_POR_CELDA) {
        errores.push({
          fila: numFila,
          campo: 'alias',
          codigo: 'ALIAS_LIMITE_EXCEDIDO',
          mensaje: `Máximo ${LIMITE_ALIAS_POR_CELDA} alias por celda.`,
          valorRecibido: aliasRaw.slice(0, 80),
        });
      } else {
        for (const a of partes) {
          if (a.length < 2 || a.length > 200) {
            errores.push({
              fila: numFila,
              campo: 'alias',
              codigo: 'ALIAS_INVALIDO',
              mensaje: 'Cada alias debe tener entre 2 y 200 caracteres.',
              valorRecibido: a,
            });
          } else {
            aliasList.push(a);
          }
        }
      }
    }

    const precioListaRaw = this.valorCampo(fila, cabeceras, mapeo, 'precioLista');
    const listaCodigoRaw = this.valorCampo(
      fila,
      cabeceras,
      mapeo,
      'listaPrecioCodigo',
    );
    let precioLista: string | null = null;
    let listaPrecioId: string | null = null;
    if (precioListaRaw) {
      if (!PRECIO_REGEX.test(precioListaRaw) || Number(precioListaRaw) <= 0) {
        errores.push({
          fila: numFila,
          campo: 'precioLista',
          codigo: 'PRECIO_INVALIDO',
          mensaje: 'El precio debe ser un decimal positivo con hasta 4 decimales.',
          valorRecibido: precioListaRaw,
        });
      } else {
        precioLista = Number(precioListaRaw).toFixed(4);
        if (listaCodigoRaw) {
          const lista = m.listasPorCodigo.get(listaCodigoRaw.toUpperCase());
          if (!lista) {
            errores.push({
              fila: numFila,
              campo: 'listaPrecioCodigo',
              codigo: 'LISTA_PRECIO_NO_ENCONTRADA',
              mensaje: 'No se encontró una lista de precios activa con ese código.',
              valorRecibido: listaCodigoRaw,
            });
          } else {
            listaPrecioId = lista.id;
          }
        } else if (m.listaPredeterminada) {
          listaPrecioId = m.listaPredeterminada.id;
        } else {
          errores.push({
            fila: numFila,
            campo: 'listaPrecioCodigo',
            codigo: 'LISTA_PRECIO_NO_ENCONTRADA',
            mensaje:
              'No hay lista predeterminada; indique listaPrecioCodigo junto al precio.',
          });
        }
      }
    }

    const itemExistente = sku ? (m.itemsPorSku.get(sku) ?? null) : null;
    const advertencias: string[] = [];
    if (itemExistente && sku) {
      const aliasExistentes = m.aliasActivosPorItem.get(itemExistente.id);
      for (const a of aliasList) {
        const norm = normalizarTexto(a);
        if (aliasExistentes?.has(norm)) {
          errores.push({
            fila: numFila,
            campo: 'alias',
            codigo: 'ALIAS_DUPLICADO',
            mensaje: 'El alias ya existe normalizado en el mismo item.',
            valorRecibido: a,
          });
        }
      }
    }

    const tieneErrorFila = errores.some((e) => e.fila === numFila);
    if (tieneErrorFila) return null;

    return {
      fila: numFila,
      esActualizacion: itemExistente != null,
      itemExistente,
      sku,
      nombre,
      descripcion,
      unidadId,
      categoriaId,
      marcaId,
      tipoItem,
      controlaStock: tipoItem === TipoItem.SERVICIO ? false : controlaStock,
      stockAproximado:
        tipoItem === TipoItem.SERVICIO || !controlaStock
          ? null
          : stockAproximado,
      atributos: atributosValidados,
      alias: aliasList,
      precioLista,
      listaPrecioId,
      advertencias,
    };
  }

  private validarFilaPrecios(
    numFila: number,
    fila: Record<string, string>,
    cabeceras: string[],
    mapeo: MapeoColumnas,
    m: ContextoMaestras,
    clavesDuplicadas: Set<string>,
    errores: FilaError[],
  ): FilaPreciosResuelta | null {
    const skuRaw = this.valorCampo(fila, cabeceras, mapeo, 'sku');
    const sku = skuRaw ? skuRaw.toUpperCase() : '';

    if (!sku) {
      errores.push({
        fila: numFila,
        campo: 'sku',
        codigo: 'ITEM_SKU_NO_ENCONTRADO',
        mensaje: 'El SKU es obligatorio.',
      });
    } else if (
      clavesDuplicadas.has(
        this.claveDuplicadoFila(TipoImportacion.PRECIOS, sku, fila, cabeceras, mapeo),
      )
    ) {
      errores.push({
        fila: numFila,
        campo: 'sku',
        codigo: 'SKU_DUPLICADO_EN_ARCHIVO',
        mensaje: 'El SKU y lista aparecen más de una vez; corrija el archivo.',
        valorRecibido: skuRaw,
      });
    }

    const item = sku ? m.itemsPorSku.get(sku) : undefined;
    if (sku && !item) {
      errores.push({
        fila: numFila,
        campo: 'sku',
        codigo: 'ITEM_SKU_NO_ENCONTRADO',
        mensaje: 'No existe un item con ese SKU en la organización.',
        valorRecibido: skuRaw,
      });
    }

    const listaCodigo = this.valorCampo(
      fila,
      cabeceras,
      mapeo,
      'listaPrecioCodigo',
    );
    let listaPrecioId = '';
    if (!listaCodigo) {
      errores.push({
        fila: numFila,
        campo: 'listaPrecioCodigo',
        codigo: 'LISTA_PRECIO_NO_ENCONTRADA',
        mensaje: 'El código de lista de precios es obligatorio.',
      });
    } else {
      const lista = m.listasPorCodigo.get(listaCodigo.toUpperCase());
      if (!lista) {
        errores.push({
          fila: numFila,
          campo: 'listaPrecioCodigo',
          codigo: 'LISTA_PRECIO_NO_ENCONTRADA',
          mensaje: 'No se encontró una lista de precios activa con ese código.',
          valorRecibido: listaCodigo,
        });
      } else {
        listaPrecioId = lista.id;
      }
    }

    const precioRaw = this.valorCampo(fila, cabeceras, mapeo, 'precio');
    let precio = '';
    if (!precioRaw || !PRECIO_REGEX.test(precioRaw) || Number(precioRaw) <= 0) {
      errores.push({
        fila: numFila,
        campo: 'precio',
        codigo: 'PRECIO_INVALIDO',
        mensaje: 'El precio debe ser un decimal positivo con hasta 4 decimales.',
        valorRecibido: precioRaw || undefined,
      });
    } else {
      precio = Number(precioRaw).toFixed(4);
    }

    if (errores.some((e) => e.fila === numFila) || !item) return null;

    return {
      fila: numFila,
      itemId: item.id,
      listaPrecioId,
      precio,
      esActualizacion: false, // se determina al persistir; para resumen preliminar
    };
  }

  private validarFilaAlias(
    numFila: number,
    fila: Record<string, string>,
    cabeceras: string[],
    mapeo: MapeoColumnas,
    m: ContextoMaestras,
    clavesDuplicadas: Set<string>,
    errores: FilaError[],
    _advertenciasGlobales: string[],
  ): FilaAliasResuelta | null {
    const skuRaw = this.valorCampo(fila, cabeceras, mapeo, 'sku');
    const sku = skuRaw ? skuRaw.toUpperCase() : '';

    if (!sku) {
      errores.push({
        fila: numFila,
        campo: 'sku',
        codigo: 'ITEM_SKU_NO_ENCONTRADO',
        mensaje: 'El SKU es obligatorio.',
      });
    } else if (
      clavesDuplicadas.has(
        this.claveDuplicadoFila(TipoImportacion.ALIAS, sku, fila, cabeceras, mapeo),
      )
    ) {
      errores.push({
        fila: numFila,
        campo: 'sku',
        codigo: 'SKU_DUPLICADO_EN_ARCHIVO',
        mensaje: 'El SKU y alias aparecen más de una vez; corrija el archivo.',
        valorRecibido: skuRaw,
      });
    }

    const item = sku ? m.itemsPorSku.get(sku) : undefined;
    if (sku && !item) {
      errores.push({
        fila: numFila,
        campo: 'sku',
        codigo: 'ITEM_SKU_NO_ENCONTRADO',
        mensaje: 'No existe un item con ese SKU en la organización.',
        valorRecibido: skuRaw,
      });
    }

    const aliasRaw = this.valorCampo(fila, cabeceras, mapeo, 'alias');
    let normalizado = '';
    if (!aliasRaw || aliasRaw.length < 2 || aliasRaw.length > 200) {
      errores.push({
        fila: numFila,
        campo: 'alias',
        codigo: 'ALIAS_INVALIDO',
        mensaje: 'El alias debe tener entre 2 y 200 caracteres.',
        valorRecibido: aliasRaw || undefined,
      });
    } else {
      normalizado = normalizarTexto(aliasRaw);
      if (normalizado.length < 2) {
        errores.push({
          fila: numFila,
          campo: 'alias',
          codigo: 'ALIAS_INVALIDO',
          mensaje: 'El alias normalizado es demasiado corto.',
          valorRecibido: aliasRaw,
        });
      }
    }

    const advertencias: string[] = [];
    if (item && normalizado) {
      const existentes = m.aliasActivosPorItem.get(item.id);
      if (existentes?.has(normalizado)) {
        errores.push({
          fila: numFila,
          campo: 'alias',
          codigo: 'ALIAS_DUPLICADO',
          mensaje: 'El alias ya existe normalizado en el mismo item.',
          valorRecibido: aliasRaw,
        });
      }

      for (const [itemId, set] of m.aliasActivosPorItem) {
        if (itemId === item.id) continue;
        if (set.has(normalizado)) {
          advertencias.push('ALIAS_COMPARTIDO_CON_OTRO_ITEM');
          break;
        }
      }
    }

    if (errores.some((e) => e.fila === numFila) || !item || !aliasRaw) {
      return null;
    }

    return {
      fila: numFila,
      itemId: item.id,
      alias: aliasRaw,
      normalizado,
      advertencias,
    };
  }

  private resolverCategoriaPorNombre(
    categorias: Categoria[],
    valor: string,
  ): Categoria | null {
    const partes = valor.split('>').map((p) => p.trim()).filter(Boolean);
    if (partes.length === 0) return null;

    if (partes.length === 1) {
      const clave = normalizarNombreComparacion(partes[0]);
      const matches = categorias.filter(
        (c) => normalizarNombreComparacion(c.nombre) === clave,
      );
      if (matches.length === 1) return matches[0];
      const raiz = matches.find((c) => !c.categoriaPadreId);
      return raiz ?? matches[0] ?? null;
    }

    let categoriaActual: Categoria | undefined;
    for (const parte of partes) {
      const clave = normalizarNombreComparacion(parte);
      const padreIdEsperado =
        categoriaActual === undefined ? null : categoriaActual.id;
      categoriaActual = categorias.find(
        (c) =>
          normalizarNombreComparacion(c.nombre) === clave &&
          (c.categoriaPadreId ?? null) === padreIdEsperado,
      );
      if (!categoriaActual) return null;
    }
    return categoriaActual ?? null;
  }

  private parseBoolean(valor: string): boolean | null {
    const v = valor.trim().toLowerCase();
    if (['true', 'si', 'sí', '1', 'yes', 's'].includes(v)) return true;
    if (['false', 'no', '0', 'n'].includes(v)) return false;
    return null;
  }

  private parseValorAtributo(
    valor: string,
    codigo: string,
    definiciones: DefinicionAtributo[],
  ): unknown {
    const def = definiciones.find((d) => d.codigo === codigo);
    if (!def) return valor;
    switch (def.tipoDato) {
      case 'BOOLEANO': {
        const b = this.parseBoolean(valor);
        return b === null ? valor : b;
      }
      case 'ENTERO': {
        const n = Number(valor);
        return Number.isInteger(n) ? n : valor;
      }
      case 'NUMERO':
        return valor;
      case 'RANGO_ANIO': {
        try {
          const parsed = JSON.parse(valor) as unknown;
          return parsed;
        } catch {
          const parts = valor.split(/[-–]/).map((p) => p.trim());
          if (parts.length === 2) {
            return {
              desde: Number(parts[0]),
              hasta: Number(parts[1]),
            };
          }
          return valor;
        }
      }
      default:
        return valor;
    }
  }

  private acumularErroresAtributo(
    numFila: number,
    err: unknown,
    errores: FilaError[],
  ) {
    if (
      err instanceof AppError &&
      err.details &&
      typeof err.details === 'object' &&
      err.details !== null &&
      'errores' in err.details
    ) {
      const lista = (err.details as { errores: Array<{
        code?: string;
        message?: string;
        clave?: string;
      }> }).errores;
      for (const e of lista) {
        const code = e.code ?? 'ATRIBUTO_INVALIDO';
        errores.push({
          fila: numFila,
          campo: e.clave ? `atributo:${e.clave}` : undefined,
          codigo: code.startsWith('ITEM_') ? code.replace(/^ITEM_/, '') : code,
          mensaje: e.message ?? err.message,
        });
      }
      return;
    }
    if (err instanceof AppError) {
      errores.push({
        fila: numFila,
        campo: 'atributos',
        codigo: err.code.startsWith('ITEM_')
          ? err.code.replace(/^ITEM_/, '')
          : err.code,
        mensaje: err.message,
      });
      return;
    }
    errores.push({
      fila: numFila,
      campo: 'atributos',
      codigo: 'ATRIBUTO_INVALIDO',
      mensaje: err instanceof Error ? err.message : 'Atributos inválidos.',
    });
  }

  private construirResumenConfirmacion(
    resultado: ResultadoValidacion,
    simular: boolean,
  ): ResumenImportacionDto {
    const altas = resultado.resumen?.altas ?? 0;
    const actualizaciones = resultado.resumen?.actualizaciones ?? 0;
    return {
      altas,
      actualizaciones,
      omitidas: resultado.filasConError,
      filasAplicadas: resultado.filasValidas,
      filasOmitidas: resultado.filasConError,
      filasActualizadas: actualizaciones,
      advertencias: resultado.resumen?.advertencias,
      simulado: simular,
    };
  }

  private async persistirItems(
    manager: EntityManager,
    organizacionId: string,
    usuarioId: string,
    filas: FilaItemsResuelta[],
  ) {
    for (const f of filas) {
      let item: Item;
      if (f.itemExistente) {
        item = f.itemExistente;
        item.nombre = f.nombre;
        item.descripcion = f.descripcion;
        item.unidadMedidaId = f.unidadId;
        item.categoriaId = f.categoriaId;
        item.marcaId = f.marcaId;
        item.tipoItem = f.tipoItem;
        item.controlaStock = f.controlaStock;
        item.stockAproximado = f.stockAproximado;
        item.atributos = f.atributos;
        item.updatedById = usuarioId;
        await manager.save(Item, item);
      } else {
        item = manager.create(Item, {
          organizacionId,
          sku: f.sku,
          nombre: f.nombre,
          descripcion: f.descripcion,
          unidadMedidaId: f.unidadId,
          categoriaId: f.categoriaId,
          marcaId: f.marcaId,
          tipoItem: f.tipoItem,
          controlaStock: f.controlaStock,
          stockAproximado: f.stockAproximado,
          atributos: f.atributos,
          textoBusqueda: '',
          estadoRegistro: EstadoRegistro.ACTIVO,
          createdById: usuarioId,
          updatedById: usuarioId,
        });
        await manager.save(Item, item);
      }

      for (const texto of f.alias) {
        await this.upsertAliasTx(
          manager,
          organizacionId,
          item.id,
          texto,
          usuarioId,
        );
      }

      if (f.precioLista && f.listaPrecioId) {
        await this.upsertPrecioTx(
          manager,
          organizacionId,
          f.listaPrecioId,
          item.id,
          f.precioLista,
          usuarioId,
        );
      }

      item.textoBusqueda = await this.itemsUso.construirTextoBusqueda(
        manager,
        organizacionId,
        item,
      );
      item.updatedById = usuarioId;
      await manager.save(Item, item);
    }
  }

  private async persistirPrecios(
    manager: EntityManager,
    organizacionId: string,
    usuarioId: string,
    filas: FilaPreciosResuelta[],
  ) {
    for (const f of filas) {
      await this.upsertPrecioTx(
        manager,
        organizacionId,
        f.listaPrecioId,
        f.itemId,
        f.precio,
        usuarioId,
      );
    }
  }

  private async persistirAlias(
    manager: EntityManager,
    organizacionId: string,
    usuarioId: string,
    filas: FilaAliasResuelta[],
  ) {
    const itemsTocados = new Map<string, Item>();
    for (const f of filas) {
      await this.upsertAliasTx(
        manager,
        organizacionId,
        f.itemId,
        f.alias,
        usuarioId,
      );
      if (!itemsTocados.has(f.itemId)) {
        const item = await manager.findOne(Item, {
          where: { id: f.itemId, organizacionId },
        });
        if (item) itemsTocados.set(f.itemId, item);
      }
    }

    for (const item of itemsTocados.values()) {
      item.textoBusqueda = await this.itemsUso.construirTextoBusqueda(
        manager,
        organizacionId,
        item,
      );
      item.updatedById = usuarioId;
      await manager.save(Item, item);
    }
  }

  private async upsertAliasTx(
    manager: EntityManager,
    organizacionId: string,
    itemId: string,
    aliasTexto: string,
    usuarioId: string,
  ) {
    const normalizado = normalizarTexto(aliasTexto);
    const existente = await manager.findOne(ItemAlias, {
      where: { itemId, normalizado },
    });
    if (existente) {
      if (existente.estadoRegistro === EstadoRegistro.ACTIVO) {
        return;
      }
      existente.alias = aliasTexto;
      existente.origen = OrigenAlias.IMPORTADO;
      existente.estadoRegistro = EstadoRegistro.ACTIVO;
      existente.updatedById = usuarioId;
      await manager.save(ItemAlias, existente);
      return;
    }

    await manager.save(
      ItemAlias,
      manager.create(ItemAlias, {
        organizacionId,
        itemId,
        alias: aliasTexto,
        normalizado,
        origen: OrigenAlias.IMPORTADO,
        vecesUsado: 0,
        estadoRegistro: EstadoRegistro.ACTIVO,
        createdById: usuarioId,
        updatedById: usuarioId,
      }),
    );
  }

  private async upsertPrecioTx(
    manager: EntityManager,
    organizacionId: string,
    listaPrecioId: string,
    itemId: string,
    precio: string,
    usuarioId: string,
  ) {
    const existente = await manager.findOne(PrecioItem, {
      where: { listaPrecioId, itemId },
    });
    if (existente) {
      existente.precio = precio;
      existente.estadoRegistro = EstadoRegistro.ACTIVO;
      existente.updatedById = usuarioId;
      await manager.save(PrecioItem, existente);
      return;
    }

    await manager.save(
      PrecioItem,
      manager.create(PrecioItem, {
        organizacionId,
        listaPrecioId,
        itemId,
        precio,
        estadoRegistro: EstadoRegistro.ACTIVO,
        createdById: usuarioId,
        updatedById: usuarioId,
      }),
    );
  }
}

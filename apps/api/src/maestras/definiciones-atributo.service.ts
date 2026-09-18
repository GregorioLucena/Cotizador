import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DefinicionAtributo,
  EstadoRegistro,
  TipoDatoAtributo,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  crearDefinicionAtributoSchema,
  definicionAtributoNoEncontrada,
  definicionCodigoDuplicado,
  definicionCodigoInmutable,
  definicionOpcionEnUso,
  definicionOpcionesRequeridas,
  definicionTipoInmutable,
  editarDefinicionAtributoSchema,
  listQuerySchema,
  maestraEnUso,
  normalizarCodigoDefinicion,
  requireOrganizacionContext,
  requirePermission,
  ValidationError,
} from '@cotizador/shared';
import { DataSource, Not, Repository } from 'typeorm';
import { ItemsUsoHelper } from './items-uso.helper';
import { mapDefinicionAtributo } from './maestras.mapper';

@Injectable()
export class DefinicionesAtributoService {
  constructor(
    @InjectRepository(DefinicionAtributo)
    private readonly definicionRepo: Repository<DefinicionAtributo>,
    private readonly itemsUso: ItemsUsoHelper,
    private readonly dataSource: DataSource,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_VER);

    const { page, limit, search, estadoRegistro } = listQuerySchema.parse(query);
    const qb = this.definicionRepo
      .createQueryBuilder('d')
      .where('d.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (estadoRegistro !== 'TODOS') {
      qb.andWhere('d.estadoRegistro = :estado', { estado: estadoRegistro });
    }
    if (search) {
      qb.andWhere('(d.codigo ILIKE :search OR d.etiqueta ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('d.orden', 'ASC')
      .addOrderBy('d.etiqueta', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(mapDefinicionAtributo),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async crear(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_ADMINISTRAR);

    const input = crearDefinicionAtributoSchema.parse(body);
    const codigo = normalizarCodigoDefinicion(input.codigo);
    await this.asegurarCodigoUnico(ctx.organizacionId!, codigo);

    const opciones =
      input.tipoDato === 'LISTA' ? (input.opciones ?? null) : null;
    if (input.tipoDato === 'LISTA' && (!opciones || opciones.length === 0)) {
      throw definicionOpcionesRequeridas();
    }

    const orden =
      input.orden ?? (await this.siguienteOrden(ctx.organizacionId!));

    const definicion = this.definicionRepo.create({
      organizacionId: ctx.organizacionId!,
      codigo,
      etiqueta: input.etiqueta,
      tipoDato: input.tipoDato as TipoDatoAtributo,
      opciones,
      unidadSugerida: input.unidadSugerida ?? null,
      requerido: input.requerido,
      usarEnBusqueda: input.usarEnBusqueda,
      orden,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });
    await this.definicionRepo.save(definicion);
    return mapDefinicionAtributo(definicion);
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_ADMINISTRAR);

    const input = editarDefinicionAtributoSchema.parse(body);
    const definicion = await this.buscar(ctx.organizacionId!, id);
    let regenerarTexto = false;

    if (input.codigo !== undefined) {
      const codigo = normalizarCodigoDefinicion(input.codigo);
      if (codigo !== definicion.codigo) {
        throw definicionCodigoInmutable();
      }
    }

    if (
      input.tipoDato !== undefined &&
      input.tipoDato !== definicion.tipoDato
    ) {
      const enUso =
        await this.itemsUso.contarCualquierEstadoPorClaveAtributo(
          ctx.organizacionId!,
          definicion.codigo,
        );
      if (enUso > 0) {
        throw definicionTipoInmutable();
      }
      definicion.tipoDato = input.tipoDato as TipoDatoAtributo;

      if (input.tipoDato === 'LISTA') {
        const opciones = input.opciones ?? definicion.opciones;
        if (!opciones || opciones.length === 0) {
          throw definicionOpcionesRequeridas();
        }
        this.validarOpcionesSinDuplicados(opciones);
        definicion.opciones = opciones;
      } else {
        definicion.opciones = null;
      }
    } else if (input.opciones !== undefined) {
      if (definicion.tipoDato !== TipoDatoAtributo.LISTA) {
        definicion.opciones = null;
      } else {
        if (!input.opciones || input.opciones.length === 0) {
          throw definicionOpcionesRequeridas();
        }
        this.validarOpcionesSinDuplicados(input.opciones);
        await this.asegurarOpcionesRemovidasNoEnUso(
          ctx.organizacionId!,
          definicion,
          input.opciones,
        );
        definicion.opciones = input.opciones;
      }
    }

    if (input.etiqueta !== undefined) {
      definicion.etiqueta = input.etiqueta;
    }
    if (input.unidadSugerida !== undefined) {
      definicion.unidadSugerida = input.unidadSugerida;
    }
    if (input.requerido !== undefined) {
      definicion.requerido = input.requerido;
    }
    if (input.orden !== undefined) {
      definicion.orden = input.orden;
    }

    if (
      input.usarEnBusqueda !== undefined &&
      input.usarEnBusqueda !== definicion.usarEnBusqueda
    ) {
      definicion.usarEnBusqueda = input.usarEnBusqueda;
      regenerarTexto = true;
    }

    if (
      input.estadoRegistro === 'INACTIVO' &&
      definicion.estadoRegistro === EstadoRegistro.ACTIVO
    ) {
      const itemsActivos = await this.itemsUso.contarActivosPorClaveAtributo(
        ctx.organizacionId!,
        definicion.codigo,
      );
      if (itemsActivos > 0) {
        throw maestraEnUso({
          tipo: 'definicion_atributo',
          id,
          itemsActivos,
        });
      }
      definicion.estadoRegistro = EstadoRegistro.INACTIVO;
    } else if (input.estadoRegistro === 'ACTIVO') {
      definicion.estadoRegistro = EstadoRegistro.ACTIVO;
    }

    definicion.updatedById = ctx.usuarioId;

    if (regenerarTexto) {
      return this.dataSource.transaction(async (manager) => {
        await manager.save(DefinicionAtributo, definicion);
        await this.itemsUso.regenerarTextoPorClaveAtributo(
          manager,
          ctx.organizacionId!,
          definicion.codigo,
        );
        return mapDefinicionAtributo(definicion);
      });
    }

    await this.definicionRepo.save(definicion);
    return mapDefinicionAtributo(definicion);
  }

  private async buscar(
    organizacionId: string,
    id: string,
  ): Promise<DefinicionAtributo> {
    const definicion = await this.definicionRepo.findOne({
      where: { id, organizacionId },
    });
    if (!definicion) throw definicionAtributoNoEncontrada();
    return definicion;
  }

  private async asegurarCodigoUnico(
    organizacionId: string,
    codigo: string,
    excluirId?: string,
  ) {
    const where = excluirId
      ? { organizacionId, codigo, id: Not(excluirId) }
      : { organizacionId, codigo };
    const existe = await this.definicionRepo.findOne({ where });
    if (existe) throw definicionCodigoDuplicado();
  }

  private validarOpcionesSinDuplicados(opciones: string[]) {
    const lower = opciones.map((o) => o.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      throw new ValidationError(
        { opciones: ['Las opciones no pueden duplicarse'] },
        'Las opciones no pueden duplicarse.',
      );
    }
  }

  private async asegurarOpcionesRemovidasNoEnUso(
    organizacionId: string,
    definicion: DefinicionAtributo,
    nuevasOpciones: string[],
  ) {
    const actuales = definicion.opciones ?? [];
    const nuevasLower = new Set(nuevasOpciones.map((o) => o.toLowerCase()));
    const removidas = actuales.filter(
      (o) => !nuevasLower.has(o.toLowerCase()),
    );

    for (const opcion of removidas) {
      const items = await this.itemsUso.contarOpcionEnUso(
        organizacionId,
        definicion.codigo,
        opcion,
      );
      if (items > 0) {
        throw definicionOpcionEnUso({
          codigo: definicion.codigo,
          opcion,
          items,
        });
      }
    }
  }

  private async siguienteOrden(organizacionId: string): Promise<number> {
    const raw = await this.definicionRepo
      .createQueryBuilder('d')
      .select('COALESCE(MAX(d.orden), -1)', 'max')
      .where('d.organizacionId = :organizacionId', { organizacionId })
      .getRawOne<{ max: string }>();
    return Number(raw?.max ?? -1) + 1;
  }
}

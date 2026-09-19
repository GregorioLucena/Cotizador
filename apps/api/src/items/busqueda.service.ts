import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EstadoRegistro,
  Item,
  ItemAlias,
  ItemAplicacion,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  buscarItemsQuerySchema,
  itemBusquedaConsultaMuyCorta,
  normalizarTexto,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { Repository } from 'typeorm';

const UMBRAL_SIMILITUD = 0.3;

type OrigenMatch =
  | 'SKU'
  | 'ALIAS_EXACTO'
  | 'ALIAS_SIMILITUD'
  | 'TEXTO_SIMILITUD';

type Candidato = {
  itemId: string;
  sku: string | null;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  unidadCodigo: string;
  atributos: Record<string, unknown>;
  puntaje: number;
  origenMatch: OrigenMatch;
  aliasCoincidente: string | null;
  stockAproximado: string | null;
  controlaStock: boolean;
};

@Injectable()
export class BusquedaService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(ItemAlias)
    private readonly aliasRepo: Repository<ItemAlias>,
    @InjectRepository(ItemAplicacion)
    private readonly aplicacionRepo: Repository<ItemAplicacion>,
  ) {}

  async buscar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_VER);

    const input = buscarItemsQuerySchema.parse(query);
    const qNorm = normalizarTexto(input.q);
    if (qNorm.length < 2) {
      throw itemBusquedaConsultaMuyCorta();
    }

    const estado = input.estadoRegistro ?? EstadoRegistro.ACTIVO;
    const limit = input.limit;
    const orgId = ctx.organizacionId!;
    const atributosFiltro = this.extraerAtributosQuery(query);
    const porId = new Map<string, Candidato>();

    // 1. SKU exacto
    const skuQb = this.itemRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.marca', 'marca')
      .leftJoinAndSelect('i.categoria', 'categoria')
      .leftJoinAndSelect('i.unidadMedida', 'unidad')
      .where('i.organizacionId = :orgId', { orgId })
      .andWhere('i.estadoRegistro = :estado', { estado })
      .andWhere('UPPER(TRIM(i.sku)) = :sku', {
        sku: input.q.trim().toUpperCase(),
      });
    this.aplicarFiltrosEstructurados(skuQb, input, atributosFiltro);
    for (const item of await skuQb.getMany()) {
      porId.set(item.id, this.mapCandidato(item, 1, 'SKU', null));
    }

    // 2. Alias exacto
    const aliasExactos = await this.aliasRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.item', 'i')
      .leftJoinAndSelect('i.marca', 'marca')
      .leftJoinAndSelect('i.categoria', 'categoria')
      .leftJoinAndSelect('i.unidadMedida', 'unidad')
      .where('a.organizacionId = :orgId', { orgId })
      .andWhere('a.estadoRegistro = :estadoAlias', {
        estadoAlias: EstadoRegistro.ACTIVO,
      })
      .andWhere('a.normalizado = :qNorm', { qNorm })
      .andWhere('i.estadoRegistro = :estado', { estado })
      .getMany();

    for (const a of aliasExactos) {
      if (porId.has(a.itemId)) continue;
      if (!this.pasaFiltros(a.item, input, atributosFiltro)) continue;
      porId.set(
        a.itemId,
        this.mapCandidato(a.item, 1, 'ALIAS_EXACTO', a.alias),
      );
    }

    // 3. Similitud sobre alias
    const aliasSim = await this.aliasRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.item', 'i')
      .leftJoinAndSelect('i.marca', 'marca')
      .leftJoinAndSelect('i.categoria', 'categoria')
      .leftJoinAndSelect('i.unidadMedida', 'unidad')
      .addSelect('similarity(a.normalizado, :qNorm)', 'sim')
      .where('a.organizacionId = :orgId', { orgId })
      .andWhere('a.estadoRegistro = :estadoAlias', {
        estadoAlias: EstadoRegistro.ACTIVO,
      })
      .andWhere('i.estadoRegistro = :estado', { estado })
      .andWhere('similarity(a.normalizado, :qNorm) >= :umbral', {
        qNorm,
        umbral: UMBRAL_SIMILITUD,
      })
      .orderBy('sim', 'DESC')
      .limit(limit * 2)
      .getRawAndEntities();

    for (let i = 0; i < aliasSim.entities.length; i++) {
      const a = aliasSim.entities[i];
      if (porId.has(a.itemId)) continue;
      if (!this.pasaFiltros(a.item, input, atributosFiltro)) continue;
      const sim = Number(aliasSim.raw[i]?.sim ?? 0);
      porId.set(
        a.itemId,
        this.mapCandidato(a.item, sim, 'ALIAS_SIMILITUD', a.alias),
      );
    }

    // 4. Similitud sobre textoBusqueda
    const textoQb = this.itemRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.marca', 'marca')
      .leftJoinAndSelect('i.categoria', 'categoria')
      .leftJoinAndSelect('i.unidadMedida', 'unidad')
      .addSelect('similarity(i.textoBusqueda, :qNorm)', 'sim')
      .where('i.organizacionId = :orgId', { orgId })
      .andWhere('i.estadoRegistro = :estado', { estado })
      .andWhere('similarity(i.textoBusqueda, :qNorm) >= :umbral', {
        qNorm,
        umbral: UMBRAL_SIMILITUD,
      });
    this.aplicarFiltrosEstructurados(textoQb, input, atributosFiltro);
    textoQb.orderBy('sim', 'DESC').addOrderBy('i.nombre', 'ASC').limit(limit * 2);

    const textoRes = await textoQb.getRawAndEntities();
    for (let i = 0; i < textoRes.entities.length; i++) {
      const item = textoRes.entities[i];
      if (porId.has(item.id)) continue;
      const sim = Number(textoRes.raw[i]?.sim ?? 0);
      porId.set(
        item.id,
        this.mapCandidato(item, sim, 'TEXTO_SIMILITUD', null),
      );
    }

    // 5. Similitud sobre aplicaciones (fuente adicional de candidatos)
    const appSim = await this.aplicacionRepo
      .createQueryBuilder('ap')
      .innerJoinAndSelect('ap.item', 'i')
      .leftJoinAndSelect('i.marca', 'marca')
      .leftJoinAndSelect('i.categoria', 'categoria')
      .leftJoinAndSelect('i.unidadMedida', 'unidad')
      .addSelect('similarity(ap.textoNormalizado, :qNorm)', 'sim')
      .where('ap.organizacionId = :orgId', { orgId })
      .andWhere('ap.estadoRegistro = :estadoApp', {
        estadoApp: EstadoRegistro.ACTIVO,
      })
      .andWhere('i.estadoRegistro = :estado', { estado })
      .andWhere('similarity(ap.textoNormalizado, :qNorm) >= :umbral', {
        qNorm,
        umbral: UMBRAL_SIMILITUD,
      })
      .orderBy('sim', 'DESC')
      .limit(limit * 2)
      .getRawAndEntities();

    for (let i = 0; i < appSim.entities.length; i++) {
      const ap = appSim.entities[i];
      if (porId.has(ap.itemId)) continue;
      if (!this.pasaFiltros(ap.item, input, atributosFiltro)) continue;
      const sim = Number(appSim.raw[i]?.sim ?? 0);
      porId.set(
        ap.itemId,
        this.mapCandidato(ap.item, sim, 'TEXTO_SIMILITUD', null),
      );
    }

    const prioridad: Record<OrigenMatch, number> = {
      SKU: 0,
      ALIAS_EXACTO: 1,
      ALIAS_SIMILITUD: 2,
      TEXTO_SIMILITUD: 3,
    };

    const ordenados = [...porId.values()].sort((a, b) => {
      const pa = prioridad[a.origenMatch];
      const pb = prioridad[b.origenMatch];
      if (pa !== pb) return pa - pb;
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      return a.nombre.localeCompare(b.nombre);
    });

    return ordenados.slice(0, limit).map((c) => ({
      itemId: c.itemId,
      sku: c.sku,
      nombre: c.nombre,
      marca: c.marca,
      categoria: c.categoria,
      unidadCodigo: c.unidadCodigo,
      atributos: c.atributos,
      puntaje: c.puntaje.toFixed(4),
      origenMatch: c.origenMatch,
      aliasCoincidente: c.aliasCoincidente,
      precio: null as string | null,
      stockAproximado: c.controlaStock ? c.stockAproximado : null,
    }));
  }

  private mapCandidato(
    item: Item,
    puntaje: number,
    origenMatch: OrigenMatch,
    aliasCoincidente: string | null,
  ): Candidato {
    return {
      itemId: item.id,
      sku: item.sku ?? null,
      nombre: item.nombre,
      marca: item.marca?.nombre ?? null,
      categoria: item.categoria?.nombre ?? null,
      unidadCodigo: item.unidadMedida?.codigo ?? '',
      atributos: item.atributos ?? {},
      puntaje,
      origenMatch,
      aliasCoincidente,
      stockAproximado: item.stockAproximado ?? null,
      controlaStock: item.controlaStock,
    };
  }

  private extraerAtributosQuery(query: unknown): Record<string, string> {
    if (!query || typeof query !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(query as Record<string, unknown>)) {
      if (k.startsWith('atributo.') && typeof v === 'string') {
        out[k.slice('atributo.'.length)] = v;
      }
    }
    return out;
  }

  private aplicarFiltrosEstructurados(
    qb: ReturnType<Repository<Item>['createQueryBuilder']>,
    input: {
      categoriaId?: string;
      marcaId?: string;
      tipoItem?: string;
    },
    atributos: Record<string, string>,
  ) {
    if (input.categoriaId) {
      qb.andWhere('i.categoriaId = :categoriaId', {
        categoriaId: input.categoriaId,
      });
    }
    if (input.marcaId) {
      qb.andWhere('i.marcaId = :marcaId', { marcaId: input.marcaId });
    }
    if (input.tipoItem) {
      qb.andWhere('i.tipoItem = :tipoItem', { tipoItem: input.tipoItem });
    }
    for (const [codigo, valor] of Object.entries(atributos)) {
      const param = `attr_${codigo}`;
      qb.andWhere(`i.atributos @> :${param}::jsonb`, {
        [param]: JSON.stringify({ [codigo]: valor }),
      });
    }
  }

  private pasaFiltros(
    item: Item,
    input: {
      categoriaId?: string;
      marcaId?: string;
      tipoItem?: string;
    },
    atributos: Record<string, string>,
  ): boolean {
    if (input.categoriaId && item.categoriaId !== input.categoriaId) {
      return false;
    }
    if (input.marcaId && item.marcaId !== input.marcaId) return false;
    if (input.tipoItem && item.tipoItem !== input.tipoItem) return false;
    for (const [codigo, valor] of Object.entries(atributos)) {
      if (String((item.atributos ?? {})[codigo]) !== valor) return false;
    }
    return true;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EstadoRegistro,
  Item,
  ItemAlias,
} from '@cotizador/database';
import {
  type CandidatoResolucion,
  type ResultadoResolucionLinea,
  type UmbralesResolucion,
  PUNTAJE_ALIAS_EXACTO,
  PUNTAJE_SKU,
  clasificarResolucion,
  mapearSimilitudAlias,
  mapearSimilitudAtributo,
  mapearSimilitudTexto,
  normalizarTexto,
} from '@cotizador/shared';
import { EntityManager, Repository } from 'typeorm';

const UMBRAL_SIM_MIN = 0.3;
const LIMITE_POR_ESTRATEGIA = 10;

@Injectable()
export class ResolucionCatalogoService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(ItemAlias)
    private readonly aliasRepo: Repository<ItemAlias>,
  ) {}

  /**
   * Cascada SKU → alias exacto → similitud alias → textoBusqueda → atributos.
   * Detiene la cascada al superar umbral automático, pero sigue poblando candidatos.
   */
  async resolverLinea(
    organizacionId: string,
    textoSolicitado: string,
    umbrales: UmbralesResolucion,
    manager?: EntityManager,
  ): Promise<ResultadoResolucionLinea> {
    const itemRepo = manager ? manager.getRepository(Item) : this.itemRepo;
    const aliasRepo = manager
      ? manager.getRepository(ItemAlias)
      : this.aliasRepo;

    const qNorm = normalizarTexto(textoSolicitado);
    const candidatos: CandidatoResolucion[] = [];
    let alcanzoAutomatico = false;

    // 1. SKU exacto
    const skuItems = await itemRepo
      .createQueryBuilder('i')
      .where('i.organizacionId = :organizacionId', { organizacionId })
      .andWhere('i.estadoRegistro = :estado', { estado: EstadoRegistro.ACTIVO })
      .andWhere('UPPER(TRIM(i.sku)) = :sku', {
        sku: textoSolicitado.trim().toUpperCase(),
      })
      .limit(LIMITE_POR_ESTRATEGIA)
      .getMany();

    for (const item of skuItems) {
      candidatos.push({
        itemId: item.id,
        nombre: item.nombre,
        sku: item.sku,
        puntaje: PUNTAJE_SKU,
        origenMatch: 'SKU',
      });
      if (PUNTAJE_SKU >= umbrales.umbralAutomatico) alcanzoAutomatico = true;
    }

    // 2. Alias exacto
    const aliasExactos = await aliasRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.item', 'i')
      .where('a.organizacionId = :organizacionId', { organizacionId })
      .andWhere('a.estadoRegistro = :estadoAlias', {
        estadoAlias: EstadoRegistro.ACTIVO,
      })
      .andWhere('a.normalizado = :qNorm', { qNorm })
      .andWhere('i.estadoRegistro = :estado', { estado: EstadoRegistro.ACTIVO })
      .limit(LIMITE_POR_ESTRATEGIA)
      .getMany();

    for (const a of aliasExactos) {
      candidatos.push({
        itemId: a.itemId,
        nombre: a.item.nombre,
        sku: a.item.sku,
        puntaje: PUNTAJE_ALIAS_EXACTO,
        origenMatch: 'ALIAS_EXACTO',
        aliasId: a.id,
      });
      if (PUNTAJE_ALIAS_EXACTO >= umbrales.umbralAutomatico) {
        alcanzoAutomatico = true;
      }
    }

    // 3–5 siempre se ejecutan (hasta límite) para poblar candidatos
    const aliasSim = await aliasRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.item', 'i')
      .addSelect('similarity(a.normalizado, :qNorm)', 'sim')
      .where('a.organizacionId = :organizacionId', { organizacionId })
      .andWhere('a.estadoRegistro = :estadoAlias', {
        estadoAlias: EstadoRegistro.ACTIVO,
      })
      .andWhere('i.estadoRegistro = :estado', { estado: EstadoRegistro.ACTIVO })
      .andWhere('similarity(a.normalizado, :qNorm) >= :umbral', {
        qNorm,
        umbral: UMBRAL_SIM_MIN,
      })
      .orderBy('sim', 'DESC')
      .limit(LIMITE_POR_ESTRATEGIA)
      .getRawAndEntities();

    for (let i = 0; i < aliasSim.entities.length; i++) {
      const a = aliasSim.entities[i];
      const sim = Number(aliasSim.raw[i]?.sim ?? 0);
      const puntaje = mapearSimilitudAlias(sim);
      candidatos.push({
        itemId: a.itemId,
        nombre: a.item.nombre,
        sku: a.item.sku,
        puntaje,
        origenMatch: 'ALIAS_SIMILITUD',
        aliasId: a.id,
      });
      if (puntaje >= umbrales.umbralAutomatico) alcanzoAutomatico = true;
    }

    const textoSim = await itemRepo
      .createQueryBuilder('i')
      .addSelect('similarity(i.textoBusqueda, :qNorm)', 'sim')
      .where('i.organizacionId = :organizacionId', { organizacionId })
      .andWhere('i.estadoRegistro = :estado', { estado: EstadoRegistro.ACTIVO })
      .andWhere('similarity(i.textoBusqueda, :qNorm) >= :umbral', {
        qNorm,
        umbral: UMBRAL_SIM_MIN,
      })
      .orderBy('sim', 'DESC')
      .limit(LIMITE_POR_ESTRATEGIA)
      .getRawAndEntities();

    for (let i = 0; i < textoSim.entities.length; i++) {
      const item = textoSim.entities[i];
      const sim = Number(textoSim.raw[i]?.sim ?? 0);
      const puntaje = mapearSimilitudTexto(sim);
      candidatos.push({
        itemId: item.id,
        nombre: item.nombre,
        sku: item.sku,
        puntaje,
        origenMatch: 'TEXTO_SIMILITUD',
      });
      if (puntaje >= umbrales.umbralAutomatico) alcanzoAutomatico = true;
    }

    // 5. Atributos: similitud sobre textoBusqueda con boost si hay tokens de medida
    if (!alcanzoAutomatico || candidatos.length < 5) {
      const tokens = qNorm.split(/\s+/).filter((t) => t.length >= 2);
      if (tokens.length > 0) {
        const attrQb = itemRepo
          .createQueryBuilder('i')
          .addSelect('similarity(i.textoBusqueda, :qNorm)', 'sim')
          .where('i.organizacionId = :organizacionId', { organizacionId })
          .andWhere('i.estadoRegistro = :estado', {
            estado: EstadoRegistro.ACTIVO,
          })
          .andWhere('similarity(i.textoBusqueda, :qNorm) >= :umbral', {
            qNorm,
            umbral: Math.max(UMBRAL_SIM_MIN - 0.05, 0.2),
          })
          .orderBy('sim', 'DESC')
          .limit(LIMITE_POR_ESTRATEGIA);

        const attrSim = await attrQb.getRawAndEntities();
        for (let i = 0; i < attrSim.entities.length; i++) {
          const item = attrSim.entities[i];
          const sim = Number(attrSim.raw[i]?.sim ?? 0);
          // Boost ligero si el JSON de atributos contiene algún token
          const attrs = JSON.stringify(item.atributos ?? {}).toLowerCase();
          const hit = tokens.some((tok) => attrs.includes(tok));
          const puntaje = mapearSimilitudAtributo(hit ? Math.min(sim + 0.1, 1) : sim);
          candidatos.push({
            itemId: item.id,
            nombre: item.nombre,
            sku: item.sku,
            puntaje,
            origenMatch: 'ATRIBUTO',
          });
        }
      }
    }

    void alcanzoAutomatico; // la cascada completa se ejecuta para candidatos
    return clasificarResolucion(candidatos, umbrales);
  }
}

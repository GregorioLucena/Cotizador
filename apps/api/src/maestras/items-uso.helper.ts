import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Categoria,
  DefinicionAtributo,
  EstadoRegistro,
  Item,
  Marca,
} from '@cotizador/database';
import { normalizarTextoBusqueda } from '@cotizador/shared';
import { EntityManager, In, Repository } from 'typeorm';

function valorAtributoComoTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') return valor.trim() || null;
  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor);
  }
  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }
  return String(valor);
}

@Injectable()
export class ItemsUsoHelper {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(DefinicionAtributo)
    private readonly definicionRepo: Repository<DefinicionAtributo>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(Marca)
    private readonly marcaRepo: Repository<Marca>,
  ) {}

  async contarActivosPorUnidad(
    organizacionId: string,
    unidadMedidaId: string,
  ): Promise<number> {
    return this.itemRepo.count({
      where: {
        organizacionId,
        unidadMedidaId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
  }

  async contarActivosPorCategoria(
    organizacionId: string,
    categoriaId: string,
  ): Promise<number> {
    return this.itemRepo.count({
      where: {
        organizacionId,
        categoriaId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
  }

  async contarActivosPorMarca(
    organizacionId: string,
    marcaId: string,
  ): Promise<number> {
    return this.itemRepo.count({
      where: {
        organizacionId,
        marcaId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
  }

  async contarSubcategoriasActivas(
    organizacionId: string,
    categoriaPadreId: string,
  ): Promise<number> {
    return this.categoriaRepo.count({
      where: {
        organizacionId,
        categoriaPadreId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
  }

  /** Items activos cuya clave existe en `atributos`. */
  async contarActivosPorClaveAtributo(
    organizacionId: string,
    codigo: string,
  ): Promise<number> {
    return this.itemRepo
      .createQueryBuilder('i')
      .where('i.organizacionId = :organizacionId', { organizacionId })
      .andWhere('i.estadoRegistro = :estado', {
        estado: EstadoRegistro.ACTIVO,
      })
      .andWhere('i.atributos ? :codigo', { codigo })
      .getCount();
  }

  /** Cualquier item (activo o inactivo) con la clave en `atributos`. */
  async contarCualquierEstadoPorClaveAtributo(
    organizacionId: string,
    codigo: string,
  ): Promise<number> {
    return this.itemRepo
      .createQueryBuilder('i')
      .where('i.organizacionId = :organizacionId', { organizacionId })
      .andWhere('i.atributos ? :codigo', { codigo })
      .getCount();
  }

  async contarOpcionEnUso(
    organizacionId: string,
    codigo: string,
    opcion: string,
  ): Promise<number> {
    return this.itemRepo
      .createQueryBuilder('i')
      .where('i.organizacionId = :organizacionId', { organizacionId })
      .andWhere("i.atributos ->> :codigo = :opcion", { codigo, opcion })
      .getCount();
  }

  async regenerarTextoPorCategoria(
    manager: EntityManager,
    organizacionId: string,
    categoriaId: string,
  ): Promise<void> {
    const items = await manager.find(Item, {
      where: {
        organizacionId,
        categoriaId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
    await this.regenerarItems(manager, organizacionId, items);
  }

  async regenerarTextoPorMarca(
    manager: EntityManager,
    organizacionId: string,
    marcaId: string,
  ): Promise<void> {
    const items = await manager.find(Item, {
      where: {
        organizacionId,
        marcaId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
    await this.regenerarItems(manager, organizacionId, items);
  }

  async regenerarTextoPorClaveAtributo(
    manager: EntityManager,
    organizacionId: string,
    codigo: string,
  ): Promise<void> {
    const items = await manager
      .createQueryBuilder(Item, 'i')
      .where('i.organizacionId = :organizacionId', { organizacionId })
      .andWhere('i.estadoRegistro = :estado', {
        estado: EstadoRegistro.ACTIVO,
      })
      .andWhere('i.atributos ? :codigo', { codigo })
      .getMany();
    await this.regenerarItems(manager, organizacionId, items);
  }

  private async regenerarItems(
    manager: EntityManager,
    organizacionId: string,
    items: Item[],
  ): Promise<void> {
    if (items.length === 0) return;

    const definiciones = await manager.find(DefinicionAtributo, {
      where: {
        organizacionId,
        estadoRegistro: EstadoRegistro.ACTIVO,
        usarEnBusqueda: true,
      },
    });
    const codigosBusqueda = new Set(definiciones.map((d) => d.codigo));

    const categoriaIds = [
      ...new Set(
        items
          .map((i) => i.categoriaId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const marcaIds = [
      ...new Set(
        items.map((i) => i.marcaId).filter((id): id is string => Boolean(id)),
      ),
    ];

    const categorias =
      categoriaIds.length > 0
        ? await manager.find(Categoria, { where: { id: In(categoriaIds) } })
        : [];
    const marcas =
      marcaIds.length > 0
        ? await manager.find(Marca, { where: { id: In(marcaIds) } })
        : [];

    const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
    const marcaPorId = new Map(marcas.map((m) => [m.id, m]));

    for (const item of items) {
      const categoria = item.categoriaId
        ? categoriaPorId.get(item.categoriaId)
        : undefined;
      const marca = item.marcaId ? marcaPorId.get(item.marcaId) : undefined;

      const valoresAtributos: string[] = [];
      for (const [clave, valor] of Object.entries(item.atributos ?? {})) {
        if (!codigosBusqueda.has(clave)) continue;
        const texto = valorAtributoComoTexto(valor);
        if (texto) valoresAtributos.push(texto);
      }

      item.textoBusqueda = normalizarTextoBusqueda(
        item.nombre,
        categoria?.nombre,
        marca?.nombre,
        ...valoresAtributos,
      );
    }

    await manager.save(Item, items);
  }
}

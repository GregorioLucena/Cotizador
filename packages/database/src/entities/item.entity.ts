import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoRegistro, TipoItem } from '../enums';
import { BaseEntity } from './base.entity';
import { Categoria } from './categoria.entity';
import { Marca } from './marca.entity';
import { Organizacion } from './organizacion.entity';
import { UnidadMedida } from './unidad-medida.entity';

@Entity('items')
export class Item extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column({ type: 'varchar', nullable: true })
  sku?: string | null;

  @Column()
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ type: 'uuid', nullable: true })
  categoriaId?: string | null;

  @ManyToOne(() => Categoria, { nullable: true })
  @JoinColumn({ name: 'categoriaId' })
  categoria?: Categoria | null;

  @Column({ type: 'uuid', nullable: true })
  marcaId?: string | null;

  @ManyToOne(() => Marca, { nullable: true })
  @JoinColumn({ name: 'marcaId' })
  marca?: Marca | null;

  @Column('uuid')
  unidadMedidaId!: string;

  @ManyToOne(() => UnidadMedida)
  @JoinColumn({ name: 'unidadMedidaId' })
  unidadMedida!: UnidadMedida;

  @Column({ type: 'enum', enum: TipoItem, default: TipoItem.FUNGIBLE })
  tipoItem!: TipoItem;

  @Column({ type: 'jsonb', default: {} })
  atributos!: Record<string, unknown>;

  @Column({ type: 'text', default: '' })
  textoBusqueda!: string;

  @Column({ type: 'boolean', default: false })
  controlaStock!: boolean;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  stockAproximado?: string | null;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

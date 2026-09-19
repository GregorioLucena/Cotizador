import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EstadoRegistro } from '../enums';
import { BaseEntity } from './base.entity';
import { Item } from './item.entity';
import { ListaPrecio } from './lista-precio.entity';
import { Organizacion } from './organizacion.entity';

@Entity('precios_item')
@Unique(['listaPrecioId', 'itemId'])
export class PrecioItem extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column('uuid')
  listaPrecioId!: string;

  @ManyToOne(() => ListaPrecio)
  @JoinColumn({ name: 'listaPrecioId' })
  listaPrecio!: ListaPrecio;

  @Column('uuid')
  itemId!: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'itemId' })
  item!: Item;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  precio!: string;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

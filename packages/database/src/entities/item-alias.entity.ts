import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EstadoRegistro, OrigenAlias } from '../enums';
import { BaseEntity } from './base.entity';
import { Item } from './item.entity';
import { Organizacion } from './organizacion.entity';

@Entity('item_alias')
@Unique(['itemId', 'normalizado'])
export class ItemAlias extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column('uuid')
  itemId!: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'itemId' })
  item!: Item;

  @Column()
  alias!: string;

  @Column()
  normalizado!: string;

  @Column({ type: 'enum', enum: OrigenAlias, default: OrigenAlias.MANUAL })
  origen!: OrigenAlias;

  @Column({ type: 'int', default: 0 })
  vecesUsado!: number;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

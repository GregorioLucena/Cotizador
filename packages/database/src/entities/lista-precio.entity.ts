import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoRegistro } from '../enums';
import { BaseEntity } from './base.entity';
import { Moneda } from './moneda.entity';
import { Organizacion } from './organizacion.entity';

@Entity('listas_precio')
export class ListaPrecio extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column()
  nombre!: string;

  @Column('uuid')
  monedaId!: string;

  @ManyToOne(() => Moneda)
  @JoinColumn({ name: 'monedaId' })
  moneda!: Moneda;

  @Column({ type: 'boolean', default: false })
  esPredeterminada!: boolean;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

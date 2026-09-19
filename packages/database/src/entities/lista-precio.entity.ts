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

  /** Código único por organización (2–20, mayúsculas). */
  @Column({ type: 'varchar', length: 20 })
  codigo!: string;

  @Column('uuid')
  monedaId!: string;

  @ManyToOne(() => Moneda)
  @JoinColumn({ name: 'monedaId' })
  moneda!: Moneda;

  @Column({ type: 'boolean', default: false })
  esPredeterminada!: boolean;

  @Column({ type: 'date', nullable: true })
  vigenciaDesde?: string | null;

  @Column({ type: 'date', nullable: true })
  vigenciaHasta?: string | null;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  AmbitoReglaDescuento,
  EstadoRegistro,
  TipoDescuento,
} from '../enums';
import { BaseEntity } from './base.entity';
import { ListaPrecio } from './lista-precio.entity';
import { Organizacion } from './organizacion.entity';

@Entity('reglas_descuento')
export class ReglaDescuento extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column('uuid', { nullable: true })
  listaPrecioId?: string | null;

  @ManyToOne(() => ListaPrecio, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'listaPrecioId' })
  listaPrecio?: ListaPrecio | null;

  @Column({ type: 'varchar', length: 120 })
  nombre!: string;

  @Column({ type: 'enum', enum: AmbitoReglaDescuento })
  ambito!: AmbitoReglaDescuento;

  @Column('uuid', { nullable: true })
  referenciaId?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: '1.0000' })
  cantidadMinima!: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  cantidadMaxima?: string | null;

  @Column({ type: 'enum', enum: TipoDescuento })
  tipoDescuento!: TipoDescuento;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  valor!: string;

  @Column({ type: 'int', default: 0 })
  prioridad!: number;

  @Column({ type: 'date', nullable: true })
  vigenciaDesde?: string | null;

  @Column({ type: 'date', nullable: true })
  vigenciaHasta?: string | null;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

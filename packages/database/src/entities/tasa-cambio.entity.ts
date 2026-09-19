import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EstadoRegistro, FuenteTasaCambio } from '../enums';
import { BaseEntity } from './base.entity';
import { Moneda } from './moneda.entity';
import { Organizacion } from './organizacion.entity';

@Entity('tasas_cambio')
@Unique(['organizacionId', 'monedaOrigenId', 'monedaDestinoId', 'fechaVigencia'])
export class TasaCambio extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column('uuid')
  monedaOrigenId!: string;

  @ManyToOne(() => Moneda)
  @JoinColumn({ name: 'monedaOrigenId' })
  monedaOrigen!: Moneda;

  @Column('uuid')
  monedaDestinoId!: string;

  @ManyToOne(() => Moneda)
  @JoinColumn({ name: 'monedaDestinoId' })
  monedaDestino!: Moneda;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  valor!: string;

  @Column({ type: 'date' })
  fechaVigencia!: string;

  @Column({
    type: 'enum',
    enum: FuenteTasaCambio,
    default: FuenteTasaCambio.MANUAL,
  })
  fuente!: FuenteTasaCambio;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

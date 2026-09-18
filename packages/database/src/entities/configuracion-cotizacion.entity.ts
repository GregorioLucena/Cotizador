import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ModoRedondeo } from '../enums';
import { BaseEntity } from './base.entity';
import { ListaPrecio } from './lista-precio.entity';
import { Organizacion } from './organizacion.entity';

@Entity('configuraciones_cotizacion')
export class ConfiguracionCotizacion extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { unique: true })
  organizacionId!: string;

  @OneToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column({ type: 'int', default: 48 })
  vigenciaHorasPredeterminada!: number;

  @Column({ type: 'boolean', default: false })
  aplicaImpuesto!: boolean;

  @Column({ type: 'numeric', precision: 9, scale: 4, default: 0 })
  porcentajeImpuesto!: string;

  @Column({ type: 'boolean', default: false })
  preciosIncluyenImpuesto!: boolean;

  @Column({ type: 'int', default: 2 })
  decimalesRedondeo!: number;

  @Column({ type: 'enum', enum: ModoRedondeo, default: ModoRedondeo.NORMAL })
  modoRedondeo!: ModoRedondeo;

  @Column({ type: 'boolean', default: true })
  mostrarDescuentoDetallado!: boolean;

  @Column({ type: 'boolean', default: true })
  permiteSobrescribirPrecio!: boolean;

  @Column({ type: 'uuid', nullable: true })
  listaPrecioPredeterminadaId?: string | null;

  @ManyToOne(() => ListaPrecio, { nullable: true })
  @JoinColumn({ name: 'listaPrecioPredeterminadaId' })
  listaPrecioPredeterminada?: ListaPrecio | null;
}

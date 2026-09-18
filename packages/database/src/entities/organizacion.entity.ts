import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoRegistro } from '../enums';
import { BaseEntity } from './base.entity';
import { Moneda } from './moneda.entity';
import { Sucursal } from './sucursal.entity';
import { Vertical } from './vertical.entity';

@Entity('organizaciones')
export class Organizacion extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  nombre!: string;

  @Column({ type: 'varchar', nullable: true })
  razonSocial?: string | null;

  @Column({ type: 'varchar', nullable: true })
  identificacionFiscal?: string | null;

  @Column('uuid')
  verticalId!: string;

  @ManyToOne(() => Vertical)
  @JoinColumn({ name: 'verticalId' })
  vertical!: Vertical;

  @Column({ type: 'varchar', nullable: true })
  telefono?: string | null;

  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ type: 'text', nullable: true })
  direccion?: string | null;

  @Column({ type: 'varchar', nullable: true })
  logoUrl?: string | null;

  @Column('uuid')
  monedaBaseId!: string;

  @ManyToOne(() => Moneda)
  @JoinColumn({ name: 'monedaBaseId' })
  monedaBase!: Moneda;

  @Column({ type: 'uuid', nullable: true })
  monedaPresentacionId?: string | null;

  @ManyToOne(() => Moneda, { nullable: true })
  @JoinColumn({ name: 'monedaPresentacionId' })
  monedaPresentacion?: Moneda | null;

  @Column({ default: 'America/Caracas' })
  zonaHoraria!: string;

  @Column({ default: 'es-VE' })
  locale!: string;

  @Column({ type: 'boolean', default: true })
  usaIa!: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 4, default: 0.85 })
  umbralAutomatico!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4, default: 0.5 })
  umbralDescarte!: string;

  @Column({ type: 'text', nullable: true })
  notasInternas?: string | null;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;

  @OneToMany(() => Sucursal, (s) => s.organizacion)
  sucursales!: Sucursal[];
}

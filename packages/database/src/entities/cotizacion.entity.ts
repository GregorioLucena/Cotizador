import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EstadoCotizacion } from '../enums';
import { BaseEntity } from './base.entity';
import { Cliente } from './cliente.entity';
import { ListaPrecio } from './lista-precio.entity';
import { Moneda } from './moneda.entity';
import { Organizacion } from './organizacion.entity';
import { Solicitud } from './solicitud.entity';
import { Sucursal } from './sucursal.entity';

@Entity('cotizaciones')
@Unique(['organizacionId', 'folioNumero'])
export class Cotizacion extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column('uuid')
  sucursalId!: string;

  @ManyToOne(() => Sucursal)
  @JoinColumn({ name: 'sucursalId' })
  sucursal!: Sucursal;

  @Column({ type: 'int' })
  folioNumero!: number;

  @Column({ type: 'varchar', length: 40 })
  folio!: string;

  @Column({ type: 'uuid', nullable: true })
  solicitudId?: string | null;

  @ManyToOne(() => Solicitud, { nullable: true })
  @JoinColumn({ name: 'solicitudId' })
  solicitud?: Solicitud | null;

  @Column({ type: 'uuid', nullable: true })
  clienteId?: string | null;

  @ManyToOne(() => Cliente, { nullable: true })
  @JoinColumn({ name: 'clienteId' })
  cliente?: Cliente | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  nombreClienteLibre?: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  telefonoClienteLibre?: string | null;

  @Column('uuid')
  listaPrecioId!: string;

  @ManyToOne(() => ListaPrecio)
  @JoinColumn({ name: 'listaPrecioId' })
  listaPrecio!: ListaPrecio;

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

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  tasaAplicada?: string | null;

  @Column({ type: 'date', nullable: true })
  tasaFecha?: string | null;

  @Column({
    type: 'enum',
    enum: EstadoCotizacion,
    default: EstadoCotizacion.BORRADOR,
  })
  estado!: EstadoCotizacion;

  @Column({ type: 'timestamptz', nullable: true })
  vigenciaHasta?: Date | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: '0.0000' })
  subtotal!: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: '0.0000' })
  descuentoTotal!: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: '0.0000' })
  impuestoTotal!: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: '0.0000' })
  total!: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  totalPresentacion?: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 4, default: '0.0000' })
  porcentajeImpuestoAplicado!: string;

  @Column({ type: 'text', nullable: true })
  textoCondiciones?: string | null;

  @Column({ type: 'text', nullable: true })
  textoPie?: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones?: string | null;

  @Column({ type: 'uuid', nullable: true })
  aprobadaPorId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  aprobadaAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  enviadaAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  resultadoAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  motivoPerdida?: string | null;

  @Column({ type: 'boolean', default: false })
  anulado!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  anuladoAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  anuladoById?: string | null;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'uuid', nullable: true })
  cotizacionOrigenId?: string | null;

  @ManyToOne(() => Cotizacion, { nullable: true })
  @JoinColumn({ name: 'cotizacionOrigenId' })
  cotizacionOrigen?: Cotizacion | null;
}

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoResolucionLinea, OrigenMatch } from '../enums';
import { BaseEntity } from './base.entity';
import { Cotizacion } from './cotizacion.entity';
import { Item } from './item.entity';
import { Organizacion } from './organizacion.entity';
import { ReglaDescuento } from './regla-descuento.entity';
import { UnidadMedida } from './unidad-medida.entity';

@Entity('cotizacion_lineas')
export class CotizacionLinea extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column('uuid')
  cotizacionId!: string;

  @ManyToOne(() => Cotizacion)
  @JoinColumn({ name: 'cotizacionId' })
  cotizacion!: Cotizacion;

  @Column({ type: 'int' })
  orden!: number;

  @Column({ type: 'text' })
  textoSolicitado!: string;

  @Column({ type: 'uuid', nullable: true })
  itemId?: string | null;

  @ManyToOne(() => Item, { nullable: true })
  @JoinColumn({ name: 'itemId' })
  item?: Item | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcion?: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  sku?: string | null;

  @Column({ type: 'uuid', nullable: true })
  unidadMedidaId?: string | null;

  @ManyToOne(() => UnidadMedida, { nullable: true })
  @JoinColumn({ name: 'unidadMedidaId' })
  unidadMedida?: UnidadMedida | null;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad!: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  precioLista?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  precioUnitario?: string | null;

  @Column({ type: 'uuid', nullable: true })
  reglaDescuentoId?: string | null;

  @ManyToOne(() => ReglaDescuento, { nullable: true })
  @JoinColumn({ name: 'reglaDescuentoId' })
  reglaDescuento?: ReglaDescuento | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: '0.0000' })
  descuentoMonto!: string;

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  descuentoPorcentaje?: string | null;

  @Column({ type: 'boolean', default: false })
  precioSobrescrito!: boolean;

  @Column({ type: 'text', nullable: true })
  motivoSobrescritura?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  subtotal?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  total?: string | null;

  @Column({ type: 'enum', enum: EstadoResolucionLinea })
  estadoResolucion!: EstadoResolucionLinea;

  @Column({ type: 'numeric', precision: 5, scale: 4, default: '0.0000' })
  confianza!: string;

  @Column({ type: 'enum', enum: OrigenMatch, nullable: true })
  origenMatch?: OrigenMatch | null;

  @Column({ type: 'text', nullable: true })
  notas?: string | null;

  /** Soft-delete en borrador: false = fuera del documento activo (spec 009). */
  @Column({ type: 'boolean', default: true })
  activa!: boolean;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoEventoCotizacion } from '../enums';
import { Cotizacion } from './cotizacion.entity';
import { Organizacion } from './organizacion.entity';

/** Bitácora inmutable: solo insert. */
@Entity('cotizacion_eventos')
export class CotizacionEvento {
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

  @Column({ type: 'enum', enum: TipoEventoCotizacion })
  tipo!: TipoEventoCotizacion;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  datos?: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  usuarioId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

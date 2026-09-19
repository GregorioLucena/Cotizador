import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organizacion } from './organizacion.entity';
import { Solicitud } from './solicitud.entity';

/** Inmutable: solo insert; sin updatedAt. */
@Entity('interpretaciones_solicitud')
export class InterpretacionSolicitud {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column('uuid')
  solicitudId!: string;

  @ManyToOne(() => Solicitud)
  @JoinColumn({ name: 'solicitudId' })
  solicitud!: Solicitud;

  @Column({ type: 'varchar', length: 40 })
  proveedor!: string;

  @Column({ type: 'varchar', length: 80 })
  modelo!: string;

  @Column({ type: 'varchar', length: 80 })
  versionPrompt!: string;

  @Column({ type: 'boolean' })
  exito!: boolean;

  @Column({ type: 'jsonb' })
  resultado!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  advertencias?: unknown[] | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  errorCodigo?: string | null;

  @Column({ type: 'text', nullable: true })
  errorDetalle?: string | null;

  @Column({ type: 'int' })
  latenciaMs!: number;

  @Column({ type: 'int', nullable: true })
  tokensEntrada?: number | null;

  @Column({ type: 'int', nullable: true })
  tokensSalida?: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  costoEstimado?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  createdById?: string | null;
}

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoImportacion, TipoImportacion } from '../enums';
import { BaseEntity } from './base.entity';
import { Organizacion } from './organizacion.entity';

@Entity('importaciones_catalogo')
export class ImportacionCatalogo extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column({ type: 'enum', enum: TipoImportacion })
  tipo!: TipoImportacion;

  @Column()
  nombreArchivo!: string;

  /** Ruta relativa en el adaptador de almacenamiento. */
  @Column()
  archivoPath!: string;

  @Column({ type: 'jsonb' })
  mapeoColumnas!: Record<string, string | number>;

  @Column({ type: 'enum', enum: EstadoImportacion })
  estado!: EstadoImportacion;

  @Column({ type: 'int', default: 0 })
  filasTotales!: number;

  @Column({ type: 'int', default: 0 })
  filasValidas!: number;

  @Column({ type: 'int', default: 0 })
  filasConError!: number;

  @Column({ type: 'jsonb', nullable: true })
  erroresDetalle?: unknown[] | null;

  @Column({ type: 'jsonb', nullable: true })
  resumen?: Record<string, unknown> | null;
}

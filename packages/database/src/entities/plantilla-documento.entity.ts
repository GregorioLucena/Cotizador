import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoRegistro } from '../enums';
import { BaseEntity } from './base.entity';
import { Organizacion } from './organizacion.entity';

@Entity('plantillas_documento')
export class PlantillaDocumento extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column()
  nombre!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'boolean', default: false })
  esPredeterminada!: boolean;

  @Column({ type: 'jsonb' })
  configuracion!: Record<string, unknown>;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

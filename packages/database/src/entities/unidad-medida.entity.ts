import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EstadoRegistro } from '../enums';
import { BaseEntity } from './base.entity';
import { Organizacion } from './organizacion.entity';

@Entity('unidades_medida')
@Unique(['organizacionId', 'codigo'])
export class UnidadMedida extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column()
  codigo!: string;

  @Column()
  nombre!: string;

  @Column({ type: 'boolean', default: false })
  permiteDecimales!: boolean;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

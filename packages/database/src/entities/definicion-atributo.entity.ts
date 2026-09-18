import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EstadoRegistro, TipoDatoAtributo } from '../enums';
import { BaseEntity } from './base.entity';
import { Organizacion } from './organizacion.entity';

@Entity('definiciones_atributo')
@Unique(['organizacionId', 'codigo'])
export class DefinicionAtributo extends BaseEntity {
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
  etiqueta!: string;

  @Column({ type: 'enum', enum: TipoDatoAtributo })
  tipoDato!: TipoDatoAtributo;

  @Column({ type: 'jsonb', nullable: true })
  opciones?: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  unidadSugerida?: string | null;

  @Column({ type: 'boolean', default: false })
  requerido!: boolean;

  @Column({ type: 'boolean', default: false })
  usarEnBusqueda!: boolean;

  @Column({ type: 'int', default: 0 })
  orden!: number;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

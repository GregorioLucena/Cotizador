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
import { Item } from './item.entity';
import { Organizacion } from './organizacion.entity';

@Entity('terminos_no_resueltos')
@Unique(['organizacionId', 'textoNormalizado'])
export class TerminoNoResuelto extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column()
  textoNormalizado!: string;

  @Column()
  ejemploOriginal!: string;

  @Column({ type: 'int', default: 1 })
  vecesVisto!: number;

  @Column({ type: 'timestamptz' })
  ultimaVezAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  resueltoConItemId?: string | null;

  @ManyToOne(() => Item, { nullable: true })
  @JoinColumn({ name: 'resueltoConItemId' })
  resueltoConItem?: Item | null;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

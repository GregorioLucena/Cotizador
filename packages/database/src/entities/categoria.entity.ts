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
import { Organizacion } from './organizacion.entity';

@Entity('categorias')
export class Categoria extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column()
  nombre!: string;

  @Column({ type: 'uuid', nullable: true })
  categoriaPadreId?: string | null;

  @ManyToOne(() => Categoria, (c) => c.subcategorias, { nullable: true })
  @JoinColumn({ name: 'categoriaPadreId' })
  categoriaPadre?: Categoria | null;

  @OneToMany(() => Categoria, (c) => c.categoriaPadre)
  subcategorias!: Categoria[];

  @Column({ type: 'int', default: 0 })
  orden!: number;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoRegistro } from '../enums';
import { BaseEntity } from './base.entity';
import { Organizacion } from './organizacion.entity';

@Entity('usuarios')
export class Usuario extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  organizacionId?: string | null;

  @ManyToOne(() => Organizacion, { nullable: true })
  @JoinColumn({ name: 'organizacionId' })
  organizacion?: Organizacion | null;

  @Column()
  nombreCompleto!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ type: 'varchar', nullable: true })
  telefono?: string | null;

  @Column({ type: 'boolean', default: true })
  debeCambiarPassword!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  ultimoAccesoAt?: Date | null;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

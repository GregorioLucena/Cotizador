import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoRegistro } from '../enums';
import { BaseEntity } from './base.entity';

@Entity('usuarios')
export class Usuario extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Nulo para usuarios de ambito PLATAFORMA. FK a organizaciones en fase posterior. */
  @Column({ type: 'uuid', nullable: true })
  organizacionId?: string | null;

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

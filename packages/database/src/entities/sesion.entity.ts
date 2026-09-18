import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('sesiones')
export class Sesion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  usuarioId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario!: Usuario;

  @Column()
  refreshTokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiraAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revocadaAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent?: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

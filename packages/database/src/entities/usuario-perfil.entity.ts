import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Perfil } from './perfil.entity';
import { Usuario } from './usuario.entity';

@Entity('usuario_perfiles')
@Unique(['usuarioId', 'perfilId'])
export class UsuarioPerfil {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  usuarioId!: string;

  @Column('uuid')
  perfilId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario!: Usuario;

  @ManyToOne(() => Perfil, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'perfilId' })
  perfil!: Perfil;
}

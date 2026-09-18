import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Perfil } from './perfil.entity';
import { Permiso } from './permiso.entity';

@Entity('perfil_permisos')
@Unique(['perfilId', 'permisoId'])
export class PerfilPermiso {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  perfilId!: string;

  @Column('uuid')
  permisoId!: string;

  @ManyToOne(() => Perfil, (perfil) => perfil.permisos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'perfilId' })
  perfil!: Perfil;

  @ManyToOne(() => Permiso, (permiso) => permiso.perfiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permisoId' })
  permiso!: Permiso;
}

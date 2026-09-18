import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PerfilPermiso } from './perfil-permiso.entity';

@Entity('permisos')
export class Permiso {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  codigo!: string;

  @Column()
  modulo!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @OneToMany(() => PerfilPermiso, (pp) => pp.permiso)
  perfiles!: PerfilPermiso[];
}

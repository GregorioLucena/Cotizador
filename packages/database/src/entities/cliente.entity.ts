import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoRegistro } from '../enums';
import { BaseEntity } from './base.entity';
import { ListaPrecio } from './lista-precio.entity';
import { Organizacion } from './organizacion.entity';

@Entity('clientes')
export class Cliente extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column({ type: 'varchar', length: 160 })
  nombre!: string;

  /** E.164 normalizado (`+` + 8–15 dígitos). Nulo permitido; único parcial por organización. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  telefonoWhatsapp?: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  identificacionFiscal?: string | null;

  @Column({ type: 'uuid', nullable: true })
  listaPrecioId?: string | null;

  @ManyToOne(() => ListaPrecio, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'listaPrecioId' })
  listaPrecio?: ListaPrecio | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  direccion?: string | null;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  notas?: string | null;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

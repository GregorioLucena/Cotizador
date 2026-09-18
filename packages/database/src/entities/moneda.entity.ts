import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoRegistro } from '../enums';

@Entity('monedas')
export class Moneda {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  codigoIso!: string;

  @Column()
  nombre!: string;

  @Column()
  simbolo!: string;

  @Column({ type: 'int', default: 2 })
  decimales!: number;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;
}

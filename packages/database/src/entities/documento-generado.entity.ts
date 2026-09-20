import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FormatoDocumento } from '../enums';
import { Cotizacion } from './cotizacion.entity';
import { Organizacion } from './organizacion.entity';
import { PlantillaDocumento } from './plantilla-documento.entity';
import { Usuario } from './usuario.entity';

@Entity('documentos_generados')
export class DocumentoGenerado {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column('uuid')
  cotizacionId!: string;

  @ManyToOne(() => Cotizacion)
  @JoinColumn({ name: 'cotizacionId' })
  cotizacion!: Cotizacion;

  @Column('uuid')
  plantillaId!: string;

  @ManyToOne(() => PlantillaDocumento)
  @JoinColumn({ name: 'plantillaId' })
  plantilla!: PlantillaDocumento;

  @Column({ type: 'int' })
  plantillaVersion!: number;

  @Column({ type: 'enum', enum: FormatoDocumento, default: FormatoDocumento.PDF })
  formato!: FormatoDocumento;

  @Column({ type: 'varchar', length: 500 })
  rutaArchivo!: string;

  @Column({ type: 'varchar', length: 64 })
  hashContenido!: string;

  @Column({ type: 'int' })
  tamanoBytes!: number;

  @Column('uuid')
  generadoPorId!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'generadoPorId' })
  generadoPor!: Usuario;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

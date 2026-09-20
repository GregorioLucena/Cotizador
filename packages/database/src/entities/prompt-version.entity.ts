import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoPromptVersion, PropositoPrompt } from '../enums';
import { BaseEntity } from './base.entity';

@Entity('prompt_versiones')
@Index('UQ_prompt_versiones_codigo', ['codigo'], { unique: true })
export class PromptVersion extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: PropositoPrompt })
  proposito!: PropositoPrompt;

  /** Código de vertical (FERRETERIA, AUTOMOTRIZ, GENERICO, …). */
  @Column({ type: 'varchar', length: 40 })
  verticalCodigo!: string;

  @Column({ type: 'varchar', length: 80 })
  codigo!: string;

  @Column({ type: 'enum', enum: EstadoPromptVersion })
  estado!: EstadoPromptVersion;

  @Column({ type: 'varchar', length: 80 })
  contratoVersion!: string;

  @Column({ type: 'jsonb' })
  politica!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  notasCambio!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  ultimaEvaluacion!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;
}

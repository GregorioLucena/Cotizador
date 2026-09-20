import { MigrationInterface, QueryRunner } from 'typeorm';

export class PromptVersiones1783100000000 implements MigrationInterface {
  name = 'PromptVersiones1783100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "proposito_prompt_enum" AS ENUM ('EXTRACCION_LINEAS')
    `);
    await queryRunner.query(`
      CREATE TYPE "estado_prompt_version_enum" AS ENUM (
        'BORRADOR', 'PUBLICADA', 'ACTIVA', 'ARCHIVADA'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "prompt_versiones" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "proposito" "proposito_prompt_enum" NOT NULL,
        "codigo" character varying(80) NOT NULL,
        "estado" "estado_prompt_version_enum" NOT NULL,
        "contratoVersion" character varying(80) NOT NULL,
        "politica" jsonb NOT NULL,
        "notasCambio" text,
        "ultimaEvaluacion" jsonb,
        "publishedAt" TIMESTAMPTZ,
        "activatedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_prompt_versiones" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompt_versiones_codigo"
      ON "prompt_versiones" ("codigo")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompt_versiones_activa_proposito"
      ON "prompt_versiones" ("proposito")
      WHERE "estado" = 'ACTIVA'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_prompt_versiones_activa_proposito"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_prompt_versiones_codigo"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "prompt_versiones"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "estado_prompt_version_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "proposito_prompt_enum"`);
  }
}

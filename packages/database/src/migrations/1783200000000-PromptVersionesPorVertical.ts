import { MigrationInterface, QueryRunner } from 'typeorm';

export class PromptVersionesPorVertical1783200000000
  implements MigrationInterface
{
  name = 'PromptVersionesPorVertical1783200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prompt_versiones"
      ADD COLUMN "verticalCodigo" character varying(40)
    `);
    await queryRunner.query(`
      UPDATE "prompt_versiones"
      SET "verticalCodigo" = 'FERRETERIA'
      WHERE "verticalCodigo" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt_versiones"
      ALTER COLUMN "verticalCodigo" SET NOT NULL
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_prompt_versiones_activa_proposito"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompt_versiones_activa_proposito_vertical"
      ON "prompt_versiones" ("proposito", "verticalCodigo")
      WHERE "estado" = 'ACTIVA'
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_prompt_versiones_vertical"
      ON "prompt_versiones" ("verticalCodigo")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_prompt_versiones_vertical"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_prompt_versiones_activa_proposito_vertical"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompt_versiones_activa_proposito"
      ON "prompt_versiones" ("proposito")
      WHERE "estado" = 'ACTIVA'
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt_versiones" DROP COLUMN "verticalCodigo"
    `);
  }
}

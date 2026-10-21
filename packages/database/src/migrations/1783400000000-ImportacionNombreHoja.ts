import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImportacionNombreHoja1783400000000 implements MigrationInterface {
  name = 'ImportacionNombreHoja1783400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "importaciones_catalogo"
      ADD COLUMN "nombreHoja" character varying(120)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "importaciones_catalogo"
      DROP COLUMN "nombreHoja"
    `);
  }
}

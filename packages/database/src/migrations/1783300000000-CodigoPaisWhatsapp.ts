import { MigrationInterface, QueryRunner } from 'typeorm';

export class CodigoPaisWhatsapp1783300000000 implements MigrationInterface {
  name = 'CodigoPaisWhatsapp1783300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizaciones"
      ADD COLUMN "codigoPaisWhatsapp" character varying(3)
    `);
    // Pilotos VE: locale es-VE → 58. Otras orgs quedan null (exigen + en el número).
    await queryRunner.query(`
      UPDATE "organizaciones"
      SET "codigoPaisWhatsapp" = '58'
      WHERE "locale" LIKE 'es-VE%'
        AND "codigoPaisWhatsapp" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizaciones"
      DROP COLUMN "codigoPaisWhatsapp"
    `);
  }
}

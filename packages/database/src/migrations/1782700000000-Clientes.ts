import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Clientes1782700000000 implements MigrationInterface {
  name = 'Clientes1782700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."clientes_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "clientes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "nombre" character varying(160) NOT NULL,
        "telefonoWhatsapp" character varying(20),
        "email" character varying(254),
        "identificacionFiscal" character varying(40),
        "listaPrecioId" uuid,
        "direccion" character varying(300),
        "notas" character varying(2000),
        "estadoRegistro" "public"."clientes_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_clientes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "clientes"
      ADD CONSTRAINT "FK_clientes_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "clientes"
      ADD CONSTRAINT "FK_clientes_lista_precio"
      FOREIGN KEY ("listaPrecioId") REFERENCES "listas_precio"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_clientes_org_whatsapp"
      ON "clientes" ("organizacionId", "telefonoWhatsapp")
      WHERE "telefonoWhatsapp" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_clientes_org_estado"
      ON "clientes" ("organizacionId", "estadoRegistro")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clientes_org_estado"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_clientes_org_whatsapp"`);
    await queryRunner.query(
      `ALTER TABLE "clientes" DROP CONSTRAINT IF EXISTS "FK_clientes_lista_precio"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" DROP CONSTRAINT IF EXISTS "FK_clientes_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "clientes"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."clientes_estadoregistro_enum"`,
    );
  }
}

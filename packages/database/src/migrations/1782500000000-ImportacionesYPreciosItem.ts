import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ImportacionesYPreciosItem1782500000000 implements MigrationInterface {
  name = 'ImportacionesYPreciosItem1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "listas_precio"
      ADD COLUMN IF NOT EXISTS "codigo" character varying(40)
    `);
    await queryRunner.query(`
      UPDATE "listas_precio"
      SET "codigo" = CASE
        WHEN "esPredeterminada" = true THEN 'GENERAL'
        ELSE 'LISTA-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', ''), 1, 8))
      END
      WHERE "codigo" IS NULL OR TRIM("codigo") = ''
    `);
    await queryRunner.query(`
      ALTER TABLE "listas_precio"
      ALTER COLUMN "codigo" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_listas_precio_org_codigo"
      ON "listas_precio" ("organizacionId", "codigo")
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."precios_item_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "precios_item" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "listaPrecioId" uuid NOT NULL,
        "itemId" uuid NOT NULL,
        "precio" numeric(18,4) NOT NULL,
        "estadoRegistro" "public"."precios_item_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_precios_item" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_precios_item_lista_item" UNIQUE ("listaPrecioId", "itemId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "precios_item"
      ADD CONSTRAINT "FK_precios_item_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "precios_item"
      ADD CONSTRAINT "FK_precios_item_lista"
      FOREIGN KEY ("listaPrecioId") REFERENCES "listas_precio"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "precios_item"
      ADD CONSTRAINT "FK_precios_item_item"
      FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_precios_item_org_item"
      ON "precios_item" ("organizacionId", "itemId")
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."importaciones_catalogo_tipo_enum" AS ENUM('ITEMS', 'PRECIOS', 'ALIAS')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."importaciones_catalogo_estado_enum" AS ENUM('CARGADA', 'VALIDADA', 'CONFIRMADA', 'FALLIDA', 'CANCELADA')`,
    );
    await queryRunner.query(`
      CREATE TABLE "importaciones_catalogo" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "tipo" "public"."importaciones_catalogo_tipo_enum" NOT NULL,
        "nombreArchivo" character varying NOT NULL,
        "archivoPath" character varying NOT NULL,
        "mapeoColumnas" jsonb NOT NULL,
        "estado" "public"."importaciones_catalogo_estado_enum" NOT NULL,
        "filasTotales" integer NOT NULL DEFAULT 0,
        "filasValidas" integer NOT NULL DEFAULT 0,
        "filasConError" integer NOT NULL DEFAULT 0,
        "erroresDetalle" jsonb,
        "resumen" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_importaciones_catalogo" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "importaciones_catalogo"
      ADD CONSTRAINT "FK_importaciones_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_importaciones_org_estado"
      ON "importaciones_catalogo" ("organizacionId", "estado", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_importaciones_org_estado"`);
    await queryRunner.query(
      `ALTER TABLE "importaciones_catalogo" DROP CONSTRAINT "FK_importaciones_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "importaciones_catalogo"`);
    await queryRunner.query(`DROP TYPE "public"."importaciones_catalogo_estado_enum"`);
    await queryRunner.query(`DROP TYPE "public"."importaciones_catalogo_tipo_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_precios_item_org_item"`);
    await queryRunner.query(
      `ALTER TABLE "precios_item" DROP CONSTRAINT "FK_precios_item_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "precios_item" DROP CONSTRAINT "FK_precios_item_lista"`,
    );
    await queryRunner.query(
      `ALTER TABLE "precios_item" DROP CONSTRAINT "FK_precios_item_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "precios_item"`);
    await queryRunner.query(`DROP TYPE "public"."precios_item_estadoregistro_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_listas_precio_org_codigo"`);
    await queryRunner.query(`ALTER TABLE "listas_precio" DROP COLUMN "codigo"`);
  }
}

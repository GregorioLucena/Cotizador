import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MarcasEItems1782300000000 implements MigrationInterface {
  name = 'MarcasEItems1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."marcas_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "marcas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "nombre" character varying NOT NULL,
        "estadoRegistro" "public"."marcas_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_marcas" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_marcas_org_nombre_ci"
      ON "marcas" ("organizacionId", lower("nombre"))
    `);
    await queryRunner.query(`
      ALTER TABLE "marcas"
      ADD CONSTRAINT "FK_marcas_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."items_tipoitem_enum" AS ENUM('FUNGIBLE', 'SERIALIZADO', 'SERVICIO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."items_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "sku" character varying,
        "nombre" character varying NOT NULL,
        "descripcion" text,
        "categoriaId" uuid,
        "marcaId" uuid,
        "unidadMedidaId" uuid NOT NULL,
        "tipoItem" "public"."items_tipoitem_enum" NOT NULL DEFAULT 'FUNGIBLE',
        "atributos" jsonb NOT NULL DEFAULT '{}',
        "textoBusqueda" text NOT NULL DEFAULT '',
        "controlaStock" boolean NOT NULL DEFAULT false,
        "stockAproximado" numeric(18,4),
        "estadoRegistro" "public"."items_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_items_org_sku"
      ON "items" ("organizacionId", "sku")
      WHERE "sku" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_items_org_estado" ON "items" ("organizacionId", "estadoRegistro")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_items_org_categoria" ON "items" ("organizacionId", "categoriaId")
    `);
    await queryRunner.query(`
      ALTER TABLE "items"
      ADD CONSTRAINT "FK_items_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "items"
      ADD CONSTRAINT "FK_items_categoria"
      FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "items"
      ADD CONSTRAINT "FK_items_marca"
      FOREIGN KEY ("marcaId") REFERENCES "marcas"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "items"
      ADD CONSTRAINT "FK_items_unidad"
      FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "items" DROP CONSTRAINT "FK_items_unidad"`);
    await queryRunner.query(`ALTER TABLE "items" DROP CONSTRAINT "FK_items_marca"`);
    await queryRunner.query(`ALTER TABLE "items" DROP CONSTRAINT "FK_items_categoria"`);
    await queryRunner.query(`ALTER TABLE "items" DROP CONSTRAINT "FK_items_organizacion"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_items_org_categoria"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_items_org_estado"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_items_org_sku"`);
    await queryRunner.query(`DROP TABLE "items"`);
    await queryRunner.query(`DROP TYPE "public"."items_estadoregistro_enum"`);
    await queryRunner.query(`DROP TYPE "public"."items_tipoitem_enum"`);

    await queryRunner.query(`ALTER TABLE "marcas" DROP CONSTRAINT "FK_marcas_organizacion"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_marcas_org_nombre_ci"`);
    await queryRunner.query(`DROP TABLE "marcas"`);
    await queryRunner.query(`DROP TYPE "public"."marcas_estadoregistro_enum"`);
  }
}

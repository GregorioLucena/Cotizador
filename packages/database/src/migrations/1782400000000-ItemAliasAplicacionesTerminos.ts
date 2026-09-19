import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ItemAliasAplicacionesTerminos1782400000000 implements MigrationInterface {
  name = 'ItemAliasAplicacionesTerminos1782400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."item_alias_origen_enum" AS ENUM('MANUAL', 'IMPORTADO', 'APRENDIDO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."item_alias_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "item_alias" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "itemId" uuid NOT NULL,
        "alias" character varying NOT NULL,
        "normalizado" character varying NOT NULL,
        "origen" "public"."item_alias_origen_enum" NOT NULL DEFAULT 'MANUAL',
        "vecesUsado" integer NOT NULL DEFAULT 0,
        "estadoRegistro" "public"."item_alias_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_item_alias" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_item_alias_item_normalizado" UNIQUE ("itemId", "normalizado")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "item_alias"
      ADD CONSTRAINT "FK_item_alias_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "item_alias"
      ADD CONSTRAINT "FK_item_alias_item"
      FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."item_aplicaciones_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "item_aplicaciones" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "itemId" uuid NOT NULL,
        "datos" jsonb NOT NULL,
        "textoNormalizado" text NOT NULL,
        "estadoRegistro" "public"."item_aplicaciones_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_item_aplicaciones" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "item_aplicaciones"
      ADD CONSTRAINT "FK_item_aplicaciones_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "item_aplicaciones"
      ADD CONSTRAINT "FK_item_aplicaciones_item"
      FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."terminos_no_resueltos_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "terminos_no_resueltos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "textoNormalizado" character varying NOT NULL,
        "ejemploOriginal" character varying NOT NULL,
        "vecesVisto" integer NOT NULL DEFAULT 1,
        "ultimaVezAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "resueltoConItemId" uuid,
        "estadoRegistro" "public"."terminos_no_resueltos_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_terminos_no_resueltos" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_terminos_org_texto" UNIQUE ("organizacionId", "textoNormalizado")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "terminos_no_resueltos"
      ADD CONSTRAINT "FK_terminos_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "terminos_no_resueltos"
      ADD CONSTRAINT "FK_terminos_item"
      FOREIGN KEY ("resueltoConItemId") REFERENCES "items"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_items_texto_busqueda_trgm"
      ON "items" USING GIN ("textoBusqueda" gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_items_atributos_gin"
      ON "items" USING GIN ("atributos")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_item_alias_normalizado_trgm"
      ON "item_alias" USING GIN ("normalizado" gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_item_alias_org_estado"
      ON "item_alias" ("organizacionId", "estadoRegistro")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_item_aplicaciones_texto_trgm"
      ON "item_aplicaciones" USING GIN ("textoNormalizado" gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_item_aplicaciones_texto_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_item_alias_org_estado"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_item_alias_normalizado_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_items_atributos_gin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_items_texto_busqueda_trgm"`);

    await queryRunner.query(`ALTER TABLE "terminos_no_resueltos" DROP CONSTRAINT "FK_terminos_item"`);
    await queryRunner.query(
      `ALTER TABLE "terminos_no_resueltos" DROP CONSTRAINT "FK_terminos_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "terminos_no_resueltos"`);
    await queryRunner.query(`DROP TYPE "public"."terminos_no_resueltos_estadoregistro_enum"`);

    await queryRunner.query(
      `ALTER TABLE "item_aplicaciones" DROP CONSTRAINT "FK_item_aplicaciones_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_aplicaciones" DROP CONSTRAINT "FK_item_aplicaciones_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "item_aplicaciones"`);
    await queryRunner.query(`DROP TYPE "public"."item_aplicaciones_estadoregistro_enum"`);

    await queryRunner.query(`ALTER TABLE "item_alias" DROP CONSTRAINT "FK_item_alias_item"`);
    await queryRunner.query(`ALTER TABLE "item_alias" DROP CONSTRAINT "FK_item_alias_organizacion"`);
    await queryRunner.query(`DROP TABLE "item_alias"`);
    await queryRunner.query(`DROP TYPE "public"."item_alias_estadoregistro_enum"`);
    await queryRunner.query(`DROP TYPE "public"."item_alias_origen_enum"`);
  }
}

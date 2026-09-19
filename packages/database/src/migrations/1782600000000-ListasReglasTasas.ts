import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ListasReglasTasas1782600000000 implements MigrationInterface {
  name = 'ListasReglasTasas1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "listas_precio"
      ADD COLUMN IF NOT EXISTS "vigenciaDesde" date,
      ADD COLUMN IF NOT EXISTS "vigenciaHasta" date
    `);
    await queryRunner.query(`
      ALTER TABLE "listas_precio"
      ALTER COLUMN "codigo" TYPE character varying(20)
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."reglas_descuento_ambito_enum" AS ENUM('ITEM', 'CATEGORIA', 'MARCA', 'GLOBAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reglas_descuento_tipodescuento_enum" AS ENUM('PORCENTAJE', 'MONTO_FIJO', 'PRECIO_FIJO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reglas_descuento_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "reglas_descuento" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "listaPrecioId" uuid,
        "nombre" character varying(120) NOT NULL,
        "ambito" "public"."reglas_descuento_ambito_enum" NOT NULL,
        "referenciaId" uuid,
        "cantidadMinima" numeric(18,4) NOT NULL DEFAULT 1,
        "cantidadMaxima" numeric(18,4),
        "tipoDescuento" "public"."reglas_descuento_tipodescuento_enum" NOT NULL,
        "valor" numeric(18,4) NOT NULL,
        "prioridad" integer NOT NULL DEFAULT 0,
        "vigenciaDesde" date,
        "vigenciaHasta" date,
        "estadoRegistro" "public"."reglas_descuento_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_reglas_descuento" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "reglas_descuento"
      ADD CONSTRAINT "FK_reglas_descuento_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "reglas_descuento"
      ADD CONSTRAINT "FK_reglas_descuento_lista"
      FOREIGN KEY ("listaPrecioId") REFERENCES "listas_precio"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_reglas_descuento_org_estado"
      ON "reglas_descuento" ("organizacionId", "estadoRegistro")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_reglas_descuento_org_lista"
      ON "reglas_descuento" ("organizacionId", "listaPrecioId")
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."tasas_cambio_fuente_enum" AS ENUM('MANUAL', 'AUTOMATICA')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasas_cambio_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "tasas_cambio" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "monedaOrigenId" uuid NOT NULL,
        "monedaDestinoId" uuid NOT NULL,
        "valor" numeric(18,6) NOT NULL,
        "fechaVigencia" date NOT NULL,
        "fuente" "public"."tasas_cambio_fuente_enum" NOT NULL DEFAULT 'MANUAL',
        "estadoRegistro" "public"."tasas_cambio_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_tasas_cambio" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tasas_cambio_org_par_fecha" UNIQUE (
          "organizacionId",
          "monedaOrigenId",
          "monedaDestinoId",
          "fechaVigencia"
        )
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "tasas_cambio"
      ADD CONSTRAINT "FK_tasas_cambio_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "tasas_cambio"
      ADD CONSTRAINT "FK_tasas_cambio_moneda_origen"
      FOREIGN KEY ("monedaOrigenId") REFERENCES "monedas"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "tasas_cambio"
      ADD CONSTRAINT "FK_tasas_cambio_moneda_destino"
      FOREIGN KEY ("monedaDestinoId") REFERENCES "monedas"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tasas_cambio_org_par"
      ON "tasas_cambio" ("organizacionId", "monedaOrigenId", "monedaDestinoId", "fechaVigencia")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasas_cambio_org_par"`);
    await queryRunner.query(
      `ALTER TABLE "tasas_cambio" DROP CONSTRAINT "FK_tasas_cambio_moneda_destino"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasas_cambio" DROP CONSTRAINT "FK_tasas_cambio_moneda_origen"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasas_cambio" DROP CONSTRAINT "FK_tasas_cambio_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "tasas_cambio"`);
    await queryRunner.query(`DROP TYPE "public"."tasas_cambio_estadoregistro_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tasas_cambio_fuente_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reglas_descuento_org_lista"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reglas_descuento_org_estado"`);
    await queryRunner.query(
      `ALTER TABLE "reglas_descuento" DROP CONSTRAINT "FK_reglas_descuento_lista"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reglas_descuento" DROP CONSTRAINT "FK_reglas_descuento_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "reglas_descuento"`);
    await queryRunner.query(`DROP TYPE "public"."reglas_descuento_estadoregistro_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reglas_descuento_tipodescuento_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reglas_descuento_ambito_enum"`);

    await queryRunner.query(`
      ALTER TABLE "listas_precio"
      ALTER COLUMN "codigo" TYPE character varying(40)
    `);
    await queryRunner.query(`
      ALTER TABLE "listas_precio"
      DROP COLUMN IF EXISTS "vigenciaHasta",
      DROP COLUMN IF EXISTS "vigenciaDesde"
    `);
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Spec 010: documentos_generados + congelamiento de atributos/marca en líneas.
 */
export class DocumentosGenerados1783000000000 implements MigrationInterface {
  name = 'DocumentosGenerados1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cotizacion_lineas"
      ADD COLUMN "atributosCongelados" jsonb,
      ADD COLUMN "marcaCongelada" character varying(120)
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."documentos_generados_formato_enum" AS ENUM('PDF')
    `);

    await queryRunner.query(`
      CREATE TABLE "documentos_generados" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "cotizacionId" uuid NOT NULL,
        "plantillaId" uuid NOT NULL,
        "plantillaVersion" integer NOT NULL,
        "formato" "public"."documentos_generados_formato_enum" NOT NULL DEFAULT 'PDF',
        "rutaArchivo" character varying(500) NOT NULL,
        "hashContenido" character varying(64) NOT NULL,
        "tamanoBytes" integer NOT NULL,
        "generadoPorId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documentos_generados" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_documentos_generados_cotizacion_formato"
          UNIQUE ("organizacionId", "cotizacionId", "formato")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "documentos_generados"
      ADD CONSTRAINT "FK_documentos_generados_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "documentos_generados"
      ADD CONSTRAINT "FK_documentos_generados_cotizacion"
      FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "documentos_generados"
      ADD CONSTRAINT "FK_documentos_generados_plantilla"
      FOREIGN KEY ("plantillaId") REFERENCES "plantillas_documento"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "documentos_generados"
      ADD CONSTRAINT "FK_documentos_generados_usuario"
      FOREIGN KEY ("generadoPorId") REFERENCES "usuarios"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_documentos_generados_org_cotizacion"
      ON "documentos_generados" ("organizacionId", "cotizacionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_documentos_generados_org_cotizacion"
    `);
    await queryRunner.query(`
      ALTER TABLE "documentos_generados"
      DROP CONSTRAINT "FK_documentos_generados_usuario"
    `);
    await queryRunner.query(`
      ALTER TABLE "documentos_generados"
      DROP CONSTRAINT "FK_documentos_generados_plantilla"
    `);
    await queryRunner.query(`
      ALTER TABLE "documentos_generados"
      DROP CONSTRAINT "FK_documentos_generados_cotizacion"
    `);
    await queryRunner.query(`
      ALTER TABLE "documentos_generados"
      DROP CONSTRAINT "FK_documentos_generados_organizacion"
    `);
    await queryRunner.query(`DROP TABLE "documentos_generados"`);
    await queryRunner.query(
      `DROP TYPE "public"."documentos_generados_formato_enum"`,
    );
    await queryRunner.query(`
      ALTER TABLE "cotizacion_lineas"
      DROP COLUMN "marcaCongelada",
      DROP COLUMN "atributosCongelados"
    `);
  }
}

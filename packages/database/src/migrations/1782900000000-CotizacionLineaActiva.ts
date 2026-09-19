import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft-delete de líneas de cotización (spec 009): al quitar una línea del
 * borrador se marca `activa = false` en lugar de borrar la fila.
 */
export class CotizacionLineaActiva1782900000000 implements MigrationInterface {
  name = 'CotizacionLineaActiva1782900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cotizacion_lineas"
      ADD COLUMN "activa" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_cotizacion_lineas_cotizacion_activa"
      ON "cotizacion_lineas" ("cotizacionId", "activa")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_cotizacion_lineas_cotizacion_activa"
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_lineas" DROP COLUMN "activa"
    `);
  }
}

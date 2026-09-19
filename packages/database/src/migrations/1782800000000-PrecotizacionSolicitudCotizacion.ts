import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PrecotizacionSolicitudCotizacion1782800000000
  implements MigrationInterface
{
  name = 'PrecotizacionSolicitudCotizacion1782800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."solicitudes_canal_enum" AS ENUM(
        'WHATSAPP_PEGADO', 'MANUAL', 'API'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."solicitudes_estado_enum" AS ENUM(
        'PENDIENTE', 'INTERPRETADA', 'FALLIDA'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."cotizaciones_estado_enum" AS ENUM(
        'BORRADOR', 'APROBADA', 'ENVIADA', 'GANADA', 'PERDIDA', 'VENCIDA', 'ANULADA'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."cotizacion_lineas_estadoresolucion_enum" AS ENUM(
        'RESUELTA_AUTOMATICA', 'RESUELTA_MANUAL', 'SUGERIDA_REVISAR',
        'NO_ENCONTRADA', 'AGREGADA_MANUAL'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."cotizacion_lineas_origenmatch_enum" AS ENUM(
        'SKU', 'ALIAS_EXACTO', 'ALIAS_SIMILITUD', 'TEXTO_SIMILITUD', 'ATRIBUTO', 'MANUAL'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."cotizacion_eventos_tipo_enum" AS ENUM(
        'CREADA', 'INTERPRETADA', 'LINEA_CORREGIDA', 'LINEA_AGREGADA',
        'LINEA_ELIMINADA', 'PRECIO_SOBRESCRITO', 'ALIAS_APRENDIDO', 'RECALCULADA',
        'APROBADA', 'DOCUMENTO_GENERADO', 'ENVIADA', 'MARCADA_GANADA',
        'MARCADA_PERDIDA', 'VENCIDA', 'ANULADA', 'DUPLICADA'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "solicitudes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "sucursalId" uuid,
        "clienteId" uuid,
        "canal" "public"."solicitudes_canal_enum" NOT NULL DEFAULT 'WHATSAPP_PEGADO',
        "textoOriginal" text NOT NULL,
        "textoNormalizado" text NOT NULL,
        "estado" "public"."solicitudes_estado_enum" NOT NULL DEFAULT 'PENDIENTE',
        "recibidaAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_solicitudes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "solicitudes"
      ADD CONSTRAINT "FK_solicitudes_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "solicitudes"
      ADD CONSTRAINT "FK_solicitudes_sucursal"
      FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "solicitudes"
      ADD CONSTRAINT "FK_solicitudes_cliente"
      FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_solicitudes_org_estado"
      ON "solicitudes" ("organizacionId", "estado")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_solicitudes_org_recibida"
      ON "solicitudes" ("organizacionId", "recibidaAt")
    `);

    await queryRunner.query(`
      CREATE TABLE "interpretaciones_solicitud" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "solicitudId" uuid NOT NULL,
        "proveedor" character varying(40) NOT NULL,
        "modelo" character varying(80) NOT NULL,
        "versionPrompt" character varying(80) NOT NULL,
        "exito" boolean NOT NULL,
        "resultado" jsonb NOT NULL,
        "advertencias" jsonb,
        "errorCodigo" character varying(80),
        "errorDetalle" text,
        "latenciaMs" integer NOT NULL,
        "tokensEntrada" integer,
        "tokensSalida" integer,
        "costoEstimado" numeric(18,6),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        CONSTRAINT "PK_interpretaciones_solicitud" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "interpretaciones_solicitud"
      ADD CONSTRAINT "FK_interpretaciones_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "interpretaciones_solicitud"
      ADD CONSTRAINT "FK_interpretaciones_solicitud"
      FOREIGN KEY ("solicitudId") REFERENCES "solicitudes"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_interpretaciones_solicitud"
      ON "interpretaciones_solicitud" ("solicitudId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE "secuencias_folio" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "ultimoNumero" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_secuencias_folio" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_secuencias_folio_organizacion" UNIQUE ("organizacionId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "secuencias_folio"
      ADD CONSTRAINT "FK_secuencias_folio_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "cotizaciones" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "sucursalId" uuid NOT NULL,
        "folioNumero" integer NOT NULL,
        "folio" character varying(40) NOT NULL,
        "solicitudId" uuid,
        "clienteId" uuid,
        "nombreClienteLibre" character varying(160),
        "telefonoClienteLibre" character varying(40),
        "listaPrecioId" uuid NOT NULL,
        "monedaBaseId" uuid NOT NULL,
        "monedaPresentacionId" uuid,
        "tasaAplicada" numeric(18,6),
        "tasaFecha" date,
        "estado" "public"."cotizaciones_estado_enum" NOT NULL DEFAULT 'BORRADOR',
        "vigenciaHasta" TIMESTAMP WITH TIME ZONE,
        "subtotal" numeric(18,4) NOT NULL DEFAULT '0.0000',
        "descuentoTotal" numeric(18,4) NOT NULL DEFAULT '0.0000',
        "impuestoTotal" numeric(18,4) NOT NULL DEFAULT '0.0000',
        "total" numeric(18,4) NOT NULL DEFAULT '0.0000',
        "totalPresentacion" numeric(18,4),
        "porcentajeImpuestoAplicado" numeric(9,4) NOT NULL DEFAULT '0.0000',
        "textoCondiciones" text,
        "textoPie" text,
        "observaciones" text,
        "aprobadaPorId" uuid,
        "aprobadaAt" TIMESTAMP WITH TIME ZONE,
        "enviadaAt" TIMESTAMP WITH TIME ZONE,
        "resultadoAt" TIMESTAMP WITH TIME ZONE,
        "motivoPerdida" text,
        "anulado" boolean NOT NULL DEFAULT false,
        "anuladoAt" TIMESTAMP WITH TIME ZONE,
        "anuladoById" uuid,
        "motivoAnulacion" text,
        "cotizacionOrigenId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_cotizaciones" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cotizaciones_org_folio" UNIQUE ("organizacionId", "folioNumero")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizaciones"
      ADD CONSTRAINT "FK_cotizaciones_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizaciones"
      ADD CONSTRAINT "FK_cotizaciones_sucursal"
      FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id")
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizaciones"
      ADD CONSTRAINT "FK_cotizaciones_solicitud"
      FOREIGN KEY ("solicitudId") REFERENCES "solicitudes"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizaciones"
      ADD CONSTRAINT "FK_cotizaciones_cliente"
      FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizaciones"
      ADD CONSTRAINT "FK_cotizaciones_lista"
      FOREIGN KEY ("listaPrecioId") REFERENCES "listas_precio"("id")
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizaciones"
      ADD CONSTRAINT "FK_cotizaciones_moneda_base"
      FOREIGN KEY ("monedaBaseId") REFERENCES "monedas"("id")
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizaciones"
      ADD CONSTRAINT "FK_cotizaciones_moneda_presentacion"
      FOREIGN KEY ("monedaPresentacionId") REFERENCES "monedas"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizaciones"
      ADD CONSTRAINT "FK_cotizaciones_origen"
      FOREIGN KEY ("cotizacionOrigenId") REFERENCES "cotizaciones"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_cotizaciones_org_estado_created"
      ON "cotizaciones" ("organizacionId", "estado", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_cotizaciones_org_cliente"
      ON "cotizaciones" ("organizacionId", "clienteId")
    `);

    await queryRunner.query(`
      CREATE TABLE "cotizacion_lineas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "cotizacionId" uuid NOT NULL,
        "orden" integer NOT NULL,
        "textoSolicitado" text NOT NULL,
        "itemId" uuid,
        "descripcion" character varying(200),
        "sku" character varying(60),
        "unidadMedidaId" uuid,
        "cantidad" numeric(18,4) NOT NULL,
        "precioLista" numeric(18,4),
        "precioUnitario" numeric(18,4),
        "reglaDescuentoId" uuid,
        "descuentoMonto" numeric(18,4) NOT NULL DEFAULT '0.0000',
        "descuentoPorcentaje" numeric(9,4),
        "precioSobrescrito" boolean NOT NULL DEFAULT false,
        "motivoSobrescritura" text,
        "subtotal" numeric(18,4),
        "total" numeric(18,4),
        "estadoResolucion" "public"."cotizacion_lineas_estadoresolucion_enum" NOT NULL,
        "confianza" numeric(5,4) NOT NULL DEFAULT '0.0000',
        "origenMatch" "public"."cotizacion_lineas_origenmatch_enum",
        "notas" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_cotizacion_lineas" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_lineas"
      ADD CONSTRAINT "FK_cotizacion_lineas_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_lineas"
      ADD CONSTRAINT "FK_cotizacion_lineas_cotizacion"
      FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_lineas"
      ADD CONSTRAINT "FK_cotizacion_lineas_item"
      FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_lineas"
      ADD CONSTRAINT "FK_cotizacion_lineas_unidad"
      FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_lineas"
      ADD CONSTRAINT "FK_cotizacion_lineas_regla"
      FOREIGN KEY ("reglaDescuentoId") REFERENCES "reglas_descuento"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_cotizacion_lineas_cotizacion_orden"
      ON "cotizacion_lineas" ("cotizacionId", "orden")
    `);

    await queryRunner.query(`
      CREATE TABLE "cotizacion_linea_candidatos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "cotizacionLineaId" uuid NOT NULL,
        "itemId" uuid NOT NULL,
        "puntaje" numeric(5,4) NOT NULL,
        "origenMatch" "public"."cotizacion_lineas_origenmatch_enum" NOT NULL,
        "orden" integer NOT NULL,
        CONSTRAINT "PK_cotizacion_linea_candidatos" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_linea_candidatos"
      ADD CONSTRAINT "FK_candidatos_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_linea_candidatos"
      ADD CONSTRAINT "FK_candidatos_linea"
      FOREIGN KEY ("cotizacionLineaId") REFERENCES "cotizacion_lineas"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_linea_candidatos"
      ADD CONSTRAINT "FK_candidatos_item"
      FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_candidatos_linea_orden"
      ON "cotizacion_linea_candidatos" ("cotizacionLineaId", "orden")
    `);

    await queryRunner.query(`
      CREATE TABLE "cotizacion_eventos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "cotizacionId" uuid NOT NULL,
        "tipo" "public"."cotizacion_eventos_tipo_enum" NOT NULL,
        "descripcion" text,
        "datos" jsonb,
        "usuarioId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cotizacion_eventos" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_eventos"
      ADD CONSTRAINT "FK_cotizacion_eventos_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cotizacion_eventos"
      ADD CONSTRAINT "FK_cotizacion_eventos_cotizacion"
      FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_cotizacion_eventos_cotizacion"
      ON "cotizacion_eventos" ("cotizacionId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cotizacion_eventos_cotizacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizacion_eventos" DROP CONSTRAINT IF EXISTS "FK_cotizacion_eventos_cotizacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizacion_eventos" DROP CONSTRAINT IF EXISTS "FK_cotizacion_eventos_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cotizacion_eventos"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_candidatos_linea_orden"`);
    await queryRunner.query(
      `ALTER TABLE "cotizacion_linea_candidatos" DROP CONSTRAINT IF EXISTS "FK_candidatos_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizacion_linea_candidatos" DROP CONSTRAINT IF EXISTS "FK_candidatos_linea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizacion_linea_candidatos" DROP CONSTRAINT IF EXISTS "FK_candidatos_organizacion"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "cotizacion_linea_candidatos"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cotizacion_lineas_cotizacion_orden"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizacion_lineas" DROP CONSTRAINT IF EXISTS "FK_cotizacion_lineas_regla"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizacion_lineas" DROP CONSTRAINT IF EXISTS "FK_cotizacion_lineas_unidad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizacion_lineas" DROP CONSTRAINT IF EXISTS "FK_cotizacion_lineas_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizacion_lineas" DROP CONSTRAINT IF EXISTS "FK_cotizacion_lineas_cotizacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizacion_lineas" DROP CONSTRAINT IF EXISTS "FK_cotizacion_lineas_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cotizacion_lineas"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cotizaciones_org_cliente"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cotizaciones_org_estado_created"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizaciones" DROP CONSTRAINT IF EXISTS "FK_cotizaciones_origen"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizaciones" DROP CONSTRAINT IF EXISTS "FK_cotizaciones_moneda_presentacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizaciones" DROP CONSTRAINT IF EXISTS "FK_cotizaciones_moneda_base"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizaciones" DROP CONSTRAINT IF EXISTS "FK_cotizaciones_lista"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizaciones" DROP CONSTRAINT IF EXISTS "FK_cotizaciones_cliente"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizaciones" DROP CONSTRAINT IF EXISTS "FK_cotizaciones_solicitud"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizaciones" DROP CONSTRAINT IF EXISTS "FK_cotizaciones_sucursal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cotizaciones" DROP CONSTRAINT IF EXISTS "FK_cotizaciones_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cotizaciones"`);

    await queryRunner.query(
      `ALTER TABLE "secuencias_folio" DROP CONSTRAINT IF EXISTS "FK_secuencias_folio_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "secuencias_folio"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_interpretaciones_solicitud"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interpretaciones_solicitud" DROP CONSTRAINT IF EXISTS "FK_interpretaciones_solicitud"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interpretaciones_solicitud" DROP CONSTRAINT IF EXISTS "FK_interpretaciones_organizacion"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "interpretaciones_solicitud"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_solicitudes_org_recibida"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_solicitudes_org_estado"`);
    await queryRunner.query(
      `ALTER TABLE "solicitudes" DROP CONSTRAINT IF EXISTS "FK_solicitudes_cliente"`,
    );
    await queryRunner.query(
      `ALTER TABLE "solicitudes" DROP CONSTRAINT IF EXISTS "FK_solicitudes_sucursal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "solicitudes" DROP CONSTRAINT IF EXISTS "FK_solicitudes_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "solicitudes"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."cotizacion_eventos_tipo_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."cotizacion_lineas_origenmatch_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."cotizacion_lineas_estadoresolucion_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."cotizaciones_estado_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."solicitudes_estado_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."solicitudes_canal_enum"`,
    );
  }
}

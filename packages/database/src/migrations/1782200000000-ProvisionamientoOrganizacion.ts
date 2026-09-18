import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProvisionamientoOrganizacion1782200000000 implements MigrationInterface {
  name = 'ProvisionamientoOrganizacion1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."unidades_medida_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "unidades_medida" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "codigo" character varying NOT NULL,
        "nombre" character varying NOT NULL,
        "permiteDecimales" boolean NOT NULL DEFAULT false,
        "estadoRegistro" "public"."unidades_medida_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "UQ_unidades_medida_org_codigo" UNIQUE ("organizacionId", "codigo"),
        CONSTRAINT "PK_unidades_medida" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "unidades_medida"
      ADD CONSTRAINT "FK_unidades_medida_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."definiciones_atributo_tipodato_enum" AS ENUM('TEXTO', 'NUMERO', 'ENTERO', 'BOOLEANO', 'LISTA', 'RANGO_ANIO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."definiciones_atributo_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "definiciones_atributo" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "codigo" character varying NOT NULL,
        "etiqueta" character varying NOT NULL,
        "tipoDato" "public"."definiciones_atributo_tipodato_enum" NOT NULL,
        "opciones" jsonb,
        "unidadSugerida" character varying,
        "requerido" boolean NOT NULL DEFAULT false,
        "usarEnBusqueda" boolean NOT NULL DEFAULT false,
        "orden" integer NOT NULL DEFAULT 0,
        "estadoRegistro" "public"."definiciones_atributo_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "UQ_definiciones_atributo_org_codigo" UNIQUE ("organizacionId", "codigo"),
        CONSTRAINT "PK_definiciones_atributo" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "definiciones_atributo"
      ADD CONSTRAINT "FK_definiciones_atributo_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."categorias_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "categorias" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "nombre" character varying NOT NULL,
        "categoriaPadreId" uuid,
        "orden" integer NOT NULL DEFAULT 0,
        "estadoRegistro" "public"."categorias_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_categorias" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categorias_org_padre_nombre"
      ON "categorias" ("organizacionId", COALESCE("categoriaPadreId", '00000000-0000-0000-0000-000000000000'), "nombre")
    `);
    await queryRunner.query(`
      ALTER TABLE "categorias"
      ADD CONSTRAINT "FK_categorias_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "categorias"
      ADD CONSTRAINT "FK_categorias_padre"
      FOREIGN KEY ("categoriaPadreId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."listas_precio_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "listas_precio" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "nombre" character varying NOT NULL,
        "monedaId" uuid NOT NULL,
        "esPredeterminada" boolean NOT NULL DEFAULT false,
        "estadoRegistro" "public"."listas_precio_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_listas_precio" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "listas_precio"
      ADD CONSTRAINT "FK_listas_precio_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "listas_precio"
      ADD CONSTRAINT "FK_listas_precio_moneda"
      FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."configuraciones_cotizacion_modoredondeo_enum" AS ENUM('NORMAL', 'ARRIBA', 'ABAJO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "configuraciones_cotizacion" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "vigenciaHorasPredeterminada" integer NOT NULL DEFAULT 48,
        "aplicaImpuesto" boolean NOT NULL DEFAULT false,
        "porcentajeImpuesto" numeric(9,4) NOT NULL DEFAULT 0,
        "preciosIncluyenImpuesto" boolean NOT NULL DEFAULT false,
        "decimalesRedondeo" integer NOT NULL DEFAULT 2,
        "modoRedondeo" "public"."configuraciones_cotizacion_modoredondeo_enum" NOT NULL DEFAULT 'NORMAL',
        "mostrarDescuentoDetallado" boolean NOT NULL DEFAULT true,
        "permiteSobrescribirPrecio" boolean NOT NULL DEFAULT true,
        "listaPrecioPredeterminadaId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "UQ_configuraciones_cotizacion_organizacion" UNIQUE ("organizacionId"),
        CONSTRAINT "PK_configuraciones_cotizacion" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "configuraciones_cotizacion"
      ADD CONSTRAINT "FK_configuraciones_cotizacion_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "configuraciones_cotizacion"
      ADD CONSTRAINT "FK_configuraciones_cotizacion_lista_precio"
      FOREIGN KEY ("listaPrecioPredeterminadaId") REFERENCES "listas_precio"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."plantillas_documento_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "plantillas_documento" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "nombre" character varying NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "esPredeterminada" boolean NOT NULL DEFAULT false,
        "configuracion" jsonb NOT NULL,
        "estadoRegistro" "public"."plantillas_documento_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "PK_plantillas_documento" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "plantillas_documento"
      ADD CONSTRAINT "FK_plantillas_documento_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plantillas_documento" DROP CONSTRAINT "FK_plantillas_documento_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "plantillas_documento"`);
    await queryRunner.query(`DROP TYPE "public"."plantillas_documento_estadoregistro_enum"`);

    await queryRunner.query(
      `ALTER TABLE "configuraciones_cotizacion" DROP CONSTRAINT "FK_configuraciones_cotizacion_lista_precio"`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuraciones_cotizacion" DROP CONSTRAINT "FK_configuraciones_cotizacion_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "configuraciones_cotizacion"`);
    await queryRunner.query(`DROP TYPE "public"."configuraciones_cotizacion_modoredondeo_enum"`);

    await queryRunner.query(
      `ALTER TABLE "listas_precio" DROP CONSTRAINT "FK_listas_precio_moneda"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listas_precio" DROP CONSTRAINT "FK_listas_precio_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "listas_precio"`);
    await queryRunner.query(`DROP TYPE "public"."listas_precio_estadoregistro_enum"`);

    await queryRunner.query(`ALTER TABLE "categorias" DROP CONSTRAINT "FK_categorias_padre"`);
    await queryRunner.query(`ALTER TABLE "categorias" DROP CONSTRAINT "FK_categorias_organizacion"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_categorias_org_padre_nombre"`);
    await queryRunner.query(`DROP TABLE "categorias"`);
    await queryRunner.query(`DROP TYPE "public"."categorias_estadoregistro_enum"`);

    await queryRunner.query(
      `ALTER TABLE "definiciones_atributo" DROP CONSTRAINT "FK_definiciones_atributo_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "definiciones_atributo"`);
    await queryRunner.query(`DROP TYPE "public"."definiciones_atributo_estadoregistro_enum"`);
    await queryRunner.query(`DROP TYPE "public"."definiciones_atributo_tipodato_enum"`);

    await queryRunner.query(
      `ALTER TABLE "unidades_medida" DROP CONSTRAINT "FK_unidades_medida_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "unidades_medida"`);
    await queryRunner.query(`DROP TYPE "public"."unidades_medida_estadoregistro_enum"`);
  }
}

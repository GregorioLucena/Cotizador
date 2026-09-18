import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthSesionesYOrganizaciones1782100000000 implements MigrationInterface {
  name = 'AuthSesionesYOrganizaciones1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."organizaciones_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "organizaciones" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying NOT NULL,
        "razonSocial" character varying,
        "identificacionFiscal" character varying,
        "verticalId" uuid NOT NULL,
        "telefono" character varying,
        "email" character varying,
        "direccion" text,
        "logoUrl" character varying,
        "monedaBaseId" uuid NOT NULL,
        "monedaPresentacionId" uuid,
        "zonaHoraria" character varying NOT NULL DEFAULT 'America/Caracas',
        "locale" character varying NOT NULL DEFAULT 'es-VE',
        "usaIa" boolean NOT NULL DEFAULT true,
        "umbralAutomatico" numeric(5,4) NOT NULL DEFAULT 0.85,
        "umbralDescarte" numeric(5,4) NOT NULL DEFAULT 0.5,
        "notasInternas" text,
        "estadoRegistro" "public"."organizaciones_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "UQ_organizaciones_nombre" UNIQUE ("nombre"),
        CONSTRAINT "PK_organizaciones" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_organizaciones_identificacionFiscal"
      ON "organizaciones" ("identificacionFiscal")
      WHERE "identificacionFiscal" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "organizaciones"
      ADD CONSTRAINT "FK_organizaciones_vertical"
      FOREIGN KEY ("verticalId") REFERENCES "verticales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "organizaciones"
      ADD CONSTRAINT "FK_organizaciones_moneda_base"
      FOREIGN KEY ("monedaBaseId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "organizaciones"
      ADD CONSTRAINT "FK_organizaciones_moneda_presentacion"
      FOREIGN KEY ("monedaPresentacionId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."sucursales_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "sucursales" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid NOT NULL,
        "nombre" character varying NOT NULL,
        "codigo" character varying,
        "direccion" text,
        "telefono" character varying,
        "esPrincipal" boolean NOT NULL DEFAULT false,
        "estadoRegistro" "public"."sucursales_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "UQ_sucursales_org_nombre" UNIQUE ("organizacionId", "nombre"),
        CONSTRAINT "PK_sucursales" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "sucursales"
      ADD CONSTRAINT "FK_sucursales_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "usuarios"
      ADD CONSTRAINT "FK_usuarios_organizacion"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "usuario_sucursales" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "usuarioId" uuid NOT NULL,
        "sucursalId" uuid NOT NULL,
        CONSTRAINT "UQ_usuario_sucursales_usuario_sucursal" UNIQUE ("usuarioId", "sucursalId"),
        CONSTRAINT "PK_usuario_sucursales" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "usuario_sucursales"
      ADD CONSTRAINT "FK_usuario_sucursales_usuario"
      FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "usuario_sucursales"
      ADD CONSTRAINT "FK_usuario_sucursales_sucursal"
      FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "sesiones" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "usuarioId" uuid NOT NULL,
        "refreshTokenHash" character varying NOT NULL,
        "expiraAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revocadaAt" TIMESTAMP WITH TIME ZONE,
        "userAgent" character varying,
        "ip" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sesiones" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sesiones_refreshTokenHash" ON "sesiones" ("refreshTokenHash")
    `);
    await queryRunner.query(`
      ALTER TABLE "sesiones"
      ADD CONSTRAINT "FK_sesiones_usuario"
      FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sesiones" DROP CONSTRAINT "FK_sesiones_usuario"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sesiones_refreshTokenHash"`);
    await queryRunner.query(`DROP TABLE "sesiones"`);

    await queryRunner.query(
      `ALTER TABLE "usuario_sucursales" DROP CONSTRAINT "FK_usuario_sucursales_sucursal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario_sucursales" DROP CONSTRAINT "FK_usuario_sucursales_usuario"`,
    );
    await queryRunner.query(`DROP TABLE "usuario_sucursales"`);

    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP CONSTRAINT "FK_usuarios_organizacion"`,
    );

    await queryRunner.query(
      `ALTER TABLE "sucursales" DROP CONSTRAINT "FK_sucursales_organizacion"`,
    );
    await queryRunner.query(`DROP TABLE "sucursales"`);
    await queryRunner.query(`DROP TYPE "public"."sucursales_estadoregistro_enum"`);

    await queryRunner.query(
      `ALTER TABLE "organizaciones" DROP CONSTRAINT "FK_organizaciones_moneda_presentacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizaciones" DROP CONSTRAINT "FK_organizaciones_moneda_base"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizaciones" DROP CONSTRAINT "FK_organizaciones_vertical"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_organizaciones_identificacionFiscal"`);
    await queryRunner.query(`DROP TABLE "organizaciones"`);
    await queryRunner.query(`DROP TYPE "public"."organizaciones_estadoregistro_enum"`);
  }
}

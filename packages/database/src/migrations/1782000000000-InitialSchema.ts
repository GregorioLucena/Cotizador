import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1782000000000 implements MigrationInterface {
  name = 'InitialSchema1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);

    await queryRunner.query(
      `CREATE TYPE "public"."verticales_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "verticales" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "codigo" character varying NOT NULL,
        "nombre" character varying NOT NULL,
        "descripcion" text,
        "estadoRegistro" "public"."verticales_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        CONSTRAINT "UQ_verticales_codigo" UNIQUE ("codigo"),
        CONSTRAINT "PK_verticales" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."monedas_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "monedas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "codigoIso" character varying NOT NULL,
        "nombre" character varying NOT NULL,
        "simbolo" character varying NOT NULL,
        "decimales" integer NOT NULL DEFAULT 2,
        "estadoRegistro" "public"."monedas_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        CONSTRAINT "UQ_monedas_codigoIso" UNIQUE ("codigoIso"),
        CONSTRAINT "PK_monedas" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "permisos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "codigo" character varying NOT NULL,
        "modulo" character varying NOT NULL,
        "descripcion" text,
        CONSTRAINT "UQ_permisos_codigo" UNIQUE ("codigo"),
        CONSTRAINT "PK_permisos" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."perfiles_ambito_enum" AS ENUM('PLATAFORMA', 'ORGANIZACION')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."perfiles_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "perfiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying NOT NULL,
        "codigo" character varying NOT NULL,
        "ambito" "public"."perfiles_ambito_enum" NOT NULL,
        "descripcion" text,
        "esSistema" boolean NOT NULL DEFAULT false,
        "estadoRegistro" "public"."perfiles_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        CONSTRAINT "UQ_perfiles_codigo" UNIQUE ("codigo"),
        CONSTRAINT "PK_perfiles" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "perfil_permisos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "perfilId" uuid NOT NULL,
        "permisoId" uuid NOT NULL,
        CONSTRAINT "UQ_perfil_permisos_perfil_permiso" UNIQUE ("perfilId", "permisoId"),
        CONSTRAINT "PK_perfil_permisos" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."usuarios_estadoregistro_enum" AS ENUM('ACTIVO', 'INACTIVO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "usuarios" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizacionId" uuid,
        "nombreCompleto" character varying NOT NULL,
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "telefono" character varying,
        "debeCambiarPassword" boolean NOT NULL DEFAULT true,
        "ultimoAccesoAt" TIMESTAMP WITH TIME ZONE,
        "estadoRegistro" "public"."usuarios_estadoregistro_enum" NOT NULL DEFAULT 'ACTIVO',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        "updatedById" uuid,
        CONSTRAINT "UQ_usuarios_email" UNIQUE ("email"),
        CONSTRAINT "PK_usuarios" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "usuario_perfiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "usuarioId" uuid NOT NULL,
        "perfilId" uuid NOT NULL,
        CONSTRAINT "UQ_usuario_perfiles_usuario_perfil" UNIQUE ("usuarioId", "perfilId"),
        CONSTRAINT "PK_usuario_perfiles" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "perfil_permisos"
      ADD CONSTRAINT "FK_perfil_permisos_perfil"
      FOREIGN KEY ("perfilId") REFERENCES "perfiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "perfil_permisos"
      ADD CONSTRAINT "FK_perfil_permisos_permiso"
      FOREIGN KEY ("permisoId") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "usuario_perfiles"
      ADD CONSTRAINT "FK_usuario_perfiles_usuario"
      FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "usuario_perfiles"
      ADD CONSTRAINT "FK_usuario_perfiles_perfil"
      FOREIGN KEY ("perfilId") REFERENCES "perfiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario_perfiles" DROP CONSTRAINT "FK_usuario_perfiles_perfil"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario_perfiles" DROP CONSTRAINT "FK_usuario_perfiles_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfil_permisos" DROP CONSTRAINT "FK_perfil_permisos_permiso"`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfil_permisos" DROP CONSTRAINT "FK_perfil_permisos_perfil"`,
    );
    await queryRunner.query(`DROP TABLE "usuario_perfiles"`);
    await queryRunner.query(`DROP TABLE "usuarios"`);
    await queryRunner.query(`DROP TYPE "public"."usuarios_estadoregistro_enum"`);
    await queryRunner.query(`DROP TABLE "perfil_permisos"`);
    await queryRunner.query(`DROP TABLE "perfiles"`);
    await queryRunner.query(`DROP TYPE "public"."perfiles_estadoregistro_enum"`);
    await queryRunner.query(`DROP TYPE "public"."perfiles_ambito_enum"`);
    await queryRunner.query(`DROP TABLE "permisos"`);
    await queryRunner.query(`DROP TABLE "monedas"`);
    await queryRunner.query(`DROP TYPE "public"."monedas_estadoregistro_enum"`);
    await queryRunner.query(`DROP TABLE "verticales"`);
    await queryRunner.query(`DROP TYPE "public"."verticales_estadoregistro_enum"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "unaccent"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pg_trgm"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}

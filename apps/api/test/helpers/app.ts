import 'reflect-metadata';
import { createRequire } from 'node:module';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { OrgContext } from '@cotizador/shared';
import cookieParser from 'cookie-parser';
import ExcelJS from 'exceljs';
import request from 'supertest';

const apiRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(apiRoot, '../..');
loadEnv({ path: path.join(repoRoot, '.env.development') });

const require = createRequire(__filename);
const { AppModule } = require(path.join(apiRoot, 'dist', 'app.module.js')) as {
  AppModule: new (...args: unknown[]) => unknown;
};
const { AppExceptionFilter } = require(
  path.join(apiRoot, 'dist', 'common', 'filters', 'app-exception.filter.js'),
) as { AppExceptionFilter: new (...args: unknown[]) => unknown };
const { ImportacionesService } = require(
  path.join(apiRoot, 'dist', 'importaciones', 'importaciones.service.js'),
) as {
  ImportacionesService: new (...args: unknown[]) => {
    cargar(
      ctx: OrgContext,
      body: { tipo?: string; mapeoColumnas?: string },
      file: Express.Multer.File,
    ): Promise<{ id: string; estado: string }>;
    validar(ctx: OrgContext, id: string): Promise<{ id: string; estado: string; filasValidas: number }>;
    confirmar(
      ctx: OrgContext,
      id: string,
      body: unknown,
    ): Promise<{ id: string; estado: string }>;
  };
};

let appSingleton: INestApplication | null = null;

/**
 * Arranca la API completa contra la BD de `.env.development`.
 * Misma config que producción (sin tocar bodyParser / multer).
 * Requiere Postgres + migraciones + semilla demo.
 */
export async function getTestApp(): Promise<INestApplication> {
  if (appSingleton) return appSingleton;

  process.env.IA_PROVEEDOR = process.env.IA_PROVEEDOR_E2E ?? 'mock';
  process.env.PDF_GENERADOR = process.env.PDF_GENERADOR_E2E ?? 'mock';
  process.env.NODE_ENV = 'test';

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL ausente. Ejecute con: pnpm test:e2e (carga .env.development)',
    );
  }

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule as never],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new (AppExceptionFilter as never)());
  await app.init();

  appSingleton = app;
  return app;
}

export async function closeTestApp(): Promise<void> {
  if (appSingleton) {
    await appSingleton.close();
    appSingleton = null;
  }
}

export type SesionPrueba = {
  accessToken: string;
  cookie?: string;
  organizacionId: string | null;
  usuarioId: string;
  email: string;
  contexto: OrgContext;
};

export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<SesionPrueba> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }

  const data = res.body?.data;
  if (!data?.accessToken || !data?.contexto) {
    throw new Error(`Login incompleto: ${JSON.stringify(res.body)}`);
  }

  const setCookie = res.headers['set-cookie'];
  const cookie = Array.isArray(setCookie)
    ? setCookie.map(String).join('; ')
    : setCookie
      ? String(setCookie)
      : undefined;

  return {
    accessToken: data.accessToken as string,
    cookie,
    organizacionId: (data.contexto.organizacionId as string) ?? null,
    usuarioId: data.contexto.usuarioId as string,
    email,
    contexto: data.contexto as OrgContext,
  };
}

export function auth(sesion: SesionPrueba) {
  return {
    Authorization: `Bearer ${sesion.accessToken}`,
  };
}

/**
 * Credenciales de la suite E2E (`E2E_*` en `.env.development`).
 * Deben ser las contraseñas ya cambiadas tras el primer acceso
 * (la semilla deja `debeCambiarPassword=true` y no reescribe el hash).
 */
export function credencialesE2e() {
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || '';
  const cotizadorPassword =
    process.env.E2E_COTIZADOR_PASSWORD || adminPassword;
  const plataformaPassword = process.env.E2E_PLATAFORMA_PASSWORD || '';

  return {
    admin: {
      email: process.env.E2E_ADMIN_EMAIL?.trim() || 'admin@demo.local',
      password: adminPassword,
    },
    cotizador: {
      email:
        process.env.E2E_COTIZADOR_EMAIL?.trim() || 'cotizador@demo.local',
      password: cotizadorPassword,
    },
    plataforma: {
      email:
        process.env.E2E_PLATAFORMA_EMAIL?.trim() || 'admin@cotizador.local',
      password: plataformaPassword,
    },
  };
}

/** Genera un `.xlsx` con hoja «Plantilla» (mismo formato que la plantilla de la API). */
export async function crearExcelPlantilla(
  cabeceras: string[],
  filas: Array<Array<string | number>>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Plantilla');
  ws.addRow(cabeceras);
  for (const fila of filas) {
    ws.addRow(fila);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function archivoMulter(buffer: Buffer, filename: string): Express.Multer.File {
  return {
    fieldname: 'archivo',
    originalname: filename,
    encoding: '7bit',
    mimetype:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: buffer.length,
    buffer,
    destination: '',
    filename,
    path: '',
    stream: undefined as never,
  };
}

/**
 * Importación E2E vía servicio (cargar → validar → confirmar).
 * Usa Excel real; no pasa por multipart HTTP (supertest+multer no lo entrega bien
 * en Nest TestingModule; en el navegador el upload sí funciona).
 */
export async function importarExcel(
  app: INestApplication,
  sesion: SesionPrueba,
  params: {
    tipo: 'ITEMS' | 'PRECIOS' | 'ALIAS';
    mapeo: Record<string, string>;
    archivo: Buffer;
    filename: string;
  },
) {
  const svc = app.get(ImportacionesService);
  const cargada = await svc.cargar(
    sesion.contexto,
    {
      tipo: params.tipo,
      mapeoColumnas: JSON.stringify(params.mapeo),
    },
    archivoMulter(params.archivo, params.filename),
  );
  const validada = await svc.validar(sesion.contexto, cargada.id);
  if (validada.filasValidas < 1) {
    throw new Error(
      `Importación ${params.tipo} sin filas válidas: ${JSON.stringify(validada)}`,
    );
  }
  const confirmada = await svc.confirmar(sesion.contexto, cargada.id, {
    simular: false,
  });
  return { cargada, validada, confirmada };
}

/** Mensaje coloquial alineado al catálogo demo (alias) + 1 término inexistente. */
export const MENSAJE_CINCO_ITEMS = `[18:02] Carlos:
buenas, necesito:
2 tubos de media pvc
10 codos de media
1 pegamento azul
1 rollo de teflon
5 metros de manguera negra inexistente xyz
gracias`;

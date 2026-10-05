import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import {
  MENSAJE_CINCO_ITEMS,
  auth,
  closeTestApp,
  crearExcelPlantilla,
  credencialesE2e,
  getTestApp,
  importarExcel,
  loginAs,
  type SesionPrueba,
} from './helpers/app';

/**
 * Suite de regresión MVP: un solo recorrido que ejercita los flujos críticos.
 * Precondiciones: Postgres, `pnpm db:migrate`, `pnpm db:seed` (SEED_DEMO=true).
 * Credenciales: `E2E_*` en `.env.development` (deben coincidir con la semilla).
 */
describe('Regresión MVP (API E2E)', () => {
  let app: INestApplication;
  let admin: SesionPrueba;
  let cotizador: SesionPrueba;
  let creds: ReturnType<typeof credencialesE2e>;

  let skuImportado: string;
  let listaCodigo: string;
  let clienteId: string;
  let cotizacionId: string;

  beforeAll(async () => {
    app = await getTestApp();
    creds = credencialesE2e();
    if (!creds.admin.password || !creds.cotizador.password) {
      throw new Error(
        'Faltan E2E_ADMIN_PASSWORD / E2E_COTIZADOR_PASSWORD en .env.development',
      );
    }
    admin = await loginAs(app, creds.admin.email, creds.admin.password);
    cotizador = await loginAs(
      app,
      creds.cotizador.email,
      creds.cotizador.password,
    );
    expect(admin.organizacionId).toBeTruthy();
    expect(cotizador.organizacionId).toBe(admin.organizacionId);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('Auth', () => {
    it('rechaza credenciales inválidas sin revelar el motivo', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: creds.admin.email, password: 'clave-incorrecta-xyz' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body?.error?.code ?? res.body?.code).toMatch(
        /CREDENCIALES|NO_AUTORIZADO|AUTH/i,
      );
    });

    it('devuelve perfil del cotizador autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/perfil')
        .set(auth(cotizador))
        .expect(200);
      expect(res.body.data.usuario.email).toBe(creds.cotizador.email);
    });
  });

  describe('Importación de catálogo', () => {
    it('importa ITEMS (cargar → validar → confirmar)', async () => {
      skuImportado = `E2E-${Date.now().toString(36).toUpperCase()}`;
      const xlsx = await crearExcelPlantilla(
        ['sku', 'nombre', 'unidadCodigo', 'marca', 'categoria', 'precioLista'],
        [
          [
            skuImportado,
            'Item E2E regresion',
            'UND',
            'Genérico',
            'Tornillos',
            '3.2500',
          ],
        ],
      );

      const { confirmada, validada } = await importarExcel(app, admin, {
        tipo: 'ITEMS',
        mapeo: {
          sku: 'sku',
          nombre: 'nombre',
          unidadCodigo: 'unidadCodigo',
          marca: 'marca',
          categoria: 'categoria',
          precioLista: 'precioLista',
        },
        archivo: xlsx,
        filename: 'items-e2e.xlsx',
      });
      expect(validada.filasValidas).toBeGreaterThanOrEqual(1);
      expect(confirmada.estado).toBe('CONFIRMADA');
    });

    it('importa PRECIOS para el ítem creado', async () => {
      const listas = await request(app.getHttpServer())
        .get('/api/listas-precio')
        .set(auth(admin))
        .expect(200);

      const items = Array.isArray(listas.body.data)
        ? listas.body.data
        : (listas.body.data?.items ?? listas.body.data?.data ?? []);
      const pred =
        items.find(
          (l: { esPredeterminada?: boolean }) => l.esPredeterminada,
        ) ?? items[0];
      expect(pred?.codigo).toBeTruthy();
      listaCodigo = pred.codigo as string;

      const xlsx = await crearExcelPlantilla(
        ['sku', 'listaPrecioCodigo', 'precio'],
        [[skuImportado, listaCodigo, '4.1000']],
      );

      const { confirmada } = await importarExcel(app, admin, {
        tipo: 'PRECIOS',
        mapeo: {
          sku: 'sku',
          listaPrecioCodigo: 'listaPrecioCodigo',
          precio: 'precio',
        },
        archivo: xlsx,
        filename: 'precios-e2e.xlsx',
      });
      expect(confirmada.estado).toBe('CONFIRMADA');
    });

    it('importa ALIAS para el ítem creado', async () => {
      const aliasTxt = `alias e2e ${skuImportado.toLowerCase()}`;
      const xlsx = await crearExcelPlantilla(
        ['sku', 'alias'],
        [[skuImportado, aliasTxt]],
      );

      const { confirmada } = await importarExcel(app, admin, {
        tipo: 'ALIAS',
        mapeo: { sku: 'sku', alias: 'alias' },
        archivo: xlsx,
        filename: 'alias-e2e.xlsx',
      });
      expect(confirmada.estado).toBe('CONFIRMADA');
    });

    it('encuentra el ítem importado en búsqueda', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/items/buscar')
        .query({ q: skuImportado })
        .set(auth(admin))
        .expect(200);
      const resultados = res.body.data?.items ?? res.body.data ?? [];
      const hit = (Array.isArray(resultados) ? resultados : []).find(
        (i: { sku?: string }) =>
          (i.sku ?? '').toUpperCase() === skuImportado.toUpperCase(),
      );
      expect(hit).toBeTruthy();
    });
  });

  describe('Clientes', () => {
    it('crea cliente con WhatsApp local (código país de la org)', async () => {
      const sufijo = String(Date.now()).slice(-7);
      const res = await request(app.getHttpServer())
        .post('/api/clientes')
        .set(auth(admin))
        .send({
          nombre: `Cliente E2E ${Date.now()}`,
          telefonoWhatsapp: `0414${sufijo}`,
        });

      expect([200, 201]).toContain(res.status);
      clienteId = res.body.data.id as string;
      expect(clienteId).toBeTruthy();
      expect(res.body.data.telefonoWhatsapp).toMatch(/^\+58/);
    });
  });

  describe('Precotización → aprobación → documento', () => {
    it('captura mensaje de cinco ítems con semáforo mixto', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/precotizaciones')
        .set(auth(cotizador))
        .send({
          textoOriginal: MENSAJE_CINCO_ITEMS,
          clienteId,
          canal: 'WHATSAPP_PEGADO',
        })
        .expect(201);

      const data = res.body.data;
      cotizacionId = (data.cotizacion?.id ?? data.id) as string;
      expect(cotizacionId).toBeTruthy();

      const detalle = await request(app.getHttpServer())
        .get(`/api/cotizaciones/${cotizacionId}`)
        .set(auth(cotizador))
        .expect(200);

      const cot = detalle.body.data.cotizacion ?? detalle.body.data;
      expect(cot.estado).toBe('BORRADOR');
      const lineas = cot.lineas ?? [];
      expect(lineas.length).toBeGreaterThanOrEqual(4);

      const automaticas = lineas.filter(
        (l: { estadoResolucion: string }) =>
          l.estadoResolucion === 'RESUELTA_AUTOMATICA',
      );
      const noEncontradas = lineas.filter(
        (l: { estadoResolucion: string }) =>
          l.estadoResolucion === 'NO_ENCONTRADA',
      );
      expect(automaticas.length).toBeGreaterThanOrEqual(2);
      expect(noEncontradas.length).toBeGreaterThanOrEqual(1);
    });

    it('quita líneas sin resolver y aprueba', async () => {
      const detalle = await request(app.getHttpServer())
        .get(`/api/cotizaciones/${cotizacionId}`)
        .set(auth(cotizador))
        .expect(200);
      const cot = detalle.body.data.cotizacion ?? detalle.body.data;
      const lineas = cot.lineas ?? [];

      for (const linea of lineas) {
        if (linea.estadoResolucion === 'NO_ENCONTRADA' || !linea.itemId) {
          await request(app.getHttpServer())
            .delete(`/api/cotizaciones/${cotizacionId}/lineas/${linea.id}`)
            .set(auth(cotizador))
            .expect(200);
        }
      }

      const trasQuitar = await request(app.getHttpServer())
        .get(`/api/cotizaciones/${cotizacionId}`)
        .set(auth(cotizador))
        .expect(200);
      const cot2 = trasQuitar.body.data.cotizacion ?? trasQuitar.body.data;
      for (const linea of cot2.lineas ?? []) {
        if (!linea.itemId) {
          await request(app.getHttpServer())
            .delete(`/api/cotizaciones/${cotizacionId}/lineas/${linea.id}`)
            .set(auth(cotizador))
            .expect(200);
        }
      }

      const aprobar = await request(app.getHttpServer())
        .post(`/api/cotizaciones/${cotizacionId}/aprobar`)
        .set(auth(cotizador))
        .send({});
      expect([200, 201]).toContain(aprobar.status);
      const aprobada = aprobar.body.data.cotizacion ?? aprobar.body.data;
      expect(aprobada.estado).toBe('APROBADA');
    });

    it('genera mensaje WhatsApp y PDF (mock)', async () => {
      const mensaje = await request(app.getHttpServer())
        .get(`/api/cotizaciones/${cotizacionId}/mensaje`)
        .set(auth(cotizador))
        .expect(200);
      const texto =
        mensaje.body.data.texto ?? mensaje.body.data.mensaje ?? '';
      expect(String(texto).length).toBeGreaterThan(10);

      const pdf = await request(app.getHttpServer())
        .post(`/api/cotizaciones/${cotizacionId}/documento`)
        .set(auth(cotizador))
        .send({});
      if (![200, 201].includes(pdf.status)) {
        const reentrega = await request(app.getHttpServer())
          .get(`/api/cotizaciones/${cotizacionId}/documento`)
          .set(auth(cotizador));
        expect([200, 201]).toContain(reentrega.status);
      } else {
        expect([200, 201]).toContain(pdf.status);
      }
    });

    it('lista la cotización en historial', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/cotizaciones')
        .query({ estado: 'APROBADA' })
        .set(auth(cotizador))
        .expect(200);
      const items = res.body.data?.items ?? res.body.data ?? [];
      const hit = (Array.isArray(items) ? items : []).some(
        (c: { id: string }) => c.id === cotizacionId,
      );
      expect(hit).toBe(true);
    });
  });

  describe('Aislamiento entre organizaciones', () => {
    it('un id ajeno responde 404', async () => {
      const uuidFalso = '00000000-0000-4000-8000-000000000099';
      const res = await request(app.getHttpServer())
        .get(`/api/cotizaciones/${uuidFalso}`)
        .set(auth(cotizador));
      expect(res.status).toBe(404);
    });

    it('plataforma no opera cotizaciones de organización', async () => {
      if (!creds.plataforma.password || !cotizacionId) return;
      const plat = await loginAs(
        app,
        creds.plataforma.email,
        creds.plataforma.password,
      );
      const res = await request(app.getHttpServer())
        .get(`/api/cotizaciones/${cotizacionId}`)
        .set(auth(plat));
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});

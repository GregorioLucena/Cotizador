'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { useConfirm, useToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Termino = {
  id: string;
  textoNormalizado: string;
  ejemploOriginal: string;
  vecesVisto: number;
  ultimaVezAt: string;
  resueltoConItemId: string | null;
  estadoRegistro: string;
};

type Listado = {
  items: Termino[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type PerfilAuth = {
  usuario: { id: string };
  contexto: OrgContext;
};

export default function TerminosNoResueltosPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [auth, setAuth] = useState<PerfilAuth | null>(null);
  const [data, setData] = useState<Listado | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [itemIdPorTermino, setItemIdPorTermino] = useState<Record<string, string>>(
    {},
  );

  const puedeCerrar = auth
    ? hasPermission(auth.contexto, PERMISOS.CATALOGO_ALIAS_ADMINISTRAR) ||
      hasPermission(auth.contexto, PERMISOS.CATALOGO_ITEMS_CREAR)
    : false;

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        estadoRegistro: 'ACTIVO',
      });
      const result = await apiFetch<Listado>(
        `/terminos-no-resueltos?${params.toString()}`,
      );
      setData(result);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      setError(err instanceof ApiClientError ? err.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }, [page, router]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void (async () => {
      try {
        const perfil = await apiFetch<PerfilAuth>('/auth/perfil');
        if (perfil.contexto.ambito !== 'ORGANIZACION') {
          router.replace('/panel');
          return;
        }
        if (!hasPermission(perfil.contexto, PERMISOS.CATALOGO_ITEMS_VER)) {
          setError('No tiene permiso para ver términos.');
          setLoading(false);
          return;
        }
        setAuth(perfil);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'Error');
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!auth) return;
    void cargar();
  }, [auth, cargar]);

  async function crearAlias(e: FormEvent, termino: Termino) {
    e.preventDefault();
    const itemId = itemIdPorTermino[termino.id]?.trim();
    if (!itemId) {
      setError('Indique el id del item para crear el alias.');
      return;
    }
    if (
      !(await confirm({
        title: 'Crear alias aprendido',
        description: `Se creará un alias sobre el item y se cerrará el término (visto ${termino.vecesVisto} veces).`,
        confirmLabel: 'Crear alias',
      }))
    ) {
      return;
    }
    setPendingId(termino.id);
    setError(null);
    try {
      await apiFetch(`/terminos-no-resueltos/${termino.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ accion: 'CREAR_ALIAS', itemId }),
      });
      toast.success(`Término cerrado. Apareció ${termino.vecesVisto} veces.`);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo cerrar.');
    } finally {
      setPendingId(null);
    }
  }

  async function descartar(termino: Termino) {
    if (
      !(await confirm({
        title: 'Descartar término',
        description: `¿Descartar «${termino.ejemploOriginal}»? Se vio ${termino.vecesVisto} veces.`,
        confirmLabel: 'Descartar',
        tone: 'danger',
      }))
    ) {
      return;
    }
    setPendingId(termino.id);
    setError(null);
    try {
      await apiFetch(`/terminos-no-resueltos/${termino.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ accion: 'DESCARTAR' }),
      });
      toast.success('Término descartado.');
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo descartar.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <BackLink href="/catalogo">Volver al catálogo</BackLink>
      <PageHeader
        title="Términos no resueltos"
        description="Textos que el pipeline no asoció a ningún item. Ordene por frecuencia para curar alias."
      />
      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      {loading && !data ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : data && data.items.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">No hay términos pendientes.</p>
          </CardBody>
        </Card>
      ) : data ? (
        <ul className="space-y-3">
          {data.items.map((t) => (
            <li key={t.id}>
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">{t.ejemploOriginal}</p>
                      <p className="text-xs text-muted">
                        Normalizado: {t.textoNormalizado}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Última vez:{' '}
                        {new Date(t.ultimaVezAt).toLocaleString('es-VE')}
                      </p>
                    </div>
                    <Badge tone="warn">{t.vecesVisto}×</Badge>
                  </div>
                  {puedeCerrar ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <form
                        className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
                        onSubmit={(e) => void crearAlias(e, t)}
                      >
                        <label className="block min-w-0 flex-1">
                          <span className="mb-1 block text-xs font-medium text-muted">
                            Id del item para alias
                          </span>
                          <Input
                            value={itemIdPorTermino[t.id] ?? ''}
                            onChange={(e) =>
                              setItemIdPorTermino((prev) => ({
                                ...prev,
                                [t.id]: e.target.value,
                              }))
                            }
                            placeholder="uuid del item"
                            disabled={pendingId === t.id}
                          />
                        </label>
                        <Button type="submit" disabled={pendingId === t.id}>
                          Crear alias
                        </Button>
                      </form>
                      <Link
                        href={`/catalogo/items/nuevo?nombre=${encodeURIComponent(t.ejemploOriginal)}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-borde px-4 text-sm font-semibold hover:bg-teal/8"
                      >
                        Nuevo item
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={pendingId === t.id}
                        onClick={() => void descartar(t)}
                      >
                        Descartar
                      </Button>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {data && data.meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted">
            Página {data.meta.page} de {data.meta.totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      ) : null}
    </AppShell>
  );
}

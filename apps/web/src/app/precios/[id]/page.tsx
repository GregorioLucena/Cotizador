'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { useToast } from '@/components/feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormRequiredLegend, TextField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type Lista = {
  id: string;
  nombre: string;
  codigo: string;
  esPredeterminada: boolean;
  estadoRegistro: string;
};

type PrecioRow = {
  id: string;
  itemId: string;
  precio: string;
  estadoRegistro: string;
  item: { id: string; sku: string | null; nombre: string; estadoRegistro: string } | null;
};

type ItemOpcion = { id: string; sku: string | null; nombre: string };

export default function ListaPrecioDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const listaId = params.id;
  const toast = useToast();

  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [lista, setLista] = useState<Lista | null>(null);
  const [precios, setPrecios] = useState<PrecioRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [itemQuery, setItemQuery] = useState('');
  const [items, setItems] = useState<ItemOpcion[]>([]);
  const [itemId, setItemId] = useState('');
  const [precio, setPrecio] = useState('');

  const puedeAdmin =
    contexto && hasPermission(contexto, PERMISOS.PRECIOS_LISTAS_ADMINISTRAR);

  async function cargar() {
    const perfil = await apiFetch<{ contexto: OrgContext }>('/auth/perfil');
    if (perfil.contexto.ambito !== 'ORGANIZACION') {
      router.replace('/panel');
      return;
    }
    setContexto(perfil.contexto);
    const [l, p] = await Promise.all([
      apiFetch<Lista>(`/listas-precio/${listaId}`),
      apiFetch<{ items: PrecioRow[] }>(
        `/listas-precio/${listaId}/precios?estadoRegistro=TODOS&limit=100`,
      ),
    ]);
    setLista(l);
    setPrecios(p.items);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void cargar().catch((err) => {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      setError(err instanceof ApiClientError ? err.message : 'Error al cargar');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, listaId]);

  useEffect(() => {
    if (!itemQuery.trim() || itemQuery.trim().length < 2) {
      setItems([]);
      return;
    }
    const t = setTimeout(() => {
      void apiFetch<{ items: ItemOpcion[] }>(
        `/items?search=${encodeURIComponent(itemQuery)}&limit=10&estadoRegistro=ACTIVO`,
      )
        .then((r) => setItems(r.items))
        .catch(() => setItems([]));
    }, 250);
    return () => clearTimeout(t);
  }, [itemQuery]);

  async function marcarPredeterminada() {
    if (!lista) return;
    setPending(true);
    setError(null);
    try {
      const updated = await apiFetch<Lista>(`/listas-precio/${lista.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ esPredeterminada: true }),
      });
      setLista(updated);
      toast.success('Lista marcada como predeterminada.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error');
    } finally {
      setPending(false);
    }
  }

  async function onUpsert(e: FormEvent) {
    e.preventDefault();
    if (!itemId || !precio) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/listas-precio/${listaId}/precios`, {
        method: 'PUT',
        body: JSON.stringify({ itemId, precio }),
      });
      toast.success('Precio guardado.');
      setItemId('');
      setPrecio('');
      setItemQuery('');
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar');
    } finally {
      setPending(false);
    }
  }

  async function inactivarPrecio(row: PrecioRow) {
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/listas-precio/${listaId}/precios`, {
        method: 'PUT',
        body: JSON.stringify({
          itemId: row.itemId,
          precio: row.precio,
          estadoRegistro: 'INACTIVO',
        }),
      });
      toast.success('Precio inactivado.');
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error');
    } finally {
      setPending(false);
    }
  }

  if (!lista && !error) {
    return (
      <AppShell nav="organizacion" maxWidth="lg">
        <p className="py-16 text-center text-sm text-muted">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <BackLink href="/precios">← Listas de precios</BackLink>
      <PageHeader
        title={lista?.nombre ?? 'Lista'}
        description={lista ? `Código ${lista.codigo}` : undefined}
        action={
          lista && puedeAdmin && !lista.esPredeterminada ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void marcarPredeterminada()}
            >
              Marcar predeterminada
            </Button>
          ) : undefined
        }
      />

      {lista?.esPredeterminada ? (
        <div className="mb-4">
          <Badge tone="brand">Predeterminada</Badge>
        </div>
      ) : null}

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      {puedeAdmin ? (
        <form
          onSubmit={(e) => void onUpsert(e)}
          className="mb-6 space-y-3 rounded-2xl border border-borde bg-surface p-4"
        >
          <FormRequiredLegend />
          <p className="font-display text-base font-bold text-ink">Asignar precio</p>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-ink">Buscar item</label>
            <Input
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder="SKU o nombre…"
            />
            {items.length > 0 ? (
              <ul className="max-h-40 overflow-auto rounded-xl border border-borde bg-paper">
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-teal/8"
                      onClick={() => {
                        setItemId(it.id);
                        setItemQuery(it.sku ? `${it.sku} — ${it.nombre}` : it.nombre);
                        setItems([]);
                      }}
                    >
                      {it.sku ? `${it.sku} — ` : ''}
                      {it.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <TextField
            label="Precio"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="12.5000"
            required
          />
          <Button type="submit" disabled={pending || !itemId}>
            {pending ? 'Guardando…' : 'Guardar precio'}
          </Button>
        </form>
      ) : null}

      {precios.length === 0 ? (
        <StatusBanner tone="info">Esta lista aún no tiene precios.</StatusBanner>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borde bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-borde bg-paper/80 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">SKU</th>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold text-right">Precio</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                {puedeAdmin ? (
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {precios.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-borde/70 transition hover:bg-paper/50 last:border-0"
                >
                  <td className="px-4 py-3.5 font-mono text-xs text-muted">
                    {p.item?.sku ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-ink">
                    {p.item?.nombre ?? p.itemId}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-ink">
                    {p.precio}
                  </td>
                  <td className="px-4 py-3.5">
                    {p.estadoRegistro === 'INACTIVO' ? (
                      <Badge className="bg-peligro/10 text-peligro">Inactivo</Badge>
                    ) : (
                      <Badge className="bg-exito/10 text-exito">Activo</Badge>
                    )}
                  </td>
                  {puedeAdmin ? (
                    <td className="px-4 py-3.5">
                      {p.estadoRegistro === 'ACTIVO' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => void inactivarPrecio(p)}
                        >
                          Inactivar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

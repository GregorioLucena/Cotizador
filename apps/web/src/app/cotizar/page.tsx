'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MessageSquareText, Search, UserRound } from 'lucide-react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import type { PrecotizacionResultado } from '@/lib/cotizaciones';
import {
  AppShell,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/cn';

const MAX_TEXTO = 4000;

type ClienteOpcion = {
  id: string;
  nombre: string;
  telefonoWhatsapp: string | null;
  listaPrecio: { id: string; codigo: string; nombre: string } | null;
};

type ListaOpcion = { id: string; codigo: string; nombre: string; esPredeterminada: boolean };

type SucursalOpcion = { id: string; nombre: string; codigo: string };

type ModoCliente = 'buscar' | 'libre';

export default function CotizarPage() {
  const router = useRouter();
  const textoId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [texto, setTexto] = useState('');
  const [modoCliente, setModoCliente] = useState<ModoCliente>('buscar');
  const [clienteQuery, setClienteQuery] = useState('');
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [nombreLibre, setNombreLibre] = useState('');
  const [telefonoLibre, setTelefonoLibre] = useState('');
  const [listas, setListas] = useState<ListaOpcion[]>([]);
  const [listaPrecioId, setListaPrecioId] = useState('');
  const [sucursales, setSucursales] = useState<SucursalOpcion[]>([]);
  const [sucursalId, setSucursalId] = useState('');

  const puedeCrear =
    contexto && hasPermission(contexto, PERMISOS.COTIZACIONES_CREAR);

  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => c.id === clienteId) ?? null,
    [clienteId, clientes],
  );

  const charsLeft = MAX_TEXTO - texto.length;
  const charsPct = Math.min(100, (texto.length / MAX_TEXTO) * 100);

  const cargarListasYSucursales = useCallback(async (ctx: OrgContext) => {
    const listasData = await apiFetch<{ items: ListaOpcion[] }>(
      '/listas-precio?estadoRegistro=ACTIVO&limit=100',
    );
    setListas(listasData.items);
    const pred = listasData.items.find((l) => l.esPredeterminada);
    setListaPrecioId(pred?.id ?? listasData.items[0]?.id ?? '');

    if (ctx.sucursalIds.length > 1) {
      try {
        const sucursalesData = await apiFetch<{ items: SucursalOpcion[] }>(
          '/sucursales?estadoRegistro=ACTIVO&limit=100',
        );
        const accesibles = sucursalesData.items.filter((s) =>
          ctx.sucursalIds.includes(s.id),
        );
        setSucursales(
          accesibles.length > 0
            ? accesibles
            : ctx.sucursalIds.map((id, i) => ({
                id,
                nombre: `Sucursal ${i + 1}`,
                codigo: String(i + 1),
              })),
        );
      } catch {
        setSucursales(
          ctx.sucursalIds.map((id, i) => ({
            id,
            nombre: id === ctx.sucursalActivaId ? 'Sucursal activa' : `Sucursal ${i + 1}`,
            codigo: String(i + 1),
          })),
        );
      }
    } else {
      setSucursales([]);
    }
    setSucursalId(ctx.sucursalActivaId ?? ctx.sucursalIds[0] ?? '');
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void (async () => {
      try {
        const perfil = await apiFetch<{ contexto: OrgContext }>('/auth/perfil');
        if (perfil.contexto.ambito !== 'ORGANIZACION') {
          router.replace('/panel');
          return;
        }
        if (!hasPermission(perfil.contexto, PERMISOS.COTIZACIONES_CREAR)) {
          setError('No tiene permiso para capturar cotizaciones.');
          setLoadingPerfil(false);
          return;
        }
        setContexto(perfil.contexto);
        await cargarListasYSucursales(perfil.contexto);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'No se pudo cargar el contexto.',
        );
      } finally {
        setLoadingPerfil(false);
      }
    })();
  }, [cargarListasYSucursales, router]);

  useEffect(() => {
    if (modoCliente !== 'buscar' || !contexto) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const q = clienteQuery.trim();
          const params = new URLSearchParams({
            page: '1',
            limit: '8',
            estadoRegistro: 'ACTIVO',
          });
          if (q) params.set('search', q);
          const data = await apiFetch<{ items: ClienteOpcion[] }>(
            `/clientes?${params.toString()}`,
          );
          setClientes(data.items);
        } catch {
          /* silencioso en búsqueda */
        }
      })();
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [clienteQuery, contexto, modoCliente]);

  useEffect(() => {
    if (!clienteSeleccionado?.listaPrecio) return;
    setListaPrecioId(clienteSeleccionado.listaPrecio.id);
  }, [clienteSeleccionado]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (enviando || !puedeCrear) return;
    setError(null);

    const trimmed = texto.trim();
    if (!trimmed) {
      setError('Pegá o escribí el mensaje del pedido.');
      return;
    }
    if (trimmed.length > MAX_TEXTO) {
      setError('El texto supera el máximo de 4000 caracteres.');
      return;
    }
    if (modoCliente === 'buscar' && !clienteId) {
      setError('Elegí un cliente o usá nombre libre.');
      return;
    }
    if (modoCliente === 'libre' && !nombreLibre.trim()) {
      setError('Indicá el nombre del cliente.');
      return;
    }

    setEnviando(true);
    try {
      const body: Record<string, string> = {
        textoOriginal: trimmed,
        canal: 'WHATSAPP_PEGADO',
      };
      if (modoCliente === 'buscar' && clienteId) body.clienteId = clienteId;
      if (modoCliente === 'libre') {
        body.nombreClienteLibre = nombreLibre.trim();
        if (telefonoLibre.trim()) body.telefonoClienteLibre = telefonoLibre.trim();
      }
      if (listaPrecioId) body.listaPrecioId = listaPrecioId;
      if (sucursalId) body.sucursalId = sucursalId;

      const data = await apiFetch<PrecotizacionResultado>('/precotizaciones', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (data.interpretacion && !data.interpretacion.exito) {
        sessionStorage.setItem(
          `cot_aviso_ia_${data.cotizacion.id}`,
          'No se pudo interpretar el mensaje. Puedes armar la cotización a mano.',
        );
      }
      router.push(`/cotizaciones/${data.cotizacion.id}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo generar el borrador.',
      );
      setEnviando(false);
    }
  }

  if (loadingPerfil) {
    return (
      <AppShell nav="organizacion" maxWidth="lg">
        <p className="py-20 text-center text-sm text-muted">Abriendo mostrador…</p>
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <PageHeader
        title="Cotizar"
        description="Pegá el WhatsApp. Generamos el borrador con precios del catálogo."
      />

      {error && (
        <div className="mb-4">
          <StatusBanner tone="error">{error}</StatusBanner>
        </div>
      )}

      {!puedeCrear ? (
        <p className="text-sm text-muted">Sin permiso para capturar.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {/* Contexto: cliente + lista */}
          <section className="animate-rise space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setModoCliente('buscar');
                  setNombreLibre('');
                  setTelefonoLibre('');
                }}
                className={cn(
                  'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition',
                  modoCliente === 'buscar'
                    ? 'bg-teal text-white'
                    : 'border border-borde bg-surface text-slate hover:border-teal/40',
                )}
              >
                <Search className="size-4" aria-hidden />
                Cliente
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoCliente('libre');
                  setClienteId(null);
                }}
                className={cn(
                  'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition',
                  modoCliente === 'libre'
                    ? 'bg-teal text-white'
                    : 'border border-borde bg-surface text-slate hover:border-teal/40',
                )}
              >
                <UserRound className="size-4" aria-hidden />
                Nombre libre
              </button>
            </div>

            {modoCliente === 'buscar' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Buscar cliente
                </label>
                <Input
                  value={clienteQuery}
                  onChange={(e) => setClienteQuery(e.target.value)}
                  placeholder="Nombre o WhatsApp"
                  autoComplete="off"
                />
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-borde bg-surface p-1.5">
                  {clientes.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted">
                      Sin resultados.{' '}
                      <button
                        type="button"
                        className="font-semibold text-teal underline"
                        onClick={() => setModoCliente('libre')}
                      >
                        Usar nombre libre
                      </button>
                    </li>
                  ) : (
                    clientes.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setClienteId(c.id)}
                          className={cn(
                            'flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition',
                            clienteId === c.id
                              ? 'bg-teal/12 text-teal'
                              : 'hover:bg-paper',
                          )}
                        >
                          <span>
                            <span className="font-semibold text-ink">{c.nombre}</span>
                            {c.telefonoWhatsapp && (
                              <span className="mt-0.5 block text-xs text-muted">
                                {c.telefonoWhatsapp}
                              </span>
                            )}
                          </span>
                          {clienteId === c.id && (
                            <span className="text-xs font-bold uppercase tracking-wide">
                              Elegido
                            </span>
                          )}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Nombre
                  </label>
                  <Input
                    value={nombreLibre}
                    onChange={(e) => setNombreLibre(e.target.value)}
                    placeholder="Quién pide"
                    maxLength={160}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    WhatsApp (opcional)
                  </label>
                  <Input
                    value={telefonoLibre}
                    onChange={(e) => setTelefonoLibre(e.target.value)}
                    placeholder="+58…"
                    maxLength={40}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Lista de precios
                </label>
                <Select
                  value={listaPrecioId}
                  onChange={(e) => setListaPrecioId(e.target.value)}
                  required
                >
                  {listas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                      {l.esPredeterminada ? ' · pred.' : ''}
                    </option>
                  ))}
                </Select>
              </div>
              {sucursales.length > 1 && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Sucursal
                  </label>
                  <Select
                    value={sucursalId}
                    onChange={(e) => setSucursalId(e.target.value)}
                  >
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </section>

          {/* Lienzo de captura — firma visual */}
          <section className="animate-rise-delay">
            <div
              className={cn(
                'relative overflow-hidden rounded-2xl border border-borde bg-surface shadow-[0_20px_50px_-28px_rgba(11,95,86,0.35)]',
                enviando && 'pointer-events-none opacity-90',
              )}
            >
              <div
                aria-hidden
                className={cn(
                  'absolute inset-y-0 left-0 w-1.5 bg-[#25D366]',
                  enviando && 'animate-pulse-soft',
                )}
              />
              <div className="flex items-center justify-between gap-3 border-b border-borde/80 bg-paper/60 px-4 py-2.5 pl-5">
                <div className="flex items-center gap-2 text-teal">
                  <MessageSquareText className="size-4" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-[0.14em]">
                    Mensaje de WhatsApp
                  </span>
                </div>
                <span
                  className={cn(
                    'font-display text-sm font-bold tabular-nums',
                    charsLeft < 200 ? 'text-ambar' : 'text-muted',
                    charsLeft < 0 && 'text-peligro',
                  )}
                >
                  {texto.length}/{MAX_TEXTO}
                </span>
              </div>
              <label htmlFor={textoId} className="sr-only">
                Texto del pedido
              </label>
              <Textarea
                id={textoId}
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO + 50))}
                placeholder={
                  'hola, necesito 2 tubos de media, 10 codos y un pegamento azul'
                }
                rows={8}
                className="min-h-[11rem] resize-y rounded-none border-0 bg-transparent px-4 py-3 pl-5 text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
                disabled={enviando}
              />
              <div className="h-1 bg-paper">
                <div
                  className={cn(
                    'h-full transition-[width] duration-300',
                    charsPct > 90 ? 'bg-ambar' : 'bg-teal/40',
                  )}
                  style={{ width: `${Math.min(100, charsPct)}%` }}
                />
              </div>
            </div>
          </section>

          <div className="animate-rise-late sticky bottom-3 z-10">
            <Button
              type="submit"
              disabled={enviando || !texto.trim()}
              className="w-full min-h-12 text-base shadow-[0_16px_40px_-14px_rgba(240,162,2,0.7)]"
            >
              {enviando ? 'Generando borrador…' : 'Generar borrador'}
            </Button>
            {enviando && (
              <p className="mt-2 text-center text-xs text-muted">
                Interpretando · resolviendo catálogo · calculando precios
              </p>
            )}
          </div>

          <p className="text-center text-xs text-muted">
            Los importes salen del catálogo y las reglas, no de la IA.{' '}
            <Link href="/catalogo" className="font-semibold text-teal underline">
              Ver catálogo
            </Link>
          </p>
        </form>
      )}
    </AppShell>
  );
}

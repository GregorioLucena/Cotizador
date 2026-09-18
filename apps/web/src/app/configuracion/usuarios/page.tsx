'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Search, UserMinus, UserPlus } from 'lucide-react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import { formatUltimoAcceso, type PerfilOpcion, type UsuarioDetalle } from '@/lib/usuarios';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';

type Listado = {
  items: UsuarioDetalle[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type PerfilAuth = {
  usuario: { id: string };
  contexto: OrgContext;
};

export default function UsuariosListPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<PerfilAuth | null>(null);
  const [data, setData] = useState<Listado | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilOpcion[]>([]);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<'ACTIVO' | 'INACTIVO' | 'TODOS'>('ACTIVO');
  const [perfilId, setPerfilId] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        estadoRegistro: estado,
      });
      if (search.trim()) params.set('search', search.trim());
      if (perfilId) params.set('perfilId', perfilId);
      const result = await apiFetch<Listado>(`/usuarios?${params.toString()}`);
      setData(result);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        setError('No tiene permiso para ver usuarios.');
        return;
      }
      setError(err instanceof ApiClientError ? err.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }, [estado, page, perfilId, router, search]);

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
        if (!hasPermission(perfil.contexto, PERMISOS.SEGURIDAD_USUARIOS_VER)) {
          setError('No tiene permiso para ver usuarios.');
          setLoading(false);
          return;
        }
        setAuth(perfil);
        const listaPerfiles = await apiFetch<PerfilOpcion[]>('/perfiles');
        setPerfiles(listaPerfiles);
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

  async function buscar(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    await cargar();
  }

  async function toggleEstado(u: UsuarioDetalle) {
    setPendingId(u.id);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/usuarios/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          estadoRegistro: u.estadoRegistro === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO',
        }),
      });
      setMsg(
        u.estadoRegistro === 'ACTIVO'
          ? 'Usuario inactivado. Sus sesiones se cerraron.'
          : 'Usuario reactivado.',
      );
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setPendingId(null);
    }
  }

  async function restablecer(u: UsuarioDetalle) {
    if (
      !window.confirm(
        `¿Restablecer la contraseña de ${u.nombreCompleto}? Se cerrarán sus sesiones.`,
      )
    ) {
      return;
    }
    setPendingId(u.id);
    setError(null);
    setMsg(null);
    try {
      const res = await apiFetch<{ passwordTemporal: string; sesionesRevocadas: number }>(
        `/usuarios/${u.id}/restablecer-password`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setTempPassword(res.passwordTemporal);
      setMsg(
        'Contraseña restablecida. Cópiela: no se volverá a mostrar. Las sesiones del usuario se cerraron.',
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo restablecer.');
    } finally {
      setPendingId(null);
    }
  }

  const puedeCrear =
    auth && hasPermission(auth.contexto, PERMISOS.SEGURIDAD_USUARIOS_CREAR);
  const puedeEditar =
    auth && hasPermission(auth.contexto, PERMISOS.SEGURIDAD_USUARIOS_EDITAR);
  const puedeRestablecer =
    auth && hasPermission(auth.contexto, PERMISOS.SEGURIDAD_USUARIOS_RESTABLECER_CLAVE);
  const yoId = auth?.contexto.usuarioId ?? auth?.usuario.id;

  if (error && !auth && !loading) {
    return (
      <AppShell nav="organizacion">
        <StatusBanner tone="error">{error}</StatusBanner>
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <PageHeader
        eyebrow={<BackLink href="/configuracion">← Configuración</BackLink>}
        title="Usuarios"
        description="Accesos, perfiles y sucursales de la organización."
        action={
          puedeCrear ? (
            <Link
              href="/configuracion/usuarios/nuevo"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brass px-4 text-sm font-bold text-ink shadow-[0_10px_28px_-12px_rgba(240,162,2,0.55)] transition hover:bg-brass-dark hover:text-white"
            >
              <Plus className="size-4" />
              Nuevo
            </Link>
          ) : null
        }
      />

      <form onSubmit={buscar} className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo"
            className="pl-10"
          />
        </div>
        <Select
          value={estado}
          onChange={(e) => {
            setPage(1);
            setEstado(e.target.value as typeof estado);
          }}
          aria-label="Estado"
        >
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
          <option value="TODOS">Todos</option>
        </Select>
        <Select
          value={perfilId}
          onChange={(e) => {
            setPage(1);
            setPerfilId(e.target.value);
          }}
          aria-label="Perfil"
        >
          <option value="">Todos los perfiles</option>
          {perfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {error ? <div className="mb-4"><StatusBanner tone="error">{error}</StatusBanner></div> : null}
      {msg ? <div className="mb-4"><StatusBanner tone="success">{msg}</StatusBanner></div> : null}

      {tempPassword ? (
        <Card accent className="mb-5">
          <CardBody className="space-y-3">
            <p className="text-sm font-semibold text-ink">
              Contraseña temporal (solo esta vez)
            </p>
            <code className="block rounded-xl bg-paper px-3 py-2 font-mono text-sm">{tempPassword}</code>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void navigator.clipboard.writeText(tempPassword)}
              >
                Copiar
              </Button>
              <Button type="button" onClick={() => setTempPassword(null)}>
                Ya la copié
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {loading || !data ? (
        <p className="text-sm text-muted">Cargando usuarios…</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="border-b border-borde bg-paper/80 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Perfiles</th>
                  <th className="px-4 py-3 font-semibold">Sucursales</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Último acceso</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      No hay usuarios con esos filtros.
                    </td>
                  </tr>
                ) : (
                  data.items.map((u) => {
                    const esYo = u.id === yoId;
                    const inactivarTitle = esYo
                      ? 'No puede inactivar su propio usuario'
                      : undefined;
                    const restablecerTitle = esYo
                      ? 'No puede restablecer su propia contraseña'
                      : undefined;
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-borde/70 transition hover:bg-paper/50 last:border-0"
                      >
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/configuracion/usuarios/${u.id}`}
                            className="font-semibold text-ink hover:text-teal"
                          >
                            {u.nombreCompleto}
                          </Link>
                          <p className="text-xs text-muted">{u.email}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {u.perfiles.map((p) => (
                              <Badge key={p.id} tone="brand">
                                {p.nombre}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3.5 text-slate"
                          title={u.sucursales.map((s) => s.nombre).join(', ')}
                        >
                          {u.sucursales.length}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge tone={u.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}>
                            {u.estadoRegistro}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-muted">
                          {formatUltimoAcceso(u.ultimoAccesoAt)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            <Link
                              href={`/configuracion/usuarios/${u.id}`}
                              className="inline-flex min-h-9 items-center rounded-lg border border-borde px-2.5 text-xs font-semibold text-ink hover:border-teal/40"
                            >
                              Editar
                            </Link>
                            {puedeRestablecer ? (
                              <button
                                type="button"
                                title={restablecerTitle}
                                disabled={esYo || pendingId === u.id}
                                onClick={() => void restablecer(u)}
                                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-borde px-2.5 text-xs font-semibold text-ink hover:border-teal/40 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <KeyRound className="size-3.5" />
                                Clave
                              </button>
                            ) : null}
                            {puedeEditar ? (
                              <button
                                type="button"
                                title={inactivarTitle}
                                disabled={esYo || pendingId === u.id}
                                onClick={() => void toggleEstado(u)}
                                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-borde px-2.5 text-xs font-semibold text-ink hover:border-peligro/35 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                {u.estadoRegistro === 'ACTIVO' ? (
                                  <>
                                    <UserMinus className="size-3.5" />
                                    Inactivar
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="size-3.5" />
                                    Reactivar
                                  </>
                                )}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <CardBody className="flex flex-wrap items-center justify-between gap-3 border-t border-borde/70 py-3">
            <p className="text-xs text-muted">
              {data.meta.total} resultado{data.meta.total === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </AppShell>
  );
}

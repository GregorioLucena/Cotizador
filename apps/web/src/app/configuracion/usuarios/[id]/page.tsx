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
import type { PerfilOpcion, SucursalOpcion, UsuarioDetalle } from '@/lib/usuarios';
import { formatUltimoAcceso } from '@/lib/usuarios';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CheckField, TextField } from '@/components/ui/field';
import { Select } from '@/components/ui/input';

type ListadoSucursales = {
  items: SucursalOpcion[];
  meta: { page: number; total: number };
};

export default function UsuarioDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [yoId, setYoId] = useState<string | null>(null);
  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [usuario, setUsuario] = useState<UsuarioDetalle | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilOpcion[]>([]);
  const [sucursales, setSucursales] = useState<SucursalOpcion[]>([]);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [perfilIds, setPerfilIds] = useState<string[]>([]);
  const [sucursalIds, setSucursalIds] = useState<string[]>([]);
  const [estadoRegistro, setEstadoRegistro] = useState<'ACTIVO' | 'INACTIVO'>('ACTIVO');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void (async () => {
      try {
        const perfil = await apiFetch<{
          contexto: OrgContext;
        }>('/auth/perfil');
        if (perfil.contexto.ambito !== 'ORGANIZACION') {
          router.replace('/panel');
          return;
        }
        if (!hasPermission(perfil.contexto, PERMISOS.SEGURIDAD_USUARIOS_VER)) {
          setError('No tiene permiso para ver usuarios.');
          return;
        }
        setYoId(perfil.contexto.usuarioId);
        setContexto(perfil.contexto);

        const [u, perfs, sucs] = await Promise.all([
          apiFetch<UsuarioDetalle>(`/usuarios/${id}`),
          apiFetch<PerfilOpcion[]>('/perfiles'),
          apiFetch<ListadoSucursales>('/sucursales?estadoRegistro=TODOS&limit=100'),
        ]);
        setUsuario(u);
        setPerfiles(perfs);
        setSucursales(sucs.items.filter((s) => s.estadoRegistro === 'ACTIVO' || u.sucursales.some((x) => x.id === s.id)));
        setNombreCompleto(u.nombreCompleto);
        setTelefono(u.telefono ?? '');
        setPerfilIds(u.perfiles.map((p) => p.id));
        setSucursalIds(u.sucursales.map((s) => s.id));
        setEstadoRegistro(u.estadoRegistro === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO');
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'Error al cargar');
      }
    })();
  }, [id, router]);

  const esYo = yoId === id;
  const puedeEditar = contexto
    ? hasPermission(contexto, PERMISOS.SEGURIDAD_USUARIOS_EDITAR)
    : false;
  const puedeRestablecer = contexto
    ? hasPermission(contexto, PERMISOS.SEGURIDAD_USUARIOS_RESTABLECER_CLAVE)
    : false;

  function toggleId(list: string[], value: string, checked: boolean) {
    return checked ? [...new Set([...list, value])] : list.filter((x) => x !== value);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!puedeEditar) return;
    setError(null);
    setMsg(null);
    if (perfilIds.length === 0) {
      setError('Seleccione al menos un perfil.');
      return;
    }
    if (sucursalIds.length === 0) {
      setError('Seleccione al menos una sucursal.');
      return;
    }
    setPending(true);
    try {
      const body: Record<string, unknown> = {
        nombreCompleto: nombreCompleto.trim(),
        telefono: telefono.trim() || null,
        sucursalIds,
        estadoRegistro,
      };
      if (!esYo) {
        body.perfilIds = perfilIds;
      }
      const data = await apiFetch<UsuarioDetalle>(`/usuarios/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setUsuario(data);
      setMsg(
        'Cambios guardados. Los permisos se aplicarán en la próxima renovación de sesión del usuario.',
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar.');
    } finally {
      setPending(false);
    }
  }

  async function restablecer() {
    if (esYo) return;
    if (!window.confirm('¿Restablecer la contraseña? Se cerrarán las sesiones del usuario.')) {
      return;
    }
    setPending(true);
    setError(null);
    setMsg(null);
    try {
      const res = await apiFetch<{ passwordTemporal: string }>(
        `/usuarios/${id}/restablecer-password`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setTempPassword(res.passwordTemporal);
      setMsg(
        'Contraseña restablecida. Cópiela: no se volverá a mostrar. Las sesiones del usuario se cerraron.',
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo restablecer.');
    } finally {
      setPending(false);
    }
  }

  if (!usuario && !error) {
    return (
      <AppShell nav="organizacion">
        <p className="py-16 text-center text-sm text-muted">Cargando…</p>
      </AppShell>
    );
  }

  if (error && !usuario) {
    return (
      <AppShell nav="organizacion">
        <StatusBanner tone="error">{error}</StatusBanner>
      </AppShell>
    );
  }

  if (!usuario) return null;

  return (
    <AppShell nav="organizacion" maxWidth="sm">
      <PageHeader
        eyebrow={<BackLink href="/configuracion/usuarios">← Usuarios</BackLink>}
        title={usuario.nombreCompleto}
        description={usuario.email}
        action={
          <Badge tone={usuario.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}>
            {usuario.estadoRegistro}
          </Badge>
        }
      />

      <p className="mb-5 text-sm text-muted">
        Último acceso: {formatUltimoAcceso(usuario.ultimoAccesoAt)}
      </p>

      {tempPassword ? (
        <Card accent className="mb-5">
          <CardBody className="space-y-3">
            <p className="text-sm font-semibold text-ink">Contraseña temporal (solo esta vez)</p>
            <code className="block rounded-xl bg-paper px-3 py-2 font-mono text-sm">
              {tempPassword}
            </code>
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

      <form onSubmit={onSubmit} className="space-y-5">
        <Card accent>
          <CardHeader title="Datos personales" />
          <CardBody className="space-y-4">
            <TextField
              label="Nombre completo *"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              required
              minLength={3}
              maxLength={120}
              disabled={!puedeEditar}
            />
            <TextField label="Correo" value={usuario.email} disabled readOnly />
            <TextField
              label="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              maxLength={40}
              disabled={!puedeEditar}
            />
            {puedeEditar ? (
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-ink" htmlFor="estado">
                  Estado
                </label>
                <Select
                  id="estado"
                  value={estadoRegistro}
                  disabled={esYo}
                  title={esYo ? 'No puede inactivar su propio usuario' : undefined}
                  onChange={(e) =>
                    setEstadoRegistro(e.target.value as 'ACTIVO' | 'INACTIVO')
                  }
                >
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </Select>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Perfiles *"
            description={
              esYo
                ? 'No puede modificar sus propios perfiles. Solicítelo a otro administrador.'
                : 'Al menos uno.'
            }
          />
          <CardBody className="space-y-2">
            {perfiles.map((p) => (
              <div key={p.id} className="space-y-1">
                <CheckField
                  label={p.nombre}
                  checked={perfilIds.includes(p.id)}
                  disabled={!puedeEditar || esYo}
                  onChange={(e) =>
                    setPerfilIds(toggleId(perfilIds, p.id, e.target.checked))
                  }
                />
                {p.descripcion ? (
                  <p className="pl-11 text-xs text-muted">{p.descripcion}</p>
                ) : null}
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sucursales *" description="Al menos una." />
          <CardBody className="space-y-2">
            {sucursales.map((s) => (
              <CheckField
                key={s.id}
                label={`${s.nombre}${s.esPrincipal ? ' (principal)' : ''}`}
                checked={sucursalIds.includes(s.id)}
                disabled={!puedeEditar}
                onChange={(e) =>
                  setSucursalIds(toggleId(sucursalIds, s.id, e.target.checked))
                }
              />
            ))}
          </CardBody>
        </Card>

        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
        {msg ? <StatusBanner tone="success">{msg}</StatusBanner> : null}

        <div className="flex flex-wrap gap-3">
          {puedeEditar ? (
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          ) : null}
          {puedeRestablecer ? (
            <Button
              type="button"
              variant="secondary"
              disabled={esYo || pending}
              title={esYo ? 'No puede restablecer su propia contraseña' : undefined}
              onClick={() => void restablecer()}
            >
              Restablecer contraseña
            </Button>
          ) : null}
        </div>
      </form>
    </AppShell>
  );
}

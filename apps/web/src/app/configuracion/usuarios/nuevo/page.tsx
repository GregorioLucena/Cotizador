'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import type { PerfilOpcion, SucursalOpcion } from '@/lib/usuarios';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CheckField, TextField } from '@/components/ui/field';

type CrearResultado = {
  usuarioId: string;
  email: string;
  passwordTemporal: string;
  debeCambiarPassword: true;
};

type ListadoSucursales = {
  items: SucursalOpcion[];
  meta: { page: number; total: number };
};

export default function NuevoUsuarioPage() {
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<PerfilOpcion[]>([]);
  const [sucursales, setSucursales] = useState<SucursalOpcion[]>([]);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [perfilIds, setPerfilIds] = useState<string[]>([]);
  const [sucursalIds, setSucursalIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resultado, setResultado] = useState<CrearResultado | null>(null);
  const [listo, setListo] = useState(false);

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
        if (!hasPermission(perfil.contexto, PERMISOS.SEGURIDAD_USUARIOS_CREAR)) {
          setError('No tiene permiso para crear usuarios.');
          return;
        }
        const [perfs, sucs] = await Promise.all([
          apiFetch<PerfilOpcion[]>('/perfiles'),
          apiFetch<ListadoSucursales>('/sucursales?estadoRegistro=ACTIVO&limit=100'),
        ]);
        setPerfiles(perfs);
        setSucursales(sucs.items);
        const principal = sucs.items.find((s) => s.esPrincipal);
        if (principal) setSucursalIds([principal.id]);
        setListo(true);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'Error al cargar');
      }
    })();
  }, [router]);

  function toggleId(list: string[], id: string, checked: boolean) {
    return checked ? [...new Set([...list, id])] : list.filter((x) => x !== id);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
      const data = await apiFetch<CrearResultado>('/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          nombreCompleto: nombreCompleto.trim(),
          email: email.trim(),
          ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
          perfilIds,
          sucursalIds,
        }),
      });
      setResultado(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setPending(false);
    }
  }

  if (resultado) {
    return (
      <AppShell nav="organizacion" maxWidth="sm">
        <PageHeader title="Usuario creado" />
        <StatusBanner tone="success">
          Contraseña temporal generada. Cópiela: no se volverá a mostrar.
        </StatusBanner>
        <Card accent className="mt-5">
          <CardBody className="space-y-3">
            <p className="text-sm text-muted">{resultado.email}</p>
            <code className="block rounded-xl bg-paper px-3 py-2 font-mono text-sm">
              {resultado.passwordTemporal}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void navigator.clipboard.writeText(resultado.passwordTemporal)}
              >
                Copiar
              </Button>
              <Button
                type="button"
                onClick={() => router.push(`/configuracion/usuarios/${resultado.usuarioId}`)}
              >
                Ya la copié — ver usuario
              </Button>
              <Link
                href="/configuracion/usuarios"
                className="inline-flex min-h-11 items-center rounded-xl border border-borde px-4 text-sm font-semibold"
              >
                Ir al listado
              </Link>
            </div>
          </CardBody>
        </Card>
      </AppShell>
    );
  }

  if (!listo) {
    return (
      <AppShell nav="organizacion">
        {error ? <StatusBanner tone="error">{error}</StatusBanner> : (
          <p className="py-16 text-center text-sm text-muted">Cargando…</p>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion" maxWidth="sm">
      <PageHeader
        eyebrow={<BackLink href="/configuracion/usuarios">← Usuarios</BackLink>}
        title="Nuevo usuario"
        description="Recibirá una contraseña temporal que deberá cambiar al ingresar."
      />

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
            />
            <TextField
              label="Correo *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              maxLength={40}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Perfiles *"
            description="Al menos uno. Definen qué puede hacer en el panel."
          />
          <CardBody className="space-y-2">
            {perfiles.map((p) => (
              <div key={p.id} className="space-y-1">
                <CheckField
                  label={p.nombre}
                  checked={perfilIds.includes(p.id)}
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
          <CardHeader
            title="Sucursales *"
            description="Al menos una. La principal viene marcada por defecto."
          />
          <CardBody className="space-y-2">
            {sucursales.map((s) => (
              <CheckField
                key={s.id}
                label={`${s.nombre}${s.esPrincipal ? ' (principal)' : ''}`}
                checked={sucursalIds.includes(s.id)}
                onChange={(e) =>
                  setSucursalIds(toggleId(sucursalIds, s.id, e.target.checked))
                }
              />
            ))}
          </CardBody>
        </Card>

        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? 'Creando…' : 'Crear usuario'}
        </Button>
      </form>
    </AppShell>
  );
}

'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Copy, Pencil, UserPlus } from 'lucide-react';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
  setAccessToken,
} from '@/lib/api';
import type {
  OrganizacionDetalleRespuesta,
  UsuarioInicialResultado,
} from '@/lib/organizaciones';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Dialog, useConfirm, useToast } from '@/components/feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CheckField, FormRequiredLegend, TextField } from '@/components/ui/field';

type RefreshData = {
  accessToken: string;
  debeCambiarPassword: boolean;
};

function Dato({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-ink">{value || '—'}</dd>
    </div>
  );
}

export default function OrganizacionDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const confirm = useConfirm();
  const toast = useToast();

  const [data, setData] = useState<OrganizacionDetalleRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({
    nombreCompleto: '',
    email: '',
    telefono: '',
  });
  const [adminResult, setAdminResult] = useState<UsuarioInicialResultado | null>(
    null,
  );
  const [passwordCopiada, setPasswordCopiada] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!getAccessToken()) {
        const refreshed = await apiFetch<RefreshData>('/auth/refresh', {
          method: 'POST',
          token: null,
        });
        setAccessToken(refreshed.accessToken);
        if (refreshed.debeCambiarPassword) {
          router.replace('/acceso/cambiar-password');
          return;
        }
      }
      const result = await apiFetch<OrganizacionDetalleRespuesta>(
        `/organizaciones/${id}`,
      );
      setData(result);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        setError('No tiene permiso para ver esta organización.');
        return;
      }
      if (err instanceof ApiClientError && err.status === 404) {
        setError('Organización no encontrada.');
        return;
      }
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo cargar el detalle.',
      );
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cambiarEstado(siguiente: 'ACTIVO' | 'INACTIVO') {
    if (!data) return;
    if (siguiente === 'INACTIVO') {
      const ok = await confirm({
        title: 'Inactivar organización',
        description:
          'Los usuarios de la organización no podrán iniciar sesión y sus sesiones activas se cerrarán. Los datos se conservan.',
        confirmLabel: 'Inactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }

    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/organizaciones/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estadoRegistro: siguiente }),
      });
      toast.success(
        siguiente === 'INACTIVO'
          ? 'Organización inactivada. Sus usuarios ya no pueden iniciar sesión.'
          : 'Organización reactivada.',
      );
      await cargar();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo cambiar el estado.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function crearAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        nombreCompleto: adminForm.nombreCompleto.trim(),
        email: adminForm.email.trim(),
      };
      if (adminForm.telefono.trim()) body.telefono = adminForm.telefono.trim();

      const result = await apiFetch<UsuarioInicialResultado>(
        `/organizaciones/${id}/usuario-inicial`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      setAdminResult(result);
      setPasswordCopiada(false);
      toast.success('Usuario administrador creado. Copie la contraseña temporal.');
      await cargar();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo crear el administrador.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copiarPassword() {
    if (!adminResult) return;
    await navigator.clipboard.writeText(adminResult.passwordTemporal);
    setPasswordCopiada(true);
  }

  function cerrarAdminDialog() {
    if (adminResult && !passwordCopiada) return;
    setAdminOpen(false);
    setAdminResult(null);
    setPasswordCopiada(false);
    setAdminForm({ nombreCompleto: '', email: '', telefono: '' });
  }

  if (loading) {
    return (
      <AppShell nav="plataforma">
        <p className="py-16 text-center text-sm text-muted">Cargando detalle…</p>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell nav="plataforma" maxWidth="lg">
        <PageHeader
          eyebrow={<BackLink href="/plataforma/organizaciones">← Organizaciones</BackLink>}
          title="Organización"
        />
        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      </AppShell>
    );
  }

  const { organizacion: org, provisionamiento: prov, usuarios, tieneAdministrador } =
    data;
  const activa = org.estadoRegistro === 'ACTIVO';

  return (
    <AppShell nav="plataforma" maxWidth="lg">
      <PageHeader
        eyebrow={<BackLink href="/plataforma/organizaciones">← Organizaciones</BackLink>}
        title={org.nombre}
        description={`${org.vertical.nombre} · ${org.monedaBase.codigoIso}${
          org.monedaPresentacion ? ` → ${org.monedaPresentacion.codigoIso}` : ''
        }`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/plataforma/organizaciones/${id}/editar`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borde bg-surface px-4 text-sm font-semibold text-ink hover:border-teal/40"
            >
              <Pencil className="size-4" aria-hidden />
              Editar
            </Link>
            {activa ? (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => void cambiarEstado('INACTIVO')}
              >
                Inactivar
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void cambiarEstado('ACTIVO')}
              >
                Reactivar
              </Button>
            )}
          </div>
        }
      />

      {error ? (
        <div className="mb-4">
          <StatusBanner tone="error">{error}</StatusBanner>
        </div>
      ) : null}

      <div className="space-y-5">
        <Card accent>
          <CardHeader
            title="Identidad"
            action={
              <Badge tone={activa ? 'success' : 'neutral'}>
                {org.estadoRegistro}
              </Badge>
            }
          />
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Dato label="Nombre comercial" value={org.nombre} />
              <Dato label="Razón social" value={org.razonSocial} />
              <Dato
                label="Identificación fiscal"
                value={org.identificacionFiscal}
              />
              <Dato label="Vertical" value={org.vertical.nombre} />
              <Dato label="Teléfono" value={org.telefono} />
              <Dato label="Correo" value={org.email} />
              <Dato label="Dirección" value={org.direccion} />
              <Dato
                label="IA"
                value={org.usaIa ? 'Habilitada' : 'Deshabilitada'}
              />
              <Dato label="Zona horaria" value={org.zonaHoraria} />
              <Dato label="Locale" value={org.locale} />
              <Dato
                label="Umbrales"
                value={`${org.umbralDescarte} / ${org.umbralAutomatico}`}
              />
              <Dato
                label="Alta"
                value={new Date(org.createdAt).toLocaleString('es-VE')}
              />
            </dl>
            {org.notasInternas ? (
              <p className="mt-4 rounded-xl bg-paper px-3 py-2 text-sm text-slate">
                <span className="font-semibold text-muted">Notas internas: </span>
                {org.notasInternas}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Provisionamiento"
            description={`Pack ${prov.packVersion} · ${prov.verticalCodigo}`}
          />
          <CardBody>
            <ul className="space-y-2 text-sm text-slate">
              <li className="flex justify-between gap-3 border-b border-borde/60 py-2">
                <span>Unidades de medida</span>
                <span className="font-semibold text-ink">
                  {prov.unidadesMedidaCreadas}
                </span>
              </li>
              <li className="flex justify-between gap-3 border-b border-borde/60 py-2">
                <span>Definiciones de atributo</span>
                <span className="font-semibold text-ink">
                  {prov.definicionesAtributoCreadas}
                </span>
              </li>
              <li className="flex justify-between gap-3 border-b border-borde/60 py-2">
                <span>Categorías</span>
                <span className="font-semibold text-ink">
                  {prov.categoriasCreadas}
                </span>
              </li>
              <li className="flex justify-between gap-3 py-2">
                <span>Lista / plantilla / sucursal</span>
                <span className="font-semibold text-exito">Creadas</span>
              </li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Usuarios"
            description={
              tieneAdministrador
                ? 'Esta organización ya tiene un administrador. Los usuarios se administran desde la organización.'
                : 'Crea el administrador inicial para que el negocio pueda entrar.'
            }
            action={
              !tieneAdministrador && activa ? (
                <Button
                  onClick={() => {
                    setAdminOpen(true);
                    setAdminResult(null);
                    setPasswordCopiada(false);
                  }}
                >
                  <UserPlus className="size-4" aria-hidden />
                  Admin inicial
                </Button>
              ) : null
            }
          />
          <CardBody className="p-0">
            {usuarios.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted md:px-6">
                Aún no hay usuarios en esta organización.
              </p>
            ) : (
              <ul className="divide-y divide-borde/70">
                {usuarios.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 md:px-6"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {u.nombreCompleto}
                      </p>
                      <p className="text-xs text-muted">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.esAdministrador ? (
                        <Badge tone="brand">Administrador</Badge>
                      ) : null}
                      <Badge
                        tone={
                          u.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'
                        }
                      >
                        {u.estadoRegistro}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={adminOpen}
        title={
          adminResult
            ? 'Administrador creado'
            : 'Crear administrador inicial'
        }
        description={
          adminResult
            ? 'Copie la contraseña temporal. No se volverá a mostrar.'
            : 'Recibirá perfil Administrador Organización y acceso a la sucursal principal.'
        }
        onClose={cerrarAdminDialog}
        blocking={Boolean(adminResult) && !passwordCopiada}
        hideClose={Boolean(adminResult) && !passwordCopiada}
      >
        {adminResult ? (
          <div className="space-y-4">
            <p className="text-sm text-slate">
              Correo: <span className="font-semibold text-ink">{adminResult.email}</span>
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-borde bg-paper px-3 py-2.5">
              <code className="flex-1 break-all text-sm font-semibold text-ink">
                {adminResult.passwordTemporal}
              </code>
              <Button variant="secondary" onClick={() => void copiarPassword()}>
                <Copy className="size-4" aria-hidden />
                Copiar
              </Button>
            </div>
            <CheckField
              label="Ya copié la contraseña temporal"
              checked={passwordCopiada}
              onChange={(e) => setPasswordCopiada(e.target.checked)}
            />
            <Button
              className="w-full"
              disabled={!passwordCopiada}
              onClick={cerrarAdminDialog}
            >
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={crearAdmin} className="space-y-4">
            <FormRequiredLegend />
            <TextField
              label="Nombre completo"
              value={adminForm.nombreCompleto}
              onChange={(e) =>
                setAdminForm((f) => ({ ...f, nombreCompleto: e.target.value }))
              }
              placeholder="Ej. María Pérez"
              autoComplete="name"
              required
            />
            <TextField
              label="Correo"
              type="email"
              value={adminForm.email}
              onChange={(e) =>
                setAdminForm((f) => ({ ...f, email: e.target.value }))
              }
              placeholder="admin@eltornillo.local"
              autoComplete="email"
              required
            />
            <TextField
              label="Teléfono"
              value={adminForm.telefono}
              onChange={(e) =>
                setAdminForm((f) => ({ ...f, telefono: e.target.value }))
              }
              placeholder="+58 412 555 0101"
              autoComplete="tel"
            />
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button type="submit" disabled={busy}>
                {busy ? 'Creando…' : 'Crear administrador'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={cerrarAdminDialog}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </AppShell>
  );
}

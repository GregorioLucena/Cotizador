'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import {
  ApiClientError,
  apiBaseUrl,
  apiFetch,
  getAccessToken,
} from '@/lib/api';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { useToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import {
  CheckField,
  FormRequiredLegend,
  SelectField,
  TextField,
} from '@/components/ui/field';
import { cn } from '@/lib/cn';

type OrgConfig = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  identificacionFiscal: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  logoUrl: string | null;
  monedaBase: { id: string; codigoIso: string };
  monedaPresentacion: { id: string; codigoIso: string } | null;
  zonaHoraria: string;
  locale: string;
  codigoPaisWhatsapp: string | null;
  usaIa: boolean;
  umbralAutomatico: string;
  umbralDescarte: string;
};

type Moneda = { id: string; codigoIso: string; nombre: string };

const LOGO_ACCEPT = 'image/png,image/jpeg,image/svg+xml';
const LOGO_ACCEPT_SET = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
]);

function urlLogoAbsoluta(logoUrl: string): string {
  return `${apiBaseUrl().replace(/\/api\/?$/, '')}${logoUrl}`;
}

export default function IdentidadPage() {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [org, setOrg] = useState<OrgConfig | null>(null);
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [logoPending, setLogoPending] = useState(false);
  const [confirmarMoneda, setConfirmarMoneda] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  async function cargar() {
    const [o, m] = await Promise.all([
      apiFetch<OrgConfig>('/configuracion-organizacion'),
      apiFetch<Moneda[]>('/monedas'),
    ]);
    setOrg(o);
    setMonedas(m);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void cargar().catch((err) => {
      setError(err instanceof ApiClientError ? err.message : 'Error al cargar');
    });
  }, [router]);

  useEffect(() => {
    return () => {
      if (previewLocal) URL.revokeObjectURL(previewLocal);
    };
  }, [previewLocal]);

  const elegirArchivo = useCallback((file: File | null) => {
    if (!file) {
      setArchivo(null);
      setPreviewLocal((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (!LOGO_ACCEPT_SET.has(file.type)) {
      setError('El logo debe ser PNG, JPEG o SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('El logo no puede superar 2 MB.');
      return;
    }
    setError(null);
    setArchivo(file);
    setPreviewLocal((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!org) return;
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const monedaBaseId = String(fd.get('monedaBaseId'));
    const body = {
      nombre: String(fd.get('nombre')),
      razonSocial: String(fd.get('razonSocial') || '') || null,
      identificacionFiscal: String(fd.get('identificacionFiscal') || '') || null,
      telefono: String(fd.get('telefono') || '') || null,
      email: String(fd.get('email') || '') || null,
      direccion: String(fd.get('direccion') || '') || null,
      monedaBaseId,
      monedaPresentacionId: String(fd.get('monedaPresentacionId') || '') || null,
      zonaHoraria: String(fd.get('zonaHoraria')),
      locale: String(fd.get('locale')),
      codigoPaisWhatsapp: String(fd.get('codigoPaisWhatsapp') || '') || null,
      usaIa: fd.get('usaIa') === 'on',
      umbralAutomatico: String(fd.get('umbralAutomatico')),
      umbralDescarte: String(fd.get('umbralDescarte')),
      ...(monedaBaseId !== org.monedaBase.id
        ? { confirmarCambioMonedaBase: confirmarMoneda }
        : {}),
    };
    try {
      const data = await apiFetch<{
        organizacion: OrgConfig;
        advertencias: unknown[];
      }>('/configuracion-organizacion', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setOrg(data.organizacion);
      toast.success('Configuración guardada.');
      setConfirmarMoneda(false);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo guardar',
      );
    } finally {
      setPending(false);
    }
  }

  async function subirLogo(file: File) {
    setLogoPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('archivo', file);
      const token = getAccessToken();
      const res = await fetch(`${apiBaseUrl()}/configuracion-organizacion/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new ApiClientError(
          json?.error?.code ?? 'HTTP_ERROR',
          json?.error?.message ?? 'Error al subir logo',
          res.status,
        );
      }
      setOrg(json.data);
      elegirArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Logo actualizado.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al subir');
    } finally {
      setLogoPending(false);
    }
  }

  async function onLogo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!archivo) {
      setError('Seleccione un archivo de logo.');
      return;
    }
    await subirLogo(archivo);
  }

  async function eliminarLogo() {
    setLogoPending(true);
    setError(null);
    try {
      const data = await apiFetch<OrgConfig>('/configuracion-organizacion/logo', {
        method: 'DELETE',
      });
      setOrg(data);
      elegirArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Logo eliminado.');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo eliminar',
      );
    } finally {
      setLogoPending(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    elegirArchivo(file);
  }

  if (!org) {
    return (
      <AppShell nav="organizacion">
        <p className="py-16 text-center text-sm text-muted">
          {error ?? 'Cargando…'}
        </p>
      </AppShell>
    );
  }

  const imagenVista = previewLocal
    ? previewLocal
    : org.logoUrl
      ? urlLogoAbsoluta(org.logoUrl)
      : null;

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <PageHeader
        eyebrow={<BackLink href="/configuracion">← Configuración</BackLink>}
        title="Identidad"
        description="Datos del negocio visibles en documentos y panel."
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <FormRequiredLegend />
        <Card accent>
          <CardHeader title="Datos del negocio" />
          <CardBody className="space-y-4">
            {(
              [
                ['nombre', 'Nombre', org.nombre, true],
                ['razonSocial', 'Razón social', org.razonSocial ?? '', false],
                [
                  'identificacionFiscal',
                  'Identificación fiscal',
                  org.identificacionFiscal ?? '',
                  false,
                ],
                ['telefono', 'Teléfono', org.telefono ?? '', false],
                ['email', 'Correo', org.email ?? '', false],
                ['direccion', 'Dirección', org.direccion ?? '', false],
              ] as const
            ).map(([name, label, value, required]) => (
              <TextField
                key={name}
                name={name}
                label={label}
                defaultValue={value}
                required={required}
              />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Monedas y locale" />
          <CardBody className="space-y-4">
            <SelectField
              name="monedaBaseId"
              label="Moneda base"
              defaultValue={org.monedaBase.id}
              onChange={() => setConfirmarMoneda(false)}
            >
              {monedas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigoIso} — {m.nombre}
                </option>
              ))}
            </SelectField>
            <SelectField
              name="monedaPresentacionId"
              label="Moneda de presentación"
              defaultValue={org.monedaPresentacion?.id ?? ''}
            >
              <option value="">Ninguna</option>
              {monedas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigoIso} — {m.nombre}
                </option>
              ))}
            </SelectField>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="zonaHoraria"
                label="Zona horaria"
                defaultValue={org.zonaHoraria}
                required
              />
              <TextField
                name="locale"
                label="Locale"
                defaultValue={org.locale}
                required
              />
            </div>
            <TextField
              name="codigoPaisWhatsapp"
              label="Código de país WhatsApp"
              defaultValue={org.codigoPaisWhatsapp ?? ''}
            />
            <p className="-mt-2 text-sm text-muted">
              Solo dígitos, sin +. Ej. 58. Vacío = el alta de clientes exige número con +.
            </p>
            <CheckField
              label="Confirmo el cambio de moneda base (no reconvierte precios existentes)"
              checked={confirmarMoneda}
              onChange={(ev) => setConfirmarMoneda(ev.target.checked)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Interpretación"
            description="La IA solo lee el pedido; los precios salen del catálogo."
          />
          <CardBody className="space-y-4">
            <CheckField
              name="usaIa"
              label="Usar IA en la interpretación"
              defaultChecked={org.usaIa}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="umbralAutomatico"
                label="Umbral automático"
                defaultValue={org.umbralAutomatico}
                required
              />
              <TextField
                name="umbralDescarte"
                label="Umbral descarte"
                defaultValue={org.umbralDescarte}
                required
              />
            </div>
          </CardBody>
        </Card>

        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

        <Button
          type="submit"
          disabled={pending || logoPending}
          className="w-full sm:w-auto"
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>

      <form onSubmit={onLogo} className="mt-8">
        <Card>
          <CardHeader
            title="Logo"
            description="Aparece en el PDF de cotización. PNG, JPEG o SVG · máx. 2 MB."
          />
          <CardBody>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch">
              <div
                className={cn(
                  'relative flex aspect-square w-full max-w-[11rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-paper',
                  imagenVista
                    ? 'border-borde'
                    : 'border-dashed border-borde/80',
                )}
              >
                {imagenVista ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagenVista}
                    alt={
                      archivo
                        ? 'Vista previa del logo'
                        : `Logo de ${org.nombre}`
                    }
                    className="h-full w-full object-contain p-4"
                  />
                ) : (
                  <div className="px-4 text-center">
                    <ImagePlus
                      className="mx-auto size-8 text-muted/70"
                      aria-hidden
                    />
                    <p className="mt-2 text-xs font-medium text-muted">
                      Sin logo
                    </p>
                  </div>
                )}
                {previewLocal ? (
                  <span className="absolute left-2 top-2 rounded-md bg-brass px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink">
                    Nuevo
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileRef.current?.click();
                    }
                  }}
                  onClick={() => fileRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setArrastrando(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setArrastrando(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setArrastrando(false);
                  }}
                  onDrop={onDrop}
                  className={cn(
                    'cursor-pointer rounded-2xl border border-dashed px-4 py-6 text-center transition',
                    arrastrando
                      ? 'border-teal bg-teal/5 ring-2 ring-teal/20'
                      : 'border-borde bg-paper/70 hover:border-teal/40 hover:bg-paper',
                  )}
                >
                  <Upload
                    className={cn(
                      'mx-auto size-6',
                      arrastrando ? 'text-teal' : 'text-muted',
                    )}
                    aria-hidden
                  />
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {arrastrando
                      ? 'Suelte el archivo aquí'
                      : 'Arrastre el logo o haga clic para elegir'}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    PNG, JPEG o SVG · hasta 2 MB
                  </p>
                  {archivo ? (
                    <p className="mt-3 truncate rounded-lg bg-surface px-3 py-2 text-xs font-medium text-teal ring-1 ring-teal/20">
                      {archivo.name} · {(archivo.size / 1024).toFixed(0)} KB
                    </p>
                  ) : null}
                  <input
                    ref={fileRef}
                    id="archivo"
                    name="archivo"
                    type="file"
                    accept={LOGO_ACCEPT}
                    className="sr-only"
                    onChange={(e) =>
                      elegirArchivo(e.target.files?.[0] ?? null)
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    disabled={logoPending || !archivo}
                    className="min-w-[8.5rem]"
                  >
                    {logoPending ? 'Subiendo…' : 'Subir logo'}
                  </Button>
                  {org.logoUrl ? (
                    <Button
                      type="button"
                      variant="danger"
                      disabled={logoPending}
                      onClick={() => void eliminarLogo()}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Quitar logo
                    </Button>
                  ) : null}
                  {archivo ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={logoPending}
                      onClick={() => {
                        elegirArchivo(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                    >
                      Cancelar selección
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </form>
    </AppShell>
  );
}

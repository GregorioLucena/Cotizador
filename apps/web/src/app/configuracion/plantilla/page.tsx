'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CheckField, Field, FormRequiredLegend, SelectField, TextField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type ColumnaCfg = {
  campo: string;
  etiqueta: string;
  atributoCodigo?: string;
  visible: boolean;
  orden: number;
};

type Configuracion = {
  identidad: {
    nombreComercial: string;
    razonSocial?: string;
    identificacionFiscal?: string;
    direccion?: string;
    telefonos: string[];
    email?: string;
    sitioWeb?: string;
    logoUrl?: string;
  };
  estilo: {
    colorPrimario: string;
    colorTextoSobrePrimario: string;
    tipografia: 'SANS' | 'SERIF';
    densidad: 'COMPACTA' | 'NORMAL';
    tamanoPagina: 'A4' | 'CARTA';
  };
  folio: { prefijo: string; longitudNumero: number };
  columnas: ColumnaCfg[];
  totales: {
    mostrarSubtotal: boolean;
    mostrarDescuento: boolean;
    mostrarImpuesto: boolean;
    mostrarMonedaPresentacion: boolean;
    mostrarTasaAplicada: boolean;
  };
  textos: {
    saludo?: string;
    condiciones?: string;
    pie?: string;
    cierre?: string;
  };
  mensajeWhatsapp: {
    incluirSaludo: boolean;
    incluirDetalleLineas: boolean;
    incluirCondiciones: boolean;
    maximoLineasDetalle: number;
  };
};

type Plantilla = {
  id: string;
  nombre: string;
  esPredeterminada: boolean;
  version: number;
  configuracion: Configuracion;
  estadoRegistro: string;
  updatedAt: string;
};

type DefinicionAtributo = {
  id: string;
  codigo: string;
  nombre: string;
  estadoRegistro: string;
};

const CAMPOS = [
  'ORDEN',
  'SKU',
  'DESCRIPCION',
  'MARCA',
  'ATRIBUTO',
  'UNIDAD',
  'CANTIDAD',
  'PRECIO_UNITARIO',
  'DESCUENTO',
  'TOTAL_LINEA',
] as const;

const MARCADORES = [
  'cliente',
  'folio',
  'vigencia',
  'total',
  'organizacion',
] as const;

function insertarMarcador(
  actual: string | undefined,
  marcador: string,
): string {
  return `${actual ?? ''}{{${marcador}}}`.trim();
}

export default function PlantillaDocumentoPage() {
  const router = useRouter();
  const toast = useToast();
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null);
  const [cfg, setCfg] = useState<Configuracion | null>(null);
  const [atributos, setAtributos] = useState<DefinicionAtributo[]>([]);
  const [puedeAdmin, setPuedeAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTexto, setPreviewTexto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const perfil = await apiFetch<{ contexto: OrgContext }>('/auth/perfil');
    if (perfil.contexto.ambito !== 'ORGANIZACION') {
      router.replace('/panel');
      return;
    }
    if (!hasPermission(perfil.contexto, PERMISOS.PLANTILLAS_VER)) {
      setError('No tiene permiso para ver la plantilla de documento.');
      return;
    }
    setPuedeAdmin(
      hasPermission(perfil.contexto, PERMISOS.PLANTILLAS_ADMINISTRAR),
    );

    const lista = await apiFetch<Plantilla[]>('/plantillas-documento');
    const pred = lista.find((p) => p.esPredeterminada) ?? lista[0];
    if (!pred) {
      setError(
        'No hay plantilla predeterminada. Provisiona la organización o contacta a soporte.',
      );
      return;
    }
    setPlantilla(pred);
    setCfg(structuredClone(pred.configuracion));

    try {
      const defs = await apiFetch<{ items: DefinicionAtributo[] } | DefinicionAtributo[]>(
        '/definiciones-atributo?limit=100',
      );
      const items = Array.isArray(defs) ? defs : defs.items ?? [];
      setAtributos(items.filter((a) => a.estadoRegistro === 'ACTIVO'));
    } catch {
      setAtributos([]);
    }
  }, [router]);

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
  }, [cargar, router]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!plantilla || !cfg || !puedeAdmin) return;
    setPending(true);
    setError(null);
    try {
      const data = await apiFetch<Plantilla>(
        `/plantillas-documento/${plantilla.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            nombre: plantilla.nombre,
            configuracion: cfg,
          }),
        },
      );
      setPlantilla(data);
      setCfg(structuredClone(data.configuracion));
      if (data.version === plantilla.version) {
        toast.info('Sin cambios de configuración; la versión no se incrementó.');
      } else {
        toast.success(`Plantilla guardada. Versión ${data.version}.`);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar');
    } finally {
      setPending(false);
    }
  }

  async function previsualizar(formato: 'HTML' | 'TEXTO') {
    if (!plantilla || !cfg || !puedeAdmin) return;
    setPending(true);
    setError(null);
    try {
      const data = await apiFetch<{
        formato: string;
        html?: string;
        texto?: string;
        advertencias: string[];
      }>(`/plantillas-documento/${plantilla.id}/previsualizar`, {
        method: 'POST',
        body: JSON.stringify({ configuracion: cfg, formato }),
      });
      if (formato === 'HTML') setPreviewHtml(data.html ?? null);
      if (formato === 'TEXTO') setPreviewTexto(data.texto ?? null);
      if (data.advertencias?.length) {
        toast.warn(`Advertencias: ${data.advertencias.join(', ')}`);
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Error en vista previa',
      );
    } finally {
      setPending(false);
    }
  }

  if (!cfg || !plantilla) {
    return (
      <AppShell nav="organizacion">
        <p className="py-16 text-center text-sm text-muted">
          {error ?? 'Cargando plantilla…'}
        </p>
      </AppShell>
    );
  }

  const columnasOrdenadas = [...cfg.columnas].sort((a, b) => a.orden - b.orden);

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <PageHeader
        eyebrow={<BackLink href="/configuracion">← Configuración</BackLink>}
        title="Plantilla de documento"
        description={`Versión ${plantilla.version}. Define cómo sale el PDF y el texto de WhatsApp. No altera cotizaciones ya aprobadas.`}
      />

      {error && <StatusBanner tone="error">{error}</StatusBanner>}

      <form onSubmit={guardar} className="space-y-5">
        <FormRequiredLegend />
        <Card accent>
          <CardHeader
            title="Identidad"
            description="Encabezado del PDF. El logo se toma de la ficha de organización si no fija uno aquí."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nombre comercial"
              value={cfg.identidad.nombreComercial}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  identidad: {
                    ...cfg.identidad,
                    nombreComercial: e.target.value,
                  },
                })
              }
              disabled={!puedeAdmin}
              required
            />
            <TextField
              label="Razón social"
              value={cfg.identidad.razonSocial ?? ''}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  identidad: {
                    ...cfg.identidad,
                    razonSocial: e.target.value || undefined,
                  },
                })
              }
              disabled={!puedeAdmin}
            />
            <TextField
              label="Identificación fiscal"
              value={cfg.identidad.identificacionFiscal ?? ''}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  identidad: {
                    ...cfg.identidad,
                    identificacionFiscal: e.target.value || undefined,
                  },
                })
              }
              disabled={!puedeAdmin}
            />
            <TextField
              label="Correo"
              type="email"
              value={cfg.identidad.email ?? ''}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  identidad: {
                    ...cfg.identidad,
                    email: e.target.value || undefined,
                  },
                })
              }
              disabled={!puedeAdmin}
            />
            <Field label="Dirección" className="sm:col-span-2">
              <Input
                value={cfg.identidad.direccion ?? ''}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    identidad: {
                      ...cfg.identidad,
                      direccion: e.target.value || undefined,
                    },
                  })
                }
                disabled={!puedeAdmin}
              />
            </Field>
            <Field
              label="Teléfonos (hasta 3, separados por coma)"
              hint="Aparecen en el encabezado del documento."
            >
              <Input
                value={(cfg.identidad.telefonos ?? []).join(', ')}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    identidad: {
                      ...cfg.identidad,
                      telefonos: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .slice(0, 3),
                    },
                  })
                }
                disabled={!puedeAdmin}
              />
            </Field>
            <TextField
              label="Sitio web"
              value={cfg.identidad.sitioWeb ?? ''}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  identidad: {
                    ...cfg.identidad,
                    sitioWeb: e.target.value || undefined,
                  },
                })
              }
              disabled={!puedeAdmin}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Estilo"
            description="Colores y tipografía del PDF. Hex de 6 dígitos."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Color primario"
              value={cfg.estilo.colorPrimario}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  estilo: { ...cfg.estilo, colorPrimario: e.target.value },
                })
              }
              disabled={!puedeAdmin}
            />
            <TextField
              label="Texto sobre primario"
              value={cfg.estilo.colorTextoSobrePrimario}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  estilo: {
                    ...cfg.estilo,
                    colorTextoSobrePrimario: e.target.value,
                  },
                })
              }
              disabled={!puedeAdmin}
            />
            <SelectField
              label="Tipografía"
              value={cfg.estilo.tipografia}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  estilo: {
                    ...cfg.estilo,
                    tipografia: e.target.value as 'SANS' | 'SERIF',
                  },
                })
              }
              disabled={!puedeAdmin}
            >
              <option value="SANS">Sans</option>
              <option value="SERIF">Serif</option>
            </SelectField>
            <SelectField
              label="Densidad"
              value={cfg.estilo.densidad}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  estilo: {
                    ...cfg.estilo,
                    densidad: e.target.value as 'COMPACTA' | 'NORMAL',
                  },
                })
              }
              disabled={!puedeAdmin}
            >
              <option value="NORMAL">Normal</option>
              <option value="COMPACTA">Compacta</option>
            </SelectField>
            <SelectField
              label="Tamaño de página"
              value={cfg.estilo.tamanoPagina}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  estilo: {
                    ...cfg.estilo,
                    tamanoPagina: e.target.value as 'A4' | 'CARTA',
                  },
                })
              }
              disabled={!puedeAdmin}
            >
              <option value="CARTA">Carta</option>
              <option value="A4">A4</option>
            </SelectField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Folio"
            description="Solo afecta cotizaciones nuevas; los folios ya asignados no cambian."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Prefijo"
              value={cfg.folio.prefijo}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  folio: { ...cfg.folio, prefijo: e.target.value },
                })
              }
              disabled={!puedeAdmin}
            />
            <TextField
              label="Longitud del número"
              type="number"
              min={1}
              max={10}
              value={cfg.folio.longitudNumero}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  folio: {
                    ...cfg.folio,
                    longitudNumero: Number(e.target.value) || 4,
                  },
                })
              }
              disabled={!puedeAdmin}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Columnas"
            description="Debe haber DESCRIPCION e importe (PRECIO_UNITARIO o TOTAL_LINEA) visibles."
          />
          <CardBody className="space-y-3">
            {columnasOrdenadas.map((col) => {
              const idx = cfg.columnas.findIndex(
                (c) => c.orden === col.orden && c.campo === col.campo,
              );
              return (
                <div
                  key={`${col.campo}-${col.orden}-${idx}`}
                  className="grid gap-2 rounded-xl border border-borde/70 bg-paper/40 p-3 sm:grid-cols-12 sm:items-end"
                >
                  <SelectField
                    label="Campo"
                    className="sm:col-span-3"
                    value={col.campo}
                    disabled={!puedeAdmin}
                    onChange={(e) => {
                      const next = [...cfg.columnas];
                      next[idx] = {
                        ...next[idx],
                        campo: e.target.value,
                        atributoCodigo:
                          e.target.value === 'ATRIBUTO'
                            ? next[idx].atributoCodigo
                            : undefined,
                      };
                      setCfg({ ...cfg, columnas: next });
                    }}
                  >
                    {CAMPOS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Etiqueta"
                    className="sm:col-span-3"
                    value={col.etiqueta}
                    disabled={!puedeAdmin}
                    onChange={(e) => {
                      const next = [...cfg.columnas];
                      next[idx] = { ...next[idx], etiqueta: e.target.value };
                      setCfg({ ...cfg, columnas: next });
                    }}
                  />
                  <TextField
                    label="Orden"
                    type="number"
                    className="sm:col-span-2"
                    value={col.orden}
                    disabled={!puedeAdmin}
                    onChange={(e) => {
                      const next = [...cfg.columnas];
                      next[idx] = {
                        ...next[idx],
                        orden: Number(e.target.value) || 0,
                      };
                      setCfg({ ...cfg, columnas: next });
                    }}
                  />
                  {col.campo === 'ATRIBUTO' ? (
                    <SelectField
                      label="Atributo"
                      className="sm:col-span-3"
                      value={col.atributoCodigo ?? ''}
                      disabled={!puedeAdmin}
                      onChange={(e) => {
                        const next = [...cfg.columnas];
                        next[idx] = {
                          ...next[idx],
                          atributoCodigo: e.target.value || undefined,
                        };
                        setCfg({ ...cfg, columnas: next });
                      }}
                    >
                      <option value="">Elegir…</option>
                      {atributos.map((a) => (
                        <option key={a.id} value={a.codigo}>
                          {a.nombre} ({a.codigo})
                        </option>
                      ))}
                    </SelectField>
                  ) : (
                    <div className="sm:col-span-3" />
                  )}
                  <label className="flex items-center gap-2 pb-2 text-sm sm:col-span-1">
                    <input
                      type="checkbox"
                      className="accent-teal"
                      checked={col.visible}
                      disabled={!puedeAdmin}
                      onChange={(e) => {
                        const next = [...cfg.columnas];
                        next[idx] = {
                          ...next[idx],
                          visible: e.target.checked,
                        };
                        setCfg({ ...cfg, columnas: next });
                      }}
                    />
                    Visible
                  </label>
                </div>
              );
            })}
            {puedeAdmin && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const maxOrden = Math.max(
                    0,
                    ...cfg.columnas.map((c) => c.orden),
                  );
                  setCfg({
                    ...cfg,
                    columnas: [
                      ...cfg.columnas,
                      {
                        campo: 'ATRIBUTO',
                        etiqueta: 'Atributo',
                        visible: true,
                        orden: maxOrden + 1,
                        atributoCodigo: atributos[0]?.codigo,
                      },
                    ],
                  });
                }}
              >
                Agregar columna
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Totales" description="Qué importes mostrar en el pie del PDF." />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['mostrarSubtotal', 'Mostrar subtotal'],
                ['mostrarDescuento', 'Mostrar descuento'],
                ['mostrarImpuesto', 'Mostrar impuesto'],
                ['mostrarMonedaPresentacion', 'Mostrar moneda de presentación'],
                ['mostrarTasaAplicada', 'Mostrar tasa aplicada'],
              ] as const
            ).map(([key, label]) => (
              <CheckField
                key={key}
                label={label}
                checked={cfg.totales[key]}
                disabled={!puedeAdmin}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    totales: { ...cfg.totales, [key]: e.target.checked },
                  })
                }
              />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Textos"
            description="Marcadores: {{cliente}}, {{folio}}, {{vigencia}}, {{total}}, {{organizacion}}. Se escapan en el HTML."
          />
          <CardBody className="space-y-4">
            {(
              [
                ['saludo', 'Saludo'],
                ['condiciones', 'Condiciones'],
                ['cierre', 'Cierre'],
                ['pie', 'Pie'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <div className="mb-2 flex flex-wrap gap-1">
                  {MARCADORES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={!puedeAdmin}
                      className="rounded-md border border-borde bg-surface px-2 py-0.5 text-xs font-semibold text-teal hover:border-teal/40 disabled:opacity-50"
                      onClick={() =>
                        setCfg({
                          ...cfg,
                          textos: {
                            ...cfg.textos,
                            [key]: insertarMarcador(cfg.textos[key], m),
                          },
                        })
                      }
                    >
                      {`{{${m}}}`}
                    </button>
                  ))}
                </div>
                <textarea
                  className="min-h-20 w-full rounded-xl border border-borde bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-teal/50"
                  value={cfg.textos[key] ?? ''}
                  disabled={!puedeAdmin}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      textos: {
                        ...cfg.textos,
                        [key]: e.target.value || undefined,
                      },
                    })
                  }
                />
              </Field>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="WhatsApp"
            description="El mismo motor arma el texto plano para pegar al cliente."
          />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['incluirSaludo', 'Incluir saludo'],
                ['incluirDetalleLineas', 'Incluir detalle de líneas'],
                ['incluirCondiciones', 'Incluir condiciones'],
              ] as const
            ).map(([key, label]) => (
              <CheckField
                key={key}
                label={label}
                checked={cfg.mensajeWhatsapp[key]}
                disabled={!puedeAdmin}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    mensajeWhatsapp: {
                      ...cfg.mensajeWhatsapp,
                      [key]: e.target.checked,
                    },
                  })
                }
              />
            ))}
            <TextField
              label="Máximo de líneas en detalle"
              type="number"
              min={1}
              max={50}
              value={cfg.mensajeWhatsapp.maximoLineasDetalle}
              disabled={!puedeAdmin}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  mensajeWhatsapp: {
                    ...cfg.mensajeWhatsapp,
                    maximoLineasDetalle: Number(e.target.value) || 20,
                  },
                })
              }
            />
          </CardBody>
        </Card>

        {puedeAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              Guardar plantilla
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void previsualizar('HTML')}
            >
              Vista previa HTML
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void previsualizar('TEXTO')}
            >
              Vista previa WhatsApp
            </Button>
          </div>
        )}
      </form>

      {previewHtml && (
        <section className="mt-8 space-y-2">
          <h2 className="font-display text-lg font-bold text-ink">
            Vista previa
          </h2>
          <iframe
            title="Vista previa de plantilla"
            className="h-[640px] w-full rounded-2xl border border-borde bg-white shadow-[0_14px_40px_-26px_rgba(18,32,30,0.4)]"
            srcDoc={previewHtml}
          />
        </section>
      )}

      {previewTexto && (
        <section className="mt-6 space-y-2">
          <h2 className="font-display text-lg font-bold text-ink">
            Texto WhatsApp de ejemplo
          </h2>
          <pre className="whitespace-pre-wrap rounded-2xl border border-borde bg-surface p-4 text-sm text-ink">
            {previewTexto}
          </pre>
        </section>
      )}
    </AppShell>
  );
}

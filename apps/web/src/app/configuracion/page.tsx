'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Building2, ChevronRight, FileText, Store } from 'lucide-react';
import { ApiClientError, apiFetch, clearSession, getAccessToken } from '@/lib/api';
import { AppShell, PageHeader, StatusBanner } from '@/components/shell/app-shell';

type PerfilData = {
  contexto: { ambito: string; permisos: string[] };
};

const links = [
  {
    href: '/configuracion/identidad',
    title: 'Identidad',
    desc: 'Datos del negocio, monedas, IA y logo',
    icon: Building2,
  },
  {
    href: '/configuracion/sucursales',
    title: 'Sucursales',
    desc: 'Puntos de venta y depósitos',
    icon: Store,
  },
  {
    href: '/configuracion/cotizacion',
    title: 'Cotización',
    desc: 'Vigencia, impuesto, redondeo y lista predeterminada',
    icon: FileText,
  },
];

export default function ConfiguracionHubPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void (async () => {
      try {
        const data = await apiFetch<PerfilData>('/auth/perfil');
        if (data.contexto.ambito !== 'ORGANIZACION') {
          router.replace('/panel');
          return;
        }
        setOk(true);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'Error');
      }
    })();
  }, [router]);

  if (error) {
    return (
      <AppShell nav="organizacion">
        <StatusBanner tone="error">{error}</StatusBanner>
      </AppShell>
    );
  }

  if (!ok) {
    return (
      <AppShell nav="organizacion">
        <p className="py-16 text-center text-sm text-muted">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion">
      <PageHeader
        title="Configuración"
        description="Los cambios afectan cotizaciones futuras, no las ya aprobadas."
      />

      <ul className="space-y-3">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className="group flex items-center gap-4 rounded-2xl border border-borde/80 bg-surface px-4 py-4 shadow-[0_14px_40px_-26px_rgba(18,32,30,0.4)] transition hover:border-teal/35 hover:shadow-[0_18px_44px_-20px_rgba(11,95,86,0.3)] md:px-5"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal transition group-hover:bg-teal group-hover:text-white">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-bold text-ink">
                    {l.title}
                  </span>
                  <span className="text-sm text-muted">{l.desc}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-teal" />
              </Link>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}

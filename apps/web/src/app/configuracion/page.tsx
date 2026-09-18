'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, FileText, Store, Users } from 'lucide-react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
import { ApiClientError, apiFetch, clearSession, getAccessToken } from '@/lib/api';
import { AppShell, PageHeader, StatusBanner } from '@/components/shell/app-shell';

type PerfilData = {
  contexto: OrgContext;
};

const ALL_LINKS = [
  {
    href: '/configuracion/identidad',
    title: 'Identidad',
    desc: 'Datos del negocio, monedas, IA y logo',
    icon: Building2,
    permiso: PERMISOS.CONFIGURACION_ORGANIZACION_VER,
  },
  {
    href: '/configuracion/sucursales',
    title: 'Sucursales',
    desc: 'Puntos de venta y depósitos',
    icon: Store,
    permiso: PERMISOS.CONFIGURACION_SUCURSALES_VER,
  },
  {
    href: '/configuracion/cotizacion',
    title: 'Cotización',
    desc: 'Vigencia, impuesto, redondeo y lista predeterminada',
    icon: FileText,
    permiso: PERMISOS.CONFIGURACION_ORGANIZACION_VER,
  },
  {
    href: '/configuracion/usuarios',
    title: 'Usuarios',
    desc: 'Accesos, perfiles y sucursales',
    icon: Users,
    permiso: PERMISOS.SEGURIDAD_USUARIOS_VER,
  },
] as const;

export default function ConfiguracionHubPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
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
        setPerfil(data);
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

  const links = useMemo(() => {
    if (!perfil) return [];
    return ALL_LINKS.filter((l) => hasPermission(perfil.contexto, l.permiso));
  }, [perfil]);

  if (error) {
    return (
      <AppShell nav="organizacion">
        <StatusBanner tone="error">{error}</StatusBanner>
      </AppShell>
    );
  }

  if (!perfil) {
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

      {links.length === 0 ? (
        <StatusBanner tone="info">No hay secciones disponibles para su perfil.</StatusBanner>
      ) : (
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
      )}
    </AppShell>
  );
}

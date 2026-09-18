'use client';

/**
 * Cascarón canónico del área autenticada (docs/09-guia-ux-ui.md).
 * Navegación base: cabecera + menú lateral deslizante. No reemplazar por dock inferior.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Building2, ChevronRight, Home, LogOut, Menu, Settings2, X } from 'lucide-react';
import { apiFetch, clearSession } from '@/lib/api';
import { cn } from '@/lib/cn';

export type ShellNav = 'organizacion' | 'plataforma' | 'none';

const NAV = {
  organizacion: [
    { href: '/panel', label: 'Inicio', desc: 'Tu panel y accesos', icon: Home },
    {
      href: '/configuracion',
      label: 'Configuración',
      desc: 'Identidad, sucursales y cotización',
      icon: Settings2,
    },
  ],
  plataforma: [
    { href: '/panel', label: 'Inicio', desc: 'Tu panel y accesos', icon: Home },
    {
      href: '/plataforma/organizaciones',
      label: 'Organizaciones',
      desc: 'Alta y listado de plataforma',
      icon: Building2,
    },
  ],
} as const;

function isActive(pathname: string, href: string) {
  if (href === '/panel') return pathname === '/panel';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  nav = 'none',
  actions,
  onLogout,
  maxWidth = 'md',
}: {
  children: ReactNode;
  nav?: ShellNav;
  actions?: ReactNode;
  onLogout?: () => void | Promise<void>;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const items = nav === 'none' ? [] : NAV[nav];
  const showMenu = items.length > 0 || nav !== 'none';
  const widths = {
    sm: 'max-w-xl',
    md: 'max-w-3xl',
    lg: 'max-w-5xl',
    xl: 'max-w-6xl',
  };

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    if (onLogout) {
      await onLogout();
      return;
    }
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* idempotente */
    }
    clearSession();
    router.replace('/acceso');
  }

  return (
    <div className="relative min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-teal text-white shadow-[0_12px_40px_-20px_rgba(11,95,86,0.65)]">
        <div
          className={cn(
            'mx-auto flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2.5 md:px-6',
            widths[maxWidth],
          )}
        >
          <Link href="/panel" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brass font-display text-sm font-bold text-ink">
              C
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Cotizador</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {actions}
            {showMenu ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold transition hover:bg-white/20"
                aria-expanded={open}
                aria-controls={titleId}
                aria-haspopup="dialog"
              >
                <Menu className="size-5" />
                <span className="hidden sm:inline">Menú</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className={cn('mx-auto w-full px-4 py-6 md:px-6 md:py-8', widths[maxWidth])}>
        {children}
      </div>

      {showMenu ? (
        <div
          className={cn(
            'fixed inset-0 z-50 transition',
            open ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          aria-hidden={!open}
        >
          <button
            type="button"
            className={cn(
              'absolute inset-0 bg-ink/45 backdrop-blur-[2px] transition-opacity',
              open ? 'opacity-100' : 'opacity-0',
            )}
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            tabIndex={open ? 0 : -1}
          />

          <aside
            id={titleId}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className={cn(
              'absolute inset-y-0 right-0 flex w-[min(100%,22rem)] flex-col bg-paper shadow-[-24px_0_60px_-28px_rgba(18,32,30,0.55)] transition-transform duration-300 ease-out',
              open ? 'translate-x-0' : 'translate-x-full',
            )}
          >
            <div className="flex items-center justify-between border-b border-borde bg-teal px-4 py-3.5 text-white">
              <div>
                <p className="font-display text-lg font-bold tracking-tight">Menú</p>
                <p className="text-xs text-white/70">Navegá por el panel</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto p-4" aria-label="Principal">
              {items.map(({ href, label, desc, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'group flex min-h-16 items-center gap-3 rounded-2xl border px-3.5 py-3 transition',
                      active
                        ? 'border-teal/30 bg-teal text-white shadow-[0_12px_30px_-16px_rgba(11,95,86,0.55)]'
                        : 'border-borde/80 bg-surface text-ink hover:border-teal/35 hover:bg-white',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-xl',
                        active ? 'bg-white/15' : 'bg-teal/10 text-teal',
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-bold">{label}</span>
                      <span
                        className={cn('block text-xs', active ? 'text-white/75' : 'text-muted')}
                      >
                        {desc}
                      </span>
                    </span>
                    <ChevronRight
                      className={cn(
                        'size-4 shrink-0 transition group-hover:translate-x-0.5',
                        active ? 'text-white/80' : 'text-muted',
                      )}
                    />
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-borde p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-borde bg-surface text-sm font-semibold text-slate transition hover:border-peligro/30 hover:bg-peligro/5 hover:text-peligro"
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0 space-y-1.5">
        {eyebrow}
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-[2.1rem]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center text-sm font-semibold text-teal transition hover:text-teal-deep"
    >
      {children}
    </Link>
  );
}

export function StatusBanner({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const tones = {
    error: 'border-peligro/25 bg-peligro/8 text-peligro',
    success: 'border-exito/25 bg-exito/8 text-exito',
    info: 'border-teal/20 bg-teal/8 text-teal-deep',
  };
  return (
    <p
      className={cn('rounded-xl border px-3.5 py-2.5 text-sm font-medium', tones[tone])}
      role="status"
    >
      {children}
    </p>
  );
}

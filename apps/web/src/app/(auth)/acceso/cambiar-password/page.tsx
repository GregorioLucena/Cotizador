'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { requisitosPassword } from '@cotizador/shared';
import { ApiClientError, apiFetch, clearAccessToken, getAccessToken, setAccessToken } from '@/lib/api';
import { useEffect } from 'react';

export default function CambiarPasswordPage() {
  const router = useRouter();
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
    }
  }, [router]);

  const requisitos = useMemo(() => requisitosPassword(passwordNueva), [passwordNueva]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (passwordNueva !== confirmacion) {
      setError('La confirmación no coincide con la contraseña nueva.');
      return;
    }
    setPending(true);
    try {
      const data = await apiFetch<{ ok: true; accessToken: string }>('/auth/cambiar-password', {
        method: 'POST',
        body: JSON.stringify({ passwordActual, passwordNueva }),
      });
      setAccessToken(data.accessToken);
      setOk(true);
      setTimeout(() => router.replace('/panel'), 1200);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('No se pudo cambiar la contraseña.');
      }
    } finally {
      setPending(false);
    }
  }

  async function cerrarSesion() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* idempotente */
    }
    clearAccessToken();
    router.replace('/acceso');
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <Link href="/" className="font-display text-3xl font-semibold text-ink">
          Cotizador
        </Link>
        <p className="mt-2 max-w-sm text-sm text-muted">
          La contraseña fue asignada por un administrador y debe reemplazarse antes de continuar.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-borde bg-surface p-6 shadow-[0_20px_50px_-30px_rgba(20,33,43,0.5)]"
      >
        <div className="space-y-1.5">
          <label htmlFor="actual" className="text-sm font-medium text-ink">
            Contraseña actual
          </label>
          <input
            id="actual"
            type="password"
            autoComplete="current-password"
            required
            value={passwordActual}
            onChange={(ev) => setPasswordActual(ev.target.value)}
            className="min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink outline-none focus:border-brass"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="nueva" className="text-sm font-medium text-ink">
            Contraseña nueva
          </label>
          <input
            id="nueva"
            type="password"
            autoComplete="new-password"
            required
            value={passwordNueva}
            onChange={(ev) => setPasswordNueva(ev.target.value)}
            className="min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink outline-none focus:border-brass"
          />
          <ul className="space-y-1 pt-1 text-xs text-muted">
            <li className={requisitos.longitud ? 'text-exito' : undefined}>
              Al menos 10 caracteres
            </li>
            <li className={requisitos.mayuscula ? 'text-exito' : undefined}>Una mayúscula</li>
            <li className={requisitos.minuscula ? 'text-exito' : undefined}>Una minúscula</li>
            <li className={requisitos.digito ? 'text-exito' : undefined}>Un dígito</li>
          </ul>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-sm font-medium text-ink">
            Confirmar nueva
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirmacion}
            onChange={(ev) => setConfirmacion(ev.target.value)}
            className="min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink outline-none focus:border-brass"
          />
        </div>
        {error ? (
          <p className="text-sm text-peligro" role="alert">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p className="text-sm text-exito">
            Contraseña actualizada. Se cerraron sus otras sesiones.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || ok}
          className="flex min-h-11 w-full items-center justify-center rounded-md bg-ink text-sm font-semibold text-paper disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
        <button
          type="button"
          onClick={cerrarSesion}
          className="w-full text-center text-sm text-muted underline"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}

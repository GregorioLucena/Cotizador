'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { requisitosPassword } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

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
    <main className="hero-counter flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 animate-rise text-center">
        <Link href="/" className="font-display text-3xl font-semibold tracking-tight text-white">
          Cotizador
        </Link>
        <p className="mt-2 max-w-sm text-sm text-white/65">
          La contraseña fue asignada por un administrador y debe reemplazarse antes de continuar.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="animate-rise-delay w-full max-w-sm space-y-4 rounded-2xl border border-white/15 bg-white/95 p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] backdrop-blur-sm"
      >
        <Field label="Contraseña actual" htmlFor="actual">
          <Input
            id="actual"
            type="password"
            autoComplete="current-password"
            required
            value={passwordActual}
            onChange={(ev) => setPasswordActual(ev.target.value)}
          />
        </Field>
        <Field label="Contraseña nueva" htmlFor="nueva">
          <Input
            id="nueva"
            type="password"
            autoComplete="new-password"
            required
            value={passwordNueva}
            onChange={(ev) => setPasswordNueva(ev.target.value)}
          />
          <ul className="space-y-1 pt-1 text-xs text-muted">
            <li className={requisitos.longitud ? 'text-exito' : undefined}>
              Al menos 10 caracteres
            </li>
            <li className={requisitos.mayuscula ? 'text-exito' : undefined}>Una mayúscula</li>
            <li className={requisitos.minuscula ? 'text-exito' : undefined}>Una minúscula</li>
            <li className={requisitos.digito ? 'text-exito' : undefined}>Un dígito</li>
          </ul>
        </Field>
        <Field label="Confirmar nueva" htmlFor="confirm">
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirmacion}
            onChange={(ev) => setConfirmacion(ev.target.value)}
          />
        </Field>
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
        <Button type="submit" disabled={pending || ok} className="w-full min-h-12">
          {pending ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
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

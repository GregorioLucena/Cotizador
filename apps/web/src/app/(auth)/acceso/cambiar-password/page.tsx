'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { requisitosPassword } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, FormRequiredLegend } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  children?: ReactNode;
}) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <Field label={label} htmlFor={id} required>
      <div className="relative">
        <Input
          id={id}
          type={mostrar ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-r-xl text-muted transition hover:text-ink"
          aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={mostrar}
        >
          {mostrar ? (
            <EyeOff className="size-5" aria-hidden />
          ) : (
            <Eye className="size-5" aria-hidden />
          )}
        </button>
      </div>
      {children}
    </Field>
  );
}

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
    router.replace('/');
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
        <FormRequiredLegend />
        <PasswordField
          id="actual"
          label="Contraseña actual"
          value={passwordActual}
          onChange={setPasswordActual}
          autoComplete="current-password"
        />
        <PasswordField
          id="nueva"
          label="Contraseña nueva"
          value={passwordNueva}
          onChange={setPasswordNueva}
          autoComplete="new-password"
        >
          <ul className="space-y-1 pt-1 text-sm text-muted">
            <li className={requisitos.longitud ? 'text-exito' : undefined}>
              Al menos 10 caracteres
            </li>
            <li className={requisitos.mayuscula ? 'text-exito' : undefined}>Una mayúscula</li>
            <li className={requisitos.minuscula ? 'text-exito' : undefined}>Una minúscula</li>
            <li className={requisitos.digito ? 'text-exito' : undefined}>Un dígito</li>
          </ul>
        </PasswordField>
        <PasswordField
          id="confirm"
          label="Confirmar nueva"
          value={confirmacion}
          onChange={setConfirmacion}
          autoComplete="new-password"
        />
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

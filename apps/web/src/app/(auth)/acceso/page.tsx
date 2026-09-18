'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import type { OrgContext } from '@cotizador/shared';
import { ApiClientError, apiFetch, setAccessToken } from '@/lib/api';

type LoginData = {
  accessToken: string;
  expiraEn: number;
  debeCambiarPassword: boolean;
  usuario: { id: string; nombreCompleto: string; email: string };
  contexto: OrgContext;
};

export default function AccesoPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await apiFetch<LoginData>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(data.accessToken);
      if (data.debeCambiarPassword) {
        router.replace('/acceso/cambiar-password');
      } else {
        router.replace('/panel');
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('No se pudo iniciar sesión. Intente de nuevo.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <Link href="/" className="font-display text-3xl font-semibold text-ink">
          Cotizador
        </Link>
        <p className="mt-2 text-sm text-muted">Ingresá al panel de tu organización</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-borde bg-surface p-6 shadow-[0_20px_50px_-30px_rgba(20,33,43,0.5)]"
      >
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-ink">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="vos@negocio.com"
            className="min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink outline-none placeholder:text-muted focus:border-brass"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-ink">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            placeholder="••••••••"
            className="min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink outline-none placeholder:text-muted focus:border-brass"
          />
        </div>
        {error ? (
          <p className="text-sm text-peligro" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-11 w-full items-center justify-center rounded-md bg-ink text-sm font-semibold text-paper transition hover:bg-slate disabled:opacity-60"
        >
          {pending ? 'Ingresando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

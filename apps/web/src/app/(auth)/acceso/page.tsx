'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { OrgContext } from '@cotizador/shared';
import { ApiClientError, apiFetch, setAccessToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, FormRequiredLegend } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

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
  const [mostrarPassword, setMostrarPassword] = useState(false);
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
    <main className="hero-counter flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 animate-rise text-center">
        <Link href="/" className="font-display text-3xl font-semibold tracking-tight text-white">
          Cotizador
        </Link>
        <p className="mt-2 text-sm text-white/60">Ingresá al panel de tu organización</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="animate-rise-delay w-full max-w-sm space-y-4 rounded-2xl border border-white/15 bg-white/95 p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] backdrop-blur-sm"
      >
        <FormRequiredLegend />
        <Field label="Correo" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="vos@negocio.com"
          />
        </Field>
        <Field label="Contraseña" htmlFor="password" required>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={mostrarPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder="••••••••"
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setMostrarPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-r-xl text-muted transition hover:text-ink"
              aria-label={
                mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
              aria-pressed={mostrarPassword}
            >
              {mostrarPassword ? (
                <EyeOff className="size-5" aria-hidden />
              ) : (
                <Eye className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </Field>
        {error ? (
          <p className="text-sm text-peligro" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full min-h-12">
          {pending ? 'Ingresando…' : 'Entrar'}
        </Button>
      </form>
    </main>
  );
}

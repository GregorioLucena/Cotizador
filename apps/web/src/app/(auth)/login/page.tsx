import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <Link href="/" className="font-display text-3xl font-semibold text-ink">
          Cotizador
        </Link>
        <p className="mt-2 text-sm text-muted">Ingresá al panel de tu organización</p>
      </div>

      <div className="w-full max-w-sm space-y-4 rounded-lg border border-borde bg-surface p-6 shadow-[0_20px_50px_-30px_rgba(20,33,43,0.5)]">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-ink">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="vos@negocio.com"
            disabled
            className="min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink outline-none placeholder:text-muted disabled:opacity-70"
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
            placeholder="••••••••"
            disabled
            className="min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink outline-none placeholder:text-muted disabled:opacity-70"
          />
        </div>
        <button
          type="button"
          disabled
          className="flex min-h-11 w-full items-center justify-center rounded-md bg-ink text-sm font-semibold text-paper opacity-60"
        >
          Entrar (próximamente)
        </button>
        <p className="text-center text-xs text-muted">
          Fase 0: cimientos listos. El login real llega con la especificación de usuarios.
        </p>
      </div>
    </main>
  );
}

import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(20,33,43,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(20,33,43,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 md:px-8">
        <p className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Cotizador
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-slate"
        >
          Entrar
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-6 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-14 md:px-8 md:pt-12">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">
            Mostrador · WhatsApp · Aprobación humana
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink md:text-5xl lg:text-[3.4rem]">
            Del chat al folio, sin inventar precios.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-slate md:text-xl">
            Pegá el mensaje del cliente. Armamos el borrador con el catálogo. Vos revisás, aprobás y
            copiás la respuesta.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center rounded-md bg-brass px-6 text-base font-semibold text-white shadow-sm transition hover:bg-brass-dark"
            >
              Abrir el panel
            </Link>
            <a
              href="#regla"
              className="inline-flex min-h-12 items-center rounded-md border border-borde bg-surface px-6 text-base font-semibold text-ink transition hover:border-slate"
            >
              Cómo funciona
            </a>
          </div>
        </div>

        <aside
          className="relative mx-auto w-full max-w-md animate-ticket-in"
          aria-label="Ejemplo de cotización"
        >
          <div className="absolute -inset-3 rounded-lg bg-brass/10 blur-xl" aria-hidden />
          <div className="relative overflow-hidden rounded-lg border border-borde bg-surface shadow-[0_24px_60px_-28px_rgba(20,33,43,0.45)]">
            <div className="flex items-center justify-between border-b border-dashed border-borde bg-ink px-5 py-4 text-paper">
              <div>
                <p className="font-display text-lg font-semibold tracking-wide">COT-0045</p>
                <p className="text-xs text-paper/70">Válida 48 horas</p>
              </div>
              <span className="rounded-sm bg-brass px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                Borrador
              </span>
            </div>
            <ul className="divide-y divide-borde/80 px-5 py-2 text-sm">
              <li className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-ink">Tubo PVC 1/2&quot; × 3m</p>
                  <p className="text-xs text-muted">× 2 und</p>
                </div>
                <span className="text-xs font-semibold text-exito">Resuelta</span>
              </li>
              <li className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-ink">Pegamento PVC</p>
                  <p className="text-xs text-muted">“pega azul” · × 1</p>
                </div>
                <span className="text-xs font-semibold text-ambar">Revisar</span>
              </li>
              <li className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-ink">—</p>
                  <p className="text-xs text-muted">“eso del lavamanos”</p>
                </div>
                <span className="text-xs font-semibold text-peligro">No encontrada</span>
              </li>
            </ul>
            <div className="border-t border-borde bg-paper/60 px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-muted">Total en moneda base</p>
              <p className="font-display text-2xl font-semibold text-ink">$ —</p>
              <p className="mt-1 text-xs text-muted">Los importes salen del catálogo, nunca de la IA.</p>
            </div>
            <div className="ticket-perforation h-3 w-full bg-ink/5" aria-hidden />
          </div>
        </aside>
      </section>

      <section id="regla" className="relative z-10 border-t border-borde/80 bg-surface/70">
        <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
          <p className="font-display text-2xl font-semibold text-ink md:text-3xl">
            La IA propone. El catálogo cotiza. La persona aprueba.
          </p>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate">
            Tres pasos claros para que el mostrador cotice en segundos, con precios auditables y sin
            enviar nada al cliente hasta que vos lo digas.
          </p>
        </div>
      </section>
    </main>
  );
}

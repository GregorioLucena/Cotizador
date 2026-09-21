import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-paper text-ink">
      <section className="hero-counter relative isolate min-h-dvh overflow-hidden text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 75% 65% at 50% 35%, black, transparent)',
          }}
        />
        <div
          aria-hidden
          className="animate-pulse-soft pointer-events-none absolute -right-20 top-16 h-64 w-64 rounded-full bg-[#7dd3c0]/30 blur-3xl md:h-96 md:w-96"
        />

        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-8 pt-4 md:max-w-6xl md:px-8 md:pt-7 md:pb-10">
          <header className="animate-rise flex items-center justify-between gap-4">
            <p className="font-display text-base font-semibold tracking-tight md:text-xl">
              Cotizador
            </p>
            <Link
              href="/acceso"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/30 bg-white/10 px-4 text-sm font-semibold backdrop-blur-sm transition hover:bg-white/20"
            >
              Entrar
            </Link>
          </header>

          {/* Una composición: marca + tesis + CTA + demo */}
          <div className="flex flex-1 flex-col justify-center gap-7 py-5 md:grid md:grid-cols-2 md:items-center md:gap-12 md:py-6">
            <div className="animate-rise-delay space-y-4 text-center md:space-y-5 md:text-left">
              <p className="font-display text-[2.6rem] font-bold leading-[0.95] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.5rem]">
                Cotizador
              </p>
              <h1 className="mx-auto max-w-md text-lg font-medium leading-snug text-white/90 md:mx-0 md:text-xl lg:text-2xl">
                Del WhatsApp al folio — precios del catálogo, aprobación tuya.
              </h1>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/65 md:mx-0 md:max-w-md">
                Pegás el mensaje. Revisás el semáforo. Aprobás. Nada se envía sin vos.
              </p>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center md:justify-start">
                <Link
                  href="/acceso"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brass px-7 text-base font-bold text-ink shadow-[0_16px_40px_-12px_rgba(240,162,2,0.65)] transition hover:bg-brass-dark hover:text-white"
                >
                  Abrir el panel
                </Link>
                <a
                  href="#como"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-7 text-sm font-semibold text-white/90 transition hover:border-white/45 hover:bg-white/10"
                >
                  Cómo funciona
                </a>
              </div>
            </div>

            <div
              className="animate-rise-late animate-float relative mx-auto w-full max-w-[20rem] md:mx-0 md:max-w-md"
              aria-label="De un mensaje de WhatsApp a una cotización"
            >
              <div
                className="absolute -inset-6 rounded-[2.5rem] bg-white/10 blur-2xl md:-inset-10"
                aria-hidden
              />
              <div className="relative space-y-2.5">
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#25D366] px-3.5 py-2.5 text-left text-xs font-medium leading-snug text-ink shadow-lg">
                  hola, 2 tubos de media, 10 codos y un pegamento azul
                </div>

                <div className="overflow-hidden rounded-[1.25rem] border border-white/20 bg-white shadow-[0_28px_60px_-18px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between bg-teal px-3.5 py-3 text-white">
                    <div>
                      <p className="font-display text-base font-bold tracking-tight">COT-0045</p>
                      <p className="text-xs text-white/70">Borrador · 48 h</p>
                    </div>
                    <span className="rounded-md bg-brass px-2 py-1 text-xs font-bold uppercase tracking-wider text-ink">
                      Revisar
                    </span>
                  </div>
                  <ul className="divide-y divide-borde px-3.5 text-sm text-ink">
                    <li className="flex items-center justify-between gap-2 py-2.5">
                      <span>Tubo PVC 1/2″ × 3m</span>
                      <span className="text-xs font-bold text-exito">Listo</span>
                    </li>
                    <li className="flex items-center justify-between gap-2 py-2.5">
                      <span>Codo — candidatos</span>
                      <span className="text-xs font-bold text-ambar">Revisar</span>
                    </li>
                    <li className="flex items-center justify-between gap-2 py-2.5">
                      <span className="text-slate">“eso del lavamanos”</span>
                      <span className="text-xs font-bold text-peligro">Sin match</span>
                    </li>
                  </ul>
                  <div className="ticket-perforation h-2 w-full opacity-50" aria-hidden />
                  <p className="px-3.5 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">
                    Precios del catálogo · nunca de la IA
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como" className="border-t border-borde bg-paper px-5 py-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-2xl text-center md:text-left">
          <p className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
            La IA lee. El catálogo cotiza. Vos aprobás.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate md:text-base">
            Pensado mobile-first a 375px: una sola tarea en el mostrador — pegar, revisar semáforo y
            aprobar — sin inventar importes.
          </p>
        </div>
      </section>
    </main>
  );
}

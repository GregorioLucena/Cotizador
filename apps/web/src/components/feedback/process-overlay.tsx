'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

const MENSAJES_DEFAULT = [
  'Interpretando el pedido…',
  'Buscando ítems en el catálogo…',
  'Calculando precios y descuentos…',
];

type ProcessOverlayProps = {
  open: boolean;
  title?: string;
  messages?: string[];
  /** Mensaje fijo si no se quiere rotar. */
  message?: string;
};

export function ProcessOverlay({
  open,
  title = 'Generando borrador',
  messages = MENSAJES_DEFAULT,
  message,
}: ProcessOverlayProps) {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setElapsed(false);
      return;
    }
    const rotate = window.setInterval(() => {
      setIndex((i) => (i + 1) % Math.max(messages.length, 1));
    }, 2400);
    const late = window.setTimeout(() => setElapsed(true), 8000);
    return () => {
      window.clearInterval(rotate);
      window.clearTimeout(late);
    };
  }, [open, messages.length]);

  if (!open) return null;

  const texto =
    message ?? messages[index % messages.length] ?? 'Procesando…';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 p-4 backdrop-blur-[3px] sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="process-overlay-title"
      aria-describedby="process-overlay-desc"
    >
      <div className="w-full max-w-sm animate-rise overflow-hidden rounded-2xl border border-borde bg-surface shadow-[0_28px_70px_-28px_rgba(18,32,30,0.65)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-teal to-teal-deep px-5 py-6 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-brass/25 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 left-8 size-24 rounded-full bg-white/10 blur-xl"
          />
          <div className="relative flex items-center gap-3">
            <span className="relative inline-flex size-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <span
                aria-hidden
                className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-brass animate-[spin_1.1s_linear_infinite]"
              />
              <Sparkles className="size-5 text-brass" />
            </span>
            <div>
              <p
                id="process-overlay-title"
                className="font-display text-lg font-bold leading-tight"
              >
                {title}
              </p>
              <p className="mt-0.5 text-xs font-medium text-white/75">
                Un momento, sin cerrar esta ventana
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-5">
          <p
            id="process-overlay-desc"
            key={texto}
            className="animate-rise text-sm font-semibold text-ink"
          >
            {texto}
          </p>
          <div className="flex gap-1.5" aria-hidden>
            {messages.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-500',
                  i === index % messages.length ? 'bg-teal' : 'bg-borde',
                )}
              />
            ))}
          </div>
          {elapsed ? (
            <p className="text-xs leading-relaxed text-muted">
              Sigue en curso. La interpretación puede tardar unos segundos más.
            </p>
          ) : (
            <p className="text-xs text-muted">
              Los importes salen del catálogo, no de la IA.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type MouseEvent,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  /** Si true, Escape y clic en el fondo no cierran (proceso obligatorio). */
  blocking?: boolean;
  className?: string;
  /** Oculta el botón X (p. ej. overlay de proceso). */
  hideClose?: boolean;
  size?: 'sm' | 'md';
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function primerCampoEditable(panel: HTMLElement): HTMLElement | null {
  const campo = panel.querySelector<HTMLElement>(
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
  );
  if (campo) return campo;
  return panel.querySelector<HTMLElement>(FOCUSABLE);
}

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  blocking = false,
  className,
  hideClose = false,
  size = 'sm',
}: DialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const blockingRef = useRef(blocking);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    blockingRef.current = blocking;
  }, [blocking]);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    // Esperar un frame para que el contenido (inputs) ya esté montado.
    const focusTimer = window.setTimeout(() => {
      const target = panel ? primerCampoEditable(panel) : null;
      target?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !blockingRef.current) {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previousFocus.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function onBackdrop(e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || blocking) return;
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-4 backdrop-blur-[2px] sm:items-center"
      role="presentation"
      onClick={onBackdrop}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'w-full animate-rise rounded-2xl border border-borde bg-surface shadow-[0_28px_70px_-30px_rgba(18,32,30,0.6)]',
          size === 'sm' ? 'max-w-md' : 'max-w-lg',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-borde/70 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-lg font-bold leading-snug text-ink"
            >
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1.5 text-sm leading-relaxed text-slate">
                {description}
              </p>
            ) : null}
          </div>
          {!hideClose && !blocking ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-paper hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

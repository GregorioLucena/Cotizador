'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastTone = 'success' | 'error' | 'info' | 'warn';

export type ToastInput = {
  message: string;
  tone?: ToastTone;
  /** ms; por defecto 4200. `0` = no auto-cierra. */
  durationMs?: number;
};

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
};

type ToastApi = {
  push: (input: ToastInput | string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
  warn: TriangleAlert,
};

const TONES: Record<ToastTone, string> = {
  success: 'border-exito/30 bg-surface text-ink shadow-[0_16px_40px_-20px_rgba(31,138,76,0.45)]',
  error: 'border-peligro/30 bg-surface text-ink shadow-[0_16px_40px_-20px_rgba(196,60,60,0.45)]',
  info: 'border-teal/30 bg-surface text-ink shadow-[0_16px_40px_-20px_rgba(11,95,86,0.4)]',
  warn: 'border-ambar/40 bg-surface text-ink shadow-[0_16px_40px_-20px_rgba(217,146,11,0.45)]',
};

const ICON_TONES: Record<ToastTone, string> = {
  success: 'text-exito',
  error: 'text-peligro',
  info: 'text-teal',
  warn: 'text-ambar',
};

const MAX_VISIBLE = 3;
const DEFAULT_MS = 4200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: ToastInput | string) => {
    const normalized: ToastInput =
      typeof input === 'string' ? { message: input } : input;
    const item: ToastItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: normalized.message,
      tone: normalized.tone ?? 'info',
      durationMs:
        normalized.durationMs === undefined
          ? DEFAULT_MS
          : normalized.durationMs,
    };
    setItems((prev) => [...prev, item].slice(-MAX_VISIBLE));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (message) => push({ message, tone: 'success' }),
      error: (message) => push({ message, tone: 'error' }),
      info: (message) => push({ message, tone: 'info' }),
      warn: (message) => push({ message, tone: 'warn' }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-stretch gap-2 p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm sm:items-end"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((toast) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const t = window.setTimeout(onDismiss, toast.durationMs);
    return () => window.clearTimeout(t);
  }, [toast.durationMs, onDismiss]);

  const Icon = ICONS[toast.tone];

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 animate-rise',
        TONES[toast.tone],
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-paper',
          ICON_TONES[toast.tone],
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <p className="min-w-0 flex-1 pt-1 text-sm font-medium leading-snug text-ink">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-paper hover:text-ink"
        aria-label="Cerrar aviso"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }
  return ctx;
}

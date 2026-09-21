'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/feedback/dialog';
import { cn } from '@/lib/cn';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const tone = pending?.tone ?? 'primary';
  const Icon = tone === 'danger' ? AlertTriangle : HelpCircle;

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={Boolean(pending)}
        title={pending?.title ?? ''}
        description={pending?.description}
        onClose={() => finish(false)}
        hideClose={false}
      >
        <div className="mb-4 flex justify-center sm:justify-start">
          <span
            className={cn(
              'inline-flex size-12 items-center justify-center rounded-2xl',
              tone === 'danger' ? 'bg-peligro/12 text-peligro' : 'bg-teal/12 text-teal',
            )}
            aria-hidden
          >
            <Icon className="size-6" />
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => finish(true)}
            autoFocus
          >
            {pending?.confirmLabel ?? 'Continuar'}
          </Button>
          <Button variant="secondary" onClick={() => finish(false)}>
            {pending?.cancelLabel ?? 'Cancelar'}
          </Button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm debe usarse dentro de ConfirmProvider');
  }
  return ctx;
}

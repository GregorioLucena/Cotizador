import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'brand';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-paper text-slate',
    success: 'bg-exito/12 text-exito',
    warn: 'bg-ambar/15 text-ambar',
    danger: 'bg-peligro/12 text-peligro',
    brand: 'bg-teal/12 text-teal',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

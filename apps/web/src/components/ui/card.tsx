import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({
  className,
  children,
  accent = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { accent?: boolean }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-borde/80 bg-surface shadow-[0_18px_50px_-28px_rgba(18,32,30,0.35)]',
        accent && 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-teal',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('p-5 md:p-6', className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-borde/70 bg-paper/60 px-5 py-4 md:px-6">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

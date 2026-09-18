import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Input, Select } from '@/components/ui/input';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p className="text-xs text-peligro" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = props.id ?? props.name;
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Input id={id} {...props} />
    </Field>
  );
}

export function SelectField({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = props.id ?? props.name;
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Select id={id} {...props}>
        {children}
      </Select>
    </Field>
  );
}

export function CheckField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-borde/80 bg-paper/50 px-3.5 text-sm text-ink transition hover:border-teal/30',
        className,
      )}
    >
      <input
        type="checkbox"
        className="size-4 accent-teal"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

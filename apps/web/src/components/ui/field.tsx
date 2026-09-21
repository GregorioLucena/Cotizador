'use client';

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';
import { FieldErrorProvider } from '@/components/ui/field-error';
import { Input, Select } from '@/components/ui/input';

export function RequiredAsterisk() {
  return (
    <span className="text-peligro" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <FieldErrorProvider error={error}>
      {(shown) => (
        <div className={cn('space-y-1.5', className)}>
          <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
            {label}
            {required ? <RequiredAsterisk /> : null}
          </label>
          {children}
          {shown ? (
            <p className="text-sm font-medium text-peligro" role="alert">
              {shown}
            </p>
          ) : null}
          {hint && !shown ? <p className="text-sm text-muted">{hint}</p> : null}
        </div>
      )}
    </FieldErrorProvider>
  );
}

export function FormRequiredLegend() {
  return (
    <p className="rounded-xl bg-teal/4 px-3 py-2 text-sm text-muted ring-1 ring-teal/10">
      Los campos marcados con{' '}
      <span className="font-semibold text-peligro">*</span> son obligatorios.
    </p>
  );
}

export function TextField({
  label,
  className,
  required,
  error,
  id: idProp,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) {
  const autoId = useId();
  const id = idProp ?? (typeof props.name === 'string' ? props.name : undefined) ?? autoId;
  return (
    <Field
      label={label}
      htmlFor={id}
      className={className}
      required={Boolean(required)}
      error={error}
    >
      <Input id={id} required={required} {...props} />
    </Field>
  );
}

export function SelectField({
  label,
  className,
  required,
  error,
  id: idProp,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  const autoId = useId();
  const id = idProp ?? (typeof props.name === 'string' ? props.name : undefined) ?? autoId;
  return (
    <Field
      label={label}
      htmlFor={id}
      className={className}
      required={Boolean(required)}
      error={error}
    >
      <Select id={id} required={required} {...props}>
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
      <input type="checkbox" className="size-4 accent-teal" {...props} />
      <span>{label}</span>
    </label>
  );
}

export { getControlClassName } from '@/components/ui/input';
export { messageFromValidity, useFieldError } from '@/components/ui/field-error';

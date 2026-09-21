'use client';

import {
  forwardRef,
  type FormEvent,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';
import { messageFromValidity, useFieldError } from '@/components/ui/field-error';

const controlClass =
  'min-h-11 w-full rounded-xl border border-borde bg-white px-3.5 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:text-muted focus:border-teal focus:ring-2 focus:ring-teal/20';

const controlErrorClass =
  'border-peligro/60 bg-peligro/[0.03] focus:border-peligro focus:ring-peligro/20';

export function getControlClassName(hasError?: boolean) {
  return cn(controlClass, hasError && controlErrorClass);
}

function useInlineValidity(
  onInvalid?: (e: FormEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void,
  onInput?: (e: FormEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void,
) {
  const fieldError = useFieldError();

  return {
    onInvalid: (
      e: FormEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => {
      if (fieldError) {
        e.preventDefault();
        fieldError.setError(messageFromValidity(e.currentTarget));
      }
      onInvalid?.(e);
    },
    onInput: (
      e: FormEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => {
      fieldError?.setError(undefined);
      onInput?.(e);
    },
    hasError: Boolean(fieldError?.hasError),
  };
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, required, onInvalid, onInput, ...props }, ref) {
    const validity = useInlineValidity(onInvalid, onInput);
    return (
      <input
        ref={ref}
        className={cn(getControlClassName(validity.hasError), className)}
        required={required}
        {...props}
        onInvalid={validity.onInvalid}
        onInput={validity.onInput}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, required, onInvalid, onInput, ...props }, ref) {
    const validity = useInlineValidity(onInvalid, onInput);
    return (
      <select
        ref={ref}
        className={cn(getControlClassName(validity.hasError), className)}
        required={required}
        {...props}
        onInvalid={validity.onInvalid}
        onInput={validity.onInput}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, required, onInvalid, onInput, ...props }, ref) {
  const validity = useInlineValidity(onInvalid, onInput);
  return (
    <textarea
      ref={ref}
      className={cn(getControlClassName(validity.hasError), 'min-h-28 py-3', className)}
      required={required}
      {...props}
      onInvalid={validity.onInvalid}
      onInput={validity.onInput}
    />
  );
});

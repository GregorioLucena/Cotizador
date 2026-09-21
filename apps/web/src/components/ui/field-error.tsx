'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  REQUIRED_FIELD_MESSAGE,
  getEmailFieldError,
} from '@/lib/form-validation';

type FieldErrorCtx = {
  setError: (message: string | undefined) => void;
  hasError: boolean;
};

const FieldErrorContext = createContext<FieldErrorCtx | null>(null);

export function useFieldError() {
  return useContext(FieldErrorContext);
}

export function messageFromValidity(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
) {
  if (el.validity.valueMissing) return REQUIRED_FIELD_MESSAGE;
  if (el.validity.typeMismatch && 'type' in el && el.type === 'email') {
    return getEmailFieldError(el.value) ?? 'Ingresa un correo válido.';
  }
  if (el.validity.tooShort) {
    return `Mínimo ${el.minLength} caracteres.`;
  }
  if (el.validity.tooLong) {
    return `Máximo ${el.maxLength} caracteres.`;
  }
  if (el.validity.patternMismatch) {
    return 'El formato no es válido.';
  }
  return REQUIRED_FIELD_MESSAGE;
}

export function FieldErrorProvider({
  error,
  children,
}: {
  error?: string;
  children: (shown: string | undefined) => ReactNode;
}) {
  const [localError, setLocalError] = useState<string | undefined>();
  const shown = error ?? localError;
  const setError = useCallback((message: string | undefined) => {
    setLocalError(message);
  }, []);
  const ctx = useMemo(
    () => ({ setError, hasError: Boolean(shown) }),
    [setError, shown],
  );

  return (
    <FieldErrorContext.Provider value={ctx}>
      {children(shown)}
    </FieldErrorContext.Provider>
  );
}

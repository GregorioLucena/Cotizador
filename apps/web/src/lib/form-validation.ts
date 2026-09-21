/** Mensajes de validación de formularios del panel. */

export const REQUIRED_FIELD_MESSAGE = 'Este campo es obligatorio.';

export type FieldErrors = Record<string, string>;

export function getRequiredFieldError(value: string): string | undefined {
  return value.trim() ? undefined : REQUIRED_FIELD_MESSAGE;
}

export function getEmailFieldError(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(trimmed) ? undefined : 'Ingresa un correo válido.';
}

export function clearFieldError(
  field: string,
  setFieldErrors: (value: FieldErrors | ((prev: FieldErrors) => FieldErrors)) => void,
) {
  setFieldErrors((prev) => {
    if (!prev[field]) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  });
}

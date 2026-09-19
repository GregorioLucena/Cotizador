import { AppError } from '../errors/classes';
import {
  whatsappFormatoInvalido,
  whatsappSinCodigoPais,
} from '../errors/cliente.errors';

/** Patrón E.164 operativo del MVP: `+` + dígito 1–9 + 7 a 14 dígitos más. */
export const WHATSAPP_E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Normaliza un teléfono WhatsApp a E.164 (`+` + 8–15 dígitos).
 * Vacío / null / undefined → null.
 * Sin código de país (solo dígitos locales) → WHATSAPP_SIN_CODIGO_PAIS.
 * Forma inválida tras normalizar → WHATSAPP_FORMATO_INVALIDO.
 */
export function normalizarTelefonoWhatsapp(
  valor: string | null | undefined,
): string | null {
  if (valor == null) return null;

  let t = valor.trim();
  if (!t) return null;

  // Espacios, guiones, paréntesis y puntos
  t = t.replace(/[\s\-().]/g, '');

  if (t.startsWith('00')) {
    t = `+${t.slice(2)}`;
  }

  // Solo dígitos sin + → falta código de país (MVP)
  if (/^\d+$/.test(t)) {
    throw whatsappSinCodigoPais();
  }

  if (!t.startsWith('+')) {
    throw whatsappFormatoInvalido();
  }

  const digitos = t.slice(1);
  if (!/^\d+$/.test(digitos)) {
    throw whatsappFormatoInvalido();
  }

  if (!WHATSAPP_E164_REGEX.test(t)) {
    throw whatsappFormatoInvalido();
  }

  return t;
}

/** Variante que no lanza: útil en búsquedas parciales. */
export function intentarNormalizarTelefonoWhatsapp(
  valor: string | null | undefined,
): string | null {
  try {
    return normalizarTelefonoWhatsapp(valor);
  } catch (err) {
    if (err instanceof AppError) return null;
    throw err;
  }
}

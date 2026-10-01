import { AppError } from '../errors/classes';
import {
  whatsappFormatoInvalido,
  whatsappSinCodigoPais,
} from '../errors/cliente.errors';

/** Patrón E.164 operativo del MVP: `+` + dígito 1–9 + 7 a 14 dígitos más. */
export const WHATSAPP_E164_REGEX = /^\+[1-9]\d{7,14}$/;

/** Código de país ITU: 1 a 3 dígitos, sin cero inicial. */
export const CODIGO_PAIS_WHATSAPP_REGEX = /^[1-9]\d{0,2}$/;

export type NormalizarWhatsappOpciones = {
  /** Dígitos de país sin `+` (ej. `58`). Si falta, los locales se rechazan. */
  codigoPaisDefault?: string | null;
};

/**
 * Normaliza un teléfono WhatsApp a E.164 (`+` + 8–15 dígitos).
 * Vacío / null / undefined → null.
 * Sin código de país (solo dígitos locales) → antepone `codigoPaisDefault` si viene;
 * si no, WHATSAPP_SIN_CODIGO_PAIS.
 * Forma inválida tras normalizar → WHATSAPP_FORMATO_INVALIDO.
 */
export function normalizarTelefonoWhatsapp(
  valor: string | null | undefined,
  opciones?: NormalizarWhatsappOpciones,
): string | null {
  if (valor == null) return null;

  let t = valor.trim();
  if (!t) return null;

  // Espacios, guiones, paréntesis y puntos
  t = t.replace(/[\s\-().]/g, '');

  if (t.startsWith('00')) {
    t = `+${t.slice(2)}`;
  }

  // Solo dígitos sin + → aplicar código de país de la organización o rechazar
  if (/^\d+$/.test(t)) {
    const codigo = (opciones?.codigoPaisDefault ?? '').trim();
    if (!codigo || !CODIGO_PAIS_WHATSAPP_REGEX.test(codigo)) {
      throw whatsappSinCodigoPais();
    }
    // Prefijo troncal local habitual (0…): 0414… → 414… antes de anteponer el país
    const nacional = t.replace(/^0+/, '');
    if (!nacional) {
      throw whatsappFormatoInvalido();
    }
    t = `+${codigo}${nacional}`;
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
  opciones?: NormalizarWhatsappOpciones,
): string | null {
  try {
    return normalizarTelefonoWhatsapp(valor, opciones);
  } catch (err) {
    if (err instanceof AppError) return null;
    throw err;
  }
}

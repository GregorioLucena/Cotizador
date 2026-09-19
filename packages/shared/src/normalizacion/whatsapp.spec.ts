import { describe, expect, it } from 'vitest';
import {
  normalizarTelefonoWhatsapp,
  WHATSAPP_E164_REGEX,
} from './whatsapp';
import { AppError } from '../errors/classes';

describe('normalizarTelefonoWhatsapp', () => {
  it('devuelve null para vacío o solo espacios', () => {
    expect(normalizarTelefonoWhatsapp(null)).toBeNull();
    expect(normalizarTelefonoWhatsapp(undefined)).toBeNull();
    expect(normalizarTelefonoWhatsapp('')).toBeNull();
    expect(normalizarTelefonoWhatsapp('   ')).toBeNull();
  });

  it('normaliza con espacios, guiones y paréntesis', () => {
    expect(normalizarTelefonoWhatsapp('+58 414 1234567')).toBe('+584141234567');
    expect(normalizarTelefonoWhatsapp('+58-414-1234567')).toBe('+584141234567');
    expect(normalizarTelefonoWhatsapp('+58 (414) 123.4567')).toBe('+584141234567');
  });

  it('reemplaza prefijo 00 por +', () => {
    expect(normalizarTelefonoWhatsapp('00584141234567')).toBe('+584141234567');
  });

  it('rechaza dígitos locales sin código de país', () => {
    try {
      normalizarTelefonoWhatsapp('0414-1234567');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('WHATSAPP_SIN_CODIGO_PAIS');
    }
  });

  it('rechaza formato inválido', () => {
    try {
      normalizarTelefonoWhatsapp('abc');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('WHATSAPP_FORMATO_INVALIDO');
    }
  });

  it('rechaza números demasiado cortos o largos', () => {
    try {
      normalizarTelefonoWhatsapp('+1234567');
      expect.unreachable();
    } catch (err) {
      expect((err as AppError).code).toBe('WHATSAPP_FORMATO_INVALIDO');
    }
    try {
      normalizarTelefonoWhatsapp('+1234567890123456');
      expect.unreachable();
    } catch (err) {
      expect((err as AppError).code).toBe('WHATSAPP_FORMATO_INVALIDO');
    }
  });

  it('acepta E.164 válido', () => {
    const n = normalizarTelefonoWhatsapp('+584141234567');
    expect(n).toBe('+584141234567');
    expect(WHATSAPP_E164_REGEX.test(n!)).toBe(true);
  });
});

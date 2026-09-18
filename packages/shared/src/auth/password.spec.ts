import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/classes';
import { generarPasswordTemporal, validarPoliticaPassword } from './password';

describe('validarPoliticaPassword', () => {
  it('acepta una contraseña válida', () => {
    expect(() => validarPoliticaPassword('Segura1234')).not.toThrow();
  });

  it('rechaza longitud menor a 10', () => {
    expect(() => validarPoliticaPassword('Segura1')).toThrow(AppError);
  });

  it('rechaza sin mayúscula', () => {
    expect(() => validarPoliticaPassword('segura1234')).toThrow(AppError);
  });

  it('rechaza sin minúscula', () => {
    expect(() => validarPoliticaPassword('SEGURA1234')).toThrow(AppError);
  });

  it('rechaza sin dígito', () => {
    expect(() => validarPoliticaPassword('SeguraSegura')).toThrow(AppError);
  });

  it('rechaza si coincide con el correo', () => {
    expect(() =>
      validarPoliticaPassword('Admin@mail.com', { email: 'admin@mail.com' }),
    ).toThrow(AppError);
  });

  it('rechaza si coincide con el nombre', () => {
    expect(() =>
      validarPoliticaPassword('Juan Perez', { nombreCompleto: 'Juan Perez' }),
    ).toThrow(AppError);
  });
});

describe('generarPasswordTemporal', () => {
  it('siempre cumple la política', () => {
    for (let i = 0; i < 20; i += 1) {
      const password = generarPasswordTemporal();
      expect(() => validarPoliticaPassword(password)).not.toThrow();
    }
  });
});

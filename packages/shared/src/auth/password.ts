import { AppError } from '../errors/classes';

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

export type PasswordPolicyContext = {
  email?: string;
  nombreCompleto?: string;
};

export function validarPoliticaPassword(
  password: string,
  ctx: PasswordPolicyContext = {},
): void {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new AppError(
      'AUTH_PASSWORD_DEBIL',
      'La contraseña no cumple los requisitos de seguridad.',
      400,
    );
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError(
      'AUTH_PASSWORD_DEBIL',
      'La contraseña no cumple los requisitos de seguridad.',
      400,
    );
  }

  const email = ctx.email?.trim().toLowerCase();
  if (email && password.toLowerCase() === email) {
    throw new AppError(
      'AUTH_PASSWORD_DEBIL',
      'La contraseña no cumple los requisitos de seguridad.',
      400,
    );
  }

  const nombre = ctx.nombreCompleto?.trim().toLowerCase();
  if (nombre && password.toLowerCase() === nombre) {
    throw new AppError(
      'AUTH_PASSWORD_DEBIL',
      'La contraseña no cumple los requisitos de seguridad.',
      400,
    );
  }
}

/** Genera una contraseña temporal que cumple la política. */
export function generarPasswordTemporal(): string {
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minus = 'abcdefghijkmnopqrstuvwxyz';
  const digitos = '23456789';
  const todos = mayus + minus + digitos;

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)]!;
  const chars = [pick(mayus), pick(minus), pick(digitos)];
  while (chars.length < 12) {
    chars.push(pick(todos));
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  const password = chars.join('');
  validarPoliticaPassword(password);
  return password;
}

export function requisitosPassword(password: string): {
  longitud: boolean;
  minuscula: boolean;
  mayuscula: boolean;
  digito: boolean;
} {
  return {
    longitud: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    minuscula: /[a-z]/.test(password),
    mayuscula: /[A-Z]/.test(password),
    digito: /[0-9]/.test(password),
  };
}

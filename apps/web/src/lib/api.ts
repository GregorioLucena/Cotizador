const ACCESS_TOKEN_KEY = 'cotizador_access_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function clearSession(): void {
  clearAccessToken();
}

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
}

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type ApiFetchInit = RequestInit & {
  /** Si es `null`, no envía Authorization aunque haya token en sessionStorage. */
  token?: string | null;
};

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  const isFormData =
    typeof FormData !== 'undefined' && rest.body instanceof FormData;
  if (!headers.has('Content-Type') && rest.body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  if (token !== null) {
    const bearer = token ?? getAccessToken();
    if (bearer) {
      headers.set('Authorization', `Bearer ${bearer}`);
    }
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...rest,
    headers,
    credentials: 'include',
  });

  // Descarga binaria (plantilla CSV o PDF)
  const contentType = response.headers.get('content-type') ?? '';
  if (response.ok && contentType.includes('text/csv')) {
    const text = await response.text();
    return text as T;
  }
  if (response.ok && contentType.includes('application/pdf')) {
    const blob = await response.blob();
    return blob as T;
  }

  const json = (await response.json().catch(() => null)) as
    | { data: T }
    | ApiErrorBody
    | null;

  if (!response.ok) {
    const err = json && 'error' in json ? json.error : null;
    throw new ApiClientError(
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? 'No se pudo completar la solicitud.',
      response.status,
      err?.details,
    );
  }

  return (json as { data: T }).data;
}

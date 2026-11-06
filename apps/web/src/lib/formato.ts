'use client';

import { useEffect, useState } from 'react';
import {
  formatearImportePresentacion,
  modoRedondeoDe,
  type ModoRedondeo,
} from '@cotizador/shared';
import { apiFetch, getAccessToken } from '@/lib/api';

type FormatoOrganizacion = {
  decimales: number;
  modo: ModoRedondeo;
  locale: string;
};

const DEFECTO: FormatoOrganizacion = {
  decimales: 2,
  modo: 'NORMAL',
  locale: 'es-VE',
};

let cacheToken: string | null = null;
let cache: FormatoOrganizacion | null = null;

export function invalidarFormatoOrganizacion(): void {
  cache = null;
  cacheToken = null;
}

async function obtenerFormatoOrganizacion(): Promise<FormatoOrganizacion> {
  const token = getAccessToken();
  if (!token) return DEFECTO;
  if (cache && cacheToken === token) return cache;
  const perfil = await apiFetch<{
    organizacion: {
      locale?: string;
      decimalesRedondeo?: number;
      modoRedondeo?: string;
    } | null;
  }>('/auth/perfil');
  const org = perfil.organizacion;
  const formato: FormatoOrganizacion = {
    decimales: org?.decimalesRedondeo ?? DEFECTO.decimales,
    modo: modoRedondeoDe(org?.modoRedondeo),
    locale: org?.locale?.trim() || DEFECTO.locale,
  };
  cache = formato;
  cacheToken = token;
  return formato;
}

/** Formatea importes con los decimales de redondeo de la organización en sesión. */
export function useImporteOrganizacion(): (
  valor: string | null | undefined,
) => string {
  const [fmt, setFmt] = useState<FormatoOrganizacion>(DEFECTO);
  useEffect(() => {
    let vivo = true;
    void obtenerFormatoOrganizacion()
      .then((f) => {
        if (vivo) setFmt(f);
      })
      .catch(() => {
        if (vivo) setFmt(DEFECTO);
      });
    return () => {
      vivo = false;
    };
  }, []);
  return (valor) =>
    formatearImportePresentacion(valor, fmt.decimales, {
      locale: fmt.locale,
      modo: fmt.modo,
    });
}

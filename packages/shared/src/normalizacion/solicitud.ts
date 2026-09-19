import { normalizarTexto } from './texto';

const MARCA_HORA =
  /^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*[^:\n]{0,80}:\s*/gim;
const ENCABEZADO_REENVIADO =
  /^(reenviado|mensaje original|forwarded|mensaje reenviado)\s*:?\s*$/gim;
const SALUDOS_INICIO =
  /^(buenas?|hola|buen\s+d[ií]a|buenas\s+tardes|buenas\s+noches|saludos)[!,.\s]*/i;
const DESPEDIDAS_FIN =
  /\s*(gracias|porfa|por\s+favor|saludos|chao|bye)[!.\s]*$/i;

/**
 * Normalización de mensajes de WhatsApp / texto libre para la etapa 1 del pipeline.
 * Conserva el original aparte; esta función solo produce `textoNormalizado`.
 * Reutiliza `normalizarTexto` para acentos, puntuación y equivalencias de medida.
 */
export function normalizarTextoSolicitud(textoOriginal: string): string {
  let t = textoOriginal.trim();
  if (!t) return '';

  // Separar viñetas y guiones en líneas lógicas
  t = t.replace(/^[*\-•]\s+/gm, '');
  t = t.replace(/\r\n/g, '\n');

  // Eliminar marcas de hora / nombre de contacto y encabezados de reenvío
  t = t.replace(MARCA_HORA, '');
  t = t
    .split('\n')
    .filter((linea) => !ENCABEZADO_REENVIADO.test(linea.trim()))
    .join('\n');
  // Reset lastIndex de regex globales
  ENCABEZADO_REENVIADO.lastIndex = 0;

  // Saludos al inicio y despedidas al final (por línea y del bloque)
  const lineas = t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      let x = l.replace(SALUDOS_INICIO, '').trim();
      x = x.replace(DESPEDIDAS_FIN, '').trim();
      return x;
    })
    .filter(Boolean);

  t = lineas.join('\n');
  t = t.replace(SALUDOS_INICIO, '').trim();
  t = t.replace(DESPEDIDAS_FIN, '').trim();

  // Normalizar cada línea con la función canónica del catálogo
  const normalizadas = t
    .split('\n')
    .map((l) => normalizarTexto(l))
    .filter(Boolean);

  return normalizadas.join('\n').trim();
}

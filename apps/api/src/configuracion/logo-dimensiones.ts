export type DimensionesImagen = { width: number; height: number };

/** Lee IHDR de un PNG (bytes 16-23 tras la firma de 8 bytes + longitud + tipo). */
export function dimensionesPng(buffer: Buffer): DimensionesImagen | null {
  if (buffer.length < 24) return null;
  const firma = buffer.subarray(0, 8);
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!firma.equals(pngSig)) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

/** Busca el primer marcador SOF0/SOF2 en un JPEG. */
export function dimensionesJpeg(buffer: Buffer): DimensionesImagen | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;

    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    const esSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (esSof && offset + 9 < buffer.length) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      if (width >= 1 && height >= 1) {
        return { width, height };
      }
    }

    offset += 2 + length;
  }

  return null;
}

export function dimensionesBitmap(
  buffer: Buffer,
  mime: string,
): DimensionesImagen | null {
  if (mime === 'image/png') return dimensionesPng(buffer);
  if (mime === 'image/jpeg') return dimensionesJpeg(buffer);
  return null;
}

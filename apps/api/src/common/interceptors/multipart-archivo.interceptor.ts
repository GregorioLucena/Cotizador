import {
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  type Type,
} from '@nestjs/common';
import { AppError } from '@cotizador/shared';
import Busboy from 'busboy';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

type RequestConArchivo = Request & { file?: Express.Multer.File };

/**
 * Sustituto de Nest FileInterceptor + multer 2.
 * En Windows + Express 5, multer 2 no entrega campos ni archivo; busboy sí.
 */
export function MultipartArchivoInterceptor(
  fieldName: string,
  maxFileSizeBytes: number,
): Type<NestInterceptor> {
  @Injectable()
  class MultipartArchivoInterceptorHost implements NestInterceptor {
    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<unknown>> {
      const req = context.switchToHttp().getRequest<RequestConArchivo>();
      const contentType = String(req.headers['content-type'] ?? '');
      if (!contentType.toLowerCase().includes('multipart/form-data')) {
        return Promise.resolve(next.handle());
      }

      return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (err: unknown) => {
          if (settled) return;
          settled = true;
          reject(err);
        };
        const ok = () => {
          if (settled) return;
          settled = true;
          resolve(next.handle());
        };

        const bb = Busboy({
          headers: req.headers,
          limits: { fileSize: maxFileSizeBytes },
        });
        const body: Record<string, string> = {};
        let file: Express.Multer.File | undefined;
        let truncated = false;

        bb.on('file', (name, stream, info) => {
          if (name !== fieldName) {
            stream.resume();
            return;
          }
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          stream.on('limit', () => {
            truncated = true;
          });
          stream.on('end', () => {
            if (truncated) return;
            const buffer = Buffer.concat(chunks);
            file = {
              fieldname: name,
              originalname: info.filename || 'archivo',
              encoding: info.encoding,
              mimetype: info.mimeType,
              size: buffer.length,
              buffer,
              destination: '',
              filename: info.filename || 'archivo',
              path: '',
              stream: undefined as never,
            };
          });
        });

        bb.on('field', (name, value) => {
          body[name] = value;
        });

        bb.on('error', (err: Error) => {
          fail(err);
        });

        bb.on('finish', () => {
          if (truncated) {
            fail(
              new AppError(
                'ARCHIVO_DEMASIADO_GRANDE',
                'El archivo supera el tamaño máximo permitido.',
                400,
              ),
            );
            return;
          }
          req.body = body;
          req.file = file;
          ok();
        });

        req.pipe(bb);
      });
    }
  }

  return mixin(MultipartArchivoInterceptorHost);
}

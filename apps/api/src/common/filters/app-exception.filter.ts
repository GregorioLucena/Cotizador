import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppError, ValidationError } from '@cotizador/shared/errors';
import { ZodError } from 'zod';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof AppError) {
      return response.status(exception.status).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      });
    }

    if (exception instanceof ZodError) {
      const validation = new ValidationError(exception.flatten());
      return response.status(validation.status).json({
        error: {
          code: validation.code,
          message: validation.message,
          details: validation.details,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return response.status(status).json({
        error: {
          code: 'HTTP_ERROR',
          message:
            typeof body === 'string' ? body : (body as { message?: string }).message,
          details: typeof body === 'object' ? body : undefined,
        },
      });
    }

    console.error(exception);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocurrió un error inesperado.',
      },
    });
  }
}

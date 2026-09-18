import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new AppExceptionFilter());

  const uploadDir = process.env.UPLOAD_DIR
    ? process.env.UPLOAD_DIR
    : join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadDir, { prefix: '/api/uploads' });

  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({ origin: corsOrigin, credentials: true });

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API escuchando en http://0.0.0.0:${port}/api`);
}

bootstrap();

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import * as helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter()
  );
  app.useGlobalPipes(new ValidationPipe());
  app.use(helmet.default()); // Utilisation de Helmet avec .default()
  await app.listen(3000);
  console.log(`Application is running on: http://localhost:3000`);
}
bootstrap();

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
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, 
        forbidNonWhitelisted: true, 
        transform: true, 
        transformOptions: {
        enableImplicitConversion: true, 
        },
      }),
    );
    
    app.useGlobalFilters(new HttpExceptionFilter());

    app.use(
      helmet.default({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
          },
        },
      }),
    );

    app.enableCors({
      origin: [
        'http://localhost:3001',
      ],
      methods: 'GET,POST,PUT,DELETE',
      credentials: true, 
    });

    const port = process.env.PORT || 3000;
    console.log(
      `Server running on http://localhost:${port} in ${process.env.NODE_ENV || 'development'} mode`,
    );

    await app.listen(port);
  } catch (error) {
    console.error('Failed to bootstrap the application:', error.stack);
    process.exit(1);
  }
}
bootstrap();
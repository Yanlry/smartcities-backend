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
        whitelist: true, // Supprime les champs non définis dans le DTO
        forbidNonWhitelisted: true, // Bloque les champs non autorisés
        transform: true, // Convertit automatiquement les types
        transformOptions: {
          enableImplicitConversion: true, // Permet les conversions implicites
        },
      }),
    );
    
    // Gestion des exceptions globales
    app.useGlobalFilters(new HttpExceptionFilter());

    // Sécurité avec Helmet
    app.use(
      helmet.default({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // Permet les styles inline si nécessaire
          },
        },
      }),
    );

    // Configuration CORS pour permettre le frontend
    app.enableCors({
      origin: [
        'http://localhost:3001', // Domaine local pour le développement
        'http://192.168.1.100:3000/', // Domaine déployé
      ],
      methods: 'GET,POST,PUT,DELETE',
      credentials: true, // Permet d'envoyer des cookies si nécessaire
    });

    // Affiche le mode d'exécution
    const port = process.env.PORT || 3000;
    console.log(
      `Server running on http://localhost:${port} in ${process.env.NODE_ENV || 'development'} mode`,
    );

    // Démarrage du serveur
    await app.listen(port);
  } catch (error) {
    console.error('Failed to bootstrap the application:', error.stack);
    process.exit(1); // Quitte le processus en cas d'échec critique
  }
}
bootstrap();
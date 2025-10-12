// Chemin : backend/src/main.ts

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
import { join } from 'path'; // ✨ NOUVEAU : Import pour gérer les chemins de fichiers

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(),
    );

    // ========================================
    // ✨ NOUVEAU : Configuration pour servir les fichiers uploadés (photos)
    // ========================================
    // Cela permet au frontend de pouvoir afficher les photos en utilisant une URL comme :
    // http://localhost:3000/uploads/mayor-photos/mayor-123456789.jpg
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
      prefix: '/uploads/', // Les fichiers seront accessibles via /uploads/...
    });

    // Configuration de la validation automatique des données
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // Supprime les propriétés non définies dans le DTO
        forbidNonWhitelisted: true, // Rejette les requêtes avec des propriétés non autorisées
        transform: true, // Transforme automatiquement les types
        transformOptions: {
          enableImplicitConversion: true, // Convertit automatiquement les types primitifs
        },
      }),
    );
    
    // Filtre global pour gérer les erreurs HTTP
    app.useGlobalFilters(new HttpExceptionFilter());

    // Configuration de la sécurité avec Helmet
    // ⚠️ MODIFIÉ : Ajout de 'blob:' pour permettre l'affichage des images uploadées
    app.use(
      helmet.default({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'], // ✨ Ajout de 'blob:' pour les images
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
          },
        },
      }),
    );

    // Configuration du CORS (Cross-Origin Resource Sharing)
    // Permet au frontend de communiquer avec le backend
    app.enableCors({
      origin: [
        'http://localhost:3001', // Frontend sur le port 3001
      ],
      methods: 'GET,POST,PUT,DELETE', // Méthodes HTTP autorisées
      credentials: true, // Autorise l'envoi de cookies
    });

    // Démarrage du serveur sur le port 3000 (ou celui défini dans .env)
    const port = process.env.PORT || 3000;
    console.log(
      `🚀 Server running on http://localhost:${port} in ${process.env.NODE_ENV || 'development'} mode`,
    );

    await app.listen(port);
  } catch (error) {
    console.error('❌ Failed to bootstrap the application:', error.stack);
    process.exit(1);
  }
}
bootstrap();
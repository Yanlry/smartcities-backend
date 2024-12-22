import { Injectable, OnModuleInit, OnModuleDestroy, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'], // Active les logs Prisma
    });
  }

  async onModuleInit() {
    try {
      console.log('Tentative de connexion à la base de données...');
      await this.$connect();
      console.log('Connexion réussie à la base de données.');
    } catch (error) {
      console.error('Erreur lors de la connexion à la base de données :', error.message);

      // Reconnexion après un délai (en cas de problème temporaire)
      console.log('Nouvelle tentative de connexion dans 5 secondes...');
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Délai de 5 secondes
      try {
        await this.$connect();
        console.log('Connexion réussie après une seconde tentative.');
      } catch (retryError) {
        console.error(
          'Échec de la reconnexion à la base de données :',
          retryError.message
        );
        process.exit(1); // Arrête l'application si la base est inaccessible
      }
    }
  }

  async onModuleDestroy() {
    try {
      console.log('Déconnexion de la base de données...');
      await this.$disconnect();
      console.log('Déconnexion réussie.');
    } catch (error) {
      console.error('Erreur lors de la déconnexion de la base de données :', error.message);
    }
  }

  async onApplicationShutdown() {
    try {
      console.log('Déconnexion de la base de données lors de la fermeture de l\'application...');
      await this.$disconnect();
      console.log('Déconnexion réussie à la fermeture.');
    } catch (error) {
      console.error('Erreur lors de la déconnexion à la fermeture :', error.message);
    }
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) { }

  // S'ABONNER À UNE ZONE GÉOGRAPHIQUE (VILLE, LATITUDE, LONGITUDE, RADIUS)
  async subscribeToRegion({ userId, city, latitude, longitude, radius }: { userId: number; city?: string; latitude?: number; longitude?: number; radius?: number }) {
    return this.prisma.notificationSubscription.create({
      data: {
        userId,
        city,
        latitude,
        longitude,
        radius,
      },
    });
  }

  // OBTENIR LES ABONNEMENTS D'UN UTILISATEUR
  async getUserSubscriptions(userId: number) {
    return this.prisma.notificationSubscription.findMany({
      where: { userId },
      select: {
        city: true,
        latitude: true,
        longitude: true,
        radius: true,
        createdAt: true,
      },
    });
  }

  // Créer une notification spécifique pour les actions de l'utilisateur
  async createNotification(userId: number, message: string, type: string, relatedId: number) {
    return this.prisma.notification.create({
      data: {
        userId,
        message,
        isRead: false,
        type,  // Type de notification : "vote", "commentaire", "signalement mis à jour", etc.
        relatedId, // Id lié à l'élément que la notification concerne
      },
    });
  }

  async updateReportOrEventAndNotify(type: 'report' | 'event', id: number, data: any) {
    const updated = type === 'report'
      ? await this.prisma.report.update({ where: { id }, data })
      : await this.prisma.event.update({ where: { id }, data });
  
    const message = `${type === 'report' ? 'Signalement' : 'Événement'} mis à jour (ID : ${id})`;
  
    let organizerId: number | undefined;
  
    if (type === 'event') {
      // Récupère l'`organizerId` seulement si c'est un événement
      const event = await this.prisma.event.findUnique({
        where: { id },
        select: { organizerId: true },
      });
  
      if (!event) throw new NotFoundException("Événement non trouvé");
      
      organizerId = event.organizerId; // Assigner l'ID de l'organisateur
    }
  
    // Récupérer les abonnés ou participants à notifier
    const subscribers = await this.prisma.notificationSubscription.findMany({
      where: { userId: { not: organizerId } }, // Ne pas inclure l'organisateur dans les notifications
    });
  
    for (const subscriber of subscribers) {
      await this.createNotification(subscriber.userId, message, type, id);
    }
  
    return updated;
  }
  
  // OBTENIR LES NOTIFICATIONS D'UN UTILISATEUR
  async getNotifications(userId: number) {
    return await this.prisma.notification.findMany({
      where: { userId },
    });
  }

  // Récupérer les abonnés (excluant l'utilisateur lui-même)
  async getSubscribers(excludingUserId: number) {
    return this.prisma.notificationSubscription.findMany({
      where: {
        userId: {
          not: excludingUserId, // Exclure l'utilisateur qui envoie la notification
        },
      },
      select: {
        userId: true, // Récupérer uniquement l'ID des abonnés
      },
    });
  }

  // MARQUER TOUTES LES NOTIFICATIONS D'UN UTILISATEUR COMME LUES
  async markAllAsRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: { userId },
      data: { isRead: true },
    });
    return { message: 'Toutes les notifications ont été marquées comme lues.' };
  }

  // MARQUER UNE NOTIFICATION SPÉCIFIQUE COMME LUE
  async markNotificationAsRead(notificationId: number) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  // OBTENIR UNE NOTIFICATION PAR SON ID
  async getNotificationById(notificationId: number) {
    return this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
  }

  // TODO : ABONNEMENT AUX NOTIFICATIONS DE PROXIMITÉ 
  async subscribeToNotifications(userId: number) {
    // Logique d'abonnement (par exemple, ajouter une préférence de notification pour l'utilisateur)
    return { message: "Abonnement aux notifications de proximité réussi." };
  }

  // SE DÉSABONNER D'UN ABONNEMENT SPÉCIFIQUE PAR SON ID
  async unsubscribeFromSpecific(subscriptionId: number, userId: number) {

    const id = parseInt(subscriptionId.toString(), 10);
    if (isNaN(id)) {
      throw new BadRequestException("L'ID de l'abonnement est invalide");
    }

    const subscription = await this.prisma.notificationSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Abonnement non trouvé');
    }

    if (subscription.userId !== userId) {
      throw new BadRequestException('Vous ne pouvez pas supprimer cet abonnement');
    }

    await this.prisma.notificationSubscription.delete({
      where: { id },
    });

    return { message: 'Abonnement supprimé avec succès' };
  }

  // SE DÉSABONNER DE TOUTES LES NOTIFICATIONS D'UN UTILISATEUR
  async unsubscribeFromNotifications(userId: number) {

    const deletedSubscriptions = await this.prisma.notificationSubscription.deleteMany({
      where: { userId },
    });


    if (deletedSubscriptions.count === 0) {
      throw new NotFoundException('Aucun abonnement trouvé pour cet utilisateur.');
    }

    return { message: "Désabonnement des notifications réussi." };
  }
}

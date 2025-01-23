import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException, 
  Inject,
  forwardRef
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service'; 

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => UserService)) 
    private readonly userService: UserService
  ) {}

  // S'ABONNER À UNE ZONE GÉOGRAPHIQUE (VILLE, LATITUDE, LONGITUDE, RADIUS)
  async subscribeToRegion({
    userId,
    city,
    latitude,
    longitude,
    radius,
  }: {
    userId: number;
    city?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
  }) {
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

  async getUnreadNotifications(userId: number) {
    const unreadNotifications = await this.prisma.notification.findMany({
      where: {
        userId,
        isRead: false, 
      },
      include: {
        initiator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            useFullName: true,
            photos: {
              where: { isProfile: true },
              select: {
                id: true,
                url: true,
              },
            },
          },
        },
      },
    });
  
    return unreadNotifications.map((notif) => ({
      id: notif.id,
      message: notif.message,
      type: notif.type,
      createdAt: notif.createdAt,
      isRead: notif.isRead,
      initiator: notif.initiator
        ? {
            id: notif.initiator.id,
            username: notif.initiator.username,
            name: notif.initiator.useFullName
              ? `${notif.initiator.firstName} ${notif.initiator.lastName}`
              : notif.initiator.username,
            profilePhoto: notif.initiator.photos[0]?.url || null,
          }
        : null,
    }));
  }

  async getUnreadCount(userId: number): Promise<number> {
    try {
      return await this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });
    } catch (error) {
      console.error('Erreur dans getUnreadCount :', error.message, error.stack);
      throw new Error('Erreur dans getUnreadCount');
    }
  }

  // OBTENIR TOUTES LES NOTIFICATIONS D'UN UTILISATEUR (LUES ET NON LUES)
  async getAllNotifications(userId: number) {
    return this.prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
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

  async createNotification(
    userId: number,
    message: string,
    type: string,
    relatedId: number | string, 
    initiatorId?: number
) {
    try {
        console.log('Création d\'une notification avec les données :', { userId, message, type, relatedId, initiatorId });
        const notification = await this.prisma.notification.create({
            data: {
                userId,
                message,
                isRead: false,
                type,
                relatedId: String(relatedId),
                initiatorId,
            },
        });
        console.log('Notification créée dans la base de données :', notification);
        return notification;
    } catch (error) {
        console.error('Erreur Prisma lors de la création de la notification :', error);
        throw new Error('Erreur lors de la création de la notification');
    }
}

  async updateReportOrEventAndNotify(
    type: 'report' | 'event',
    id: number,
    data: any
  ) {
    const updated =
      type === 'report'
        ? await this.prisma.report.update({ where: { id }, data })
        : await this.prisma.event.update({ where: { id }, data });

    const message = `${type === 'report' ? 'Signalement' : 'Événement'} mis à jour (ID : ${id})`;

    let organizerId: number | undefined;

    if (type === 'event') {
      const event = await this.prisma.event.findUnique({
        where: { id },
        select: { organizerId: true },
      });

      if (!event) throw new NotFoundException('Événement non trouvé');

      organizerId = event.organizerId; 
    }

    const subscribers = await this.prisma.notificationSubscription.findMany({
      where: { userId: { not: organizerId } }, 
    });

    for (const subscriber of subscribers) {
      await this.createNotification(subscriber.userId, message, type, id);
    }

    return updated;
  }

  async getNotifications(userId: number) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      include: {
        initiator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            useFullName: true,
            photos: {
              where: { isProfile: true },
              select: { url: true },
            },
          },
        },
      },
    });
  
    return notifications.map((notif) => ({
      id: notif.id,
      message: notif.message,
      isRead: notif.isRead,
      createdAt: notif.createdAt,
      type: notif.type,
      relatedId: notif.relatedId,
      initiator: notif.initiator
        ? {
            id: notif.initiator.id,
            username: notif.initiator.username,
            name: notif.initiator.useFullName
              ? `${notif.initiator.firstName} ${notif.initiator.lastName}`
              : notif.initiator.username,
            profilePhoto: notif.initiator.photos[0]?.url || null,
          }
        : null,
    }));
  }
  
  async getNotificationsWithInitiatorDetails(userId: number) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      include: {
        initiator: true,
      },
    });

    const enrichedNotifications = await Promise.all(
      notifications.map(async (notification) => {
        if (!notification.initiatorId) {
          return {
            ...notification,
            initiatorDetails: null,
          };
        }

        const initiatorDetails = await this.userService.getUserById(notification.initiatorId);

        return {
          ...notification,
          initiatorDetails,
        };
      })
    );

    return enrichedNotifications;
  }
  
  async getSubscribers(excludingUserId: number) {
    return this.prisma.notificationSubscription.findMany({
      where: {
        userId: {
          not: excludingUserId, 
        },
      },
      select: {
        userId: true, 
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
    return { message: 'Abonnement aux notifications de proximité réussi.' };
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
      throw new BadRequestException(
        'Vous ne pouvez pas supprimer cet abonnement'
      );
    }

    await this.prisma.notificationSubscription.delete({
      where: { id },
    });

    return { message: 'Abonnement supprimé avec succès' };
  }

  async deleteNotification(
    notificationId: number,
    userId: number
  ): Promise<{ message: string }> {
    console.log('Demande de suppression pour :', { notificationId, userId });
  
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
  
    console.log('Notification trouvée :', notification);
  
    if (!notification) {
      console.error('Notification introuvable pour ID :', notificationId);
      throw new NotFoundException('Notification introuvable.');
    }
  
    if (notification.userId !== userId) {
      console.error('Utilisateur non autorisé à supprimer cette notification :', {
        notificationUserId: notification.userId,
        userId,
      });
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer cette notification.'
      );
    }
  
    try {
      const deletedNotification = await this.prisma.notification.delete({
        where: { id: notificationId },
      });
      console.log('Notification supprimée :', deletedNotification);
      return { message: 'Notification supprimée avec succès.' };
    } catch (error) {
      console.error('Erreur Prisma lors de la suppression :', error.message);
      throw new InternalServerErrorException(
        'Erreur interne lors de la suppression.'
      );
    }
  }

  // SE DÉSABONNER DE TOUTES LES NOTIFICATIONS D'UN UTILISATEUR
  async unsubscribeFromNotifications(userId: number) {
    const deletedSubscriptions =
      await this.prisma.notificationSubscription.deleteMany({
        where: { userId },
      });

    if (deletedSubscriptions.count === 0) {
      throw new NotFoundException(
        'Aucun abonnement trouvé pour cet utilisateur.'
      );
    }

    return { message: 'Désabonnement des notifications réussi.' };
  }
}

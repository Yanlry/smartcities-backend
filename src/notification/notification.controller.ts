import {
  Controller,
  Get,
  Body,
  Param,
  Post,
  Delete,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) { }

  // POST /notifications/create
  @Post('/create')
  async create(@Body() notificationData: { userId: number, message: string, type: string, relatedId: number }) {
    // Appeler la méthode createNotification du service
    return this.notificationService.createNotification(notificationData.userId, notificationData.message, notificationData.type, notificationData.relatedId);
  }

  // POST /notifications/send (Envoi aux utilisateurs concernés)
  @Post('/send')
  async sendNotifications(
    @Body() notificationData: { userId: number, message: string, type: string, relatedId: number }
  ) {
    // Récupérer les abonnés sauf l'utilisateur qui envoie la notification
    const subscribers = await this.notificationService.getSubscribers(notificationData.userId);  // Utiliser le service pour obtenir les abonnés

    // Envoyer une notification à chaque abonné
    for (const subscriber of subscribers) {
      await this.notificationService.createNotification(subscriber.userId, notificationData.message, notificationData.type, notificationData.relatedId);
    }

    return { message: 'Notifications envoyées' };
  }

  // S'ABONNER AUX NOTIFICATIONS PAR ZONE GEOGRAPHIQUE (VILLES, LATITUDE, LONGITUDE, RADIUS)
  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async subscribeToRegion(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      city?: string;
      latitude?: number;
      longitude?: number;
      radius?: number;
    }
  ) {
    const userId = request.user.id;
    return this.notificationService.subscribeToRegion({ userId, ...body });
  }

  // RECUPERER LES ABONNEMENTS DE L'UTILISATEUR
  @UseGuards(JwtAuthGuard)
  @Get('subscriptions')
  async getUserSubscriptions(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    return this.notificationService.getUserSubscriptions(userId);
  }

  // RECUPERER LES NOTIFICATIONS DE L'UTILISATEUR CONNECTE
  @UseGuards(JwtAuthGuard)
  @Get()
  async getNotifications(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    return this.notificationService.getNotifications(userId);
  }

  // MARQUER UNE NOTIFICATION SPECIFIQUE COMME LUE
  @UseGuards(JwtAuthGuard)
  @Post(':id/mark-read')
  async markNotificationAsRead(
    @Param('id') notificationId: string, // Paramètre reçu en tant que chaîne
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user.id;
    const id = parseInt(notificationId, 10);
    if (isNaN(id)) {
      throw new BadRequestException("L'ID de la notification est invalide");
    }

    const notification = await this.notificationService.getNotificationById(id);
    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }

    if (notification.userId !== userId) {
      throw new BadRequestException(
        'Vous ne pouvez pas lire cette notification'
      );
    }
    return this.notificationService.markNotificationAsRead(id);
  }

  // MARQUER TOUTES LES NOTIFICATIONS COMME LUES
  @UseGuards(JwtAuthGuard)
  @Post('mark-all-read')
  async markAllNotificationsAsRead(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    return this.notificationService.markAllAsRead(userId);
  }

  // SE DESABONNER D'UNE NOTIFICATION SPECIFIQUE PAR ID
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async unsubscribeFromSpecific(
    @Param('id') subscriptionId: number,
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user.id;
    return this.notificationService.unsubscribeFromSpecific(
      subscriptionId,
      userId
    );
  }

  // SE DESABONNER DES NOTIFICATIONS DE L'UTILISATEUR CONNECTE
  @UseGuards(JwtAuthGuard)
  @Delete('unsubscribe')
  async unsubscribeFromNotifications(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    return this.notificationService.unsubscribeFromNotifications(userId);
  }
}

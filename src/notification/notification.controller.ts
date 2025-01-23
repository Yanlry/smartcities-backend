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
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('/create')
  async create(
    @Body()
    notificationData: {
      userId: number;
      message: string;
      type: string;
      relatedId: string;
      initiatorId?: number;
    }
  ) {
    console.log(
      'Données reçues pour créer une notification :',
      notificationData
    );

    try {
      const notification = await this.notificationService.createNotification(
        notificationData.userId,
        notificationData.message,
        notificationData.type,
        notificationData.relatedId,
        notificationData.initiatorId
      );
      console.log('Notification créée avec succès :', notification);
      return notification;
    } catch (error) {
      console.error('Erreur lors de la création de la notification :', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getNotifications(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    return this.notificationService.getNotificationsWithInitiatorDetails(
      userId
    );
  }

  // MARQUER UNE NOTIFICATION COMME LUE
  @UseGuards(JwtAuthGuard)
  @Post(':id/mark-read')
  async markNotificationAsRead(
    @Param('id', ParseIntPipe) notificationId: number,
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user.id;
    return this.notificationService.markNotificationAsRead(notificationId);
  }

  // MARQUER TOUTES LES NOTIFICATIONS COMME LUES
  @UseGuards(JwtAuthGuard)
  @Post('mark-all-read')
  async markAllNotificationsAsRead(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    return this.notificationService.markAllAsRead(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async deleteNotification(
    @Param('id', ParseIntPipe) notificationId: number,
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user.id;
    await this.notificationService.deleteNotification(notificationId, userId);
  }

  // RÉCUPÉRER LES NOTIFICATIONS NON LUES
  @UseGuards(JwtAuthGuard)
  @Get('unread')
  async getUnreadNotifications(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    return this.notificationService.getUnreadNotifications(userId);
  }

  @Get('unread/count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Req() request: AuthenticatedRequest) {
    console.log('Request.user :', request.user);
    if (!request.user) {
      throw new BadRequestException('Utilisateur non authentifié.');
    }
    const userId = request.user.id; 
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  // S'ABONNER AUX NOTIFICATIONS (PAR ZONE GÉOGRAPHIQUE)
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

  // RÉCUPÉRER LES ABONNEMENTS DE L'UTILISATEUR
  @UseGuards(JwtAuthGuard)
  @Get('subscriptions')
  async getUserSubscriptions(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    return this.notificationService.getUserSubscriptions(userId);
  }

  // SE DÉSABONNER D'UN ABONNEMENT
  @UseGuards(JwtAuthGuard)
  @Delete('subscriptions/:id')
  async unsubscribeFromSpecific(
    @Param('id', ParseIntPipe) subscriptionId: number,
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user.id;
    return this.notificationService.unsubscribeFromSpecific(
      subscriptionId,
      userId
    );
  }

  // SE DÉSABONNER DE TOUS LES ABONNEMENTS
  @UseGuards(JwtAuthGuard)
  @Delete('unsubscribe')
  async unsubscribeFromNotifications(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    return this.notificationService.unsubscribeFromNotifications(userId);
  }
}

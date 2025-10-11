// Chemin : backend/src/mails/mail.controller.ts

import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mails')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  /**
   * API pour envoyer un email avec style amélioré.
   * 
   * ✅ Support COMPLET pour signaler:
   * - Un profil (userId)
   * - Une conversation (conversationId)
   * - Un commentaire (commentId)
   * - Un rapport (reportId)
   * - Un événement (eventId) 🆕
   */
  @Post('send')
  async sendEmail(
    @Body()
    body: {
      to: string;
      subject: string;
      reporterId: string;
      reportReason: string;
      userId?: string; 
      conversationId?: string;
      commentId?: string;
      reportId?: string;
      eventId?: string;              // 🆕 AJOUT : Support pour signaler un événement
    },
  ) {
    console.log('📧 Données reçues dans le backend :', body);
  
    // On récupère TOUTES les informations
    const { 
      to, 
      subject, 
      reporterId, 
      reportReason, 
      userId, 
      conversationId, 
      commentId,
      reportId,
      eventId                         // 🆕 On récupère eventId
    } = body;
  
    // ✅ Validation : Au moins UN des ID doit être fourni
    if (!reporterId || !reportReason || (!userId && !conversationId && !commentId && !reportId && !eventId)) {
      throw new BadRequestException(
        "❌ Les données de signalement sont incomplètes. Un 'userId', 'conversationId', 'commentId', 'reportId', ou 'eventId' est requis.",
      );
    }
  
    // ✅ On envoie TOUTES les données au service email
    await this.mailService.sendEmail(to, subject, {
      reporterId,
      reportReason,
      userId,
      conversationId,
      commentId,
      reportId,
      eventId,                        // 🆕 On passe eventId au service
    });
  
    return { message: '✅ Email envoyé avec succès' };
  }
}
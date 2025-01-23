import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mails')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  /**
   * API pour envoyer un email avec style amélioré.
   * @param body - Corps de la requête contenant les informations de l'email
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
    },
  ) {
    console.log('Données reçues dans le backend :', body);
  
    const { to, subject, reporterId, reportReason, userId, conversationId, commentId } = body;
  
    if (!reporterId || !reportReason || (!userId && !conversationId && !commentId)) {
      throw new BadRequestException(
        "Les données de signalement sont incomplètes. Un 'userId', 'conversationId', ou 'commentId' est requis.",
      );
    }
  
    await this.mailService.sendEmail(to, subject, {
      reporterId,
      reportReason,
      userId,
      conversationId,
      commentId, 
    });
  
    return { message: 'Email envoyé avec succès' };
  }
}
import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mails')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  /**
   * API pour envoyer un email avec style amélioré.
   * 
   * ✅ CORRIGÉ : Supporte maintenant AUSSI le signalement de rapports (reportId)
   * 
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
      reportId?: string;          // ✅ AJOUT : Support pour signaler un rapport
    },
  ) {
    console.log('Données reçues dans le backend :', body);
  
    // ✅ CORRECTION : On récupère AUSSI reportId maintenant
    const { 
      to, 
      subject, 
      reporterId, 
      reportReason, 
      userId, 
      conversationId, 
      commentId,
      reportId                     // ✅ AJOUT : On récupère reportId
    } = body;
  
    // ✅ CORRECTION : On accepte AUSSI reportId dans la validation
    // AVANT : if (!reporterId || !reportReason || (!userId && !conversationId && !commentId))
    // APRÈS : On ajoute reportId dans la condition
    if (!reporterId || !reportReason || (!userId && !conversationId && !commentId && !reportId)) {
      throw new BadRequestException(
        "Les données de signalement sont incomplètes. Un 'userId', 'conversationId', 'commentId', ou 'reportId' est requis.",
      );
    }
  
    // ✅ CORRECTION : On envoie AUSSI reportId au service
    await this.mailService.sendEmail(to, subject, {
      reporterId,
      reportReason,
      userId,
      conversationId,
      commentId,
      reportId,                    // ✅ AJOUT : On passe reportId au service
    });
  
    return { message: 'Email envoyé avec succès' };
  }
}
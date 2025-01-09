import { Injectable } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class MailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
  }

  /**
   * Envoie un email à un destinataire avec un style professionnel.
   * @param to - Adresse email du destinataire
   * @param subject - Sujet de l'email
   * @param text - Texte brut de l'email
   * @param data - Données supplémentaires pour personnalisation
   */
  async sendEmail(
    to: string,
    subject: string,
    data: {
      reporterId: string;
      userId?: string;
      conversationId?: string;
      commentId?: string;
      reportReason: string;
    }
  ): Promise<void> {
    const { reporterId, userId, conversationId, commentId, reportReason } = data;
  
    try {
      console.log('Données utilisées pour générer l\'email :', {
        to,
        subject,
        reporterId,
        userId,
        conversationId,
        commentId,
        reportReason,
      });
  
      const styledHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f4f6f9;
                color: #333;
              }
              .container {
                max-width: 700px;
                margin: 30px auto;
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
                overflow: hidden;
              }
              .header {
                background-color: #FF4747;
                color: #ffffff;
                padding: 20px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 24px;
                text-transform: uppercase;
                letter-spacing: 2px;
              }
              .content {
                padding: 30px;
                line-height: 1.8;
              }
              .content h2 {
                font-size: 18px;
                color: #FF4747;
                margin-top: 0;
              }
              .details {
                margin: 20px 0;
                padding: 15px;
                background: #f9f9f9;
                border: 1px solid #ddd;
                border-radius: 8px;
              }
              .details p {
                margin: 5px 0;
                font-size: 14px;
              }
              .details strong {
                color: #FF4747;
              }
              .footer {
                background: #f1f1f1;
                padding: 15px;
                text-align: center;
                font-size: 12px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Signalement Reçu</h1>
              </div>
              <div class="content">
                <h2>Détails du signalement :</h2>
                <div class="details">
                  ${userId ? `<p><strong>Type :</strong> Profil signalé</p>` : ''}
                  ${conversationId ? `<p><strong>Type :</strong> Conversation signalée</p>` : ''}
                  ${commentId ? `<p><strong>Type :</strong> Commentaire signalé</p>` : ''}
                  ${userId ? `<p><strong>ID du profil :</strong> ${userId}</p>` : ''}
                  ${conversationId ? `<p><strong>ID de la conversation :</strong> ${conversationId}</p>` : ''}
                  ${commentId ? `<p><strong>ID du commentaire :</strong> ${commentId}</p>` : ''}
                  <p><strong>Signalé par :</strong> ${reporterId}</p>
                  <p><strong>Raison :</strong> ${reportReason}</p>
                </div>
                <p>Merci de prendre les mesures nécessaires pour résoudre ce signalement.</p>
              </div>
              <div class="footer">
                <p>© 2025 SmartCities. Tous droits réservés.</p>
                <p>Pour toute question, contactez-moi directement à <a href="mailto:yannleroy23@gmail.com">yannleroy23@gmail.com</a>.</p>
              </div>
            </div>
          </body>
        </html>`;
  
      const msg = {
        to,
        from: 'yannleroy23@gmail.com',
        subject,
        text: `${commentId ? `Commentaire signalé : ${commentId}` : ''}, Raison : ${reportReason}`,
        html: styledHtml,
      };
  
      console.log('Envoi du message avec les données :', msg);
  
      await sgMail.send(msg);
      console.log(`Email envoyé à : ${to}`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email :', error.response?.body || error.message);
      throw new Error('Échec de l\'envoi de l\'email.');
    }
  }
}
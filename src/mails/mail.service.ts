import { Injectable } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class MailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
  }

  /**
   * Envoie un email à un destinataire.
   * @param to - Adresse email du destinataire
   * @param subject - Sujet de l'email
   * @param text - Texte brut de l'email
   * @param html - Contenu HTML de l'email
   */
  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    const msg = {
      to,
      from: 'yannleroy23@gmail.com', // Adresse email vérifiée dans votre compte SendGrid
      subject,
      text,
      html,
    };

    try {
      await sgMail.send(msg);
      console.log(`Email envoyé à : ${to}`);
    } catch (error) {
      console.error(
        'Erreur lors de l\'envoi de l\'email:',
        error.response?.body || error.message,
      );
      throw new Error('Échec de l\'envoi de l\'email.');
    }
  }
}
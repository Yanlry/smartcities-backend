import { Injectable } from '@nestjs/common';
// ✅ IMPORT CORRECT pour Mailjet avec TypeScript/NestJS
const Mailjet = require('node-mailjet');

@Injectable()
export class MailService {
  // Variable pour stocker l'instance Mailjet
  private mailjet: any;

  constructor() {
    // ✅ Configuration de Mailjet avec tes clés API
    // On utilise .apiConnect() qui est la méthode recommandée
    this.mailjet = Mailjet.apiConnect(
      process.env.MAILJET_API_KEY || '',
      process.env.MAILJET_SECRET_KEY || ''
    );
  }

  /**
   * Envoie un email à un destinataire avec un style professionnel.
   * 
   * ✅ CORRIGÉ : Gère maintenant AUSSI le signalement de rapports
   * 
   * @param to - Adresse email du destinataire (qui recevra le signalement)
   * @param subject - Sujet de l'email
   * @param data - Toutes les informations sur le signalement
   */
  async sendEmail(
    to: string,
    subject: string,
    data: {
      reporterId: string;      // ID de la personne qui signale
      userId?: string;          // ID du profil signalé (optionnel)
      conversationId?: string;  // ID de la conversation signalée (optionnel)
      commentId?: string;       // ID du commentaire signalé (optionnel)
      reportId?: string;        // ✅ AJOUT : ID du rapport signalé (optionnel)
      reportReason: string;     // Raison du signalement
    }
  ): Promise<void> {
    // ✅ CORRECTION : On récupère AUSSI reportId maintenant
    const { 
      reporterId, 
      userId, 
      conversationId, 
      commentId, 
      reportId,                 // ✅ AJOUT : On récupère reportId
      reportReason 
    } = data;
  
    try {
      // On affiche dans la console ce qu'on va envoyer (utile pour déboguer)
      console.log('📧 Préparation de l\'email avec les données suivantes :', {
        to,
        subject,
        reporterId,
        userId,
        conversationId,
        commentId,
        reportId,               // ✅ AJOUT : On affiche reportId dans les logs
        reportReason,
      });
  
      // ✅ Template HTML de l'email (design professionnel)
      // ✅ CORRIGÉ : On ajoute le support de reportId dans le HTML
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
                background: #F2F4F7;
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
                  ${userId ? `<p><strong>Type :</strong> Profil inaproprié</p>` : ''}
                  ${conversationId ? `<p><strong>Type :</strong> Conversation inaproprié</p>` : ''}
                  ${commentId ? `<p><strong>Type :</strong> Commentaire inaproprié</p>` : ''}
                  ${reportId ? `<p><strong>Type :</strong> Signalement inaproprié</p>` : ''}
                  ${userId ? `<p><strong>ID du profil :</strong> ${userId}</p>` : ''}
                  ${conversationId ? `<p><strong>ID de la conversation :</strong> ${conversationId}</p>` : ''}
                  ${commentId ? `<p><strong>ID du commentaire :</strong> ${commentId}</p>` : ''}
                  ${reportId ? `<p><strong>ID du signalement :</strong> ${reportId}</p>` : ''}
                  <p><strong>Signalé par l'utilsateur numéro :</strong> ${reporterId}</p>
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
  
      // ✅ ENVOI DE L'EMAIL AVEC MAILJET
      // C'est ici qu'on envoie vraiment l'email
      const request = await this.mailjet
        .post('send', { version: 'v3.1' })  // On utilise l'API v3.1 de Mailjet
        .request({
          Messages: [  // On peut envoyer plusieurs messages, mais ici on en envoie qu'un seul
            {
              From: {  // L'expéditeur de l'email
                Email: process.env.MAILJET_SENDER_EMAIL || 'yannleroy23@gmail.com',
                Name: 'SmartCities Support',  // Le nom affiché comme expéditeur
              },
              To: [  // Le destinataire (ou les destinataires)
                {
                  Email: to,  // L'adresse email du destinataire
                  Name: 'Administrateur',  // Le nom du destinataire
                },
              ],
              Subject: subject,  // Le sujet de l'email
              // ✅ CORRECTION : On inclut reportId dans le texte brut aussi
              TextPart: `${commentId ? `Commentaire signalé : ${commentId}` : ''}${reportId ? `Rapport signalé : ${reportId}` : ''}, Raison : ${reportReason}`,
              HTMLPart: styledHtml,  // Version HTML avec le beau design
            },
          ],
        });
  
      // ✅ Si tout s'est bien passé, on affiche un message de succès
      console.log('✅ Email envoyé avec succès via Mailjet à :', to);
      console.log('📬 Réponse de Mailjet :', request.body);
      
    } catch (error) {
      // ❌ Si une erreur se produit, on l'affiche dans la console
      console.error('❌ Erreur lors de l\'envoi de l\'email avec Mailjet :');
      console.error('Code d\'erreur :', error.statusCode);
      console.error('Message d\'erreur :', error.message);
      
      // On renvoie l'erreur pour que l'application sache que ça n'a pas fonctionné
      throw new Error('Échec de l\'envoi de l\'email.');
    }
  }
}
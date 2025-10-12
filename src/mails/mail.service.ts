// Chemin : backend/src/mails/mail.service.ts

import { Injectable } from '@nestjs/common';
const Mailjet = require('node-mailjet');

@Injectable()
export class MailService {
  private mailjet: any;

  constructor() {
    this.mailjet = Mailjet.apiConnect(
      process.env.MAILJET_API_KEY || '',
      process.env.MAILJET_SECRET_KEY || ''
    );
  }

  /**
   * Envoie un email à un destinataire avec un style professionnel.
   * 
   * ✅ Support COMPLET pour signaler:
   * - Un profil (userId)
   * - Une conversation (conversationId)
   * - Un commentaire (commentId)
   * - Un rapport (reportId)
   * - Un événement (eventId)
   */
  async sendEmail(
    to: string,
    subject: string,
    data: {
      reporterId: string;
      userId?: string;
      conversationId?: string;
      commentId?: string;
      reportId?: string;
      eventId?: string;
      reportReason: string;
    }
  ): Promise<void> {
    const { 
      reporterId, 
      userId, 
      conversationId, 
      commentId, 
      reportId,
      eventId,
      reportReason 
    } = data;
  
    try {
      console.log('📧 Préparation de l\'email avec les données suivantes :', {
        to,
        subject,
        reporterId,
        userId,
        conversationId,
        commentId,
        reportId,
        eventId,
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
                <h1>🚨 ALERTE 🚨</h1>
              </div>
              <div class="content">
                <h2>Détails du signalement :</h2>
                <div class="details">
                  ${userId ? `<p><strong>Type :</strong> 👤 Profil inapproprié</p>` : ''}
                  ${conversationId ? `<p><strong>Type :</strong> 💬 Conversation inappropriée</p>` : ''}
                  ${commentId ? `<p><strong>Type :</strong> 💭 Commentaire inapproprié</p>` : ''}
                  ${reportId ? `<p><strong>Type :</strong> 📋 Signalement inapproprié</p>` : ''}
                  ${eventId ? `<p><strong>Type :</strong> 📅 Événement inapproprié</p>` : ''}
                  ${userId ? `<p><strong>ID du profil :</strong> ${userId}</p>` : ''}
                  ${conversationId ? `<p><strong>ID de la conversation :</strong> ${conversationId}</p>` : ''}
                  ${commentId ? `<p><strong>ID du commentaire :</strong> ${commentId}</p>` : ''}
                  ${reportId ? `<p><strong>ID du signalement :</strong> ${reportId}</p>` : ''}
                  ${eventId ? `<p><strong>ID de l'événement :</strong> ${eventId}</p>` : ''}
                  <p><strong>Signalé par l'utilisateur numéro :</strong> ${reporterId}</p>
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
  
      const request = await this.mailjet
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: process.env.MAILJET_SENDER_EMAIL || 'yannleroy23@gmail.com',
                Name: 'SmartCities Support',
              },
              To: [
                {
                  Email: to,
                  Name: 'Administrateur',
                },
              ],
              Subject: subject,
              TextPart: `${commentId ? `Commentaire signalé : ${commentId}` : ''}${reportId ? `Rapport signalé : ${reportId}` : ''}${eventId ? `Événement signalé : ${eventId}` : ''}, Raison : ${reportReason}`,
              HTMLPart: styledHtml,
            },
          ],
        });
  
      console.log('✅ Email envoyé avec succès via Mailjet à :', to);
      console.log('📬 Réponse de Mailjet :', request.body);
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'email avec Mailjet :');
      console.error('Code d\'erreur :', error.statusCode);
      console.error('Message d\'erreur :', error.message);
      
      throw new Error('Échec de l\'envoi de l\'email.');
    }
  }

  /**
   * 🆕 Envoie un email quand une mairie s'inscrit (AVEC BOUTONS CLIQUABLES)
   */
  async sendMunicipalityRegistrationEmail(user: any): Promise<void> {
    console.log('🏛️ Préparation de l\'email d\'inscription mairie pour:', user.email);

    // ✅ URL de ton backend (à adapter selon ton environnement)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

    const htmlContent = `
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
              background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
              color: #ffffff;
              padding: 30px;
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
              font-size: 20px;
              color: #6366f1;
              margin-top: 0;
            }
            .details {
              margin: 20px 0;
              padding: 20px;
              background: #F2F4F7;
              border-left: 4px solid #6366f1;
              border-radius: 4px;
            }
            .details p {
              margin: 8px 0;
              font-size: 15px;
            }
            .details strong {
              color: #4f46e5;
              font-weight: 600;
            }
            .buttons-container {
              text-align: center;
              margin: 30px 0;
            }
            .button {
              display: inline-block;
              margin: 10px;
              padding: 15px 40px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              transition: all 0.3s ease;
            }
            .button-approve {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
            }
            .button-approve:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
            }
            .button-reject {
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
              color: white;
            }
            .button-reject:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
            }
            .footer {
              background: #f1f1f1;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏛️ NOUVELLE DEMANDE MAIRIE</h1>
            </div>
            <div class="content">
              <h2>Une nouvelle mairie souhaite s'inscrire</h2>
              <p>Une demande d'inscription en tant que mairie vient d'être soumise et nécessite votre validation.</p>
              
              <div class="details">
                <p><strong>Nom de la mairie :</strong> ${user.municipalityName}</p>
                <p><strong>Numéro SIREN :</strong> ${user.municipalitySIREN}</p>
                <p><strong>Téléphone :</strong> ${user.municipalityPhone || 'Non renseigné'}</p>
                <p><strong>Adresse :</strong> ${user.municipalityAddress || 'Non renseignée'}</p>
                <p><strong>Ville :</strong> ${user.nomCommune} (${user.codePostal})</p>
                <p><strong>Email :</strong> ${user.email}</p>
                <p><strong>Nom d'utilisateur :</strong> ${user.username}</p>
                <p><strong>ID utilisateur :</strong> ${user.id}</p>
              </div>

              <div class="buttons-container">
                <a href="${backendUrl}/auth/validate-municipality/${user.id}?action=approve" class="button button-approve">
                  ✅ Accepter la demande
                </a>
                <a href="${backendUrl}/auth/validate-municipality/${user.id}?action=reject" class="button button-reject">
                  ❌ Refuser la demande
                </a>
              </div>

              <p style="color: #64748b; font-size: 14px; text-align: center;">
                Cliquez simplement sur l'un des boutons ci-dessus. La mairie sera automatiquement notifiée par email.
              </p>
            </div>
            <div class="footer">
              <p>© 2025 SmartCities. Tous droits réservés.</p>
              <p>Cet email a été envoyé automatiquement. Pour toute question, contactez-nous à <a href="mailto:yannleroy23@gmail.com">yannleroy23@gmail.com</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const request = await this.mailjet
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: process.env.MAILJET_SENDER_EMAIL || 'yannleroy23@gmail.com',
                Name: 'SmartCities - Inscriptions',
              },
              To: [
                {
                  Email: process.env.ADMIN_EMAIL || 'yannleroy23@gmail.com',
                  Name: 'Administrateur SmartCities',
                },
              ],
              Subject: `🏛️ Nouvelle demande mairie - ${user.municipalityName}`,
              HTMLPart: htmlContent,
            },
          ],
        });

      console.log('✅ Email de notification admin envoyé avec succès:', request.body);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'email admin:');
      console.error('Code d\'erreur:', error.statusCode);
      console.error('Message:', error.message);
      console.error('Détails complets:', JSON.stringify(error, null, 2));
      
      throw new Error(`Échec de l'envoi de l'email d'inscription: ${error.message}`);
    }
  }

  /**
   * 🆕 Envoie un email à la mairie pour confirmer que sa demande est ACCEPTÉE
   */
  async sendMunicipalityApprovalEmail(user: any): Promise<void> {
    console.log('✅ Préparation de l\'email d\'approbation pour:', user.email);

    const htmlContent = `
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
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: #ffffff;
              padding: 40px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              letter-spacing: 1px;
            }
            .content {
              padding: 40px;
              line-height: 1.8;
            }
            .success-icon {
              text-align: center;
              font-size: 80px;
              margin: 20px 0;
            }
            .button {
              display: inline-block;
              margin: 20px 0;
              padding: 15px 40px;
              background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
            }
            .footer {
              background: #f1f1f1;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Demande Approuvée !</h1>
            </div>
            <div class="content">
              <div class="success-icon">✅</div>
              <h2 style="color: #10b981; text-align: center;">Félicitations ${user.municipalityName} !</h2>
              <p style="font-size: 16px; text-align: center;">
                Votre demande d'inscription sur SmartCities a été <strong>approuvée</strong> par notre équipe.
              </p>
              <p style="text-align: center;">
                Vous pouvez maintenant vous connecter à votre compte et commencer à utiliser notre plateforme pour gérer les signalements de vos citoyens.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <p><strong>Vos identifiants :</strong></p>
                <p>📧 Email : ${user.email}</p>
                <p>👤 Nom d'utilisateur : ${user.username}</p>
              </div>
              <p style="text-align: center; color: #64748b; font-size: 14px;">
                Bienvenue dans la communauté SmartCities !
              </p>
            </div>
            <div class="footer">
              <p>© 2025 SmartCities. Tous droits réservés.</p>
              <p>Pour toute question, contactez notre support : <a href="mailto:yannleroy23@gmail.com">yannleroy23@gmail.com</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await this.mailjet
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: process.env.MAILJET_SENDER_EMAIL || 'yannleroy23@gmail.com',
                Name: 'SmartCities',
              },
              To: [
                {
                  Email: user.email,
                  Name: user.municipalityName,
                },
              ],
              Subject: '✅ Votre compte SmartCities a été approuvé !',
              HTMLPart: htmlContent,
            },
          ],
        });

      console.log('✅ Email d\'approbation envoyé avec succès à:', user.email);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'email d\'approbation:', error.message);
      throw new Error(`Échec de l'envoi de l'email d'approbation: ${error.message}`);
    }
  }

  /**
   * 🆕 Envoie un email à la mairie pour l'informer que sa demande est REFUSÉE
   */
  async sendMunicipalityRejectionEmail(user: any, reason?: string): Promise<void> {
    console.log('❌ Préparation de l\'email de rejet pour:', user.email);

    const htmlContent = `
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
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
              color: #ffffff;
              padding: 40px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              letter-spacing: 1px;
            }
            .content {
              padding: 40px;
              line-height: 1.8;
            }
            .footer {
              background: #f1f1f1;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Demande Non Approuvée</h1>
            </div>
            <div class="content">
              <p>Bonjour ${user.municipalityName},</p>
              <p>
                Nous avons examiné votre demande d'inscription sur SmartCities, et nous sommes au regret de vous informer qu'elle n'a pas pu être approuvée pour le moment.
              </p>
              ${reason ? `
                <div style="background: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
                  <strong>Raison :</strong> ${reason}
                </div>
              ` : ''}
              <p>
                Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez plus d'informations, n'hésitez pas à nous contacter directement.
              </p>
              <p>Cordialement,<br>L'équipe SmartCities</p>
            </div>
            <div class="footer">
              <p>© 2025 SmartCities. Tous droits réservés.</p>
              <p>Pour toute question, contactez notre support : <a href="mailto:yannleroy23@gmail.com">yannleroy23@gmail.com</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await this.mailjet
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: process.env.MAILJET_SENDER_EMAIL || 'yannleroy23@gmail.com',
                Name: 'SmartCities',
              },
              To: [
                {
                  Email: user.email,
                  Name: user.municipalityName,
                },
              ],
              Subject: 'Mise à jour concernant votre demande SmartCities',
              HTMLPart: htmlContent,
            },
          ],
        });

      console.log('✅ Email de rejet envoyé avec succès à:', user.email);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'email de rejet:', error.message);
      throw new Error(`Échec de l'envoi de l'email de rejet: ${error.message}`);
    }
  }
}
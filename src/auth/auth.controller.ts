// Chemin : backend/src/auth/auth.controller.ts

import {
  Controller,
  Post,
  Body,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Get,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Headers,
  Param,
  Query,
  HttpException,
  Header,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { S3Service } from 'src/services/s3/s3.service';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly s3Service: S3Service
  ) {}

  @Post('check-username')
  async checkUsername(@Body('username') username: string) {
    await this.authService.checkUsernameAvailability(username);
    
    return {
      success: true,
      available: true,
      message: 'Nom d\'utilisateur disponible'
    };
  }

  @Post('check-email')
  async checkEmail(@Body('email') email: string) {
    await this.authService.checkEmailAvailability(email);
    
    return {
      success: true,
      available: true,
      message: 'Adresse email disponible'
    };
  }

  @Post('signup')
  @UseInterceptors(
    FilesInterceptor('photos', 1, {
      limits: { fileSize: 10 * 1024 * 1024 }, 
    })
  )
  async signup(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('lastName') lastName: string,
    @Body('firstName') firstName: string,
    @Body('username') username: string, // ⬅️ Devient optionnel pour les mairies
    @Body('nom_commune') nomCommune: string,
    @Body('code_postal') codePostal: string,
    @Body('latitude') latitude: string,
    @Body('longitude') longitude: string,
    @Body('isMunicipality') isMunicipality: string,
    @Body('municipalityName') municipalityName: string,
    @Body('municipalitySIREN') municipalitySIREN: string,
    @Body('municipalityPhone') municipalityPhone: string,
    @Body('municipalityAddress') municipalityAddress: string,
    @UploadedFiles() photos: Express.Multer.File[]
  ) {
    console.log('📥 Données reçues du frontend :', {
      email,
      username, // ⬅️ Peut être undefined pour les mairies
      nomCommune,
      codePostal,
      latitude,
      longitude,
      isMunicipality,
      municipalityName,
    });

    const latitudeNumber = parseFloat(latitude);
    const longitudeNumber = parseFloat(longitude);

    if (isNaN(latitudeNumber) || isNaN(longitudeNumber)) {
      throw new BadRequestException('Latitude et longitude doivent être des nombres valides.');
    }

    const isMunicipalityBool = isMunicipality === 'true';

    // ✅ NOUVEAU : Si c'est une mairie et pas de username, on passe une chaîne vide
    // Le service va le générer automatiquement
    const finalUsername = isMunicipalityBool && !username ? '' : username;

    let photoUrls: string[] = [];
    
    if (!isMunicipalityBool) {
      const validPhotos = photos?.filter(
        (file) => file.buffer && file.originalname && file.mimetype
      ) || [];

      if (validPhotos.length === 0) {
        throw new BadRequestException('Aucun fichier valide trouvé.');
      }

      for (const photo of validPhotos) {
        try {
          const url = await this.s3Service.uploadFile(photo);
          photoUrls.push(url);
        } catch (error) {
          console.error(`Error uploading file ${photo.originalname}:`, error.message);
          throw new BadRequestException(
            `Erreur lors de l'upload de la photo ${photo.originalname}: ${error.message}`
          );
        }
      }

      console.log('📸 URLs des photos après upload :', photoUrls);
    } else {
      console.log('🏛️ Inscription de mairie - Pas de photo requise');
      console.log(`🏛️ Username sera généré automatiquement pour la ville: ${nomCommune}`);
    }

    return this.authService.signup(
      email,
      password,
      firstName,
      lastName,
      finalUsername, // ⬅️ Peut être vide si mairie, sera généré automatiquement
      photoUrls,
      nomCommune, 
      codePostal, 
      latitudeNumber, 
      longitudeNumber,
      isMunicipalityBool,
      municipalityName,
      municipalitySIREN,
      municipalityPhone,
      municipalityAddress
    );
  }

  /**
   * 🆕 NOUVEL ENDPOINT : Valider ou rejeter une mairie via un lien cliquable
   * ✅ VERSION SIMPLIFIÉE sans @Res() qui marche toujours !
   * 
   * Exemple d'URL :
   * - Approuver : http://localhost:3000/auth/validate-municipality/123?action=approve
   * - Rejeter : http://localhost:3000/auth/validate-municipality/123?action=reject
   */
  @Get('validate-municipality/:userId')
  @Header('Content-Type', 'text/html') // ✅ On dit qu'on retourne du HTML
  async validateMunicipality(
    @Param('userId') userId: string,
    @Query('action') action: string,
    @Query('reason') reason: string,
  ) {
    console.log(`🔗 Clic sur le lien de validation - UserID: ${userId}, Action: ${action}`);

    // ❌ Validation des paramètres - Si erreur, on lance une exception avec HTML
    if (!action || (action !== 'approve' && action !== 'reject')) {
      throw new HttpException(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Erreur</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f4f6f9; }
              .error { background: #fee2e2; border: 1px solid #ef4444; padding: 20px; border-radius: 8px; display: inline-block; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>❌ Erreur</h1>
              <p>Action invalide. Veuillez utiliser un lien valide.</p>
            </div>
          </body>
        </html>
        `,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      // ✅ On appelle le service pour valider/rejeter la mairie
      const result = await this.authService.validateMunicipality(
        parseInt(userId),
        action as 'approve' | 'reject',
        reason
      );

      // ✅ Message de succès personnalisé
      const successMessage = action === 'approve' 
        ? `✅ La mairie "${result.user.municipalityName}" a été approuvée avec succès !`
        : `❌ La mairie "${result.user.municipalityName}" a été rejetée.`;

      // ✅ On retourne directement le HTML (pas besoin de .status() ou .send() !)
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Validation réussie</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 50px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .success { 
                background: white; 
                padding: 40px; 
                border-radius: 12px; 
                box-shadow: 0 8px 16px rgba(0,0,0,0.2);
                display: inline-block;
                max-width: 500px;
              }
              .icon { font-size: 60px; margin-bottom: 20px; }
              h1 { color: #333; margin-bottom: 10px; }
              p { color: #666; line-height: 1.6; }
              .email-sent { 
                background: #dbeafe; 
                padding: 15px; 
                border-radius: 8px; 
                margin-top: 20px;
                color: #1e40af;
              }
            </style>
          </head>
          <body>
            <div class="success">
              <div class="icon">${action === 'approve' ? '✅' : '❌'}</div>
              <h1>${action === 'approve' ? 'Demande Approuvée !' : 'Demande Rejetée'}</h1>
              <p>${successMessage}</p>
              <div class="email-sent">
                📧 Un email de notification a été envoyé à <strong>${result.user.email}</strong>
              </div>
              <p style="margin-top: 30px; font-size: 14px; color: #999;">
                Vous pouvez fermer cette fenêtre.
              </p>
            </div>
          </body>
        </html>
      `;
    } catch (error) {
      console.error('❌ Erreur lors de la validation:', error.message);

      // ❌ Si erreur pendant le traitement, on lance une exception avec HTML
      throw new HttpException(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Erreur</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f4f6f9; }
              .error { background: #fee2e2; border: 1px solid #ef4444; padding: 20px; border-radius: 8px; display: inline-block; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>❌ Erreur</h1>
              <p>${error.message}</p>
            </div>
          </body>
        </html>
        `,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string
  ) {
    return this.authService.login(email, password);
  }

  @Get('verify-token')
  @UseGuards(JwtAuthGuard)
  async verifyToken() {
    return { message: 'Token valide' };
  }

  @Post('refresh-token')
  async refreshToken(
    @Body('userId') userId: number,
    @Body('refreshToken') refreshToken: string
  ) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(
    @Body('resetToken') resetToken: string,
    @Body('newPassword') newPassword: string
  ) {
    if (!resetToken || !newPassword) {
      throw new BadRequestException('Le token de réinitialisation et le nouveau mot de passe sont requis.');
    }
    return this.authService.resetPassword(resetToken, newPassword);
  }

  @Get('me')
  async getMe(@Headers('authorization') authorization: string) {
    if (!authorization) {
      throw new UnauthorizedException('Token manquant');
    }

    const token = authorization.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Token manquant');
    }

    return this.authService.getUserFromToken(token);
  }
}
// Chemin : backend/src/auth/auth.service.ts

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcrypt';
import { MailService } from '../mails/mail.service';
const Mailjet = require('node-mailjet');
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private mailjet: any;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService
  ) {
    this.mailjet = Mailjet.apiConnect(
      process.env.MAILJET_API_KEY || '',
      process.env.MAILJET_SECRET_KEY || ''
    );
  }

  // ✅ NOUVELLE FONCTION : Générer un username pour une mairie
  private generateMunicipalityUsername(cityName: string): string {
    const normalizedCity = cityName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    return `mairie-${normalizedCity}`;
  }

  // 🆕 NOUVELLE FONCTION : Vérifier si un texte contient "mairie"
  private containsMairie(text: string): boolean {
    if (!text) return false;
    
    // On normalise le texte pour détecter toutes les variantes
    const normalized = text
      .toLowerCase()
      .trim()
      .normalize('NFD') // Enlève les accents
      .replace(/[\u0300-\u036f]/g, ''); // Enlève les caractères accentués
    
    // On cherche "mairie" dans le texte normalisé
    return normalized.includes('mairie');
  }

  async checkUsernameAvailability(username: string): Promise<boolean> {
    if (!username || username.trim().length < 3) {
      throw new BadRequestException('Le nom d\'utilisateur doit contenir au moins 3 caractères');
    }

    // 🆕 NOUVELLE VÉRIFICATION : Bloquer "mairie" pour les citoyens
    if (this.containsMairie(username)) {
      throw new BadRequestException(
        'Le mot "mairie" est réservé aux comptes officiels des mairies. Veuillez choisir un autre nom d\'utilisateur.'
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { 
        username: {
          equals: username.trim(),
          mode: 'insensitive'
        }
      },
    });

    if (existingUser) {
      throw new ConflictException('Ce nom d\'utilisateur est déjà pris');
    }

    return true;
  }

  async checkEmailAvailability(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new BadRequestException('Format d\'email invalide');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Cette adresse email est déjà utilisée');
    }

    return true;
  }

  async signup(
    email: string,
    password: string,
    lastName: string,
    firstName: string,
    username: string,
    photoUrls: string[],
    nomCommune?: string,
    codePostal?: string,
    latitude?: number,
    longitude?: number,
    isMunicipality?: boolean,
    municipalityName?: string,
    municipalitySIREN?: string,
    municipalityPhone?: string,
    municipalityAddress?: string
  ) {
    console.log('📝 Début de signup avec les paramètres:', {
      email,
      username,
      isMunicipality,
      municipalityName,
      nomCommune,
      photoUrls: photoUrls?.length || 0
    });

    // 🆕 NOUVELLE VÉRIFICATION : Pour les CITOYENS uniquement, bloquer "mairie"
    if (!isMunicipality) {
      // Vérifier le nom
      if (this.containsMairie(lastName)) {
        throw new BadRequestException(
          'Le mot "mairie" ne peut pas être utilisé dans le nom. Ce terme est réservé aux comptes officiels des mairies.'
        );
      }

      // Vérifier le prénom
      if (this.containsMairie(firstName)) {
        throw new BadRequestException(
          'Le mot "mairie" ne peut pas être utilisé dans le prénom. Ce terme est réservé aux comptes officiels des mairies.'
        );
      }

      // Vérifier le username
      if (this.containsMairie(username)) {
        throw new BadRequestException(
          'Le mot "mairie" ne peut pas être utilisé dans le nom d\'utilisateur. Ce terme est réservé aux comptes officiels des mairies.'
        );
      }

      console.log('✅ Vérification "mairie" passée pour le citoyen');
    }

    // ✅ Si c'est une mairie, on génère automatiquement le username
    let finalUsername = username;
    
    if (isMunicipality) {
      if (!nomCommune) {
        throw new BadRequestException('Le nom de la commune est requis pour les mairies');
      }
      
      finalUsername = this.generateMunicipalityUsername(nomCommune);
      console.log(`🏛️ Username généré automatiquement pour la mairie : ${finalUsername}`);
    }

    // Vérification email
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé.');
    }

    // Vérification username
    const existingUsername = await this.prisma.user.findFirst({
      where: { 
        username: {
          equals: finalUsername.trim(),
          mode: 'insensitive'
        }
      },
    });
    if (existingUsername) {
      throw new ConflictException('Ce nom d\'utilisateur est déjà pris.');
    }

    // Pour les utilisateurs normaux, vérifier qu'il y a des photos
    if (!isMunicipality) {
      if (!photoUrls || photoUrls.length === 0) {
        throw new BadRequestException('No valid photo URLs provided');
      }
      console.log('Photo URLs received in create service:', photoUrls);
    }

    const hashedPassword = await hash(password, 10);

    if (latitude === undefined || longitude === undefined) {
      throw new BadRequestException('Latitude et longitude sont obligatoires.');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        lastName,
        firstName,
        username: finalUsername,
        nomCommune,
        codePostal,
        latitude,
        longitude,
        isMunicipality: isMunicipality || false,
        municipalityName: isMunicipality ? municipalityName : null,
        municipalitySIREN: isMunicipality ? municipalitySIREN : null,
        municipalityPhone: isMunicipality ? municipalityPhone : null,
        municipalityAddress: isMunicipality ? municipalityAddress : null,
        isVerified: !isMunicipality,
        accountStatus: isMunicipality ? 'pending' : 'active',
      },
    });

    console.log('✅ Utilisateur créé en base de données :', user);

    // Ajouter les photos pour les utilisateurs normaux
    if (!isMunicipality && photoUrls.length > 0) {
      const photosData = photoUrls.map((url, index) => ({
        url,
        userId: user.id,
        isProfile: index === 0,
      }));

      console.log("📸 Photos associées à l'utilisateur :", photosData);

      await this.prisma.photo.createMany({
        data: photosData,
      });
    }

    // Si c'est une mairie, envoyer l'email d'inscription
    if (isMunicipality) {
      console.log('🏛️ Envoi de l\'email d\'inscription mairie via MailService...');
      
      try {
        await this.mailService.sendMunicipalityRegistrationEmail(user);
        console.log('✅ Email d\'inscription mairie envoyé avec succès');
      } catch (error) {
        console.error('❌ ERREUR CRITIQUE lors de l\'envoi de l\'email:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
      }
      
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        message: 'Demande d\'inscription envoyée. En attente de validation.',
      };
    }

    // Pour les utilisateurs normaux, générer un token
    const payload = { userId: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    console.log('🎫 Token généré avec succès :', token);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      token,
    };
  }

  async validateMunicipality(userId: number, action: 'approve' | 'reject', reason?: string) {
    console.log(`🔍 Validation de la mairie - UserID: ${userId}, Action: ${action}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (!user.isMunicipality) {
      throw new BadRequestException('Cet utilisateur n\'est pas une mairie');
    }

    if (action === 'approve') {
      console.log('✅ Approbation de la mairie...');
      
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          accountStatus: 'active',
        },
      });

      await this.mailService.sendMunicipalityApprovalEmail(user);

      return {
        message: 'Mairie approuvée avec succès. Un email de confirmation a été envoyé.',
        user: {
          id: user.id,
          email: user.email,
          municipalityName: user.municipalityName,
          status: 'active',
        },
      };
    } else if (action === 'reject') {
      console.log('❌ Rejet de la mairie...');
      
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: false,
          accountStatus: 'rejected',
          rejectionReason: reason || 'Votre demande n\'a pas été approuvée.',
        },
      });

      await this.mailService.sendMunicipalityRejectionEmail(user, reason);

      return {
        message: 'Mairie rejetée. Un email a été envoyé pour informer l\'utilisateur.',
        user: {
          id: user.id,
          email: user.email,
          municipalityName: user.municipalityName,
          status: 'rejected',
        },
      };
    }

    throw new BadRequestException('Action invalide. Utilisez "approve" ou "reject".');
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    
    if (!user || !(await compare(password, user.password))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (user.isMunicipality && !user.isVerified) {
      throw new UnauthorizedException(
        'Votre compte est en attente de validation. Vous recevrez un email une fois votre compte approuvé.'
      );
    }

    if (user.accountStatus === 'rejected') {
      const reason = user.rejectionReason || 'Votre demande a été rejetée.';
      throw new UnauthorizedException(`Accès refusé. ${reason}`);
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '30d',
    });

    const hashedRefreshToken = await hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return {
      message: 'Connexion réussie',
      accessToken,
      refreshToken,
      userId: user.id,
    };
  }

  async refreshToken(refreshToken: string) {
    console.log('Tentative de rafraîchissement avec refreshToken :', refreshToken);

    const refreshPayload = this.jwtService.verify<JwtPayload>(refreshToken);
    console.log('Payload extrait du refresh token :', refreshPayload);

    const userId = refreshPayload?.userId;
    if (!userId) {
      throw new UnauthorizedException('Refresh token invalide (userId manquant)');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Utilisateur introuvable ou refresh token manquant');
    }

    const isRefreshTokenValid = await compare(refreshToken, user.refreshToken);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    console.log('Refresh token valide, génération de nouveaux tokens...');

    const payload = { userId: user.id, email: user.email };
    const newAccessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    });
    const newRefreshToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '30d',
    });
    const hashedRefreshToken = await hash(newRefreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    console.log('Nouveaux tokens générés et sauvegardés.');
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async resetPassword(resetToken: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Le token est invalide ou a expiré. Veuillez réessayer de saisir le token ou lancer un nouveau processus de réinitialisation.'
      );
    }

    const hashedPassword = await hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  async getUserFromToken(token: string) {
    const payload = this.jwtService.verify(token);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    console.log('Utilisateur trouvé dans la base de données :', user);

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log(`Tentative de réinitialisation pour un email inexistant: ${email}`);
      throw new NotFoundException('Adresse email introuvable.');
    }

    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    await this.prisma.user.update({
      where: { email },
      data: { resetToken, resetTokenExpiry },
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; background-color: #F2F4F7;">
        <h2 style="color: #4CAF50;">Réinitialisation de mot de passe</h2>
        <p>Bonjour,</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe. Voici votre token de réinitialisation :</p>
        <div style="margin: 20px 0; text-align: center;">
          <span style="display: inline-block; padding: 10px 20px; font-size: 18px; font-weight: bold; color: #fff; background-color: #4CAF50; border-radius: 5px; letter-spacing: 1px;">
            ${resetToken}
          </span>
        </div>
        <p>Copiez ce token et utilisez-le sur l'application pour réinitialiser votre mot de passe.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, veuillez nous le signaler immédiatement. Une tentative de fraude pourrait être en cours.</p>
        <p>Merci,<br>L'équipe Support</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      </div>
    `;

    try {
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
                  Email: email,
                  Name: `${user.firstName} ${user.lastName}`,
                },
              ],
              Subject: 'Réinitialisation de mot de passe',
              HTMLPart: htmlContent,
            },
          ],
        });

      console.log('✅ Email envoyé avec succès via Mailjet:', request.body);

      return {
        message: 'Un email a été envoyé. Veuillez vérifier votre boîte de réception.',
      };
    } catch (error) {
      console.error('❌ Erreur d\'envoi d\'email avec Mailjet:', error.statusCode, error.message);
      throw new InternalServerErrorException("Un problème est survenu lors de l'envoi de l'email.");
    }
  }
}
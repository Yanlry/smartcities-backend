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
import * as sgMail from '@sendgrid/mail';
import { v4 as uuidv4 } from 'uuid'; // UTILISÉ POUR GÉNÉRER DES TOKENS UNIQUES
import { JwtPayload } from 'jsonwebtoken';
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY); // INITIALISE LA CLÉ API DE SENDGRID
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
    longitude?: number
  ) {
    console.log("Photo URLs received in create service:", photoUrls);
  
    // Vérification des photos
    if (!photoUrls || photoUrls.length === 0) {
      throw new BadRequestException("No valid photo URLs provided");
    }
  
    // Vérifier si l'email existe déjà
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException("Cet email est déjà utilisé.");
    }
  
    // Hachage du mot de passe
    const hashedPassword = await hash(password, 10);
  
    // Validation des coordonnées géographiques
    if (latitude === undefined || longitude === undefined) {
      throw new BadRequestException("Latitude et longitude sont obligatoires.");
    }
  
    // Création de l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        lastName,
        firstName,
        username,
        nomCommune, // Nom de la ville
        codePostal, // Code postal
        latitude,   // Latitude
        longitude,  // Longitude
      },
    });
  
    console.log("Utilisateur créé en base de données :", user);
  
    // Ajout des photos et marquage de la première comme photo de profil
    if (photoUrls.length > 0) {
      const photosData = photoUrls.map((url, index) => ({
        url,
        userId: user.id,
        isProfile: index === 0, // La première photo devient la photo de profil
      }));
  
      console.log("Photos associées à l'utilisateur :", photosData);
  
      await this.prisma.photo.createMany({
        data: photosData,
      });
    }
  
    // Génération du token
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
  
    console.log("Token généré avec succès :", token);
  
    // Retourner l'utilisateur avec le token
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      token,
    };
  }
  
  

  // AUTHENTIFIE L'UTILISATEUR ET RETOURNE UN ACCESS TOKEN ET UN REFRESH TOKEN SI LES IDENTIFIANTS SONT VALIDES
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await compare(password, user.password))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
  
    // Génération des tokens
    const payload = { userId: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: process.env.JWT_REFRESH_EXPIRY || '30d' });
  
    // Hachage et stockage du refresh token (remplace l'ancien)
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
    const newAccessToken = this.jwtService.sign(payload, { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' });
    const newRefreshToken = this.jwtService.sign(payload, { expiresIn: process.env.JWT_REFRESH_EXPIRY || '30d' });
    const hashedRefreshToken = await hash(newRefreshToken, 10);
  
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });
  
    console.log('Nouveaux tokens générés et sauvegardés.');
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async forgotPassword(email: string) {
    // Recherche de l'utilisateur
    const user = await this.prisma.user.findUnique({ where: { email } });
  
    // Si l'utilisateur n'est pas trouvé, lever une exception
    if (!user) {
      console.log(`Tentative de réinitialisation pour un email inexistant: ${email}`);
      throw new NotFoundException('Adresse email introuvable.');
    }
  
    // Génération du token et mise à jour en base
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // Expires in 1 hour
  
    await this.prisma.user.update({
      where: { email },
      data: { resetToken, resetTokenExpiry },
    });
  
    // Préparation et envoi de l'email
    const msg = {
      to: email,
      from: 'yannleroy23@gmail.com', // Adresse email validée dans SendGrid
      subject: 'Réinitialisation de mot de passe',
      text: `Voici votre token de réinitialisation : ${resetToken}`,
    };
  
    try {
      await sgMail.send(msg);
      return { message: 'Un email a été envoyé. Vous y trouverez votre token de réinitialisation.' };
    } catch (error) {
      console.error(
        'Erreur d\'envoi d\'email:',
        error.response ? error.response.body : error
      );
      throw new InternalServerErrorException(
        'Un problème est survenu lors de l\'envoi de l\'email.'
      );
    }
  }

  // UTILISE LE TOKEN POUR RÉINITIALISER LE MOT DE PASSE DE L'UTILISATEUR, SI LE TOKEN EST VALIDE ET NON EXPRIRÉ
  async resetPassword(resetToken: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken,
        resetTokenExpiry: { gt: new Date() }, // VÉRIFIE QUE LE TOKEN N'A PAS EXPRIRÉ
      },
    });

    if (!user) {
      throw new BadRequestException('Le token est invalide ou a expiré. Veuillez réessayer de saisir le token ou lancer un nouveau processus de réinitialisation.');
    }

    const hashedPassword = await hash(newPassword, 10);

    // MET À JOUR LE MOT DE PASSE DE L'UTILISATEUR ET SUPPRIME LE TOKEN DE RÉINITIALISATION
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
    const payload = this.jwtService.verify(token); // Décoder le token
    console.log('Payload décodé du token :', payload); // Log le payload du token

    // Trouver l'utilisateur correspondant
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    console.log('Utilisateur trouvé dans la base de données :', user); // Log l'utilisateur trouvé

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }
}

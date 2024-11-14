import { Injectable, ConflictException, UnauthorizedException, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcrypt';
import * as sgMail from '@sendgrid/mail';
import { v4 as uuidv4 } from 'uuid'; // UTILISÉ POUR GÉNÉRER DES TOKENS UNIQUES

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY); // INITIALISE LA CLÉ API DE SENDGRID
  }

  // INSCRIT UN NOUVEL UTILISATEUR DANS LA BASE DE DONNÉES APRÈS AVOIR HASHÉ SON MOT DE PASSE
  async signup(email: string, password: string, username: string, lastName: string, firstName: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('Cet email est déjà utilisé.');

    const hashedPassword = await hash(password, 10);

    return this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        lastName,
        firstName,
        username,
      },
    });
  }

  // AUTHENTIFIE L'UTILISATEUR ET RETOURNE UN ACCESS TOKEN ET UN REFRESH TOKEN SI LES IDENTIFIANTS SONT VALIDES
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await compare(password, user.password))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' }); // TOKEN D'ACCÈS VALIDE 15 MINUTES
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' }); // TOKEN DE RAFRAÎCHISSEMENT VALIDE 30 JOURS

    const hashedRefreshToken = await hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return { message: 'Connexion réussie', accessToken, refreshToken };
  }

  // VÉRIFIE ET RÉGÉNÈRE UN NOUVEAU ACCESS TOKEN UTILISANT UN REFRESH TOKEN VALIDE
  async refreshToken(userId: number, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshToken || !(await compare(refreshToken, user.refreshToken))) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    const payload = { userId: user.id, email: user.email };
    const newAccessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    return { accessToken: newAccessToken };
  }

  // ENVOIE UN EMAIL AVEC UN TOKEN POUR RÉINITIALISER LE MOT DE PASSE SI L'UTILISATEUR EXISTE
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const resetToken = uuidv4(); // CRÉE UN TOKEN UNIQUE DE RÉINITIALISATION
    const resetTokenExpiry = new Date(Date.now() + 3600000); // EXPIRE DANS 1 HEURE

    await this.prisma.user.update({
      where: { email },
      data: { resetToken, resetTokenExpiry },
    });

    const msg = {
      to: email,
      from: 'yannleroy23@gmail.com', // ADRESSE EMAIL VALIDÉE DANS SENDGRID
      subject: 'Réinitialisation de mot de passe',
      text: `Voici votre token de réinitialisation : ${resetToken}`,
    };

    try {
      await sgMail.send(msg);
      return { message: 'Email de réinitialisation envoyé avec succès' };
    } catch (error) {
      console.error('Erreur d\'envoi d\'email:', error.response ? error.response.body : error);
      throw new InternalServerErrorException('Erreur lors de l\'envoi de l\'email');
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
      throw new BadRequestException('Le token est invalide ou expiré.');
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
}

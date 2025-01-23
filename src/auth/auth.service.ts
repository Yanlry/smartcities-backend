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
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from 'jsonwebtoken';
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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
    console.log('Photo URLs received in create service:', photoUrls);

    if (!photoUrls || photoUrls.length === 0) {
      throw new BadRequestException('No valid photo URLs provided');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé.');
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
        username,
        nomCommune,
        codePostal,
        latitude,
        longitude,
      },
    });

    console.log('Utilisateur créé en base de données :', user);

    if (photoUrls.length > 0) {
      const photosData = photoUrls.map((url, index) => ({
        url,
        userId: user.id,
        isProfile: index === 0,
      }));

      console.log("Photos associées à l'utilisateur :", photosData);

      await this.prisma.photo.createMany({
        data: photosData,
      });
    }

    const payload = { userId: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    console.log('Token généré avec succès :', token);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      token,
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await compare(password, user.password))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
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
    console.log(
      'Tentative de rafraîchissement avec refreshToken :',
      refreshToken
    );

    const refreshPayload = this.jwtService.verify<JwtPayload>(refreshToken);
    console.log('Payload extrait du refresh token :', refreshPayload);

    const userId = refreshPayload?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'Refresh token invalide (userId manquant)'
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException(
        'Utilisateur introuvable ou refresh token manquant'
      );
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
    console.log('Payload décodé du token :', payload);

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
      console.log(
        `Tentative de réinitialisation pour un email inexistant: ${email}`
      );
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
        <p>Si vous n’avez pas demandé cette réinitialisation, veuillez nous le signaler immédiatement. Une tentative de fraude pourrait être en cours.</p>
        <p>Merci,<br>L'équipe Support</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      </div>
    `;

    const msg = {
      to: email,
      from: 'yannleroy23@gmail.com',
      subject: 'Réinitialisation de mot de passe',
      html: htmlContent,
    };

    try {
      await sgMail.send(msg);
      return {
        message:
          'Un email a été envoyé. Veuillez vérifier votre boîte de réception.',
      };
    } catch (error) {
      console.error(
        "Erreur d'envoi d'email:",
        error.response ? error.response.body : error
      );
      throw new InternalServerErrorException(
        "Un problème est survenu lors de l'envoi de l'email."
      );
    }
  }
}

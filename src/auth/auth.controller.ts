import {
  Controller,
  Post,
  Body,
  Req,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Get,
  Res,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { S3Service } from 'src/services/s3/s3.service';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly s3Service: S3Service
  ) {}

  // CRÉE UN NOUVEL UTILISATEUR AVEC UN EMAIL, UN MOT DE PASSE ET UN NOM FOURNIS
  @Post('signup')
  @UseInterceptors(
    FilesInterceptor('photos', 1, {
      limits: { fileSize: 10 * 1024 * 1024 }, // Limite à 10 Mo
    })
  )
  async signup(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('lastName') lastName: string,
    @Body('firstName') firstName: string,
    @Body('username') username: string,
    @Body('nom_commune') nomCommune: string,
    @Body('code_postal') codePostal: string,
    @Body('latitude') latitude: string,
    @Body('longitude') longitude: string,
    @UploadedFiles() photos: Express.Multer.File[]
  ) {
    console.log('Données reçues du frontend :', {
      email,
      nomCommune,
      codePostal,
      latitude,
      longitude,
    });

    // Validation des coordonnées
    const latitudeNumber = parseFloat(latitude);
    const longitudeNumber = parseFloat(longitude);

    if (isNaN(latitudeNumber) || isNaN(longitudeNumber)) {
      throw new BadRequestException(
        'Latitude et longitude doivent être des nombres valides.'
      );
    }

    // Filtrer les fichiers valides
    const validPhotos =
      photos?.filter(
        (file) => file.buffer && file.originalname && file.mimetype
      ) || [];

    if (validPhotos.length === 0) {
      throw new BadRequestException('Aucun fichier valide trouvé.');
    }

    const photoUrls = [];
    for (const photo of validPhotos) {
      try {
        const url = await this.s3Service.uploadFile(photo);
        photoUrls.push(url);
      } catch (error) {
        console.error(
          `Error uploading file ${photo.originalname}:`,
          error.message
        );
        throw new BadRequestException(
          `Erreur lors de l'upload de la photo ${photo.originalname}: ${error.message}`
        );
      }
    }

    console.log('URLs des photos après upload :', photoUrls);

    // Appel au service pour créer l'utilisateur
    return this.authService.signup(
      email,
      password,
      firstName,
      lastName,
      username,
      photoUrls,
      nomCommune, // Nom de la ville
      codePostal, // Code postal
      latitudeNumber, // Latitude convertie
      longitudeNumber // Longitude convertie
    );
  }

  // AUTHENTIFIE UN UTILISATEUR ET RETOURNE UN TOKEN JWT S'IL RÉUSSIT
  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string
  ) {
    return this.authService.login(email, password);
  }

  @Get('verify-token')
  @UseGuards(JwtAuthGuard)
  async verifyToken(@Req() req: Request, @Res() res: Response) {
    try {
      // Si tout va bien, le token est valide
      return res.status(HttpStatus.OK).json({ message: 'Token valide' });
    } catch (error) {
      // Si le token est expiré, retournez une erreur explicite
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Token expiré. Veuillez renouveler le token.'
        );
      }
      throw new UnauthorizedException('Token invalide.');
    }
  }

  // GÉNÈRE UN NOUVEAU TOKEN D'ACCÈS UTILISANT LE TOKEN DE RAFRAÎCHISSEMENT FOURNI, PROLONGEANT LA SESSION
  @Post('refresh-token')
  async refreshToken(
    @Body('userId') userId: number,
    @Body('refreshToken') refreshToken: string
  ) {
    return this.authService.refreshToken(refreshToken);
  }

  // ENVOIE UN EMAIL AVEC UN LIEN ET UN TOKEN DE RÉINITIALISATION POUR REINITIALISER LE MOT DE PASSE
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  // RÉINITIALISE LE MOT DE PASSE D'UN UTILISATEUR UTILISANT UN TOKEN DE RÉINITIALISATION ET UN NOUVEAU MOT DE PASSE
  @Post('reset-password')
  async resetPassword(
    @Body('resetToken') resetToken: string,
    @Body('newPassword') newPassword: string
  ) {
    if (!resetToken || !newPassword) {
      throw new BadRequestException(
        'Le token de réinitialisation et le nouveau mot de passe sont requis.'
      );
    }
    return this.authService.resetPassword(resetToken, newPassword);
  }

  @Get('me')
  async getMe(@Req() req: Request) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Token manquant');
    }
    return this.authService.getUserFromToken(token);
  }
}

import { Controller, Post, Body, Req, UseGuards, Get, Res, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // CRÉE UN NOUVEL UTILISATEUR AVEC UN EMAIL, UN MOT DE PASSE ET UN NOM FOURNIS
  @Post('signup')
  async signup(@Body('email') email: string, @Body('password') password: string, @Body('name') name: string) {
    return this.authService.signup(email, password, name);
  }

  // AUTHENTIFIE UN UTILISATEUR ET RETOURNE UN TOKEN JWT S'IL RÉUSSIT
  @Post('login')
  async login(@Body('email') email: string, @Body('password') password: string) {
    return this.authService.login(email, password);
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
    @Body('newPassword') newPassword: string,
  ) {
    if (!resetToken || !newPassword) {
      throw new BadRequestException('Le token de réinitialisation et le nouveau mot de passe sont requis.');
    }
    return this.authService.resetPassword(resetToken, newPassword);
  }

  // VÉRIFIE LA VALIDITÉ DU TOKEN D'ACCÈS DE L'UTILISATEUR, INDIQUANT SI LA SESSION EST TOUJOURS VALIDE
  @Get('verify-token')
  @UseGuards(JwtAuthGuard)
  async verifyToken(@Req() req: Request, @Res() res: Response) {
    return res.status(HttpStatus.OK).json({ message: 'Token valide' });
  }

  // GÉNÈRE UN NOUVEAU TOKEN D'ACCÈS UTILISANT LE TOKEN DE RAFRAÎCHISSEMENT FOURNI, PROLONGEANT LA SESSION
  @Post('refresh-token')
  async refreshToken(@Body('userId') userId: number, @Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(userId, refreshToken);
  }
}

import { Controller, Post, Body, Req, UseGuards, Get, Res, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request, Response } from 'express'; // Ajouté pour les types Request et Response

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body('email') email: string, @Body('password') password: string, @Body('name') name: string) {
    return this.authService.signup(email, password, name);
  }

  @Post('login')
  async login(@Body('email') email: string, @Body('password') password: string) {
    return this.authService.login(email, password);
  }

  @Get('verify-token')
  @UseGuards(JwtAuthGuard)
  async verifyToken(@Req() req: Request, @Res() res: Response) {
    return res.status(HttpStatus.OK).json({ message: 'Token valide' });
  }

  @Post('refresh-token')
  async refreshToken(@Body('userId') userId: number, @Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(userId, refreshToken);
  }
}

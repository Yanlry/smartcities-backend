import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(email: string, password: string, name: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('Cet email est déjà utilisé.');

    const hashedPassword = await hash(password, 10);
    return this.prisma.user.create({
      data: { email, password: hashedPassword, name },
    });
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await compare(password, user.password))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' }); // Expire en 15 minutes
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '10s' }); // Expire en 30 jours

    // Stocker le refresh token hashé dans la base de données
    const hashedRefreshToken = await hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return { message: 'Connexion réussie', accessToken, refreshToken };
  }

  async refreshToken(userId: number, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshToken || !(await compare(refreshToken, user.refreshToken))) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    const payload = { userId: user.id, email: user.email };
    const newAccessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    return { accessToken: newAccessToken };
  }
}

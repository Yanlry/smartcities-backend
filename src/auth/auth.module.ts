import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { S3Module } from 'src/services/s3/s3.module';

@Module({
  imports: [
    JwtModule.register({
      secret: 'secretKey', // Remplace par une clé secrète sécurisée
      signOptions: { expiresIn: '1h' }, // Configure l'expiration du token
    }), S3Module],
  providers: [AuthService, PrismaService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}

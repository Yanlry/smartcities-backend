import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service'; // Importer PrismaService pour l'accès à la DB

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService], // Fournit PrismaService et UserService
})
export class UserModule {}

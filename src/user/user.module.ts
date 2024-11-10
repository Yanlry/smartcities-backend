import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module'; // Import du module de notifications

@Module({
  imports: [PrismaModule, NotificationModule], // Ajoute NotificationModule ici
  providers: [UserService],
  controllers: [UserController],
})
export class UserModule {}

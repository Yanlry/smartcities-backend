import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module'; // Import du module de notifications
import { S3Module } from 'src/services/s3/s3.module';

@Module({
  imports: [PrismaModule, NotificationModule, S3Module], // Ajoute NotificationModule ici
  providers: [UserService],
  controllers: [UserController],
})
export class UserModule {}

import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module'; // Import NotificationModule
import { S3Module } from 'src/services/s3/s3.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => NotificationModule), // Utilise forwardRef pour éviter la boucle
    S3Module,
  ],
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
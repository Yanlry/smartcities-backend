import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // Assure-toi que PrismaModule est bien importé
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService], // Ajoute NotificationService aux exports
})
export class NotificationModule {}

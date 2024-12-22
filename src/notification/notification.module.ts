import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UserModule), // Utilise forwardRef pour éviter la boucle
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService], // Exporte NotificationService si nécessaire
})
export class NotificationModule {}
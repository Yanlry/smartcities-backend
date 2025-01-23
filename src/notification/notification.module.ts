import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UserModule), 
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService], 
})
export class NotificationModule {}
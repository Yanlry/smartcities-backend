import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { S3Module } from '../services/s3/s3.module';

@Module({
  imports: [NotificationModule, PrismaModule, S3Module],
  controllers: [EventsController],
  providers: [EventsService, PrismaService],
})
export class EventsModule {}

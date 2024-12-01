import { Module } from '@nestjs/common';
import { ReportService } from './reports.service';
import { ReportController } from './reports.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { S3Module } from 'src/services/s3/s3.module';

@Module({
  imports: [PrismaModule, NotificationModule, S3Module],
  providers: [ReportService],
  controllers: [ReportController],
})
export class ReportModule {}

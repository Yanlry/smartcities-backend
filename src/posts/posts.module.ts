import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { S3Module } from '../services/s3/s3.module';

@Module({
  imports: [PrismaModule, NotificationModule, S3Module],
  providers: [PostsService, PrismaService],
  controllers: [PostsController],
})
export class PostsModule {}

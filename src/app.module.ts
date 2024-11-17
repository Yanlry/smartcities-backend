import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ReportModule } from './reports/reports.module';
import { PrismaService } from './prisma/prisma.service';
import { PostsModule } from './posts/posts.module';
import { GroupsModule } from './groups/groups.module';
import { EventsModule } from './events/events.module';
import { MessagesModule } from './messages/messages.module';
import { MapModule } from './map/map.module';
import { NotificationModule } from './notification/notification.module';
import { StatsModule } from './stats/stats.module';
import { ConfigModule } from './config/config.module';

@Module({
  imports: [AuthModule, ConfigModule, UserModule, ReportModule, PostsModule, GroupsModule, EventsModule, MessagesModule, MapModule, NotificationModule, StatsModule],
  providers: [PrismaService],
})
export class AppModule {}

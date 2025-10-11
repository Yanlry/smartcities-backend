import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './config/config.service';
import { AppConfigController } from './config/config.controller';
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
import { MailModule } from './mails/mail.module';
import { CityInfoModule } from './cityinfo/cityinfo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    UserModule,
    ReportModule,
    PostsModule,
    GroupsModule,
    EventsModule,
    MessagesModule,
    MapModule,
    NotificationModule,
    StatsModule,
    MailModule,
    CityInfoModule,
  ],
  providers: [PrismaService, AppConfigService],
  controllers: [AppConfigController], 
})
export class AppModule {}

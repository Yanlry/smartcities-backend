import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ReportModule } from './reports/reports.module';
import { PrismaService } from './prisma/prisma.service';
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [AuthModule, UserModule, ReportModule, PostsModule],
  providers: [PrismaService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { MapController } from './map.controller';
import { MapService } from './map.service';
import { PrismaModule } from '../prisma/prisma.module'; 
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [PrismaModule], 
  controllers: [MapController],
  providers: [MapService,PrismaService],
})
export class MapModule {}

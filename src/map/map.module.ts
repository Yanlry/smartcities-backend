import { Module } from '@nestjs/common';
import { MapController } from './map.controller';
import { MapService } from './map.service';
import { PrismaModule } from '../prisma/prisma.module'; // Vérifie que ce chemin est correct
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [PrismaModule], // Ajoute PrismaModule ici
  controllers: [MapController],
  providers: [MapService,PrismaService],
})
export class MapModule {}

// Chemin : backend/src/cityinfo/cityinfo.module.ts

import { Module } from '@nestjs/common';
import { CityInfoController } from './cityinfo.controller';
import { CityInfoService } from './cityinfo.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CityInfoController],
  providers: [CityInfoService, PrismaService],
  exports: [CityInfoService], // Pour pouvoir l'utiliser dans d'autres modules
})
export class CityInfoModule {}
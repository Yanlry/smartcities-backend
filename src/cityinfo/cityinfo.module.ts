// Chemin : backend/src/cityinfo/cityinfo.module.ts

import { Module } from '@nestjs/common';
import { CityInfoController } from './cityinfo.controller';
import { CityInfoService } from './cityinfo.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Module } from '../services/s3/s3.module'; // ⬅️ ✅ LIGNE AJOUTÉE : Import du module S3 pour uploader les photos

@Module({
  imports: [
    S3Module, // ⬅️ ✅ LIGNE AJOUTÉE : Permet à CityInfoService d'utiliser S3Service pour uploader sur Amazon
  ],
  controllers: [CityInfoController],
  providers: [CityInfoService, PrismaService],
  exports: [CityInfoService], // Pour pouvoir l'utiliser dans d'autres modules
})
export class CityInfoModule {}
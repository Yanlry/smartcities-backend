import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';

@Module({
  providers: [S3Service], // Déclare S3Service comme provider
  exports: [S3Service],   // Permet à d'autres modules de l'utiliser
})
export class S3Module {}
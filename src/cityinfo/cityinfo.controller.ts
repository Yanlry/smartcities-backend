// Chemin : backend/src/cityinfo/cityinfo.controller.ts

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CityInfoService } from './cityinfo.service';
import { UpsertCityInfoDto } from './dto/upsert-city-info.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cityinfo')
export class CityInfoController {
  constructor(private readonly cityInfoService: CityInfoService) {}

  /**
   * ROUTE 1 : Vérifier si une ville a configuré ses infos
   */
  @Get('exists')
  @HttpCode(HttpStatus.OK)
  async checkExists(@Query('cityName') cityName: string) {
    console.log('📥 Vérification existence pour:', cityName);
    const exists = await this.cityInfoService.checkCityInfoExists(cityName);
    return { exists };
  }

  /**
   * ROUTE 2 : Récupérer les infos complètes d'une ville
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getCityInfo(@Query('cityName') cityName: string) {
    console.log('📥 Récupération des infos pour:', cityName);
    return this.cityInfoService.getCityInfo(cityName);
  }

  /**
   * ✨ ROUTE CORRIGÉE : Uploader la photo du maire vers S3
   */
  @Post('upload-mayor-photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('mayorPhoto')) // ⬅️ On enlève multerConfig car on va uploader sur S3
  @HttpCode(HttpStatus.OK)
  async uploadMayorPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body('cityName') cityName: string,
    @Request() req: any,
  ) {
    console.log('📸 Upload photo du maire vers S3');
    console.log('📁 Fichier reçu:', file?.originalname);
    console.log('🏙️ Ville:', cityName);

    if (!file) {
      return {
        success: false,
        message: 'Aucun fichier fourni',
      };
    }

    // ⬅️ ✅ On passe le fichier au service qui va l'uploader sur S3
    const result = await this.cityInfoService.uploadMayorPhoto(
      req.user.id,
      cityName,
      file,
    );

    return {
      success: true,
      message: 'Photo uploadée avec succès sur S3',
      mayorPhotoUrl: result.photoUrl,
    };
  }

  /**
   * ✨ ROUTE CORRIGÉE : Uploader la photo d'un membre d'équipe vers S3
   */
  @Post('upload-team-photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('teamMemberPhoto')) // ⬅️ On enlève multerConfig
  @HttpCode(HttpStatus.OK)
  async uploadTeamMemberPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    console.log('📸 Upload photo membre équipe vers S3');
    console.log('📁 Fichier reçu:', file?.originalname);

    if (!file) {
      return {
        success: false,
        message: 'Aucun fichier fourni',
      };
    }

    // ⬅️ ✅ Upload vers S3
    const result = await this.cityInfoService.uploadTeamMemberPhoto(
      req.user.id,
      file,
    );

    return {
      success: true,
      message: 'Photo uploadée avec succès sur S3',
      photoUrl: result.photoUrl,
    };
  }

  /**
   * ROUTE 3 : Créer ou modifier les infos d'une ville
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async upsertCityInfo(
    @Body() upsertCityInfoDto: UpsertCityInfoDto,
    @Request() req: any,
  ) {
    console.log('📥 Sauvegarde par userId:', req.user.id);
    console.log('📝 Données:', upsertCityInfoDto);

    return this.cityInfoService.upsertCityInfo(req.user.id, upsertCityInfoDto);
  }

  /**
   * ROUTE 4 : Supprimer les infos d'une ville
   */
  @Delete(':cityName')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteCityInfo(
    @Param('cityName') cityName: string,
    @Request() req: any,
  ) {
    console.log('🗑️ Suppression demandée par userId:', req.user.id);
    return this.cityInfoService.deleteCityInfo(cityName, req.user.id);
  }
}
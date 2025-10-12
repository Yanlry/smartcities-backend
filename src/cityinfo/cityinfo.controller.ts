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
import { multerConfig } from './multer.config';

@Controller('cityinfo')
export class CityInfoController {
  constructor(private readonly cityInfoService: CityInfoService) {}

  /**
   * ROUTE 1 : Vérifier si une ville a configuré ses infos
   * Exemple : GET /cityinfo/exists?cityName=HAUBOURDIN
   * 🌍 PUBLIC (pas besoin de connexion)
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
   * Exemple : GET /cityinfo?cityName=HAUBOURDIN
   * 🌍 PUBLIC (tout le monde peut voir)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getCityInfo(@Query('cityName') cityName: string) {
    console.log('📥 Récupération des infos pour:', cityName);
    return this.cityInfoService.getCityInfo(cityName);
  }

  /**
   * ✨ NOUVELLE ROUTE : Uploader la photo du maire
   * Exemple : POST /cityinfo/upload-mayor-photo
   * 🔒 PROTÉGÉ (seulement pour les mairies)
   */
  @Post('upload-mayor-photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('mayorPhoto', multerConfig))
  @HttpCode(HttpStatus.OK)
  async uploadMayorPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body('cityName') cityName: string,
    @Request() req: any,
  ) {
    console.log('📸 Upload photo du maire');
    console.log('📁 Fichier reçu:', file?.filename);
    console.log('🏙️ Ville:', cityName);
    
    if (!file) {
      return { 
        success: false, 
        message: 'Aucun fichier fourni' 
      };
    }

    // Construire l'URL complète de la photo
    const photoUrl = `${process.env.API_URL}/uploads/mayor-photos/${file.filename}`;
    
    // Sauvegarder l'URL dans la base de données
    const result = await this.cityInfoService.updateMayorPhoto(
      req.user.id,
      cityName,
      photoUrl,
    );

    return {
      success: true,
      message: 'Photo uploadée avec succès',
      mayorPhotoUrl: photoUrl,
    };
  }

  /**
 * ✨ NOUVELLE ROUTE : Uploader la photo d'un membre d'équipe
 * Exemple : POST /cityinfo/upload-team-photo
 * 🔒 PROTÉGÉ (seulement pour les mairies)
 */
@Post('upload-team-photo')
@UseGuards(JwtAuthGuard)
@UseInterceptors(FileInterceptor('teamMemberPhoto', multerConfig))
@HttpCode(HttpStatus.OK)
async uploadTeamMemberPhoto(
  @UploadedFile() file: Express.Multer.File,
  @Body('cityName') cityName: string,
  @Request() req: any,
) {
  console.log('📸 Upload photo membre équipe');
  console.log('📁 Fichier reçu:', file?.filename);
  console.log('🏙️ Ville:', cityName);
  
  if (!file) {
    return { 
      success: false, 
      message: 'Aucun fichier fourni' 
    };
  }

  // Construire l'URL complète de la photo
  const photoUrl = `${process.env.API_URL}/uploads/mayor-photos/${file.filename}`;
  
  console.log('✅ Photo uploadée avec succès:', photoUrl);

  return {
    success: true,
    message: 'Photo uploadée avec succès',
    photoUrl: photoUrl,
  };
}

  /**
   * ROUTE 3 : Créer ou modifier les infos d'une ville
   * Exemple : POST /cityinfo
   * 🔒 PROTÉGÉ (seulement pour les mairies connectées)
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
    
    return this.cityInfoService.upsertCityInfo(
      req.user.id,
      upsertCityInfoDto,
    );
  }

  /**
   * ROUTE 4 : Supprimer les infos d'une ville
   * Exemple : DELETE /cityinfo/HAUBOURDIN
   * 🔒 PROTÉGÉ (seulement pour les mairies)
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
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
} from '@nestjs/common';
import { CityInfoService } from './cityinfo.service';
import { UpsertCityInfoDto } from './dto/upsert-city-info.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cityinfo')
export class CityInfoController {
  constructor(private readonly cityInfoService: CityInfoService) {}

  // ⚠️ IMPORTANT : Les routes SPÉCIFIQUES doivent être AVANT les routes GÉNÉRIQUES
  
  /**
   * ROUTE PUBLIC : Vérifier si une ville a configuré ses infos
   * GET /cityinfo/exists?cityName=HAUBOURDIN
   * 
   * 🔥 CETTE ROUTE DOIT ÊTRE EN PREMIER !
   */
  @Get('exists')
  @HttpCode(HttpStatus.OK)
  async checkExists(@Query('cityName') cityName: string) {
    console.log('📥 Requête GET /cityinfo/exists avec cityName:', cityName);
    const exists = await this.cityInfoService.checkCityInfoExists(cityName);
    return { exists };
  }

  /**
   * ROUTE PUBLIC : Récupérer les infos d'une ville
   * GET /cityinfo?cityName=HAUBOURDIN
   * 
   * 🔥 CETTE ROUTE DOIT ÊTRE EN DERNIER (c'est la plus générale)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getCityInfo(@Query('cityName') cityName: string) {
    console.log('📥 Requête GET /cityinfo avec cityName:', cityName);
    return this.cityInfoService.getCityInfo(cityName);
  }

  /**
   * ROUTE PROTÉGÉE : Créer ou mettre à jour les infos (MAIRIE SEULEMENT)
   * POST /cityinfo
   * 
   * 🔒 Nécessite un token JWT valide
   * 👤 L'utilisateur doit avoir isMunicipality = true
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async upsertCityInfo(
    @Body() upsertCityInfoDto: UpsertCityInfoDto,
    @Request() req: any
  ) {
    console.log('📥 Requête POST /cityinfo par userId:', req.user.id);
    console.log('📝 Données reçues:', upsertCityInfoDto);
    
    return this.cityInfoService.upsertCityInfo(
      req.user.id,
      upsertCityInfoDto
    );
  }

  /**
   * ROUTE PROTÉGÉE : Supprimer les infos d'une ville (ADMIN)
   * DELETE /cityinfo/:cityName
   * 
   * 🔒 Nécessite un token JWT valide
   * 👤 L'utilisateur doit être une mairie
   */
  @Delete(':cityName')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteCityInfo(
    @Param('cityName') cityName: string,
    @Request() req: any
  ) {
    console.log('📥 Requête DELETE /cityinfo/:cityName par userId:', req.user.id);
    return this.cityInfoService.deleteCityInfo(cityName, req.user.id);
  }
}
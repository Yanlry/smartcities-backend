import { Controller, Get, Query } from '@nestjs/common';
import { MapService } from './map.service';

@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) { }

  // RÉCUPÉRER TOUS LES SIGNALÉMENTS
  @Get('/reports')
  async getReports() {
    return await this.mapService.getReports(); // Appelle le service pour récupérer les signalements
  }

  // RÉCUPÉRER TOUS LES ÉVÉNEMENTS
  @Get('/events')
  async getEvents() {
    return await this.mapService.getEvents(); // Appelle le service pour récupérer les événements
  }

  // FILTRER LES ÉLÉMENTS DE LA CARTE PAR TYPE (SIGNALÉMENT OU ÉVÉNEMENT)
  @Get('/filter')
  async filterMapItems(@Query('type') type: string) {
    return await this.mapService.filterMapItems(type); // Filtre les éléments en fonction du type (report ou event)
  }

  // RÉCUPÉRER LES ÉLÉMENTS À PROXIMITÉ EN FONCTION DE LA LATITUDE ET LONGITUDE
  @Get('/nearby')
  async getNearbyItems(@Query('latitude') latitude: number, @Query('longitude') longitude: number) {
    return await this.mapService.getNearbyItems(latitude, longitude); // Récupère les signalements et événements proches de la position donnée
  }
}

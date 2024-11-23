import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
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
  @Get('/events' )
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
  async getNearbyItems(
    @Query('latitude') latitude: number, 
    @Query('longitude') longitude: number,
    @Query('userId') userId: number, // On ajoute l'ID de l'utilisateur pour la vérification de l'interaction
  ) {
    if (!latitude || !longitude) {
      throw new BadRequestException("La latitude et la longitude sont nécessaires pour obtenir les éléments à proximité.");
    }

    // Appelle le service pour récupérer les signalements et événements proches de la position donnée
    const { reports, events } = await this.mapService.getNearbyItems(latitude, longitude);

    // Vérifier si l'utilisateur peut interagir avec les éléments à proximité (par exemple, voter, commenter)
    const userInteractions = await this.checkUserInteractions(userId, reports, events, latitude, longitude);

    return {
      reports,
      events,
      userInteractions, // On renvoie l'état de l'interaction possible pour l'utilisateur
    };
  }

  // Vérification si l'utilisateur peut interagir (voter/commenter) sur les éléments proches
  private async checkUserInteractions(userId: number, reports: any[], events: any[], latitude: number, longitude: number) {
    const interactions = { reports: [], events: [] };

    // Vérification des interactions pour les signalements
    for (const report of reports) {
      const canInteract = await this.mapService.isUserWithinRadius(latitude, longitude, report.latitude, report.longitude);
      if (canInteract) {
        interactions.reports.push({ reportId: report.id, canInteract });
      }
    }

    // Vérification des interactions pour les événements
    for (const event of events) {
      const canInteract = await this.mapService.isUserWithinRadius(latitude, longitude, event.latitude, event.longitude);
      if (canInteract) {
        interactions.events.push({ eventId: event.id, canInteract });
      }
    }

    return interactions;
  }
}

import { Controller, Get, Post, Body, Param, Put, Delete, BadRequestException } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) { }

  // CRÉE UN NOUVEL ÉVÉNEMENT
  @Post()
  async create(@Body() createEventDto: CreateEventDto) {
    // Si reportId est présent, un rayon doit être aussi fourni
    if (createEventDto.reportId && !createEventDto.radius) {
      throw new BadRequestException("Un rayon (radius) doit être défini si vous associez un événement à un signalement.");
    }

    return this.eventsService.create(createEventDto);
  }

  // RÉCUPÈRE TOUS LES ÉVÉNEMENT
  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  // RÉCUPÈRE LES DÉTAILS D'UN ÉVÉNEMENT PAR SON ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(+id);
  }

  // MET À JOUR LES INFORMATIONS D'UN ÉVÉNEMENT
  @Put(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.update(+id, updateEventDto);
  }

  // INVITE UN UTILISATEUR À UN ÉVÉNEMENT
  @Post(':id/invite')
  async inviteUser(@Param('id') eventId: string, @Body() body: { userId: number }) {
    if (!body.userId) {
      throw new BadRequestException("L'ID de l'utilisateur est requis pour l'invitation");
    }
    const id = parseInt(eventId, 10);
    return this.eventsService.inviteUser(id, body.userId);
  }

  // RÉPOND À UNE INVITATION POUR UN ÉVÉNEMENT
  @Post(':id/rsvp')
  async rsvpToEvent(
    @Param('id') eventId: string,
    @Body() body: { userId: number; status: string }
  ) {
    if (!body.userId || !body.status) {
      throw new BadRequestException("L'ID de l'utilisateur et le statut sont requis pour le RSVP");
    }
    const id = parseInt(eventId, 10);
    return this.eventsService.rsvpToEvent(id, body.userId, body.status);
  }

  // SUPPRIME UN ÉVÉNEMENT
  @Delete(':id')
  async removeEvent(@Param('id') id: string, @Body('userId') userId: number) {
    const eventId = parseInt(id, 10);
    return this.eventsService.remove(eventId, userId);
  }
}

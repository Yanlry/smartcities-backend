import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService,
    private notificationService: NotificationService,
  ) { }

  // CRÉE UN NOUVEL ÉVÉNEMENT
  async create(data: CreateEventDto) {
    if (data.reportId && !data.radius) {
      throw new BadRequestException('Un rayon (radius) doit être défini si vous associez un événement à un signalement.');
    }
    // Créer l'événement
    const event = await this.prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        date: data.date,
        location: data.location,
        organizer: { connect: { id: data.organizerId } },
      },
    });
    // Si un signalement est lié à cet événement, associer l'événement au signalement
    if (data.reportId && data.radius) {
      await this.prisma.report.update({
        where: { id: data.reportId },
        data: {
          eventId: event.id, // Lier l'événement au signalement
          radius: data.radius, // Définir un rayon spécifique si nécessaire
        },
      });
    }
    return event;
  }

  // LISTE TOUS LES ÉVÉNEMENTS
  async findAll() {
    return this.prisma.event.findMany();
  }

  // RÉCUPÈRE LES DÉTAILS D'UN ÉVÉNEMENT PAR SON ID
  async findOne(id: number) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  // MET À JOUR LES INFORMATIONS D'UN ÉVÉNEMENT
  async update(id: number, data: UpdateEventDto) {
    return this.prisma.event.update({
      where: { id },
      data,
    });
  }

  // INVITE UN UTILISATEUR À UN ÉVÉNEMENT
  async inviteUser(eventId: number, userId: number) {
    // Créer une invitation pour un utilisateur
    const invite = await this.prisma.invite.create({
      data: {
        eventId: eventId,
        userId: userId,
        status: 'pending', // Statut d'invitation par défaut
      },
    });

    // Notifier l'utilisateur qu'il a été invité
    const message = `Vous avez été invité à un événement (ID : ${eventId})`;
    await this.notificationService.createNotification(
      userId,          // ID de l'utilisateur qui reçoit la notification
      message,         // Le message de notification
      "event",         // Le type de notification (ici "event")
      eventId          // L'ID de l'événement pour lequel la notification est envoyée
    );
    

    return invite;
  }

  // RÉPOND À UNE INVITATION (ACCEPTE OU REFUSE)
  async rsvpToEvent(eventId: number, userId: number, status: string) {
    const result = await this.prisma.invite.updateMany({
      where: { eventId, userId },
      data: { status },
    });

    if (result.count === 0) throw new NotFoundException("Invitation non trouvée");

    if (status === "accepted") {
      await this.prisma.attendee.create({
        data: { eventId: eventId, userId: userId, status: "accepted" },
      });
    }

    // Récupère l'ID de l'organisateur
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });

    if (!event) throw new NotFoundException("Événement non trouvé");

    // Envoie une notification à l'organisateur pour l'informer de la réponse
    const message = `L'utilisateur (ID : ${userId}) a ${status === "accepted" ? "accepté" : "refusé"} l'invitation pour l'événement (ID : ${eventId})`;
    await this.notificationService.createNotification(
      event.organizerId,  // ID de l'organisateur de l'événement
      message,            // Message indiquant si l'utilisateur a accepté ou refusé l'invitation
      "event",            // Le type de notification ("event" pour un événement)
      eventId             // L'ID de l'événement pour lequel la notification est envoyée
    );
    

    return { message: "Statut de l'invitation mis à jour avec succès" };
  }

  // SUPPRIME UN ÉVÉNEMENT
  async remove(eventId: number, userId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException("L'événement n'existe pas");
    }

    if (event.organizerId !== userId) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à supprimer cet événement");
    }

    // Récupère les invités et les participants
    const attendees = await this.prisma.attendee.findMany({
      where: { eventId: eventId },
      select: { userId: true },
    });

    const invites = await this.prisma.invite.findMany({
      where: { eventId: eventId },
      select: { userId: true },
    });

    await this.prisma.attendee.deleteMany({
      where: { eventId: eventId },
    });

    await this.prisma.invite.deleteMany({
      where: { eventId: eventId },
    });

    const deletedEvent = await this.prisma.event.delete({
      where: { id: eventId },
    });

    // Notifie chaque invité et participant que l'événement a été annulé
    const message = `L'événement (ID : ${eventId}) a été annulé.`;
    // Correction pour inviter et notifier
      for (const invite of invites) {
        await this.notificationService.createNotification(
          invite.userId,  // userId de l'invité
          message,  // message de notification
          'event',  // type de notification
          event.id  // relatedId (ID de l'événement)
        );
      }

      // Correction pour les participants
      for (const attendee of attendees) {
        await this.notificationService.createNotification(
          attendee.userId,  // userId du participant
          message,  // message de notification
          'event',  // type de notification
          event.id  // relatedId (ID de l'événement)
        );
      }

    return deletedEvent;
  }
}

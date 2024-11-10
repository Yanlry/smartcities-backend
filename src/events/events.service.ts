import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
    return this.prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        date: data.date,
        location: data.location,
        organizer: { connect: { id: data.organizerId } },
      },
    });
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
    const invite = await this.prisma.invite.create({
      data: {
        eventId: eventId,
        userId: userId,
        status: "pending",
      },
    });

    // Notifie l'utilisateur qu'il a reçu une invitation
    const message = `Vous avez été invité à un événement (ID : ${eventId})`;
    await this.notificationService.createNotification(userId, message);

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
    await this.notificationService.createNotification(event.organizerId, message);

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
    for (const attendee of attendees) {
      await this.notificationService.createNotification(attendee.userId, message);
    }
    for (const invite of invites) {
      await this.notificationService.createNotification(invite.userId, message);
    }

    return deletedEvent;
  }

}

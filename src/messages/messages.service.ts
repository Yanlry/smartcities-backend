import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  // RÉCUPÉRER LES CONVERSATIONS D'UN UTILISATEUR (EN FONCTION DE SES PARTICIPANTS)
  async getConversations(userId: number) {
    return this.prisma.conversation.findMany({
      where: { participants: { some: { id: userId } } },
      include: { messages: true },
    });
  }

  // RÉCUPÉRER LES MESSAGES D'UNE CONVERSATION PAR SON ID
  async getMessages(conversationId: number) {
    return this.prisma.message.findMany({
      where: { conversationId: Number(conversationId) },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ENVOYER UN MESSAGE DANS UNE CONVERSATION
  async sendMessage(data: SendMessageDto) {
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        participants: { some: { id: data.senderId } },
        AND: { participants: { some: { id: data.recipientId } } },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          participants: {
            connect: [{ id: data.senderId }, { id: data.recipientId }],
          },
        },
      });
    }

    const message = await this.prisma.message.create({
      data: {
        content: data.content,
        conversationId: conversation.id,
        senderId: data.senderId,
        isRead: false,
      },
    });

    // Ajout du type et relatedId
    const notificationMessage = `Vous avez reçu un nouveau message de l'utilisateur ID ${data.senderId}`;
    await this.notificationService.createNotification(
      data.recipientId,  // userId
      notificationMessage,  // message
      'message',  // type
      message.id  // relatedId (ici, on passe l'ID du message)
    );

    return message;
  }

// MARQUER LES MESSAGES COMME LUS DANS UNE CONVERSATION
async markMessagesAsRead(markReadDto: MarkReadDto) {
  const { conversationId, userId } = markReadDto;

  const updatedMessages = await this.prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, isRead: false },
    data: { isRead: true },
  });

  const notificationMessage = `Vos messages dans la conversation ID ${conversationId} ont été lus`;
  const conversation = await this.prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participants: true },
  });

  const sender = conversation?.participants.find(participant => participant.id !== userId);
  if (sender) {
    await this.notificationService.createNotification(
      sender.id,  // userId (l'expéditeur du message)
      notificationMessage,  // message
      'message',  // type (le type de notification, ici 'message')
      conversationId  // relatedId (l'ID de la conversation, ici)
    );
  }

  return updatedMessages;
}

  
  // RÉCUPÉRER LES MESSAGES D'UNE MAIRIE POUR LES UTILISATEURS ABONNÉS
  async getMunicipalityMessages(userId: number, municipalityId: number) {
    if (isNaN(userId)) {
      throw new NotFoundException("ID utilisateur non valide.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isSubscribed) {
      throw new ForbiddenException('Accès réservé aux abonnés');
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        participants: { some: { id: municipalityId } },
        AND: { participants: { some: { id: userId } } },
      },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation avec la mairie introuvable");
    }

    return this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
  }

 // ENVOYER UN MESSAGE À UNE MAIRIE (SEULS LES ABONNÉS PEUVENT LE FAIRE)
  async sendMunicipalityMessage(sendMessageDto: SendMessageDto, municipalityId: number) {
    const { senderId, content } = sendMessageDto;

    const user = await this.prisma.user.findUnique({ where: { id: senderId } });
    if (!user || !user.isSubscribed) {
      throw new ForbiddenException("Seuls les utilisateurs abonnés peuvent envoyer des messages à la mairie.");
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        participants: { some: { id: municipalityId } },
        AND: { participants: { some: { id: senderId } } },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          participants: {
            connect: [{ id: senderId }, { id: municipalityId }],
          },
        },
      });
    }

    const message = await this.prisma.message.create({
      data: {
        senderId,
        conversationId: conversation.id,
        content,
        isRead: false,
      },
    });

    const notificationMessage = `Vous avez reçu un nouveau message de l'utilisateur ID ${senderId}`;
    await this.notificationService.createNotification(
      municipalityId,  // userId (la mairie)
      notificationMessage,  // message
      'message',  // type (le type de notification, ici 'message')
      message.id  // relatedId (ID du message)
    );
    return message;
  }
}

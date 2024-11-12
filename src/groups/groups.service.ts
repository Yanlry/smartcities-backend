import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService,
    private notificationService: NotificationService,
  ) { }

  // LISTE TOUS LES GROUPES
  async listGroups() {
    return this.prisma.group.findMany();
  }

  // CRÉE UN NOUVEAU GROUPE
  async createGroup(data: CreateGroupDto, ownerId: number) {

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });
    if (!owner) {
      throw new NotFoundException('Utilisateur propriétaire non trouvé');
    }

    return this.prisma.group.create({
      data: {
        ...data,
        ownerId,
      },
    });
  }

  // RÉCUPÈRE LES DÉTAILS D'UN GROUPE PAR SON ID
  async getGroupById(id: number) {
    const group = await this.prisma.group.findUnique({
      where: { id },
    });
    if (!group) throw new NotFoundException('Groupe non trouvé');
    return group;
  }

  // REJOINDRE UN GROUPE
  async joinGroup(groupId: number, userId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Groupe non trouvé');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        groups: {
          connect: { id: groupId },
        },
      },
    });

    const message = `Un nouvel utilisateur (ID : ${userId}) a rejoint votre groupe (ID : ${groupId})`;
    await this.notificationService.createNotification(
      group.ownerId,  // ID de l'organisateur du groupe
      message,        // Message indiquant qu'un utilisateur a rejoint le groupe
      "group",        // Le type de notification (ici "group" pour groupe)
      groupId         // L'ID du groupe auquel l'utilisateur a rejoint
    );
    

    return { message: 'Vous avez rejoint le groupe avec succès' };
  }


  // QUITTER UN GROUPE
  async leaveGroup(groupId: number, userId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      throw new NotFoundException('Groupe non trouvé');
    }

    const isMember = group.members.some(member => member.id === userId);
    if (!isMember) {
      throw new NotFoundException("L'utilisateur n'est pas membre du groupe");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        groups: {
          disconnect: { id: groupId },
        },
      },
    });

    const message = `L'utilisateur (ID : ${userId}) a quitté votre groupe (ID : ${groupId})`;
    await this.notificationService.createNotification(
      group.ownerId,  // ID de l'organisateur du groupe
      message,        // Message indiquant qu'un utilisateur a quitté le groupe
      "group",        // Le type de notification (ici "group" pour groupe)
      groupId         // L'ID du groupe auquel l'utilisateur a quitté
    );
    

    return { message: 'Utilisateur retiré du groupe avec succès' };
  }


  // RÉCUPÈRE LES MEMBRES D'UN GROUPE
  async getGroupMembers(groupId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) throw new NotFoundException('Groupe non trouvé');
    return group.members;
  }

  // SUPPRIME UN GROUPE
  async deleteGroup(groupId: number, ownerId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      throw new NotFoundException('Groupe non trouvé');
    }

    if (group.ownerId !== ownerId) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à supprimer ce groupe");
    }

    const message = `Le groupe (ID : ${groupId}) auquel vous apparteniez a été supprimé.`;
    for (const member of group.members) {
      await this.notificationService.createNotification(
        member.id,      // ID de chaque membre du groupe
        message,        // Message indiquant que le groupe a été supprimé
        "group",        // Le type de notification (ici "group" pour groupe)
        groupId         // L'ID du groupe supprimé
      );
      
    }

    return this.prisma.group.delete({ where: { id: groupId } });
  }

}

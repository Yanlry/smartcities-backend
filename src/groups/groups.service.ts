import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async listGroups() {
    return this.prisma.group.findMany();
  }

  async createGroup(data: CreateGroupDto, ownerId: number) {
    // Vérifiez que l'utilisateur existe
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });
    if (!owner) {
      throw new NotFoundException('Utilisateur propriétaire non trouvé');
    }

    // Créez le groupe si l'utilisateur existe
    return this.prisma.group.create({
      data: {
        ...data,
        ownerId,
      },
    });
  }

 // groups.service.ts
async getGroupById(id: number) {
    const group = await this.prisma.group.findUnique({
      where: { id },
    });
    if (!group) throw new NotFoundException('Groupe non trouvé');
    return group;
  }
  

  // Joindre un groupe
  async joinGroup(groupId: number, userId: number) {
    // Vérifie si le groupe existe
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Groupe non trouvé');

    // Ajoute l'utilisateur en tant que membre
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        groups: {
          connect: { id: groupId },
        },
      },
    });

    return { message: 'Vous avez rejoint le groupe avec succès' };
  }

  // Quitter un groupe
  async leaveGroup(groupId: number, userId: number) {
    // Vérifie si l'utilisateur est membre du groupe
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

    // Déconnecter l'utilisateur du groupe
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        groups: {
          disconnect: { id: groupId },
        },
      },
    });

    return { message: 'Utilisateur retiré du groupe avec succès' };
  }


  

  async deleteGroup(groupId: number, ownerId: number) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (group.ownerId !== ownerId) throw new ForbiddenException('Not authorized');
    return this.prisma.group.delete({ where: { id: groupId } });
  }

  async getGroupMembers(groupId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true, // Inclut les membres dans le résultat
      },
    });

    if (!group) throw new NotFoundException('Groupe non trouvé');
    return group.members; // Retourne seulement la liste des membres
  }
}

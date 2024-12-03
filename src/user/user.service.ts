import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { last } from 'rxjs';
import { S3Service } from 'src/services/s3/s3.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly s3Service: S3Service,
  ) { }

  async getUserById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        lastName: true,
        firstName: true,
        createdAt: true,
        trustRate: true,
        latitude: true,
        longitude: true,
        photos: {
          where: { isProfile: true },
          select: {
            id: true,
            url: true,
          },
        },
      },
    });
  
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
  
    const profilePhoto = user.photos.length > 0 ? user.photos[0] : null;
  
    return {
      ...user,
      profilePhoto,
    };
  }
  
  
  async updateProfilePhoto(userId: number, newProfilePhoto: Express.Multer.File): Promise<string> {
    // Récupérer l'ancienne photo de profil
    const oldProfilePhoto = await this.prisma.photo.findFirst({
      where: { userId, isProfile: true },
    });
  
    // Supprimer l'ancienne photo de profil de S3 si elle existe
    if (oldProfilePhoto) {
      try {
        await this.s3Service.deleteFile(oldProfilePhoto.url);
        console.log('Ancienne photo de profil supprimée :', oldProfilePhoto.url);
      } catch (error) {
        console.error('Erreur lors de la suppression de l\'ancienne photo :', error.message);
        // On continue le processus même si la suppression échoue
      }
    } else {
      console.log('Aucune ancienne photo à supprimer');
    }
  
    // Upload de la nouvelle photo
    const newProfilePhotoUrl = await this.s3Service.uploadFile(newProfilePhoto);
    console.log('Nouvelle photo uploadée :', newProfilePhotoUrl);
  
    // Mettre à jour la base de données
    await this.prisma.photo.updateMany({
      where: { userId },
      data: { isProfile: false },
    });
  
    const createdPhoto = await this.prisma.photo.create({
      data: {
        url: newProfilePhotoUrl,
        isProfile: true,
        userId,
      },
    });
  
    return createdPhoto.url;
  }
  
  
  
  
  // MET À JOUR LE PROFIL D'UN UTILISATEUR
  async updateUser(userId: number, data: any) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return updatedUser;
  }
  
  // MET A JOUR LE TAUX DE CONFIANCE DE L'UTILISATEUR
  async updateUserTrustRate(userId: number) {
    const votes = await this.prisma.vote.findMany({
      where: { userId },
    });

    let trustRate = 0;
    let validVotes = 0;

    // Calcul du trustRate basé sur les votes positifs
    votes.forEach(vote => {
      if (vote.type === 'up') {
        trustRate += 1;
        validVotes += 1;
      } else if (vote.type === 'down') {
        trustRate -= 1;
      }
    });

    // Appliquer la réputation (trustRate) à l'utilisateur
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        trustRate: validVotes > 0 ? trustRate / validVotes : 0, // Moyenne des votes valides
      },
    });
  }

  // LISTE LES UTILISATEURS AVEC POSSIBILITÉ DE FILTRE
  async listUsers(filter: any) {
    const users = await this.prisma.user.findMany({
      where: filter,
      select: {
        id: true,
        email: true,
        username: true,
        lastName: true,
        firstName: true,
        createdAt: true,
        reports: true,
      },
    });
    return users;
  }

  // RÉCUPÈRE LES STATISTIQUES D'UN UTILISATEUR (INCLUANT LE TRUST RATE)
  async getUserStats(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        reports: true,
        trustRate: true,  // Inclure le trustRate dans les statistiques
      },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    return {
      numberOfReports: user.reports.length,  // Compte les signalements
      trustRate: user.trustRate,  // Récupère le trustRate
    };
  }

  // S'ABONNER A UN UTILISATEUR 
  async followUser(userId: number, followerId: number) {
    const follow = await this.prisma.userFollow.create({
      data: {
        followingId: userId,
        followerId: followerId,
      },
    });
    // Créer une notification pour informer l'utilisateur qu'il a un nouveau follower
    const follower = await this.prisma.user.findUnique({ where: { id: followerId } });
    
    // Ajoutez ici les valeurs des arguments `type` et `relatedId`
    await this.notificationService.createNotification(
      userId, 
      `${follower.username} vous suit maintenant.`,
      "FOLLOW",           // Exemple de valeur pour le type
      follow.id           // Par exemple, l'ID du suivi
    );
    return follow;
  }

  // SE DESABONNER D'UN UTILISATEUR
  async unfollowUser(userId: number, followerId: number) {
    return this.prisma.userFollow.deleteMany({
      where: {
        followingId: userId,
        followerId: followerId,
      },
    });
  }

  // RECUPERE LE NOMBRE DE FOLLOWER D'UN UTILISATEUR
  async getUserWithFollowers(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { followers: true }, // Compte les followers
        },
      },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    return {
      ...user,
      followersCount: user._count.followers, // Ajoute le nombre de followers au résultat
    };
  }

  // SUPPRIME UN UTILISATEUR PAR SON ID
  async deleteUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Utilisateur supprimé avec succès' };
  }

  
}

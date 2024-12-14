import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { first, last } from 'rxjs';
import { S3Service } from 'src/services/s3/s3.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { use } from 'passport';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly s3Service: S3Service
  ) {}

  async listTop10Smarter() {
    // Récupérer tous les utilisateurs et leur nombre de votes
    const users = await this.prisma.user.findMany({
      include: {
        votes: true, // Inclure les votes pour calculer le total
        photos: {
          where: { isProfile: true },
          select: { url: true },
        },
      },
    });

    // Calculer le nombre de votes et trier
    const usersWithRanking = users
      .map((user) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        useFullName: user.useFullName,
        voteCount: user.votes.length,
        photo: user.photos[0]?.url || null,
      }))
      .sort((a, b) => b.voteCount - a.voteCount); // Trier par votes décroissants

    // Ajouter les rangs à chaque utilisateur
    const usersWithRankingAndPosition = usersWithRanking.map((user, index) => ({
      ...user,
      ranking: index + 1, // Classement basé sur la position
    }));

    // Retourner les 10 meilleurs utilisateurs
    return usersWithRankingAndPosition.slice(0, 10);
  }

  async listAllUsersByRanking() {
    // Récupérer tous les utilisateurs avec leurs votes
    const users = await this.prisma.user.findMany({
      include: {
        votes: true, // Inclure les votes pour chaque utilisateur
        photos: {
          where: { isProfile: true },
          select: { url: true },
        },
      },
    });

    // Calculer le nombre de votes et trier par votes décroissants
    const usersWithRanking = users
      .map((user) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        useFullName: user.useFullName,
        voteCount: user.votes.length,
        photo: user.photos[0]?.url || null,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    // Ajouter les rangs
    return usersWithRanking.map((user, index) => ({
      ...user,
      ranking: index + 1, // Classement global
    }));
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

  // METTRE À JOUR LA PREFERENCE D'AFFICHAGE DE L'UTILISATEUR
  async updateDisplayPreference(userId: number, useFullName: boolean) {
    // Vérifie si l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Met à jour la préférence d'affichage
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { useFullName },
    });

    return {
      message: 'Préférence mise à jour avec succès',
      user: {
        id: updatedUser.id,
        useFullName: updatedUser.useFullName,
      },
    };
  }

  async getUserRanking(userId: number) {
    // Étape 1 : Récupérer les utilisateurs classés par votes
    const users = await this.prisma.user.findMany({
      include: {
        votes: true, // Récupère les votes pour chaque utilisateur
      },
    });

    // Étape 2 : Calculer le nombre de votes pour chaque utilisateur
    const usersWithVoteCount = users.map((user) => ({
      id: user.id,
      username: user.username,
      voteCount: user.votes.length, // Nombre total de votes
    }));

    // Étape 3 : Trier par le nombre de votes (ordre décroissant)
    usersWithVoteCount.sort((a, b) => b.voteCount - a.voteCount);

    // Étape 4 : Trouver le rang de l'utilisateur actuel
    const ranking =
      usersWithVoteCount.findIndex((user) => user.id === userId) + 1;

    return {
      ranking,
      totalUsers: usersWithVoteCount.length,
      users: usersWithVoteCount,
    };
  }

  async getUserById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        showEmail: true,
        username: true,
        lastName: true,
        firstName: true,
        useFullName: true,
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
        followers: {
          select: {
            follower: {
              select: {
                id: true,
                username: true,
                photos: {
                  where: { isProfile: true },
                  select: { url: true },
                },
              },
            },
          },
        },
        following: {
          select: {
            following: {
              select: {
                id: true,
                username: true,
                photos: {
                  where: { isProfile: true },
                  select: { url: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé5');
    }

    return {
      ...user,
      email: user.showEmail ? user.email : null,
      profilePhoto: user.photos.length > 0 ? user.photos[0] : null,
      followers: user.followers.map((f) => ({
        id: f.follower.id,
        username: f.follower.username,
        profilePhoto: f.follower.photos[0]?.url || null,
      })),
      following: user.following.map((f) => ({
        id: f.following.id,
        username: f.following.username,
        profilePhoto: f.following.photos[0]?.url || null,
      })),
    };
  }

  async updateEmailVisibility(userId: number, showEmail: boolean) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { showEmail },
    });
  
    return {
      message: "Préférence mise à jour avec succès.",
      showEmail: user.showEmail,
    };
  }
  
  async updateProfilePhoto(
    userId: number,
    newProfilePhoto: Express.Multer.File
  ): Promise<string> {
    // Récupérer l'ancienne photo de profil
    const oldProfilePhoto = await this.prisma.photo.findFirst({
      where: { userId, isProfile: true },
    });

    // Supprimer l'ancienne photo de profil de S3 si elle existe
    if (oldProfilePhoto) {
      try {
        await this.s3Service.deleteFile(oldProfilePhoto.url);
        console.log(
          'Ancienne photo de profil supprimée :',
          oldProfilePhoto.url
        );
      } catch (error) {
        console.error(
          "Erreur lors de la suppression de l'ancienne photo :",
          error.message
        );
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

  async updateUser(userId: number, data: UpdateUserDto) {
    // Filtrer les champs invalides (si des champs non autorisés sont envoyés)
    const { email, username, firstName, lastName } = data;

    // Valider les champs si nécessaire
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { email, username, firstName, lastName },
    });

    return updatedUser;
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ) {
    // Récupérer l'utilisateur existant
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new Error('Utilisateur introuvable.');
    }

    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      existingUser.password
    );
    if (!isPasswordValid) {
      throw new Error('Mot de passe actuel incorrect.');
    }

    // Hacher le nouveau mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Mettre à jour le mot de passe dans la base de données
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Mot de passe mis à jour avec succès.' };
  }

  // MET A JOUR LE TAUX DE CONFIANCE DE L'UTILISATEUR
  async updateUserTrustRate(userId: number) {
    const votes = await this.prisma.vote.findMany({
      where: { userId },
    });

    let trustRate = 0;
    let validVotes = 0;

    // Calcul du trustRate basé sur les votes positifs
    votes.forEach((vote) => {
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

  // RÉCUPÈRE LES STATISTIQUES D'UN UTILISATEUR (INCLUANT LE TRUST RATE)
  async getUserStats(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        reports: true,
        trustRate: true, // Inclure le trustRate dans les statistiques
      },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    return {
      numberOfReports: user.reports.length, // Compte les signalements
      trustRate: user.trustRate, // Récupère le trustRate
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
    const follower = await this.prisma.user.findUnique({
      where: { id: followerId },
    });

    // Ajoutez ici les valeurs des arguments `type` et `relatedId`
    await this.notificationService.createNotification(
      userId,
      `${follower.username} vous suit maintenant.`,
      'FOLLOW', // Exemple de valeur pour le type
      follow.id // Par exemple, l'ID du suivi
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

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { NotificationService } from '../notification/notification.service';
import { CreateCommentDto } from './dto/create-comment.dto'; // Ajouter le DTO

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) { }

  // CRÉER UNE NOUVELLE PUBLICATION
  async createPost(createPostDto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: {
        content: createPostDto.content,
        author: {
          connect: { id: createPostDto.authorId }, // Utilisez `connect` pour lier l'auteur
        },
        latitude: createPostDto.latitude,
        longitude: createPostDto.longitude,
      },
    });
  
    // Notifier les abonnés de l'auteur de la publication
    const followers = await this.prisma.user.findMany({
      where: {
        following: {
          some: { id: createPostDto.authorId },
        },
      },
      select: { id: true },
    });
  
    const notificationMessage = `Nouvelle publication de ${createPostDto.authorId}`;
    for (const follower of followers) {
      await this.notificationService.createNotification(
        follower.id,               // ID de l'abonné
        notificationMessage,       // Message de notification
        "post",                    // Type de notification
        post.id                    // ID du post concerné
      );
    }
  
    return post;
  }

  // RÉCUPÈRE UNE LISTE DE PUBLICATIONS AVEC LE NOMBRE DE LIKES
  async listPosts(filters: any) {
    const posts = await this.prisma.post.findMany({
      where: filters,
      include: {
        likes: true,
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            useFullName: true,
            photos: {
              where: { isProfile: true },
              select: { url: true },
            },
          },
        },
      },
    });

    return posts.map((post) => ({
      ...post,
      likesCount: post.likes.length,
      authorName: post.author.useFullName
        ? `${post.author.firstName} ${post.author.lastName}`
        : post.author.username || 'Utilisateur inconnu',
      profilePhoto: post.author.photos[0]?.url || null,
    }));
  }

  // RÉCUPÈRE UNE PUBLICATION PAR SON ID AVEC LE NOMBRE DE LIKES
  async getPostById(id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        _count: {
          select: { likes: true }, // Compte le nombre de likes
        },
      },
    });

    if (!post) throw new NotFoundException('Publication non trouvée');

    return {
      ...post,
      likesCount: post._count.likes, // Ajoute le nombre de likes au résultat
    };
  }

  // MODIFIER UNE PUBLICATION
  async updatePost(id: number, updatePostDto: UpdatePostDto) {
    return this.prisma.post.update({
      where: { id },
      data: updatePostDto,
    });
  }

  async toggleLike(postId: number, userId: number) {
    // Vérifie si un like existe déjà pour cette publication et cet utilisateur
    const existingLike = await this.prisma.like.findFirst({
      where: { postId, userId },
    });
  
    if (existingLike) {
      // Supprime le like existant et décrémente le trustRate de l'utilisateur
      await this.prisma.like.delete({
        where: { id: existingLike.id },
      });
      await this.updateUserTrustRate(userId, -1); // Décrémenter le trustRate
      return { message: 'Vous venez de déliker' };
    } else {
      // Ajoute un like pour la publication et incrémente le trustRate de l'utilisateur
      const like = await this.prisma.like.create({
        data: {
          postId,
          userId,
        },
      });
  
      await this.updateUserTrustRate(userId, 1); // Incrémenter le trustRate
  
      // Récupère l'auteur de la publication pour lui envoyer une notification
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, authorId: true }, // Sélectionne id et authorId
      });
  
      if (post?.authorId) {
        const notificationMessage = `Votre publication a été aimée par l'utilisateur ID ${userId}`;
        await this.notificationService.createNotification(
          post.authorId,          // userId (l'auteur du post)
          notificationMessage,     // message (le message de notification)
          "post",                  // type (le type de notification, ici "post")
          post.id                  // relatedId (l'ID du post concerné)
        );
      }
      return { message: 'Bravo vous avez liké' };
    }
  }
  

  // MET À JOUR LE TRUSTRATE D'UN UTILISATEUR
  async updateUserTrustRate(userId: number, increment: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustRate: true },
    });

    if (!user) throw new BadRequestException('Utilisateur non trouvé');

    // Calculer le nouveau trustRate en fonction de l'incrément
    const newTrustRate = user.trustRate + increment;

    // Si la nouvelle valeur est en dehors de la plage [-1, 1], la clore à cette plage
    const clampedTrustRate = Math.max(-1, Math.min(newTrustRate, 1));

    // Mettre à jour le trustRate de l'utilisateur dans la base de données
    await this.prisma.user.update({
      where: { id: userId },
      data: { trustRate: clampedTrustRate }, // Le trustRate est maintenant limité à la plage [-1, 1]
    });
  }

  // AJOUTE UN COMMENTAIRE À UNE PUBLICATION ET MET À JOUR LE TRUSTRATE DE L'UTILISATEUR
  async commentOnPost(commentData: CreateCommentDto) {
    const { postId, userId, text } = commentData;

    // Vérifier que tous les champs sont fournis
    if (!postId || !userId || !text) {
      throw new BadRequestException("Post ID, User ID, and Comment text are required");
    }

    // Créer le commentaire dans la base de données
    const newComment = await this.prisma.comment.create({
      data: {
        postId,   // Assurez-vous que 'postId' est bien un nombre
        userId,   // Assurez-vous que 'userId' est bien un nombre
        text,     // Le texte du commentaire
      },
    });

    // Mettre à jour le trustRate de l'utilisateur après avoir commenté
    await this.updateUserTrustRate(userId, 0.5); // Exemple d'incrément (ajuster selon la logique de ton application)

    return newComment;
  }

  // SUPPRIME UNE PUBLICATION
  async deletePost(id: number) {
    return this.prisma.post.delete({ where: { id } });
  }
}

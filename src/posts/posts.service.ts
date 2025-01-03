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
  // Créer la publication
  const post = await this.prisma.post.create({
    data: {
      content: createPostDto.content,
      author: {
        connect: { id: createPostDto.authorId }, // Lier l'auteur à la publication
      },
      latitude: createPostDto.latitude,
      longitude: createPostDto.longitude,
    },
  });

  // Récupérer les informations de l'auteur
  const author = await this.prisma.user.findUnique({
    where: { id: createPostDto.authorId },
    select: {
      firstName: true,
      lastName: true,
      username: true,
      useFullName: true,
    },
  });

  if (!author) {
    console.error(`Auteur introuvable pour l'ID : ${createPostDto.authorId}`);
    return post;
  }

  // Construire le nom lisible de l'auteur
  const authorName = author.useFullName
    ? `${author.firstName} ${author.lastName}`
    : author.username || 'Un utilisateur';

  // Récupérer les abonnés de l'auteur
  const followers = await this.prisma.user.findMany({
    where: {
      following: {
        some: { id: createPostDto.authorId },
      },
    },
    select: { id: true },
  });

  // Créer le message de notification
  const notificationMessage = `${authorName} a publié un nouveau contenu.`;

  // Envoyer les notifications à tous les abonnés
  for (const follower of followers) {
    await this.notificationService.createNotification(
      follower.id,        // ID de l'abonné
      notificationMessage, // Message personnalisé
      "post",             // Type de notification
      post.id,            // ID du post concerné
      createPostDto.authorId // InitiatorId (ID de l'auteur de la publication)
    );
  }

  return post;
}

// RÉCUPÈRE UNE LISTE DE PUBLICATIONS AVEC LE NOMBRE DE LIKES ET LES COMMENTAIRES
async listPosts(filters: any) {
  const posts = await this.prisma.post.findMany({
    where: filters,
    include: {
      likes: true,
      comments: {
        include: {
          user: {
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
      },
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
    comments: post.comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      userId: comment.user.id, // Ajout explicite du userId
      userName: comment.user.useFullName
        ? `${comment.user.firstName} ${comment.user.lastName}`
        : comment.user.username || 'Utilisateur inconnu',
      userProfilePhoto: comment.user.photos[0]?.url || null,
    })),
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
  
      // Récupère les informations de l'utilisateur initiateur (celui qui a aimé)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          useFullName: true,
        },
      });
  
      if (post?.authorId && user) {
        // Construire un nom lisible pour l'utilisateur initiateur
        const likerName = user.useFullName
          ? `${user.firstName} ${user.lastName}`
          : user.username || 'Un utilisateur';
  
        // Message de notification personnalisé
        const notificationMessage = `${likerName} a aimé votre publication.`;
  
        // Envoi de la notification
        await this.notificationService.createNotification(
          post.authorId,          // userId (l'auteur du post)
          notificationMessage,     // message (personnalisé avec le nom du liker)
          "LIKE",                  // type (le type de notification, ici "LIKE")
          post.id,                 // relatedId (l'ID du post concerné)
          userId                   // initiatorId (ID de celui qui a aimé)
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

  async commentOnPost(commentData: CreateCommentDto) {
    const { postId, userId, text } = commentData;
  
    if (!postId || !userId || !text) {
      throw new BadRequestException("Post ID, User ID, and Comment text are required");
    }
  
    // Log des données reçues
    console.log("Données reçues dans le backend :", commentData);
  
    // Créer le commentaire
    const newComment = await this.prisma.comment.create({
      data: {
        postId,
        userId,
        text,
      },
    });
  
    // Incrémenter le trust rate de l'utilisateur qui commente
    await this.updateUserTrustRate(userId, 0.5);
  
    // Récupérer l'auteur du post
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
  
    if (!post) {
      console.error(`Post introuvable pour l'ID : ${postId}`);
      return newComment;
    }
  
    // Récupérer les informations de l'utilisateur qui commente
    const commenter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        username: true,
        useFullName: true,
      },
    });
  
    if (!commenter) {
      console.error(`Utilisateur introuvable pour l'ID : ${userId}`);
      return newComment;
    }
  
    // Construire le nom lisible de l'utilisateur qui commente
    const commenterName = commenter.useFullName
      ? `${commenter.firstName} ${commenter.lastName}`
      : commenter.username || "Un utilisateur";
  
    // Créer le message de notification
    const notificationMessage = `${commenterName} a commenté votre publication.`;
  
    // Envoyer la notification à l'auteur du post
    if (post.authorId !== userId) {
      await this.notificationService.createNotification(
        post.authorId,          // ID de l'auteur du post
        notificationMessage,    // Message de notification
        "comment",              // Type de notification
        postId,                 // ID du post concerné
        userId                  // InitiatorId (ID de l'utilisateur qui commente)
      );
    }
  
    return newComment;
  }

  async deleteComment(commentId: number) {
    try {
      // Supprimer le commentaire par ID
      return await this.prisma.comment.delete({
        where: { id: commentId },
      });
    } catch (error) {
      console.error("Erreur lors de la suppression du commentaire :", error);
      throw new NotFoundException("Commentaire non trouvé");
    }
  }
  
  async deletePost(id: number) {
    try {
      // Supprime les commentaires associés au post
      await this.prisma.comment.deleteMany({
        where: { postId: id },
      });
  
      // Supprime les likes associés au post
      await this.prisma.like.deleteMany({
        where: { postId: id },
      });
  
      // Supprime le post
      return await this.prisma.post.delete({
        where: { id },
      });
    } catch (error) {
      console.error("Erreur lors de la suppression :", error);
      throw new Error("Impossible de supprimer la publication.");
    }
  }
}

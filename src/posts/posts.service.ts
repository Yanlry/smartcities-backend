import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { NotificationService } from '../notification/notification.service';
import { CreateCommentDto } from './dto/create-comment.dto'; // Ajouter le DTO

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService
  ) {}

  // CRÉER UNE NOUVELLE PUBLICATION
  async createPost(createPostDto: CreatePostDto, photoUrls: string[]) {
    console.log('Photo URLs received in createPost service:', photoUrls);
  
    // Création de la publication
    const post = await this.prisma.post.create({
      data: {
        content: createPostDto.content,
        latitude: createPostDto.latitude,
        longitude: createPostDto.longitude,
        author: {
          connect: { id: createPostDto.authorId }, // Lier l'auteur à la publication
        },
      },
    });
  
    console.log('Post created in database:', post);
  
    // Associer les photos au post
    if (photoUrls && photoUrls.length > 0) {
      const photosData = photoUrls.map((url) => ({
        url,
        postId: post.id,
      }));
  
      console.log('Associating photos with post:', photosData);
  
      try {
        await this.prisma.photo.createMany({
          data: photosData,
        });
      } catch (error) {
        console.error('Erreur lors de l’association des photos au post:', error);
        throw new BadRequestException('Erreur lors de l’association des photos.');
      }
    }
  
    // Récupérer la publication mise à jour avec les photos associées
    const updatedPost = await this.prisma.post.findUnique({
      where: { id: post.id },
      include: { photos: true }, // Inclure les photos associées
    });
  
    console.log('Post with associated photos:', updatedPost);
  
    return updatedPost; // Retourne le post avec les photos associées
  }

  async listPosts(filters: any, userId: number) {
    const posts = await this.prisma.post.findMany({
      where: filters,
      include: {
        likes: true, // Inclure les likes pour calculer `likedByUser`
        photos: {
          select: { url: true }, // Sélectionner uniquement les URLs des photos
        },
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
  
    const organizeComments = (comments) => {
      const commentMap = new Map();
  
      // Créer une map pour tous les commentaires
      comments.forEach((comment) => {
        commentMap.set(comment.id, { ...comment, replies: [] });
      });
  
      const rootComments = [];
  
      comments.forEach((comment) => {
        if (comment.parentId) {
          // Si le commentaire a un parentId, ajoutez-le aux replies du parent
          const parentComment = commentMap.get(comment.parentId);
          if (parentComment) {
            parentComment.replies.push(commentMap.get(comment.id));
          }
        } else {
          // Sinon, c'est un commentaire principal
          rootComments.push(commentMap.get(comment.id));
        }
      });
  
      return rootComments;
    };
  
    return posts.map((post) => ({
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likesCount: post.likes.length, // Compte le nombre de likes
      likedByUser: post.likes.some((like) => like.userId === userId), // Vérifie si l'utilisateur a liké
      authorId: post.author.id,
      authorName: post.author.useFullName
        ? `${post.author.firstName} ${post.author.lastName}`
        : post.author.username || "Utilisateur inconnu",
      profilePhoto: post.author.photos[0]?.url || null,
      photos: post.photos.map((photo) => photo.url), // Ajouter les URLs des photos
      comments: organizeComments(
        post.comments.map((comment) => ({
          id: comment.id,
          text: comment.text,
          createdAt: comment.createdAt, // Ajouté pour afficher la date
          parentId: comment.parentId || null, // Inclure le parentId
          userId: comment.user?.id || null,
          userName: comment.user
            ? comment.user.useFullName
              ? `${comment.user.firstName} ${comment.user.lastName}`
              : comment.user.username || "Utilisateur inconnu"
            : "Utilisateur inconnu",
          userProfilePhoto: comment.user?.photos[0]?.url || null,
        }))
      ),
    }));
  }

  // RÉCUPÈRE UNE PUBLICATION PAR SON ID AVEC LE NOMBRE DE LIKES
// RÉCUPÈRE UNE PUBLICATION PAR SON ID AVEC LE NOMBRE DE LIKES ET LES PHOTOS ASSOCIÉES
async getPostById(id: number, userId: number) {
  const post = await this.prisma.post.findUnique({
    where: { id },
    include: {
      likes: true,
      photos: {
        select: { url: true },
      },
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
      _count: {
        select: { likes: true },
      },
    },
  });

  if (!post) throw new NotFoundException('Publication non trouvée');

  // Organiser les commentaires comme dans listPosts
  const organizeComments = (comments) => {
    const commentMap = new Map();

    comments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    const rootComments = [];

    comments.forEach((comment) => {
      if (comment.parentId) {
        const parentComment = commentMap.get(comment.parentId);
        if (parentComment) {
          parentComment.replies.push(commentMap.get(comment.id));
        }
      } else {
        rootComments.push(commentMap.get(comment.id));
      }
    });

    return rootComments;
  };

  // Vérifier si l'utilisateur connecté a liké ce post
  const likedByUser = post.likes.some((like) => like.userId === userId);

  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    likesCount: post._count.likes,
    likedByUser, // Ajouter cette propriété
    authorId: post.author.id,
    authorName: post.author.useFullName
      ? `${post.author.firstName} ${post.author.lastName}`
      : post.author.username || 'Utilisateur inconnu',
    profilePhoto: post.author.photos[0]?.url || null,
    photos: post.photos.map((photo) => photo.url),
    comments: organizeComments(
      post.comments.map((comment) => ({
        id: comment.id,
        text: comment.text,
        createdAt: comment.createdAt,
        parentId: comment.parentId || null,
        userId: comment.user?.id || null,
        userName: comment.user
          ? comment.user.useFullName
            ? `${comment.user.firstName} ${comment.user.lastName}`
            : comment.user.username || 'Utilisateur inconnu'
          : 'Utilisateur inconnu',
        userProfilePhoto: comment.user?.photos[0]?.url || null,
      }))
    ),
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
          post.authorId, // userId (l'auteur du post)
          notificationMessage, // message (personnalisé avec le nom du liker)
          'LIKE', // type (le type de notification, ici "LIKE")
          post.id, // relatedId (l'ID du post concerné)
          userId // initiatorId (ID de celui qui a aimé)
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
    const { postId, userId, text, parentId } = commentData;
  
    // Validation des champs obligatoires
    if (!postId || !userId || !text) {
      throw new BadRequestException("Post ID, User ID, and Comment text are required");
    }
  
    // Si parentId est fourni, vérifier que le commentaire parent existe
    if (parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentId },
      });
  
      if (!parentComment) {
        throw new BadRequestException("Le commentaire parent n'existe pas.");
      }
    }
  
    // Log des données reçues
    console.log("Données reçues dans le backend :", commentData);
  
    // Créer le commentaire ou la réponse
    const newComment = await this.prisma.comment.create({
      data: {
        postId,
        userId,
        text,
        parentId, // Ajout du parentId pour lier à un commentaire parent
      },
    });
  
    // Incrémenter le trust rate de l'utilisateur qui commente
    await this.updateUserTrustRate(userId, 0.5);
  
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
  
    // Gestion des notifications
    if (parentId) {
      // Notification pour une réponse
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true },
      });
  
      if (parentComment && parentComment.userId !== userId) {
        const notificationMessage = `${commenterName} a répondu à votre commentaire.`;
  
        await this.notificationService.createNotification(
          parentComment.userId, // ID de l'auteur du commentaire parent
          notificationMessage,  // Message de notification
          "comment_reply",      // Type de notification
          postId,               // ID du post concerné
          userId                // InitiatorId
        );
      }
    } else {
      // Notification pour un commentaire principal
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });
  
      if (!post) {
        console.error(`Post introuvable pour l'ID : ${postId}`);
        return newComment;
      }
  
      if (post.authorId !== userId) {
        const notificationMessage = `${commenterName} a commenté votre publication.`;
  
        await this.notificationService.createNotification(
          post.authorId,        // ID de l'auteur du post
          notificationMessage,  // Message de notification
          "comment",            // Type de notification
          postId,               // ID du post concerné
          userId                // InitiatorId
        );
      }
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
      console.error('Erreur lors de la suppression du commentaire :', error);
      throw new NotFoundException('Commentaire non trouvé');
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
      console.error('Erreur lors de la suppression :', error);
      throw new Error('Impossible de supprimer la publication.');
    }
  }
}

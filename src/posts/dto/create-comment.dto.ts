export class CreateCommentDto {
    postId: number; // ID de la publication
    userId: number; // ID de l'utilisateur qui commente
    text: string;   // Le contenu du commentaire
  }
  
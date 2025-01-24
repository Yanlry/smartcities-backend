export class CreateCommentDto {
  postId: number; 
  userId: number; 
  text: string;     
  parentId?: number; 
}
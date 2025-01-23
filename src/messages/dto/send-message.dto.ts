export class SendMessageDto {
  senderId: number;
  recipientId?: number; 
  content: string;
}
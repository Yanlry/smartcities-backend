export class SendMessageDto {
  senderId: number;
  recipientId?: number; // Facultatif si message à la mairie
  content: string;
}
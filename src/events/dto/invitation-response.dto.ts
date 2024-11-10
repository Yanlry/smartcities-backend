export class InvitationResponseDto {
    userId: number;  // L'ID de l'utilisateur répondant à l'invitation
    response: 'accept' | 'decline';  // La réponse à l'invitation : accepte ou décline
  }
  
export class CreateEventDto {
  title: string;
  description?: string;
  date: Date;
  location?: string;
  organizerId: number; // Id de l'utilisateur qui crée l'événement
}

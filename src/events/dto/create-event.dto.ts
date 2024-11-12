export class CreateEventDto {
  title: string;
  description: string;
  date: Date;
  location: string;
  organizerId: number; // L'organisateur de l'événement
  reportId?: number; // Optionnel, l'ID du signalement
  radius?: number; // Optionnel, le rayon pour associer l'événement à un signalement
}

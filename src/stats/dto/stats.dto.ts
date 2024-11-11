// src/stats/dto/stats.dto.ts
export class StatsDto {
    reportsCount: number;        // Nombre de rapports créés par l'utilisateur
    commentsCount: number;       // Nombre de commentaires de l'utilisateur
    eventsCount: number;         // Nombre d'événements auxquels l'utilisateur a participé
    reportTypes: { [key: string]: number }; // Répartition des rapports par type
  }
  
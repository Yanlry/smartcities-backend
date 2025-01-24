export class StatsDto {
    reportsCount: number;       
    commentsCount: number;    
    eventsCount: number;    
    reportTypes: { [key: string]: number }; 
  }
  
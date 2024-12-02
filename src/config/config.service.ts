import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  getFrontendConfig() {
    return {
      apiUrl: this.configService.get<string>('FRONTEND_API_URL'),
      mapsApiKey: this.configService.get<string>('FRONTEND_PUBLIC_MAPS_API_KEY'),
    };
  }
}

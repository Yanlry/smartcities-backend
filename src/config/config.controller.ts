import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './config.service';

@Controller('config')
export class AppConfigController {
  constructor(private appConfigService: AppConfigService) {}

  @Get()
  getFrontendConfig() {
    return this.appConfigService.getFrontendConfig();
  }
}

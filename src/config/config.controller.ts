import { Controller, Get } from '@nestjs/common';

@Controller('config')
export class ConfigController {
  @Get('keys')
  getKeys() {
    return {
      openCageApiKey: process.env.OPEN_CAGE_API_KEY,
      pulseApiKey: process.env.PULSE_API_KEY,
      sendGridApiKey: process.env.SENDGRID_API_KEY,
    };
  }
}

import { Module } from '@nestjs/common';
import { BotSettingsService } from './bot-settings.service';
import { BotSettingsController } from './bot-settings.controller';

@Module({
  controllers: [BotSettingsController],
  providers: [BotSettingsService],
  exports: [BotSettingsService],
})
export class BotSettingsModule {}

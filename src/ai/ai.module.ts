import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { BotSettingsModule } from '../bot-settings/bot-settings.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';

@Module({
  imports: [BotSettingsModule, KnowledgeBaseModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

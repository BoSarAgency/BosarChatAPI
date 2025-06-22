import { Module } from '@nestjs/common';
import { BotSettingsModule } from '../bot-settings/bot-settings.module';
import { S3Module } from '../s3/s3.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { PdfDocumentsController } from './pdf-documents.controller';
import { PdfDocumentsService } from './pdf-documents.service';

@Module({
  imports: [BotSettingsModule, S3Module, KnowledgeBaseModule],
  controllers: [PdfDocumentsController],
  providers: [PdfDocumentsService],
  exports: [PdfDocumentsService],
})
export class PdfDocumentsModule {}

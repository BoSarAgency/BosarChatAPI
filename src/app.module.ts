import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BotSettingsModule } from './bot-settings/bot-settings.module';
import { ChatMessagesModule } from './chat-messages/chat-messages.module';
import { ChatModule } from './chat/chat.module';
import { ConversationsModule } from './conversations/conversations.module';
import { EmailModule } from './email/email.module';
import { FaqModule } from './faq/faq.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { PdfDocumentsModule } from './pdf-documents/pdf-documents.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BotSettingsModule,
    ChatMessagesModule,
    ConversationsModule,
    EmailModule,
    FaqModule,
    PdfDocumentsModule,
    KnowledgeBaseModule,
    ChatModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

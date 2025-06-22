#!/usr/bin/env ts-node

import { PrismaService } from '../src/prisma/prisma.service';
import { KnowledgeBaseService } from '../src/knowledge-base/knowledge-base.service';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../src/ai/ai.service';
import { BotSettingsService } from '../src/bot-settings/bot-settings.service';

// Simple ConfigService implementation
class SimpleConfigService extends ConfigService {
  get<T = string>(key: string): T | undefined {
    return process.env[key] as T;
  }
}

async function testChat() {
  const prismaService = new PrismaService();
  const configService = new SimpleConfigService();
  const botSettingsService = new BotSettingsService(prismaService);
  const knowledgeBaseService = new KnowledgeBaseService(
    prismaService,
    configService,
  );

  try {
    const conversationId = 'aa7063f5-8b97-4246-b431-4ce6606075e1';
    const userMessage = 'How can I contact support?';

    const aiService = new AiService(
      configService,
      botSettingsService,
      knowledgeBaseService,
    );
    const conversationHistory = await prismaService.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const aiResponse = await aiService.generateResponse(
      userMessage,
      conversationHistory,
    );
    console.log('AI Response:', aiResponse.message);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prismaService.$disconnect();
  }
}

testChat().catch(console.error);

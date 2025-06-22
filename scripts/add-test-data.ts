#!/usr/bin/env ts-node

import { PrismaService } from '../src/prisma/prisma.service';
import { KnowledgeBaseService } from '../src/knowledge-base/knowledge-base.service';
import { ConfigService } from '@nestjs/config';

// Simple ConfigService implementation
class SimpleConfigService extends ConfigService {
  get<T = string>(key: string): T | undefined {
    return process.env[key] as T;
  }
}

async function addTestData() {
  const prismaService = new PrismaService();
  const configService = new SimpleConfigService();
  const knowledgeBaseService = new KnowledgeBaseService(prismaService, configService);

  try {
    console.log('🚀 Adding test data to KnowledgeBase...\n');

    // Check if we have any bot settings
    let botSettings = await prismaService.botSettings.findFirst();
    
    if (!botSettings) {
      console.log('🤖 Creating test bot settings...');
      botSettings = await prismaService.botSettings.create({
        data: {
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          systemInstructions: 'You are a helpful assistant.',
          tools: {},
        },
      });
      console.log(`✅ Created bot settings with ID: ${botSettings.id}`);
    } else {
      console.log(`✅ Using existing bot settings with ID: ${botSettings.id}`);
    }

    // Add some FAQs to the bot settings
    const existingFaqs = await prismaService.fAQ.count({
      where: { botSettingsId: botSettings.id }
    });

    if (existingFaqs === 0) {
      console.log('📝 Creating test FAQs...');
      
      const faqs = [
        {
          question: 'What are your business hours?',
          answer: 'We are open Monday to Friday, 9 AM to 5 PM EST.',
        },
        {
          question: 'How can I contact support?',
          answer: 'You can reach our support team at support@company.com or call 1-800-SUPPORT.',
        },
        {
          question: 'What services do you offer?',
          answer: 'We offer comprehensive customer service solutions including 24/7 support, live chat, and email assistance.',
        },
      ];

      for (const faq of faqs) {
        await prismaService.fAQ.create({
          data: {
            botSettingsId: botSettings.id,
            question: faq.question,
            answer: faq.answer,
          },
        });
      }
      
      console.log(`✅ Created ${faqs.length} test FAQs`);
    } else {
      console.log(`✅ Found ${existingFaqs} existing FAQs`);
    }

    // Now rebuild the knowledge base from sources
    console.log('🔄 Rebuilding knowledge base from sources...');
    const result = await knowledgeBaseService.rebuildFromSources(botSettings.id);
    
    console.log('✅ Knowledge base rebuilt successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Total entries: ${result.summary.totalEntries}`);
    console.log(`   - FAQ entries: ${result.summary.faqEntries}`);
    console.log(`   - Document entries: ${result.summary.documentEntries}`);
    
    console.log('\n🎉 Test data added successfully! You can now test the search function.');

  } catch (error) {
    console.error('❌ Error adding test data:', error);
  } finally {
    await prismaService.$disconnect();
  }
}

addTestData().catch(console.error);

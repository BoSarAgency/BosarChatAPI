#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createBotSettings() {
  try {
    console.log('🤖 Creating bot settings...');

    // Check if bot settings already exist
    const existingBotSettings = await prisma.botSettings.findFirst();

    if (existingBotSettings) {
      console.log('⚠️ Bot settings already exist:');
      console.log('   ID:', existingBotSettings.id);
      console.log('   Model:', existingBotSettings.model);
      console.log('   Temperature:', existingBotSettings.temperature);
      console.log('   Created:', existingBotSettings.createdAt);
      return;
    }

    // Create bot settings
    const botSettings = await prisma.botSettings.create({
      data: {
        model: 'gpt-4.1',
        temperature: 0.5,
        systemInstructions:
          'You are a helpful customer service assistant. Be polite, professional, and helpful. If you cannot answer a question, suggest that the customer speak with a human agent.',
        tools: [
          {
            name: 'request_human_agent',
            parameters: {
              type: 'object',
              required: [],
              properties: {
                user_reason: {
                  type: 'string',
                  description:
                    "The user's reason or intent for requesting a human agent, if provided.",
                },
              },
            },
            description:
              'Detects when the user wants to talk to a real human instead of a bot and notifies the system to escalate or transfer the conversation to a human agent.',
          },
        ],
      },
    });

    console.log('✅ Bot settings created successfully!');
    console.log('📋 Bot settings details:');
    console.log('   ID:', botSettings.id);
    console.log('   Model:', botSettings.model);
    console.log('   Temperature:', botSettings.temperature);
    console.log(
      '   System Instructions:',
      botSettings.systemInstructions.substring(0, 100) + '...',
    );
    console.log('   Tools:', JSON.stringify(botSettings.tools, null, 2));
    console.log('   Created:', botSettings.createdAt);

    // Create sample FAQ entries
    console.log('\n📝 Creating sample FAQ entries...');

    const faqEntries = [
      {
        question: 'What are your business hours?',
        answer: 'Our business hours are Monday to Friday, 9 AM to 5 PM EST.',
      },
      {
        question: 'How can I contact support?',
        answer:
          'You can contact support through this chat, email us at support@bosar.agency, or call us at 1-800-BOSAR-HELP.',
      },
      {
        question: 'What services do you offer?',
        answer:
          'We offer comprehensive customer service solutions including 24/7 support, live chat, and email assistance.',
      },
      {
        question: 'What is your refund policy?',
        answer:
          'We offer a 30-day money-back guarantee on all purchases. Please contact support to initiate a refund.',
      },
      {
        question: 'How do I get started?',
        answer:
          'Getting started is easy! Simply contact our team and we will guide you through the setup process.',
      },
    ];

    for (const faq of faqEntries) {
      await prisma.fAQ.create({
        data: {
          ...faq,
          botSettingsId: botSettings.id,
        },
      });
    }

    console.log(`✅ Created ${faqEntries.length} sample FAQ entries`);
  } catch (error) {
    console.error('❌ Error creating bot settings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createBotSettings();

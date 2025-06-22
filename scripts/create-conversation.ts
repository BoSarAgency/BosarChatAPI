#!/usr/bin/env ts-node

import { PrismaClient, ChatStatus, MessageRole } from '@prisma/client';

const prisma = new PrismaClient();

async function createConversation() {
  try {
    console.log('💬 Creating sample conversation...');

    // Get the latest bot settings
    const botSettings = await prisma.botSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!botSettings) {
      console.log(
        '❌ No bot settings found. Please create bot settings first.',
      );
      console.log('   Run: npx ts-node scripts/create-bot-settings.ts');
      return;
    }

    console.log('✅ Found bot settings:', botSettings.id);

    // Generate a unique customer ID
    const customerId = `customer-${Date.now()}`;

    // Create the conversation
    const conversation = await prisma.conversation.create({
      data: {
        customerId,
        botSettingsId: botSettings.id,
        status: ChatStatus.auto,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        botSettings: {
          select: {
            id: true,
            model: true,
          },
        },
      },
    });

    console.log('✅ Conversation created successfully!');
    console.log('📋 Conversation details:');
    console.log('   ID:', conversation.id);
    console.log('   Customer ID:', conversation.customerId);
    console.log('   Status:', conversation.status);
    console.log('   Bot Settings ID:', conversation.botSettingsId);
    console.log('   Created:', conversation.createdAt);

    // Create sample messages
    console.log('\n💬 Creating sample messages...');

    const messages = [
      {
        message: 'Hello! I need help with my order.',
        role: MessageRole.user,
      },
      {
        message:
          "Hello! I'd be happy to help you with your order. Could you please provide me with your order number or email address?",
        role: MessageRole.bot,
      },
      {
        message:
          'My order number is #12345 and my email is customer@example.com',
        role: MessageRole.user,
      },
      {
        message:
          'Thank you for providing that information. Let me look up your order details. I can see that order #12345 was placed recently. What specific issue are you experiencing with this order?',
        role: MessageRole.bot,
      },
      {
        message:
          "I haven't received a shipping confirmation yet, and it's been 3 days since I placed the order.",
        role: MessageRole.user,
      },
    ];

    for (const messageData of messages) {
      const message = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          message: messageData.message,
          role: messageData.role,
        },
      });

      console.log(
        `   ✅ ${messageData.role}: ${messageData.message.substring(0, 50)}...`,
      );

      // Small delay to ensure proper message ordering
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    console.log(`\n✅ Created ${messages.length} sample messages`);
    console.log('\n📊 Summary:');
    console.log('   Conversation ID:', conversation.id);
    console.log('   Customer ID:', conversation.customerId);
    console.log('   Total Messages:', messages.length);
    console.log('   Status:', conversation.status);
    console.log('   Bot Settings:', conversation.botSettings.model);
  } catch (error) {
    console.error('❌ Error creating conversation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createConversation();

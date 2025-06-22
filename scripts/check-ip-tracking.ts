#!/usr/bin/env ts-node

import { PrismaService } from '../src/prisma/prisma.service';

async function checkIpTracking() {
  const prismaService = new PrismaService();

  try {
    console.log('🔍 Checking IP tracking in conversations...\n');

    // Get recent conversations with IP addresses
    const conversations = await prismaService.conversation.findMany({
      where: {
        customerIp: {
          not: null
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 10,
      include: {
        chatMessages: {
          take: 1,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (conversations.length === 0) {
      console.log('❌ No conversations found with IP addresses tracked');
      return;
    }

    console.log(`✅ Found ${conversations.length} conversations with IP tracking:\n`);

    conversations.forEach((conversation, index) => {
      console.log(`${index + 1}. Conversation ID: ${conversation.id}`);
      console.log(`   Customer ID: ${conversation.customerId}`);
      console.log(`   Customer IP: ${conversation.customerIp}`);
      console.log(`   Status: ${conversation.status}`);
      console.log(`   Messages: ${conversation.messagesAmount}`);
      console.log(`   Last Message: ${conversation.lastMessageAt?.toISOString() || 'N/A'}`);
      console.log(`   Created: ${conversation.createdAt.toISOString()}`);
      console.log(`   Updated: ${conversation.updatedAt.toISOString()}`);
      
      if (conversation.chatMessages.length > 0) {
        const lastMessage = conversation.chatMessages[0];
        console.log(`   Last Message Text: "${lastMessage.message.substring(0, 50)}..."`);
      }
      
      console.log('');
    });

    // Get statistics
    const totalConversations = await prismaService.conversation.count();
    const conversationsWithIp = await prismaService.conversation.count({
      where: {
        customerIp: {
          not: null
        }
      }
    });

    console.log('📊 Statistics:');
    console.log(`   Total conversations: ${totalConversations}`);
    console.log(`   Conversations with IP: ${conversationsWithIp}`);
    console.log(`   IP tracking coverage: ${((conversationsWithIp / totalConversations) * 100).toFixed(1)}%`);

    // Get unique IP addresses
    const uniqueIps = await prismaService.conversation.findMany({
      where: {
        customerIp: {
          not: null
        }
      },
      select: {
        customerIp: true
      },
      distinct: ['customerIp']
    });

    console.log(`   Unique IP addresses: ${uniqueIps.length}`);
    console.log('   IP addresses:', uniqueIps.map(c => c.customerIp).join(', '));

  } catch (error) {
    console.error('❌ Error checking IP tracking:', error);
  } finally {
    await prismaService.$disconnect();
  }
}

checkIpTracking().catch(console.error);

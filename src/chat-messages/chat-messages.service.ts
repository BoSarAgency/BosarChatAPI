import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatStatus, MessageRole, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';

@Injectable()
export class ChatMessagesService {
  constructor(
    private prisma: PrismaService,
    // Note: ChatGateway will be injected when needed to avoid circular dependency
  ) {}

  async createMessage(
    createChatMessageDto: CreateChatMessageDto,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const { conversationId, message, role, userId } = createChatMessageDto;

    // Verify conversation exists and user has access
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check access permissions
    if (
      currentUserRole === UserRole.agent &&
      conversation.userId !== currentUserId
    ) {
      throw new ForbiddenException(
        'You can only send messages to conversations assigned to you',
      );
    }

    // Determine the actual user ID for the message
    let messageUserId: string | null = userId || currentUserId;

    // If role is 'user' (customer), don't set userId (customer messages)
    if (role === MessageRole.user) {
      messageUserId = null;
    }

    // Create the message
    const chatMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        message,
        role,
        userId: messageUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update conversation's updatedAt timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Auto-trigger human takeover if customer message contains keywords
    if (role === MessageRole.user && this.shouldTriggerHumanTakeover(message)) {
      await this.autoTriggerHumanTakeover(conversationId);
    }

    return chatMessage;
  }

  async getMessages(
    getMessagesDto: GetMessagesDto,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const {
      conversationId,
      limit = 20,
      offset = 0,
      after,
      before,
    } = getMessagesDto;

    // Verify conversation exists and user has access
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check access permissions
    // if (
    //   currentUserRole === UserRole.agent &&
    //   conversation.userId !== currentUserId
    // ) {
    //   throw new ForbiddenException(
    //     'You can only access messages from conversations assigned to you',
    //   );
    // }

    // Build where clause for pagination
    const where: any = { conversationId };

    if (after) {
      const afterMessage = await this.prisma.chatMessage.findUnique({
        where: { id: after },
        select: { createdAt: true },
      });
      if (afterMessage) {
        where.createdAt = { gt: afterMessage.createdAt };
      }
    }

    if (before) {
      const beforeMessage = await this.prisma.chatMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    const messages = await this.prisma.chatMessage.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(limit, 100), // Cap at 100 messages
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await this.prisma.chatMessage.count({
      where: { conversationId },
    });

    return {
      messages,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + messages.length < totalCount,
      },
    };
  }

  async getMessageById(
    messageId: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        conversation: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check access permissions
    // if (
    //   currentUserRole === UserRole.agent &&
    //   message.conversation.userId !== currentUserId
    // ) {
    //   throw new ForbiddenException(
    //     'You can only access messages from conversations assigned to you',
    //   );
    // }

    return message;
  }

  async deleteMessage(
    messageId: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const message = await this.getMessageById(
      messageId,
      currentUserId,
      currentUserRole,
    );

    // Only allow deletion of own messages or admin can delete any
    if (
      currentUserRole !== UserRole.admin &&
      message.userId !== currentUserId
    ) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.chatMessage.delete({
      where: { id: messageId },
    });

    return { message: 'Message deleted successfully' };
  }

  private shouldTriggerHumanTakeover(message: string): boolean {
    const humanKeywords = [
      'speak to human',
      'talk to agent',
      'human agent',
      'real person',
      'customer service',
      'representative',
      'escalate',
      'speak to someone',
      'talk to someone',
    ];

    const lowerMessage = message.toLowerCase();
    return humanKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  private async autoTriggerHumanTakeover(conversationId: string) {
    try {
      // Find an available agent
      const availableAgent = await this.findAvailableAgent();

      if (availableAgent) {
        // Update conversation status and assign agent
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: {
            status: ChatStatus.human,
            userId: availableAgent.id,
          },
        });

        // Create human takeover record
        await this.prisma.humanTakeover.create({
          data: {
            conversationId,
            triggeredById: availableAgent.id,
            reason: 'Automatic takeover - customer requested human agent',
          },
        });

        // Add system message about takeover
        await this.prisma.chatMessage.create({
          data: {
            conversationId,
            message: `Human agent ${availableAgent.name} has joined the conversation.`,
            role: MessageRole.agent,
            userId: availableAgent.id,
          },
        });
      }
    } catch (error) {
      console.error('Auto human takeover failed:', error);
    }
  }

  private async findAvailableAgent() {
    // Simple implementation - find first active agent
    // In a real app, you'd implement load balancing, availability status, etc.
    const agents = await this.prisma.user.findMany({
      where: {
        role: UserRole.agent,
        status: 'active',
      },
      take: 1,
    });

    return agents[0] || null;
  }
}

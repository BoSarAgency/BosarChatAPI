import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { HumanTakeoverDto } from './dto/human-takeover.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async create(createConversationDto: CreateConversationDto) {
    return this.prisma.conversation.create({
      data: createConversationDto,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll(userId?: string, userRole?: UserRole) {
    const where: any = {};

    // If user is an agent, only show conversations assigned to them
    // if (userRole === UserRole.agent && userId) {
    //   where.userId = userId;
    // }

    return this.prisma.conversation.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        chatMessages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Only get the latest message for preview
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            chatMessages: true,
          },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async findOne(id: string, userId?: string, userRole?: UserRole) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        humanTakeovers: {
          include: {
            triggeredBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if agent can access this conversation
    // if (userRole === UserRole.agent && conversation.userId !== userId) {
    //   throw new ForbiddenException(
    //     'You can only access conversations assigned to you',
    //   );
    // }

    return conversation;
  }

  async update(
    id: string,
    updateConversationDto: UpdateConversationDto,
    userId?: string,
    userRole?: UserRole,
  ) {
    // Check if conversation exists and user has access
    await this.findOne(id, userId, userRole);

    return this.prisma.conversation.update({
      where: { id },
      data: updateConversationDto,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async addMessage(
    conversationId: string,
    createMessageDto: CreateMessageDto,
    userId?: string,
    userRole?: UserRole,
  ) {
    // Check if conversation exists and user has access
    await this.findOne(conversationId, userId, userRole);

    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        ...createMessageDto,
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

    // Update conversation's timestamps and message count
    const messageCount = await this.prisma.chatMessage.count({
      where: { conversationId },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        messagesAmount: messageCount,
      },
    });

    return message;
  }

  async triggerHumanTakeover(
    conversationId: string,
    humanTakeoverDto: HumanTakeoverDto,
    triggeredById: string,
    userId?: string,
    userRole?: UserRole,
  ) {
    // Check if conversation exists and user has access
    const conversation = await this.findOne(conversationId, userId, userRole);

    // Create human takeover record
    const humanTakeover = await this.prisma.humanTakeover.create({
      data: {
        conversationId,
        triggeredById,
        reason: humanTakeoverDto.reason || 'Manual takeover',
      },
      include: {
        triggeredBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update conversation status to human and assign to the user who triggered takeover
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ChatStatus.human,
        userId: triggeredById,
      },
    });

    return humanTakeover;
  }

  async remove(id: string, userId?: string, userRole?: UserRole) {
    // Check if conversation exists and user has access
    await this.findOne(id, userId, userRole);

    await this.prisma.conversation.delete({
      where: { id },
    });

    return { message: 'Conversation deleted successfully' };
  }
}

import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ChatStatus, MessageRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { AiService } from '../ai/ai.service';
import { ChatMessagesService } from '../chat-messages/chat-messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  WebSocketJoinRoomDto,
  WebSocketMessageDto,
  WidgetConnectDto,
  WidgetMessageDto,
} from './dto/websocket-message.dto';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  userEmail?: string;
  customerId?: string; // For anonymous widget connections
  isWidget?: boolean; // Flag to identify widget connections
  customerIp?: string | null; // Customer IP address
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  namespace: '/chat',
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  cookie: false,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();
  private readonly heartbeatInterval = 30000; // 30 seconds

  constructor(
    private jwtService: JwtService,
    private chatMessagesService: ChatMessagesService,
    private aiService: AiService,
    private prisma: PrismaService,
    private conversationsService: ConversationsService,
  ) {
    // Start heartbeat interval for connection health monitoring
    setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  private sendHeartbeat() {
    this.connectedClients.forEach((client, clientId) => {
      if (client.connected) {
        client.emit('heartbeat', { timestamp: Date.now() });
      } else {
        this.connectedClients.delete(clientId);
        this.logger.log(
          `Removed disconnected client ${clientId} from tracking`,
        );
      }
    });
  }

  @SubscribeMessage('heartbeat-response')
  handleHeartbeatResponse(@ConnectedSocket() client: AuthenticatedSocket) {
    // Client responded to heartbeat, connection is healthy
    this.logger.debug(`Heartbeat response from client ${client.id}`);
  }

  private extractClientIp(client: AuthenticatedSocket): string | null {
    // Try to get IP from various headers (for proxies/load balancers)
    const forwarded = client.handshake.headers['x-forwarded-for'];
    const realIp = client.handshake.headers['x-real-ip'];
    const clientIp = client.handshake.headers['x-client-ip'];

    // x-forwarded-for can contain multiple IPs, take the first one
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }

    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    if (clientIp) {
      return Array.isArray(clientIp) ? clientIp[0] : clientIp;
    }

    // Fallback to socket remote address
    return client.handshake.address || null;
  }

  handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract client IP address
      client.customerIp = this.extractClientIp(client);

      // Track connected client for heartbeat monitoring
      this.connectedClients.set(client.id, client);

      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      // Check if this is a widget connection (no token provided)
      if (!token) {
        // Allow widget connections without authentication
        client.isWidget = true;
        this.logger.log(
          `Widget client ${client.id} connected from IP: ${client.customerIp}`,
        );
        return;
      }

      // Handle authenticated connections (agents/admins)
      try {
        const payload = this.jwtService.verify(token) as any;
        client.userId = payload.sub;
        client.userRole = payload.role;
        client.userEmail = payload.email;
        client.isWidget = false;

        this.logger.log(
          `Authenticated client ${client.id} connected as user ${client.userEmail}`,
        );
      } catch (authError) {
        this.logger.error(
          `Authentication failed for client ${client.id}:`,
          authError,
        );
        client.disconnect();
      }
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    // Remove client from tracking
    this.connectedClients.delete(client.id);

    this.logger.log(
      `Client ${client.id} disconnected. Active connections: ${this.connectedClients.size}`,
    );
  }

  @SubscribeMessage('join-conversation')
  @UsePipes(new ValidationPipe())
  async handleJoinConversation(
    @MessageBody() data: WebSocketJoinRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { conversationId } = data;

      // Verify user has access to this conversation
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        client.emit('error', { message: 'Conversation not found' });
        return;
      }

      // Check access permissions
      // if (
      //   client.userRole === 'agent' &&
      //   conversation.userId !== client.userId
      // ) {
      //   client.emit('error', { message: 'Access denied to this conversation' });
      //   return;
      // }

      // Join the conversation room
      await client.join(conversationId);
      client.emit('joined-conversation', { conversationId });

      this.logger.log(
        `User ${client.userEmail} joined conversation ${conversationId}`,
      );
    } catch (error) {
      this.logger.error('Error joining conversation:', error);
      client.emit('error', { message: 'Failed to join conversation' });
    }
  }

  @SubscribeMessage('send-message')
  @UsePipes(new ValidationPipe())
  async handleMessage(
    @MessageBody() data: WebSocketMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { conversationId, message, role } = data;

      // Create the message in database
      const chatMessage = await this.chatMessagesService.createMessage(
        {
          conversationId,
          message,
          role,
          userId: role === MessageRole.user ? undefined : client.userId,
        },
        client.userId!,
        client.userRole as any,
      );

      // Broadcast message to all clients in the conversation room
      this.server.to(conversationId).emit('new-message', {
        id: chatMessage.id,
        conversationId: chatMessage.conversationId,
        message: chatMessage.message,
        role: chatMessage.role,
        userId: chatMessage.userId,
        user: chatMessage.user,
        createdAt: chatMessage.createdAt,
      });

      // If this is a user message, update conversation with IP and generate AI response
      if (role === MessageRole.user) {
        // Update conversation with customer IP if it's a user message
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: {
            customerIp: client.customerIp,
            updatedAt: new Date(),
            lastMessageAt: new Date(),
          },
        });

        await this.handleAutoResponse(conversationId, message);
      }
    } catch (error) {
      this.logger.error('Error handling message:', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  private async handleAutoResponse(
    conversationId: string,
    userMessage: string,
  ) {
    try {
      // Get conversation details
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 20, // Get recent messages for context
          },
        },
      });

      if (!conversation || conversation.status !== ChatStatus.auto) {
        return; // Don't generate response if not in auto mode
      }

      // Generate AI response
      const aiResponse = await this.aiService.generateResponse(
        userMessage,
        conversation.chatMessages.reverse(), // Reverse to get chronological order
        conversation.botSettingsId,
      );

      if (aiResponse.shouldTriggerHumanTakeover) {
        // update conversation status to pending
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: {
            status: ChatStatus.pending,
          },
        });
      }

      // Create AI response message
      const aiMessage = await this.prisma.chatMessage.create({
        data: {
          conversationId,
          message: aiResponse.message,
          role: MessageRole.bot,
          userId: null,
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

      // Update conversation timestamp
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Broadcast AI response
      this.server.to(conversationId).emit('new-message', {
        id: aiMessage.id,
        conversationId: aiMessage.conversationId,
        message: aiMessage.message,
        role: aiMessage.role,
        userId: aiMessage.userId,
        user: aiMessage.user,
        createdAt: aiMessage.createdAt,
      });

      // Trigger human takeover if AI suggests it
      if (aiResponse.shouldTriggerHumanTakeover) {
        await this.triggerHumanTakeover(conversationId);
      }
    } catch (error) {
      this.logger.error('Error generating auto response:', error);
    }
  }

  private async triggerHumanTakeover(conversationId: string) {
    try {
      // Find available agent
      const availableAgent = await this.prisma.user.findFirst({
        where: {
          role: 'agent',
          status: 'active',
        },
      });

      if (!availableAgent) {
        this.logger.warn('No available agents for human takeover');
        return;
      }

      // Update conversation status
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: ChatStatus.human,
          userId: availableAgent.id,
        },
      });

      // Create takeover record
      await this.prisma.humanTakeover.create({
        data: {
          conversationId,
          triggeredById: availableAgent.id,
          reason: 'Automatic takeover - AI suggested human assistance',
        },
      });

      // Create system message
      const systemMessage = await this.prisma.chatMessage.create({
        data: {
          conversationId,
          message: `Human agent ${availableAgent.name} has joined the conversation.`,
          role: MessageRole.agent,
          userId: availableAgent.id,
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

      // Broadcast system message and status change
      this.server.to(conversationId).emit('new-message', {
        id: systemMessage.id,
        conversationId: systemMessage.conversationId,
        message: systemMessage.message,
        role: systemMessage.role,
        userId: systemMessage.userId,
        user: systemMessage.user,
        createdAt: systemMessage.createdAt,
      });

      this.server.to(conversationId).emit('conversation-status-changed', {
        conversationId,
        status: ChatStatus.human,
        assignedAgent: {
          id: availableAgent.id,
          name: availableAgent.name,
          email: availableAgent.email,
        },
      });
    } catch (error) {
      this.logger.error('Error triggering human takeover:', error);
    }
  }

  // Widget-specific handlers for anonymous customers
  @SubscribeMessage('widget-connect')
  @UsePipes(new ValidationPipe())
  handleWidgetConnect(
    @MessageBody() data: WidgetConnectDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.isWidget) {
        client.emit('error', { message: 'Invalid connection type' });
        return;
      }

      client.customerId = data.customerId;

      this.logger.log(
        `Widget client ${client.id} connected with customerId: ${data.customerId}`,
      );

      client.emit('widget-connected', { customerId: data.customerId });
    } catch (error) {
      this.logger.error('Error handling widget connect:', error);
      client.emit('error', { message: 'Failed to connect widget' });
    }
  }

  @SubscribeMessage('widget-send-message')
  @UsePipes(new ValidationPipe())
  async handleWidgetMessage(
    @MessageBody() data: WidgetMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.isWidget) {
        client.emit('error', { message: 'Invalid connection type' });
        return;
      }

      // Validate required fields
      if (!data.botId) {
        client.emit('error', { message: 'botId is required' });
        return;
      }

      let activeConversationId = data.conversationId;

      // If no conversation ID provided, find or create conversation for this customer
      if (!activeConversationId) {
        const existingConversation = await this.findOrCreateConversation(
          data.customerId,
          data.botId as string, // Type assertion since we validated above
          client.customerIp,
        );
        activeConversationId = existingConversation.id;
      }

      // Join the conversation room
      await client.join(activeConversationId);

      // Create the user message
      const chatMessage = await this.prisma.chatMessage.create({
        data: {
          conversationId: activeConversationId,
          message: data.message,
          role: MessageRole.user,
          userId: null, // Anonymous user
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

      // Update conversation timestamp, message count, and IP address
      await this.prisma.conversation.update({
        where: { id: activeConversationId },
        data: {
          updatedAt: new Date(),
          lastMessageAt: new Date(),
          messagesAmount: {
            increment: 1,
          },
          customerIp: client.customerIp, // Track customer IP
        },
      });

      // Broadcast message to all clients in the conversation room
      this.server.to(activeConversationId).emit('new-message', {
        id: chatMessage.id,
        conversationId: chatMessage.conversationId,
        message: chatMessage.message,
        role: chatMessage.role,
        userId: chatMessage.userId,
        user: chatMessage.user,
        createdAt: chatMessage.createdAt,
      });

      // Send response back to widget with conversation ID
      client.emit('message-sent', {
        conversationId: activeConversationId,
        messageId: chatMessage.id,
      });

      // Generate AI response if conversation is in auto mode
      await this.handleAutoResponse(activeConversationId, data.message);
    } catch (error) {
      this.logger.error('Error handling widget message:', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  private async findOrCreateConversation(
    customerId: string,
    botId: string,
    customerIp?: string | null,
  ) {
    // First, try to find an existing active conversation for this customer with the same botId
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        customerId,
        botSettingsId: botId,
        status: {
          in: [ChatStatus.auto, ChatStatus.human],
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // If no active conversation found, create a new one
    if (!conversation) {
      // Verify that the botId exists
      const botSettings = await this.prisma.botSettings.findUnique({
        where: { id: botId },
      });

      if (!botSettings) {
        throw new Error(
          `Bot settings with ID ${botId} not found. Please provide a valid botId.`,
        );
      }

      conversation = await this.prisma.conversation.create({
        data: {
          customerId,
          botSettingsId: botId,
          status: ChatStatus.auto,
          customerIp: customerIp,
        },
      });

      this.logger.log(
        `Created new conversation ${conversation.id} for customer ${customerId} with bot ${botId}`,
      );
    }

    return conversation;
  }

  // Method to broadcast messages from external services
  broadcastMessage(conversationId: string, message: any) {
    this.server.to(conversationId).emit('new-message', message);
  }

  // Method to broadcast conversation status changes
  broadcastStatusChange(
    conversationId: string,
    status: ChatStatus,
    assignedAgent?: any,
  ) {
    this.server.to(conversationId).emit('conversation-status-changed', {
      conversationId,
      status,
      assignedAgent,
    });
  }
}

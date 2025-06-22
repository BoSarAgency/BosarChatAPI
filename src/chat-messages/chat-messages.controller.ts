import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatMessagesService } from './chat-messages.service';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Chat Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat-messages')
export class ChatMessagesController {
  constructor(private readonly chatMessagesService: ChatMessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Send a chat message' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  createMessage(
    @Body() createChatMessageDto: CreateChatMessageDto,
    @Request() req,
  ) {
    return this.chatMessagesService.createMessage(
      createChatMessageDto,
      req.user.id,
      req.user.role,
    );
  }

  @Get('conversation/:conversationId')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of messages to return (max 100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of messages to skip',
  })
  @ApiQuery({
    name: 'after',
    required: false,
    description: 'Get messages after this message ID',
  })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'Get messages before this message ID',
  })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  getMessages(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('after') after?: string,
    @Query('before') before?: string,
    @Request() req?,
  ) {
    const getMessagesDto: GetMessagesDto = {
      conversationId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      after,
      before,
    };

    return this.chatMessagesService.getMessages(
      getMessagesDto,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific message by ID' })
  @ApiResponse({ status: 200, description: 'Message retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  getMessageById(@Param('id') id: string, @Request() req) {
    return this.chatMessagesService.getMessageById(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a message' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  deleteMessage(@Param('id') id: string, @Request() req) {
    return this.chatMessagesService.deleteMessage(
      id,
      req.user.id,
      req.user.role,
    );
  }
}

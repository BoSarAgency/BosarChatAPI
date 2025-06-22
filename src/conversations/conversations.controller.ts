import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BotSettingsService } from '../bot-settings/bot-settings.service';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { HumanTakeoverDto } from './dto/human-takeover.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly botSettingsService: BotSettingsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
  })
  async create(@Body() createConversationDto: CreateConversationDto) {
    // Get the latest bot settings to use as default
    const botSettings = await this.botSettingsService.getLatest();
    if (!botSettings) {
      throw new Error(
        'No bot settings found. Please create bot settings first.',
      );
    }

    // Use the latest bot settings ID if not provided
    if (!createConversationDto.botSettingsId) {
      createConversationDto.botSettingsId = botSettings.id;
    }

    return this.conversationsService.create(createConversationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all conversations' })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
  })
  findAll(@Request() req) {
    return this.conversationsService.findAll(req.user.id, req.user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.conversationsService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update conversation' })
  @ApiResponse({
    status: 200,
    description: 'Conversation updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  update(
    @Param('id') id: string,
    @Body() updateConversationDto: UpdateConversationDto,
    @Request() req,
  ) {
    return this.conversationsService.update(
      id,
      updateConversationDto,
      req.user.id,
      req.user.role,
    );
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Add message to conversation' })
  @ApiResponse({ status: 201, description: 'Message added successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  addMessage(
    @Param('id') id: string,
    @Body() createMessageDto: CreateMessageDto,
    @Request() req,
  ) {
    return this.conversationsService.addMessage(
      id,
      createMessageDto,
      req.user.id,
      req.user.role,
    );
  }

  @Post(':id/human-takeover')
  @ApiOperation({ summary: 'Trigger human takeover for conversation' })
  @ApiResponse({
    status: 201,
    description: 'Human takeover triggered successfully',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  triggerHumanTakeover(
    @Param('id') id: string,
    @Body() humanTakeoverDto: HumanTakeoverDto,
    @Request() req,
  ) {
    return this.conversationsService.triggerHumanTakeover(
      id,
      humanTakeoverDto,
      req.user.id,
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete conversation' })
  @ApiResponse({
    status: 200,
    description: 'Conversation deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  remove(@Param('id') id: string, @Request() req) {
    return this.conversationsService.remove(id, req.user.id, req.user.role);
  }
}

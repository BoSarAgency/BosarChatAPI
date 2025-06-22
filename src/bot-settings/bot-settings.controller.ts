import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { BotSettingsService } from './bot-settings.service';
import { CreateBotSettingsDto } from './dto/create-bot-settings.dto';
import { UpdateBotSettingsDto } from './dto/update-bot-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Bot Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bot-settings')
export class BotSettingsController {
  constructor(private readonly botSettingsService: BotSettingsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Create bot settings (Admin only)' })
  @ApiResponse({ status: 201, description: 'Bot settings created successfully' })
  create(@Body() createBotSettingsDto: CreateBotSettingsDto) {
    return this.botSettingsService.create(createBotSettingsDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bot settings' })
  @ApiResponse({ status: 200, description: 'Bot settings retrieved successfully' })
  findAll() {
    return this.botSettingsService.findAll();
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest bot settings' })
  @ApiResponse({ status: 200, description: 'Latest bot settings retrieved successfully' })
  getLatest() {
    return this.botSettingsService.getLatest();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bot settings by ID' })
  @ApiResponse({ status: 200, description: 'Bot settings retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Bot settings not found' })
  findOne(@Param('id') id: string) {
    return this.botSettingsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Update bot settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Bot settings updated successfully' })
  @ApiResponse({ status: 404, description: 'Bot settings not found' })
  update(@Param('id') id: string, @Body() updateBotSettingsDto: UpdateBotSettingsDto) {
    return this.botSettingsService.update(id, updateBotSettingsDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Delete bot settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Bot settings deleted successfully' })
  @ApiResponse({ status: 404, description: 'Bot settings not found' })
  remove(@Param('id') id: string) {
    return this.botSettingsService.remove(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { SearchKnowledgeBaseDto } from './dto/search-knowledge-base.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Knowledge Base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Create knowledge base (Admin only)' })
  @ApiResponse({ status: 201, description: 'Knowledge base created successfully' })
  @ApiResponse({ status: 404, description: 'Bot settings not found' })
  create(@Body() createKnowledgeBaseDto: CreateKnowledgeBaseDto) {
    return this.knowledgeBaseService.create(createKnowledgeBaseDto);
  }

  @Post('search')
  @ApiOperation({ summary: 'Search knowledge base' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  search(@Body() searchDto: SearchKnowledgeBaseDto) {
    return this.knowledgeBaseService.search(searchDto);
  }

  @Post('rebuild/:botSettingsId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Rebuild knowledge base from sources (Admin only)' })
  @ApiResponse({ status: 200, description: 'Knowledge base rebuilt successfully' })
  @ApiResponse({ status: 404, description: 'Bot settings not found' })
  rebuild(@Param('botSettingsId') botSettingsId: string) {
    return this.knowledgeBaseService.rebuildFromSources(botSettingsId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all knowledge bases' })
  @ApiQuery({ name: 'botSettingsId', required: false, description: 'Filter by bot settings ID' })
  @ApiResponse({ status: 200, description: 'Knowledge bases retrieved successfully' })
  findAll(@Query('botSettingsId') botSettingsId?: string) {
    return this.knowledgeBaseService.findAll(botSettingsId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get knowledge base by ID' })
  @ApiResponse({ status: 200, description: 'Knowledge base retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  findOne(@Param('id') id: string) {
    return this.knowledgeBaseService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Update knowledge base (Admin only)' })
  @ApiResponse({ status: 200, description: 'Knowledge base updated successfully' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  update(@Param('id') id: string, @Body() updateKnowledgeBaseDto: UpdateKnowledgeBaseDto) {
    return this.knowledgeBaseService.update(id, updateKnowledgeBaseDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Delete knowledge base (Admin only)' })
  @ApiResponse({ status: 200, description: 'Knowledge base deleted successfully' })
  @ApiResponse({ status: 404, description: 'Knowledge base not found' })
  remove(@Param('id') id: string) {
    return this.knowledgeBaseService.remove(id);
  }
}

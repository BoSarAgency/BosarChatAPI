import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BotSettingsService } from '../bot-settings/bot-settings.service';
import { S3Service } from '../s3/s3.service';
import { CreatePdfDocumentDto } from './dto/create-pdf-document.dto';
import { UpdatePdfDocumentDto } from './dto/update-pdf-document.dto';
import { PdfDocumentsService } from './pdf-documents.service';

@ApiTags('PDF Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pdf-documents')
export class PdfDocumentsController {
  constructor(
    private readonly pdfDocumentsService: PdfDocumentsService,
    private readonly botSettingsService: BotSettingsService,
    private readonly s3Service: S3Service,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Create PDF document entry (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'PDF document created successfully',
  })
  async create(
    @Body() createPdfDocumentDto: CreatePdfDocumentDto,
    @Request() req,
  ) {
    // Get the latest bot settings to use as default
    const botSettings = await this.botSettingsService.getLatest();
    if (!botSettings) {
      throw new Error(
        'No bot settings found. Please create bot settings first.',
      );
    }

    // Use the latest bot settings ID if not provided
    if (!createPdfDocumentDto.botSettingsId) {
      createPdfDocumentDto.botSettingsId = botSettings.id;
    }

    return this.pdfDocumentsService.create(createPdfDocumentDto, req.user.id);
  }

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          cb(new BadRequestException('Only PDF files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
      limits: {
        fileSize: 150 * 1024 * 1024, // 150MB limit
      },
    }),
  )
  @ApiOperation({ summary: 'Upload PDF file (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'PDF uploaded and processed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Get the latest bot settings to use as default
    const botSettings = await this.botSettingsService.getLatest();
    if (!botSettings) {
      throw new Error(
        'No bot settings found. Please create bot settings first.',
      );
    }

    return this.pdfDocumentsService.processUploadedFile(
      file,
      req.user.id,
      botSettings.id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all PDF documents' })
  @ApiResponse({
    status: 200,
    description: 'PDF documents retrieved successfully',
  })
  findAll(@Request() req) {
    return this.pdfDocumentsService.findAll(req.user.id, req.user.role);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search PDF documents' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({
    name: 'limit',
    description: 'Number of results to return',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
  })
  search(@Query('q') query: string, @Query('limit') limit?: string) {
    if (!query) {
      throw new BadRequestException('Search query is required');
    }

    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.pdfDocumentsService.searchDocuments(query, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PDF document by ID' })
  @ApiResponse({
    status: 200,
    description: 'PDF document retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'PDF document not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.pdfDocumentsService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Update PDF document (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'PDF document updated successfully',
  })
  @ApiResponse({ status: 404, description: 'PDF document not found' })
  update(
    @Param('id') id: string,
    @Body() updatePdfDocumentDto: UpdatePdfDocumentDto,
    @Request() req,
  ) {
    return this.pdfDocumentsService.update(
      id,
      updatePdfDocumentDto,
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Delete PDF document (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'PDF document deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'PDF document not found' })
  remove(@Param('id') id: string, @Request() req) {
    return this.pdfDocumentsService.remove(id, req.user.id, req.user.role);
  }

  @Get('debug/s3-test')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Test S3 connection (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'S3 connection test results',
  })
  async testS3Connection() {
    try {
      const isConnected = await this.s3Service.testConnection();
      return {
        success: isConnected,
        message: isConnected
          ? 'S3 connection successful'
          : 'S3 connection failed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `S3 connection failed: ${error.message}`,
        error: error.name,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('debug/s3-verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Comprehensive S3 credentials verification (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed S3 configuration verification results',
  })
  async verifyS3Credentials() {
    try {
      const verification = await this.s3Service.verifyCredentials();
      return {
        ...verification,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        valid: false,
        details: {},
        errors: [`Verification failed: ${error.message}`],
        recommendations: [
          'Check your AWS configuration and network connectivity',
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }
}

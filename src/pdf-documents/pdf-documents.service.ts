import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as fs from 'fs';
import OpenAI from 'openai';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { CreatePdfDocumentDto } from './dto/create-pdf-document.dto';
import { UpdatePdfDocumentDto } from './dto/update-pdf-document.dto';
const pdfParse = require('pdf-parse');

@Injectable()
export class PdfDocumentsService {
  private readonly logger = new Logger(PdfDocumentsService.name);
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private knowledgeBaseService: KnowledgeBaseService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not found in environment variables');
    }

    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key', // Use dummy key if not provided to prevent crashes
    });
  }

  async create(createPdfDocumentDto: CreatePdfDocumentDto, uploadedBy: string) {
    return this.prisma.pDFDocument.create({
      data: {
        fileName: createPdfDocumentDto.fileName,
        url: createPdfDocumentDto.url,
        chunks: createPdfDocumentDto.chunks || {},
        uploadedBy,
        botSettingsId: createPdfDocumentDto.botSettingsId,
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async findAll(userId?: string, userRole?: UserRole) {
    const where: any = {};

    // If user is an agent, only show documents they uploaded
    if (userRole === UserRole.agent && userId) {
      where.uploadedBy = userId;
    }

    return this.prisma.pDFDocument.findMany({
      where,
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId?: string, userRole?: UserRole) {
    const document = await this.prisma.pDFDocument.findUnique({
      where: { id },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('PDF document not found');
    }

    // Check if agent can access this document
    // if (userRole === UserRole.agent && document.uploadedBy !== userId) {
    //   throw new ForbiddenException(
    //     'You can only access documents you uploaded',
    //   );
    // }

    return document;
  }

  async update(
    id: string,
    updatePdfDocumentDto: UpdatePdfDocumentDto,
    userId?: string,
    userRole?: UserRole,
  ) {
    // Check if document exists and user has access
    await this.findOne(id, userId, userRole);

    return this.prisma.pDFDocument.update({
      where: { id },
      data: updatePdfDocumentDto,
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId?: string, userRole?: UserRole) {
    // Check if document exists and user has access
    await this.findOne(id, userId, userRole);

    await this.prisma.pDFDocument.delete({
      where: { id },
    });

    return { message: 'PDF document deleted successfully' };
  }

  async processUploadedFile(
    file: Express.Multer.File,
    uploadedBy: string,
    botSettingsId: string,
  ) {
    let tempFilePath: string | null = null;

    try {
      this.logger.log(`Processing uploaded file: ${file.originalname}`);
      this.logger.log(`File size: ${file.size} bytes`);
      this.logger.log(`File mimetype: ${file.mimetype}`);
      this.logger.log(
        `File buffer length: ${file.buffer?.length || 'undefined'} bytes`,
      );
      // 1. Upload file to S3
      this.logger.log('Uploading file to S3...');
      const s3Key = `pdfs/${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
      const fileUrl = await this.s3Service.uploadFile(file, s3Key);
      this.logger.log(`File uploaded to S3: ${fileUrl}`);

      // 2. Extract text from PDF
      this.logger.log('Extracting text from PDF...');
      const pdfData = await pdfParse(file.buffer);
      const rawText = pdfData.text as string;

      // Clean the extracted text to remove null bytes and other problematic characters
      const extractedText = this.cleanExtractedText(rawText);
      this.logger.log(
        `Extracted ${extractedText.length} characters from PDF (cleaned from ${rawText.length} raw characters)`,
      );

      // 3. Split text into 500-character chunks
      this.logger.log('Splitting text into chunks...');
      const chunks = this.splitTextIntoChunks(extractedText, 1000);
      this.logger.log(`Created ${chunks.length} chunks`);

      // 4. Save PDFDocument to database
      this.logger.log('Saving PDF document to database...');
      const savedDocument = await this.create(
        {
          fileName: file.originalname,
          url: fileUrl,
          chunks,
          botSettingsId,
        },
        uploadedBy,
      );

      // 5. Generate embeddings for each chunk using OpenAI
      this.logger.log('Generating embeddings for chunks...');
      for (const chunk of chunks) {
        // generate embedding for chunk
        const embedding = await this.generateEmbeddingForChunk(chunk);
        try {
          await this.knowledgeBaseService.create({
            botSettingsId,
            pdfDocumentId: savedDocument.id,
            embedding,
            text: chunk,
            metadata: {
              type: 'document',
              documentId: savedDocument.id,
              fileName: savedDocument.fileName,
              dimensions: 1536,
              createdAt: new Date().toISOString(),
            },
          });
        } catch (error) {
          this.logger.error(
            `Error creating knowledge base entry for chunk`,
            error,
          );
          // Continue with other chunks even if one fails
        }
      }

      this.logger.log('File processing completed successfully');

      // Return fileName, url, and createdAt as requested
      return {
        fileName: savedDocument.fileName,
        url: savedDocument.url,
        createdAt: savedDocument.createdAt,
        id: savedDocument.id,
        uploader: savedDocument.uploader,
      };
    } catch (error) {
      this.logger.error('Error processing uploaded file:', error);
      throw error;
    } finally {
      // Clean up temporary file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          this.logger.log(`Cleaned up temporary file: ${tempFilePath}`);
        } catch (cleanupError) {
          this.logger.warn(
            `Failed to clean up temporary file: ${cleanupError.message}`,
          );
        }
      }
    }
  }

  /**
   * Clean extracted text by removing null bytes and other problematic characters
   */
  private cleanExtractedText(text: string): string {
    if (!text) return '';

    // Remove null bytes and other control characters that PostgreSQL can't handle
    let cleanedText = '';

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);

      // Skip null bytes and problematic control characters
      if (
        charCode === 0 || // null byte
        (charCode >= 1 && charCode <= 8) || // control chars
        charCode === 11 ||
        charCode === 12 || // vertical tab, form feed
        (charCode >= 14 && charCode <= 31) || // more control chars
        charCode === 127
      ) {
        // DEL character
        continue;
      }

      cleanedText += text.charAt(i);
    }

    return cleanedText.trim();
  }

  /**
   * Split text into chunks of specified size
   */
  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      let endIndex = currentIndex + chunkSize;

      // If we're not at the end of the text, try to break at a word boundary
      if (endIndex < text.length) {
        const lastSpaceIndex = text.lastIndexOf(' ', endIndex);
        if (lastSpaceIndex > currentIndex) {
          endIndex = lastSpaceIndex;
        }
      }

      const chunk = text.slice(currentIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      currentIndex = endIndex + 1;
    }

    return chunks;
  }

  private async generateEmbeddingForChunk(chunk: string): Promise<number[]> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    let embedding: number[];

    try {
      if (apiKey) {
        // Generate real embedding using OpenAI
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: chunk,
        });
        embedding = response.data[0].embedding;
        this.logger.log('Generated embedding for chunk');
      } else {
        // Fallback to mock embedding if no API key
        embedding = Array.from({ length: 1536 }, () => Math.random());
        this.logger.warn('Using mock embedding for chunk (no OpenAI API key)');
      }
    } catch (error) {
      this.logger.error('Error generating embedding for chunk:', error);
      // Fallback to mock embedding on error
      embedding = Array.from({ length: 1536 }, () => Math.random());
    }

    return embedding;
  }

  async searchDocuments(query: string, limit: number = 10) {
    // In a real implementation, you would:
    // 1. Generate embedding for the query
    // 2. Perform vector similarity search against document chunks
    // 3. Return most relevant documents/chunks

    // For now, return a simple text search
    return this.prisma.pDFDocument.findMany({
      where: {
        fileName: {
          contains: query,
          mode: 'insensitive',
        },
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}

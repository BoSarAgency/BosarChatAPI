import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { SearchKnowledgeBaseDto } from './dto/search-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  source: string;
  metadata: {
    [key: string]: any;
    knowledgeBaseId: string;
    botSettingsId: string;
  };
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
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

  async create(createKnowledgeBaseDto: CreateKnowledgeBaseDto) {
    // Verify bot settings exist
    const botSettings = await this.prisma.botSettings.findUnique({
      where: { id: createKnowledgeBaseDto.botSettingsId },
    });

    if (!botSettings) {
      throw new NotFoundException('Bot settings not found');
    }

    // Use raw SQL to insert with vector type
    const embeddingVector = `[${createKnowledgeBaseDto.embedding.join(',')}]`;

    const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "KnowledgeBase" (id, "botSettingsId", "pdfDocumentId", text, embeddings, metadata, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${createKnowledgeBaseDto.botSettingsId}, ${createKnowledgeBaseDto.pdfDocumentId}, ${createKnowledgeBaseDto.text}, ${embeddingVector}::vector, ${JSON.stringify(createKnowledgeBaseDto.metadata)}::jsonb, NOW(), NOW())
      RETURNING id
    `;

    if (result.length > 0) {
      return this.prisma.knowledgeBase.findUnique({
        where: { id: result[0].id },
        include: {
          botSettings: true,
        },
      });
    }

    throw new Error('Failed to create knowledge base entry');
  }

  async findAll(botSettingsId?: string) {
    const where = botSettingsId ? { botSettingsId } : {};

    return this.prisma.knowledgeBase.findMany({
      where,
      include: {
        botSettings: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const knowledgeBase = await this.prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        botSettings: true,
      },
    });

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    return knowledgeBase;
  }

  async update(id: string, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto) {
    // Check if knowledge base exists
    await this.findOne(id);

    // TODO: Implement update with vector support
    throw new Error(
      'Update method not implemented for vector embeddings. Use create/delete instead.',
    );
  }

  async remove(id: string) {
    // Check if knowledge base exists
    await this.findOne(id);

    await this.prisma.knowledgeBase.delete({
      where: { id },
    });

    return { message: 'Knowledge base deleted successfully' };
  }

  async search(searchDto: SearchKnowledgeBaseDto): Promise<SearchResult[]> {
    try {
      // 1. Generate embedding for the search query
      const queryEmbedding = await this.generateQueryEmbedding(searchDto.query);

      // 2. Convert embedding array to PostgreSQL vector format
      const embeddingVector = `[${queryEmbedding.join(',')}]`;

      // 3. Use pgvector for efficient similarity search
      const limit = searchDto.limit || 5;
      const threshold = searchDto.threshold || 0.7;

      // Raw SQL query using pgvector cosine distance operator
      const results = await this.prisma.$queryRaw<
        Array<{
          id: string;
          text: string;
          metadata: any;
          botSettingsId: string;
          pdfDocumentId: string | null;
          similarity: number;
        }>
      >`
        SELECT
          kb.id,
          kb.text,
          kb.metadata,
          kb."botSettingsId",
          kb."pdfDocumentId",
          1 - (kb.embeddings <=> ${embeddingVector}::vector) as similarity
        FROM "KnowledgeBase" kb
        WHERE kb.embeddings IS NOT NULL
          AND (1 - (kb.embeddings <=> ${embeddingVector}::vector)) >= ${threshold}
        ORDER BY kb.embeddings <=> ${embeddingVector}::vector
        LIMIT ${limit}
      `;

      // 4. Format results and add source information
      const formattedResults: SearchResult[] = [];

      for (const result of results) {
        // Get additional data for source name
        const knowledgeEntry = await this.prisma.knowledgeBase.findUnique({
          where: { id: result.id },
          include: {
            pdfDocument: {
              select: { fileName: true },
            },
          },
        });

        const metadata = result.metadata || {};

        formattedResults.push({
          id: result.id,
          content: result.text,
          similarity: Math.round(result.similarity * 100) / 100, // Round to 2 decimal places
          source: this.getSourceName(metadata, knowledgeEntry),
          metadata: {
            ...metadata,
            knowledgeBaseId: result.id,
            botSettingsId: result.botSettingsId,
          },
        });
      }

      return formattedResults;
    } catch (error) {
      this.logger.error('Error performing knowledge base search:', error);

      // Return empty results on error
      return [];
    }
  }

  async rebuildFromSources(botSettingsId: string) {
    // Verify bot settings exist
    const botSettings = await this.prisma.botSettings.findUnique({
      where: { id: botSettingsId },
      include: {
        faqs: true,
      },
    });

    if (!botSettings) {
      throw new NotFoundException('Bot settings not found');
    }

    // Clear existing knowledge base entries for this bot settings
    await this.prisma.knowledgeBase.deleteMany({
      where: { botSettingsId },
    });

    // Get PDF documents filtered by bot settings
    const pdfDocuments = await this.prisma.pDFDocument.findMany({
      where: { botSettingsId },
    });

    const createdEntries: any[] = [];

    // Create knowledge base entries for FAQs
    for (const faq of botSettings.faqs) {
      const text = `Q: ${faq.question}\nA: ${faq.answer}`;
      const embedding = await this.generateQueryEmbedding(text);

      const metadata = {
        type: 'faq',
        faqId: faq.id,
        question: faq.question,
        dimensions: 1536,
        createdAt: new Date().toISOString(),
      };

      // Use raw SQL to insert with vector type
      const embeddingVector = `[${embedding.join(',')}]`;

      const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "KnowledgeBase" (id, "botSettingsId", text, embeddings, metadata, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${botSettingsId}, ${text}, ${embeddingVector}::vector, ${JSON.stringify(metadata)}::jsonb, NOW(), NOW())
        RETURNING id
      `;

      if (result.length > 0) {
        const knowledgeBaseEntry = await this.prisma.knowledgeBase.findUnique({
          where: { id: result[0].id },
          include: {
            botSettings: true,
          },
        });
        if (knowledgeBaseEntry) {
          createdEntries.push(knowledgeBaseEntry);
        }
      }
    }

    // Create knowledge base entries for PDF document chunks
    for (const doc of pdfDocuments) {
      if (doc.chunks && Array.isArray(doc.chunks)) {
        for (const chunk of doc.chunks) {
          if (
            chunk &&
            typeof chunk === 'object' &&
            'page' in chunk &&
            'content' in chunk
          ) {
            const text = (chunk as any).content;

            // Generate or use existing embedding
            let embedding: number[];
            if (
              (chunk as any).embedding &&
              Array.isArray((chunk as any).embedding)
            ) {
              embedding = (chunk as any).embedding;
            } else {
              embedding = await this.generateQueryEmbedding(text);
            }

            const metadata = {
              type: 'document',
              documentId: doc.id,
              fileName: doc.fileName,
              page: (chunk as any).page,
              dimensions: 1536,
              createdAt: new Date().toISOString(),
            };

            // Use raw SQL to insert with vector type
            const embeddingVector = `[${embedding.join(',')}]`;

            const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
              INSERT INTO "KnowledgeBase" (id, "botSettingsId", "pdfDocumentId", text, embeddings, metadata, "createdAt", "updatedAt")
              VALUES (gen_random_uuid(), ${botSettingsId}, ${doc.id}, ${text}, ${embeddingVector}::vector, ${JSON.stringify(metadata)}::jsonb, NOW(), NOW())
              RETURNING id
            `;

            if (result.length > 0) {
              const knowledgeBaseEntry =
                await this.prisma.knowledgeBase.findUnique({
                  where: { id: result[0].id },
                  include: {
                    botSettings: true,
                    pdfDocument: true,
                  },
                });
              if (knowledgeBaseEntry) {
                createdEntries.push(knowledgeBaseEntry);
              }
            }
          }
        }
      }
    }

    // Return summary of the rebuild operation
    return {
      message: 'Knowledge base rebuilt successfully',
      summary: {
        totalEntries: createdEntries.length,
        faqEntries: botSettings.faqs.length,
        documentEntries: createdEntries.length - botSettings.faqs.length,
        sources: {
          faqs: botSettings.faqs.length,
          documents: pdfDocuments.length,
        },
        rebuiltAt: new Date().toISOString(),
      },
      entries: createdEntries,
    };
  }

  /**
   * Generate embedding for search query using OpenAI
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    try {
      if (apiKey) {
        // Generate real embedding using OpenAI
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: query,
        });
        return response.data[0].embedding;
      } else {
        // Fallback to mock embedding if no API key
        this.logger.warn(
          'Using mock embedding for search query (no OpenAI API key)',
        );
        return Array.from({ length: 1536 }, () => Math.random());
      }
    } catch (error) {
      this.logger.error('Error generating embedding for search query:', error);
      // Fallback to mock embedding on error
      return Array.from({ length: 1536 }, () => Math.random());
    }
  }

  /**
   * Get human-readable source name from metadata and entry
   */
  private getSourceName(metadata: any, entry: any): string {
    if (metadata.type === 'faq') {
      return 'FAQ';
    } else if (metadata.type === 'document') {
      return metadata.fileName ? `${metadata.fileName}` : 'Document';
    }

    // Fallback
    return entry.pdfDocument?.fileName || 'Knowledge Base';
  }
}

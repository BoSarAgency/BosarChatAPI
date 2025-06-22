import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PdfDocumentsService } from './pdf-documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';

// Mock pdf-parse
jest.mock('pdf-parse', () => {
  return jest.fn().mockResolvedValue({
    text: 'This is a sample PDF text content that should be extracted from the PDF file for testing purposes.',
  });
});

describe('PdfDocumentsService', () => {
  let service: PdfDocumentsService;
  let prismaService: jest.Mocked<PrismaService>;
  let s3Service: jest.Mocked<S3Service>;
  let knowledgeBaseService: jest.Mocked<KnowledgeBaseService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockPrismaService = {
      pDFDocument: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };

    const mockS3Service = {
      uploadFile: jest.fn(),
    };

    const mockKnowledgeBaseService = {
      create: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfDocumentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: S3Service, useValue: mockS3Service },
        { provide: KnowledgeBaseService, useValue: mockKnowledgeBaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PdfDocumentsService>(PdfDocumentsService);
    prismaService = module.get(PrismaService);
    s3Service = module.get(S3Service);
    knowledgeBaseService = module.get(KnowledgeBaseService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('splitTextIntoChunks', () => {
    it('should split text into chunks of specified size', () => {
      const text =
        'This is a test text that should be split into smaller chunks for processing.';
      const chunkSize = 20;

      // Access private method for testing
      const chunks = (service as any).splitTextIntoChunks(text, chunkSize);

      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(1);

      // Each chunk should be roughly the specified size or smaller
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(chunkSize + 10); // Allow some flexibility for word boundaries
      });
    });

    it('should handle empty text', () => {
      const chunks = (service as any).splitTextIntoChunks('', 500);
      expect(chunks).toEqual([]);
    });

    it('should handle text shorter than chunk size', () => {
      const text = 'Short text';
      const chunks = (service as any).splitTextIntoChunks(text, 500);
      expect(chunks).toEqual([text]);
    });
  });

  describe('processUploadedFile', () => {
    it('should process a PDF file successfully', async () => {
      // Mock file
      const mockFile = {
        originalname: 'test.pdf',
        buffer: Buffer.from('mock pdf content'),
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      // Mock S3 upload
      s3Service.uploadFile.mockResolvedValue(
        'https://s3.amazonaws.com/bucket/test.pdf',
      );

      // Mock PDF document creation
      const mockDocument = {
        id: 'doc-123',
        fileName: 'test.pdf',
        url: 'https://s3.amazonaws.com/bucket/test.pdf',
        createdAt: new Date(),
        uploader: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        },
      };
      (prismaService.pDFDocument.create as jest.Mock).mockResolvedValue(
        mockDocument,
      );

      // Mock knowledge base creation
      knowledgeBaseService.create.mockResolvedValue({} as any);

      // Mock config service (no OpenAI key for this test)
      configService.get.mockReturnValue(undefined);

      const result = await service.processUploadedFile(
        mockFile,
        'user-123',
        'bot-123',
      );

      expect(result).toBeDefined();
      expect(result.fileName).toBe('test.pdf');
      expect(result.url).toBe('https://s3.amazonaws.com/bucket/test.pdf');
      expect(result.createdAt).toBeDefined();
      expect(s3Service.uploadFile).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining('pdfs/'),
      );
      expect(prismaService.pDFDocument.create).toHaveBeenCalled();
    });
  });
});

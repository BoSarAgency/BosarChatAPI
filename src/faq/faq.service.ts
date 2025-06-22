import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Injectable()
export class FaqService {
  constructor(private prisma: PrismaService) {}

  async create(createFaqDto: CreateFaqDto) {
    // Verify bot settings exist
    const botSettings = await this.prisma.botSettings.findUnique({
      where: { id: createFaqDto.botSettingsId },
    });

    if (!botSettings) {
      throw new NotFoundException('Bot settings not found');
    }

    return this.prisma.fAQ.create({
      data: createFaqDto,
      include: {
        botSettings: true,
      },
    });
  }

  async findAll(botSettingsId?: string) {
    const where = botSettingsId ? { botSettingsId } : {};

    return this.prisma.fAQ.findMany({
      where,
      include: {
        botSettings: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const faq = await this.prisma.fAQ.findUnique({
      where: { id },
      include: {
        botSettings: true,
      },
    });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    return faq;
  }

  async update(id: string, updateFaqDto: UpdateFaqDto) {
    // Check if FAQ exists
    await this.findOne(id);

    return this.prisma.fAQ.update({
      where: { id },
      data: updateFaqDto,
      include: {
        botSettings: true,
      },
    });
  }

  async remove(id: string) {
    // Check if FAQ exists
    await this.findOne(id);

    await this.prisma.fAQ.delete({
      where: { id },
    });

    return { message: 'FAQ deleted successfully' };
  }

  async findByBotSettings(botSettingsId: string) {
    return this.prisma.fAQ.findMany({
      where: { botSettingsId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

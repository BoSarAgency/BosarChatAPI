#!/usr/bin/env ts-node

import { PrismaService } from '../src/prisma/prisma.service';
import { KnowledgeBaseService } from '../src/knowledge-base/knowledge-base.service';
import { ConfigService } from '@nestjs/config';

// Simple ConfigService implementation
class SimpleConfigService extends ConfigService {
  get<T = string>(key: string): T | undefined {
    return process.env[key] as T;
  }
}

async function testSearch() {
  const prismaService = new PrismaService();
  const configService = new SimpleConfigService();
  const knowledgeBaseService = new KnowledgeBaseService(
    prismaService,
    configService,
  );

  try {
    // Get query from command line arguments
    const query = process.argv[2] || 'Membership Policy';
    const limit = parseInt(process.argv[3]) || 5;
    const threshold = parseFloat(process.argv[4]) || 0.7;

    console.log('🚀 Testing KnowledgeBase Search Function');
    console.log('=====================================');
    console.log(`Query: "${query}"`);
    console.log(`Limit: ${limit}`);
    console.log(`Threshold: ${threshold}\n`);

    // Call the search method
    const results = await knowledgeBaseService.search({
      query,
      limit,
      threshold,
    });

    console.log('📊 SEARCH RESULTS:');
    console.log('==================');

    if (results.length === 0) {
      console.log('❌ No results found');
    } else {
      results.forEach((result, index) => {
        console.log(
          `\n${index + 1}. [${result.source}] (Similarity: ${result.similarity})`,
        );
        console.log(
          `   Content: ${result.content.substring(0, 100)}${result.content.length > 100 ? '...' : ''}`,
        );
        console.log(`   ID: ${result.id}`);
      });
    }

    console.log(`\n✅ Search completed! Found ${results.length} results`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prismaService.$disconnect();
  }
}

// Usage info
if (process.argv.length < 3) {
  console.log('🔍 Knowledge Base Search Test');
  console.log('=============================\n');
  console.log('Usage: npm run test-search "query" [limit] [threshold]');
  console.log('\nExamples:');
  console.log('  npm run test-search "business hours"');
  console.log('  npm run test-search "support" 3 0.8');
  process.exit(0);
}

testSearch().catch(console.error);

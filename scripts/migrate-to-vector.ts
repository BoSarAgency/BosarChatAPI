#!/usr/bin/env ts-node

import { PrismaService } from '../src/prisma/prisma.service';

async function migrateToVector() {
  const prisma = new PrismaService();
  
  try {
    console.log('🔄 Migrating KnowledgeBase to use vector type...');
    
    // Clear existing knowledge base data
    console.log('🗑️  Clearing existing KnowledgeBase data...');
    await prisma.knowledgeBase.deleteMany({});
    
    // Drop and recreate the embeddings column as vector type
    console.log('🔧 Converting embeddings column to vector type...');
    await prisma.$executeRaw`
      ALTER TABLE "KnowledgeBase" 
      DROP COLUMN IF EXISTS "embeddings"
    `;
    
    await prisma.$executeRaw`
      ALTER TABLE "KnowledgeBase" 
      ADD COLUMN "embeddings" vector(1536)
    `;
    
    // Create vector index for efficient similarity search
    console.log('📊 Creating vector index...');
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "KnowledgeBase_embeddings_idx" 
      ON "KnowledgeBase" USING ivfflat ("embeddings" vector_cosine_ops) 
      WITH (lists = 100)
    `;
    
    console.log('✅ Migration completed successfully!');
    console.log('💡 You can now add test data with proper vector embeddings.');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateToVector().catch(console.error);

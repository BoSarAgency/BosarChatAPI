#!/usr/bin/env ts-node

import { PrismaService } from '../src/prisma/prisma.service';

async function installPgVector() {
  const prisma = new PrismaService();
  
  try {
    console.log('🔧 Installing pgvector extension...');
    
    // Install pgvector extension
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✅ pgvector extension installed successfully');
    
    // Check if extension is installed
    const result = await prisma.$queryRaw`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector'
    `;
    
    console.log('📋 Extension info:', result);
    
  } catch (error) {
    console.error('❌ Error installing pgvector:', error);
    console.log('\n💡 Note: You may need to install pgvector on your PostgreSQL server first.');
    console.log('   For AWS RDS, you need to add "vector" to shared_preload_libraries parameter.');
    console.log('   For local PostgreSQL, install pgvector: https://github.com/pgvector/pgvector');
  } finally {
    await prisma.$disconnect();
  }
}

installPgVector().catch(console.error);

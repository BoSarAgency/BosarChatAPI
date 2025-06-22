-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add the text column if it doesn't exist
ALTER TABLE "KnowledgeBase" ADD COLUMN IF NOT EXISTS "text" TEXT;

-- Add the metadata column if it doesn't exist  
ALTER TABLE "KnowledgeBase" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Add the embedding column as vector type
ALTER TABLE "KnowledgeBase" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Remove the old embeddings column if it exists
ALTER TABLE "KnowledgeBase" DROP COLUMN IF EXISTS "embeddings";

-- Create an index for vector similarity search using ivfflat
CREATE INDEX IF NOT EXISTS "KnowledgeBase_embedding_idx" ON "KnowledgeBase" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- Add the pending status to ChatStatus enum if it doesn't exist
DO $$ BEGIN
    ALTER TYPE "ChatStatus" ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

/*
  Warnings:

  - Added the required column `botSettingsId` to the `Conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `botSettingsId` to the `PDFDocument` table without a default value. This is not possible if the table is not empty.

*/

-- Add columns with temporary default using the specified botSettingsId
ALTER TABLE "Conversation" ADD COLUMN "botSettingsId" TEXT DEFAULT '106c3cac-0e27-4cc4-851c-921be1b7eeb9';
ALTER TABLE "PDFDocument" ADD COLUMN "botSettingsId" TEXT DEFAULT '106c3cac-0e27-4cc4-851c-921be1b7eeb9';

-- Update existing records to use the specified botSettingsId
UPDATE "Conversation" SET "botSettingsId" = '106c3cac-0e27-4cc4-851c-921be1b7eeb9' WHERE "botSettingsId" IS NULL;
UPDATE "PDFDocument" SET "botSettingsId" = '106c3cac-0e27-4cc4-851c-921be1b7eeb9' WHERE "botSettingsId" IS NULL;

-- Remove default constraints and make columns NOT NULL
ALTER TABLE "Conversation" ALTER COLUMN "botSettingsId" SET NOT NULL;
ALTER TABLE "Conversation" ALTER COLUMN "botSettingsId" DROP DEFAULT;
ALTER TABLE "PDFDocument" ALTER COLUMN "botSettingsId" SET NOT NULL;
ALTER TABLE "PDFDocument" ALTER COLUMN "botSettingsId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KnowledgeBase" ADD COLUMN     "pdfDocumentId" TEXT;

-- AddForeignKey
ALTER TABLE "PDFDocument" ADD CONSTRAINT "PDFDocument_botSettingsId_fkey" FOREIGN KEY ("botSettingsId") REFERENCES "BotSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_pdfDocumentId_fkey" FOREIGN KEY ("pdfDocumentId") REFERENCES "PDFDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_botSettingsId_fkey" FOREIGN KEY ("botSettingsId") REFERENCES "BotSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

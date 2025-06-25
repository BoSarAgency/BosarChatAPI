-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "customerIp" TEXT,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "messagesAmount" INTEGER;

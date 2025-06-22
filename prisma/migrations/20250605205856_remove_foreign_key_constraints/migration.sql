-- DropForeignKey
ALTER TABLE "HumanTakeover" DROP CONSTRAINT "HumanTakeover_triggeredById_fkey";

-- DropForeignKey
ALTER TABLE "PDFDocument" DROP CONSTRAINT "PDFDocument_uploadedBy_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetRequest" DROP CONSTRAINT "PasswordResetRequest_userId_fkey";

-- AlterTable
ALTER TABLE "HumanTakeover" ALTER COLUMN "triggeredById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PDFDocument" ALTER COLUMN "uploadedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PasswordResetRequest" ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PDFDocument" ADD CONSTRAINT "PDFDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanTakeover" ADD CONSTRAINT "HumanTakeover_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

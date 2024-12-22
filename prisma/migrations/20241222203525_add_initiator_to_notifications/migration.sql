-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "initiatorId" INTEGER;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `relatedId` on the `Notification` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "relatedId",
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "relatedEntityId" INTEGER,
ADD COLUMN     "senderId" INTEGER;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

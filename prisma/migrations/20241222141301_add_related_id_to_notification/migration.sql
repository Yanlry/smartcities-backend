/*
  Warnings:

  - You are about to drop the column `metadata` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `relatedEntityId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `senderId` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `relatedId` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_senderId_fkey";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "metadata",
DROP COLUMN "relatedEntityId",
DROP COLUMN "senderId",
ADD COLUMN     "relatedId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "UserFollow_followerId_followingId_idx" ON "UserFollow"("followerId", "followingId");

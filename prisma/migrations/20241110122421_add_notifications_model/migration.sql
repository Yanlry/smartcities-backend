/*
  Warnings:

  - Made the column `latitude` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `longitude` on table `Event` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "latitude" SET NOT NULL,
ALTER COLUMN "latitude" SET DEFAULT 0.0,
ALTER COLUMN "longitude" SET NOT NULL,
ALTER COLUMN "longitude" SET DEFAULT 0.0;

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

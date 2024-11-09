/*
  Warnings:

  - Added the required column `reports` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reports" INTEGER NOT NULL,
ADD COLUMN     "trustRate" DOUBLE PRECISION;

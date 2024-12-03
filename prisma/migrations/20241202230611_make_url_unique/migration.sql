/*
  Warnings:

  - A unique constraint covering the columns `[url]` on the table `Photo` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Photo_url_key" ON "Photo"("url");

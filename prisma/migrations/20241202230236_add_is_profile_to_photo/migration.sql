-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "isProfile" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "_GroupMembers" ADD CONSTRAINT "_GroupMembers_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_GroupMembers_AB_unique";

-- AlterTable
ALTER TABLE "_UserConversations" ADD CONSTRAINT "_UserConversations_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_UserConversations_AB_unique";

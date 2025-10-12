-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "municipalityAddress" TEXT,
ADD COLUMN     "municipalityName" TEXT,
ADD COLUMN     "municipalityPhone" TEXT,
ADD COLUMN     "municipalitySIREN" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

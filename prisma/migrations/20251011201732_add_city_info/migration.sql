-- CreateTable
CREATE TABLE "CityInfo" (
    "id" SERIAL NOT NULL,
    "cityName" TEXT NOT NULL,
    "mayorName" TEXT,
    "mayorPhone" TEXT,
    "mayorPhoto" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "hours" TEXT,
    "teamMembers" JSONB,
    "news" JSONB,
    "services" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityInfo_cityName_key" ON "CityInfo"("cityName");

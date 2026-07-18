-- AlterTable
ALTER TABLE "announcements"
  ADD COLUMN "targetGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "targetSubgroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable (table was previously created via db push — recreate idempotently for shadow DB)
CREATE TABLE IF NOT EXISTS "attendance_view_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_view_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_view_permissions_userId_scopeType_scopeId_key"
    ON "attendance_view_permissions"("userId", "scopeType", "scopeId");

CREATE INDEX IF NOT EXISTS "attendance_view_permissions_userId_idx"
    ON "attendance_view_permissions"("userId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_view_permissions_userId_fkey') THEN
        ALTER TABLE "attendance_view_permissions"
            ADD CONSTRAINT "attendance_view_permissions_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_view_permissions_grantedBy_fkey') THEN
        ALTER TABLE "attendance_view_permissions"
            ADD CONSTRAINT "attendance_view_permissions_grantedBy_fkey"
            FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable (original change — add accessType column)
ALTER TABLE "attendance_view_permissions" ADD COLUMN IF NOT EXISTS "accessType" TEXT NOT NULL DEFAULT 'VIEW';

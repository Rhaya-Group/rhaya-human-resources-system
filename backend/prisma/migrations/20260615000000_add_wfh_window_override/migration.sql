-- CreateTable
CREATE TABLE "wfh_window_overrides" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "openedBy" TEXT,
    "openedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "wfh_window_overrides_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "wfh_window_overrides" ADD CONSTRAINT "wfh_window_overrides_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

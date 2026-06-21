-- CreateTable: WFH Feature Scopes
CREATE TABLE "wfh_feature_scopes" (
  "id"        TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId"   TEXT NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wfh_feature_scopes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wfh_feature_scopes_scopeType_scopeId_key" ON "wfh_feature_scopes"("scopeType","scopeId");

-- CreateTable: WFH Quotas (per-employee weekly quota override)
CREATE TABLE "wfh_quotas" (
  "id"           TEXT NOT NULL,
  "employeeId"   TEXT NOT NULL,
  "quotaPerWeek" INTEGER NOT NULL DEFAULT 1,
  "setBy"        TEXT NOT NULL,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wfh_quotas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wfh_quotas_employeeId_key" ON "wfh_quotas"("employeeId");

-- CreateTable: WFH Schedules (actual bookings)
CREATE TABLE "wfh_schedules" (
  "id"            TEXT NOT NULL,
  "employeeId"    TEXT NOT NULL,
  "weekStartDate" TIMESTAMP(3) NOT NULL,
  "wfhDate"       TIMESTAMP(3) NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "overriddenBy"  TEXT,
  "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wfh_schedules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wfh_schedules_employeeId_wfhDate_key" ON "wfh_schedules"("employeeId","wfhDate");
CREATE INDEX "wfh_schedules_weekStartDate_idx" ON "wfh_schedules"("weekStartDate");
CREATE INDEX "wfh_schedules_employeeId_idx" ON "wfh_schedules"("employeeId");

-- AddForeignKey
ALTER TABLE "wfh_quotas" ADD CONSTRAINT "wfh_quotas_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wfh_quotas" ADD CONSTRAINT "wfh_quotas_setBy_fkey" FOREIGN KEY ("setBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wfh_schedules" ADD CONSTRAINT "wfh_schedules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wfh_schedules" ADD CONSTRAINT "wfh_schedules_overriddenBy_fkey" FOREIGN KEY ("overriddenBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

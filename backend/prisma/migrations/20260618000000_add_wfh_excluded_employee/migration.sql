CREATE TABLE "wfh_excluded_employees" (
  "id"         TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "excludedBy" TEXT,
  "reason"     TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wfh_excluded_employees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wfh_excluded_employees_employeeId_key"
  ON "wfh_excluded_employees"("employeeId");

ALTER TABLE "wfh_excluded_employees"
  ADD CONSTRAINT "wfh_excluded_employees_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wfh_excluded_employees"
  ADD CONSTRAINT "wfh_excluded_employees_excludedBy_fkey"
  FOREIGN KEY ("excludedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

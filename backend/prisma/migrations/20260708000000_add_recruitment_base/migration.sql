-- Base recruitment tables existed in dev before the v2 migration was written.
-- Keep this idempotent so databases that already have them can still replay migrations cleanly.

CREATE TABLE IF NOT EXISTS "applicants" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "resumeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_postings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department" TEXT,
    "location" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "openings" INTEGER NOT NULL DEFAULT 1,
    "closeDate" TIMESTAMP(3),
    "plottingCompanyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_applications" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'APPLIED',
    "coverLetter" TEXT,
    "resumeUrl" TEXT,
    "hrNotes" TEXT,
    "rejectedReason" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "application_events" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT,
    "note" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "applicants_email_key" ON "applicants"("email");
CREATE INDEX IF NOT EXISTS "job_postings_plottingCompanyId_idx" ON "job_postings"("plottingCompanyId");
CREATE INDEX IF NOT EXISTS "job_postings_status_idx" ON "job_postings"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "job_applications_jobPostingId_applicantId_key" ON "job_applications"("jobPostingId", "applicantId");
CREATE INDEX IF NOT EXISTS "job_applications_jobPostingId_idx" ON "job_applications"("jobPostingId");
CREATE INDEX IF NOT EXISTS "job_applications_applicantId_idx" ON "job_applications"("applicantId");
CREATE INDEX IF NOT EXISTS "job_applications_stage_idx" ON "job_applications"("stage");
CREATE INDEX IF NOT EXISTS "application_events_applicationId_idx" ON "application_events"("applicationId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_postings_plottingCompanyId_fkey') THEN
    ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_plottingCompanyId_fkey" FOREIGN KEY ("plottingCompanyId") REFERENCES "PlottingCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_postings_createdById_fkey') THEN
    ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_applications_jobPostingId_fkey') THEN
    ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_applications_applicantId_fkey') THEN
    ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'application_events_applicationId_fkey') THEN
    ALTER TABLE "application_events" ADD CONSTRAINT "application_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "applicants" ADD COLUMN     "cvFileUrl" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parsedCv" JSONB;

-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN     "knockoutFlagged" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "stage" SET DEFAULT 'applied';

-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN     "recruiterId" TEXT;

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isKnockout" BOOLEAN NOT NULL DEFAULT false,
    "knockoutRule" JSONB,
    "scope" TEXT NOT NULL DEFAULT 'position',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_questions" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "position_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_answers" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "profile_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_overseers" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "hrisUserId" TEXT NOT NULL,
    "access" TEXT NOT NULL DEFAULT 'view',
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_overseers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "jobPostingId" TEXT,
    "stage" TEXT,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT,
    "linkUrl" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_scope_idx" ON "questions"("scope");

-- CreateIndex
CREATE INDEX "position_questions_jobPostingId_idx" ON "position_questions"("jobPostingId");

-- CreateIndex
CREATE UNIQUE INDEX "position_questions_jobPostingId_questionId_key" ON "position_questions"("jobPostingId", "questionId");

-- CreateIndex
CREATE INDEX "answers_applicationId_idx" ON "answers"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "answers_applicationId_questionId_key" ON "answers"("applicationId", "questionId");

-- CreateIndex
CREATE INDEX "profile_answers_applicantId_idx" ON "profile_answers"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "profile_answers_applicantId_questionId_key" ON "profile_answers"("applicantId", "questionId");

-- CreateIndex
CREATE INDEX "position_overseers_jobPostingId_idx" ON "position_overseers"("jobPostingId");

-- CreateIndex
CREATE INDEX "position_overseers_hrisUserId_idx" ON "position_overseers"("hrisUserId");

-- CreateIndex
CREATE UNIQUE INDEX "position_overseers_jobPostingId_hrisUserId_key" ON "position_overseers"("jobPostingId", "hrisUserId");

-- CreateIndex
CREATE INDEX "recruitment_documents_applicationId_idx" ON "recruitment_documents"("applicationId");

-- CreateIndex
CREATE INDEX "recruitment_documents_jobPostingId_idx" ON "recruitment_documents"("jobPostingId");

-- CreateIndex
CREATE INDEX "job_postings_recruiterId_idx" ON "job_postings"("recruiterId");

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_questions" ADD CONSTRAINT "position_questions_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_questions" ADD CONSTRAINT "position_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_answers" ADD CONSTRAINT "profile_answers_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_answers" ADD CONSTRAINT "profile_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_overseers" ADD CONSTRAINT "position_overseers_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_overseers" ADD CONSTRAINT "position_overseers_hrisUserId_fkey" FOREIGN KEY ("hrisUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_documents" ADD CONSTRAINT "recruitment_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_documents" ADD CONSTRAINT "recruitment_documents_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

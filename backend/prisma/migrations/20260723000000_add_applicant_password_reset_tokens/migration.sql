-- CreateTable
CREATE TABLE "applicant_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tempPasswordHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicant_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applicant_password_reset_tokens_token_key" ON "applicant_password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "applicant_password_reset_tokens_applicantId_idx" ON "applicant_password_reset_tokens"("applicantId");

-- CreateIndex
CREATE INDEX "applicant_password_reset_tokens_token_idx" ON "applicant_password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "applicant_password_reset_tokens_expiresAt_idx" ON "applicant_password_reset_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "applicant_password_reset_tokens" ADD CONSTRAINT "applicant_password_reset_tokens_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

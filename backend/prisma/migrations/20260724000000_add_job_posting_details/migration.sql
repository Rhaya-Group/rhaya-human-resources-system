CREATE TABLE "job_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "job_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_categories_name_key" ON "job_categories"("name");

ALTER TABLE "job_postings"
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "requirements" JSONB,
  ADD COLUMN "workSystem" TEXT,
  ADD COLUMN "salaryMin" INTEGER,
  ADD COLUMN "salaryMax" INTEGER,
  ADD COLUMN "salaryDisplay" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "job_postings_categoryId_idx" ON "job_postings"("categoryId");

ALTER TABLE "job_postings"
  ADD CONSTRAINT "job_postings_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "job_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "job_categories" ("id", "name") VALUES
  ('accounting_tax', 'Accounting and Tax'),
  ('administration_clerical', 'Administration and Clerical'),
  ('architecture_construction', 'Architecture and Construction'),
  ('audit_risk_management', 'Audit and Risk Management'),
  ('banking_financial_services', 'Banking and Financial Services'),
  ('communication', 'Communication'),
  ('data_statistics', 'Data and Statistics'),
  ('development_program', 'Development Program'),
  ('education', 'Education'),
  ('engineering', 'Engineering'),
  ('environment_health_safety', 'Enviroment, Health, and Safety'),
  ('finance_treasury', 'Finance and Treasury'),
  ('general_affair', 'General Affair'),
  ('health_medical', 'Health and Medical'),
  ('hospitality', 'Hospitality'),
  ('human_capital', 'Human Capital'),
  ('information_technology', 'Information Technology'),
  ('legal', 'Legal'),
  ('marketing', 'Marketing'),
  ('production_manufacturing', 'Production and Manufacturing'),
  ('sales', 'Sales'),
  ('secretary_personal_assisstance', 'Secretary and Personal Assisstance'),
  ('security_task_force', 'Security and Task Force'),
  ('strategic_planning', 'Strategic Planning'),
  ('supply_chain', 'Supply Chain')
ON CONFLICT ("name") DO NOTHING;

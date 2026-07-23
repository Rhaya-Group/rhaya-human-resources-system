-- Add entitySubgroupId to policy_assignments (subgroup-level policy targeting)
ALTER TABLE "policy_assignments" ADD COLUMN "entitySubgroupId" TEXT;

ALTER TABLE "policy_assignments" ADD CONSTRAINT "policy_assignments_entitySubgroupId_fkey"
  FOREIGN KEY ("entitySubgroupId") REFERENCES "entity_subgroups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "policy_assignments_templateId_entitySubgroupId_key"
  ON "policy_assignments"("templateId", "entitySubgroupId");

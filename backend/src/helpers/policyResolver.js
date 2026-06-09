// backend/src/helpers/policyResolver.js
// Option D — Policy Templates with priority-based assignment resolution
import prisma from "../config/database.js";

// ─── In-memory cache ─────────────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── System default (no template assigned) ───────────────────────────────────
export const DEFAULT_POLICY = {
  templateId: null,
  templateName: "Default Policy",
  overtimeMode: "post",
  overtimeSubmissionWindowDays: 7,
  overtimeAllowLateSubmission: false,
  leaveApprovalSteps: 1,
  leaveStep1Approvers: ["supervisor", "dept_head", "hr"],
  leaveStep2Approvers: ["hr"],
  overtimeRateWeekday: 1.5,
  overtimeRateWeekend: 2.0,
  overtimeRateHoliday: 3.0,
  lateToleranceMinutes: 15,
  internalPolicyUrl: null,
  hrEmail: null,
  smtpProfile: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseApprovers(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim())
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

function templateToPolicy(template, assignmentLabel) {
  return {
    templateId: template.id,
    templateName: assignmentLabel || template.name,
    overtimeMode: template.overtimeMode,
    overtimeSubmissionWindowDays: template.overtimeSubmissionWindowDays,
    overtimeAllowLateSubmission: template.overtimeAllowLateSubmission,
    leaveApprovalSteps: template.leaveApprovalSteps,
    leaveStep1Approvers: parseApprovers(template.leaveStep1Approvers),
    leaveStep2Approvers: parseApprovers(template.leaveStep2Approvers),
    overtimeRateWeekday: template.overtimeRateWeekday,
    overtimeRateWeekend: template.overtimeRateWeekend,
    overtimeRateHoliday: template.overtimeRateHoliday,
    lateToleranceMinutes: template.lateToleranceMinutes,
    internalPolicyUrl: template.internalPolicyUrl ?? null,
    hrEmail: template.hrEmail ?? null,
    smtpProfile: template.smtpProfile ?? null,
  };
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.policy;
}

function setCache(key, policy) {
  cache.set(key, { policy, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Core resolver ────────────────────────────────────────────────────────────

/**
 * Resolve the effective policy for a given entity.
 *
 * Algorithm:
 *  1. Fetch the entity's groupId
 *  2. Fetch ALL active PolicyAssignment rows where:
 *       entityId = this entity   OR
 *       entityGroupId = entity's group
 *  3. Sort by priority DESC  (higher number wins)
 *  4. Take the first (highest priority) assignment's template
 *  5. If none → return DEFAULT_POLICY
 *
 * @param {string} entityId  plottingCompany.id
 * @returns {Promise<object>}
 */
export async function getEntityPolicy(entityId) {
  if (!entityId) return { ...DEFAULT_POLICY };

  const cached = getCached(`entity:${entityId}`);
  if (cached) return cached;

  // One query: entity + its group id, plus ALL matching active assignments
  const entity = await prisma.plottingCompany.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      groupId: true,
      policyAssignments: {
        // ← must match the relation field name in schema
        where: { isActive: true },
        include: {
          template: true,
        },
        orderBy: { priority: "desc" },
      },
      group: {
        select: {
          policyAssignments: {
            // ← must match the relation field name in schema
            where: { isActive: true },
            include: {
              template: true,
            },
            orderBy: { priority: "desc" },
          },
        },
      },
    },
  });

  if (!entity) return { ...DEFAULT_POLICY };

  // Merge entity-level and group-level assignments, re-sort by priority
  const allAssignments = [
    ...(entity.policyAssignments || []),
    ...(entity.group?.policyAssignments || []),
  ]
    .filter((a) => a.template?.isActive) // skip soft-deleted templates
    .sort((a, b) => b.priority - a.priority);

  if (allAssignments.length === 0) {
    const policy = { ...DEFAULT_POLICY };
    setCache(`entity:${entityId}`, policy);
    return policy;
  }

  // Highest priority assignment wins entirely — no field-level merging
  const winner = allAssignments[0];
  const policy = templateToPolicy(winner.template, winner.label);

  setCache(`entity:${entityId}`, policy);
  return policy;
}

/**
 * Get effective policy for logged-in user.
 * Pass req.user directly.
 */
export async function getPolicyForUser(user) {
  return getEntityPolicy(user?.plottingCompanyId ?? null);
}

/**
 * Resolve policy by group ID.
 * Returns the highest-priority template assigned to the group.
 */
export async function getGroupPolicy(groupId) {
  if (!groupId) return { ...DEFAULT_POLICY };

  const cached = getCached(`group:${groupId}`);
  if (cached) return cached;

  const assignments = await prisma.policyAssignment.findMany({
    where: { entityGroupId: groupId, isActive: true },
    include: { template: true },
    orderBy: { priority: "desc" },
  });

  const policy =
    assignments.length > 0
      ? templateToPolicy(assignments[0].template, assignments[0].label)
      : { ...DEFAULT_POLICY };

  setCache(`group:${groupId}`, policy);
  return policy;
}

/**
 * Invalidate cache entries for an entity and/or group.
 * Call after any PolicyAssignment create/update/delete.
 */
export function invalidatePolicyCache(entityId, groupId) {
  if (entityId) cache.delete(`entity:${entityId}`);
  if (groupId) cache.delete(`group:${groupId}`);
}

export function clearPolicyCache() {
  cache.clear();
  console.log("[PolicyResolver] Cache cleared");
}

// backend/src/controllers/entityPolicy.controller.js
import prisma from "../config/database.js";
import {
  invalidatePolicyCache,
  clearPolicyCache,
} from "../helpers/policyResolver.js";

// ─── GET /api/entity-policies/my-policy-url ───────────────────────────────────
// Returns the internal policy document URL for the currently logged-in user.
// Used by the sidebar to render the "Internal Policy" link.
// All authenticated employees can access this.
export const getMyPolicyUrl = async (req, res) => {
  try {
    const entityId = req.user?.plottingCompanyId;

    if (!entityId) {
      return res.json({ success: true, data: { url: null } });
    }

    // Priority: entity-specific policy > group policy
    const entity = await prisma.plottingCompany.findUnique({
      where: { id: entityId },
      select: {
        policy: { select: { internalPolicyUrl: true, label: true } },
        group: {
          select: {
            policy: { select: { internalPolicyUrl: true, label: true } },
          },
        },
      },
    });

    const url =
      entity?.policy?.internalPolicyUrl ||
      entity?.group?.policy?.internalPolicyUrl ||
      null;

    const label = entity?.policy?.label || entity?.group?.policy?.label || null;

    res.json({ success: true, data: { url, label } });
  } catch (err) {
    console.error("[EntityPolicy] getMyPolicyUrl error:", err);
    res.status(500).json({ error: "Failed to fetch policy URL" });
  }
};

// ─── GET /api/entity-policies ─────────────────────────────────────────────────
// Returns all configured policies (group + entity-specific).
// Used by the admin UI to populate the policy management table.
export const getAllPolicies = async (req, res) => {
  try {
    const policies = await prisma.entityPolicy.findMany({
      include: {
        entityGroup: {
          select: { id: true, name: true, code: true, color: true },
        },
        plottingCompany: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: policies });
  } catch (err) {
    console.error("[EntityPolicy] getAllPolicies error:", err);
    res.status(500).json({ error: "Failed to fetch policies" });
  }
};

// ─── GET /api/entity-policies/resolved/:entityId ──────────────────────────────
// Returns the effective (merged) policy for a specific entity.
// Used by frontend to show "what rules does this entity follow".
export const getResolvedPolicy = async (req, res) => {
  try {
    const { getEntityPolicy } = await import("../helpers/policyResolver.js");
    const policy = await getEntityPolicy(req.params.entityId);
    res.json({ success: true, data: policy });
  } catch (err) {
    console.error("[EntityPolicy] getResolvedPolicy error:", err);
    res.status(500).json({ error: "Failed to resolve policy" });
  }
};

// ─── POST /api/entity-policies ────────────────────────────────────────────────
// Create a new policy for a group or a specific entity.
export const createPolicy = async (req, res) => {
  try {
    const {
      entityGroupId,
      entityId,
      overtimeMode,
      overtimeSubmissionWindowDays,
      overtimeAllowLateSubmission,
      leaveApprovalSteps,
      leaveStep1Approvers,
      leaveStep2Approvers,
      overtimeRateWeekday,
      overtimeRateWeekend,
      overtimeRateHoliday,
      lateToleranceMinutes,
      internalPolicyUrl, // ✅ was missing
      label,
      notes,
    } = req.body;

    // Must target either a group or a specific entity, not both
    if (!entityGroupId && !entityId) {
      return res.status(400).json({
        error:
          "Policy must be assigned to either an entity group or a specific entity",
      });
    }
    if (entityGroupId && entityId) {
      return res.status(400).json({
        error:
          "Policy cannot be assigned to both a group and an entity simultaneously",
      });
    }

    // Validate overtimeMode
    if (overtimeMode && !["pre", "post"].includes(overtimeMode)) {
      return res.status(400).json({
        error: 'overtimeMode must be "pre" or "post"',
      });
    }

    // Validate leaveApprovalSteps
    if (leaveApprovalSteps && ![1, 2].includes(Number(leaveApprovalSteps))) {
      return res.status(400).json({
        error: "leaveApprovalSteps must be 1 or 2",
      });
    }

    // Normalize approver arrays → comma-separated strings for storage
    const normalizeApprovers = (val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val.join(",") : val;
    };

    const policy = await prisma.entityPolicy.create({
      data: {
        entityGroupId: entityGroupId || null,
        entityId: entityId || null,
        overtimeMode: overtimeMode,
        overtimeSubmissionWindowDays: overtimeSubmissionWindowDays,
        overtimeAllowLateSubmission: overtimeAllowLateSubmission,
        leaveApprovalSteps: leaveApprovalSteps
          ? Number(leaveApprovalSteps)
          : undefined,
        leaveStep1Approvers: normalizeApprovers(leaveStep1Approvers),
        leaveStep2Approvers: normalizeApprovers(leaveStep2Approvers),
        overtimeRateWeekday: overtimeRateWeekday,
        overtimeRateWeekend: overtimeRateWeekend,
        overtimeRateHoliday: overtimeRateHoliday,
        lateToleranceMinutes: lateToleranceMinutes,
        internalPolicyUrl: internalPolicyUrl || null, // ✅ was missing
        label,
        notes,
      },
      include: {
        entityGroup: { select: { id: true, name: true, code: true } },
        plottingCompany: { select: { id: true, name: true, code: true } },
      },
    });

    // Bust cache for affected entity/group
    invalidatePolicyCache(entityId, entityGroupId);

    console.log(
      `[EntityPolicy] Created policy "${policy.label || policy.id}"`,
      {
        entityGroupId,
        entityId,
        by: req.user?.name,
      },
    );

    res.status(201).json({ success: true, data: policy });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({
        error:
          "A policy already exists for this entity or group. Use PUT to update it.",
      });
    }
    console.error("[EntityPolicy] createPolicy error:", err);
    res.status(500).json({ error: "Failed to create policy" });
  }
};

// ─── PUT /api/entity-policies/:id ─────────────────────────────────────────────
// Update an existing policy.
export const updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      overtimeMode,
      overtimeSubmissionWindowDays,
      overtimeAllowLateSubmission,
      leaveApprovalSteps,
      leaveStep1Approvers,
      leaveStep2Approvers,
      overtimeRateWeekday,
      overtimeRateWeekend,
      overtimeRateHoliday,
      lateToleranceMinutes,
      internalPolicyUrl, // ✅ was missing
      label,
      notes,
    } = req.body;

    if (overtimeMode && !["pre", "post"].includes(overtimeMode)) {
      return res
        .status(400)
        .json({ error: 'overtimeMode must be "pre" or "post"' });
    }

    const normalizeApprovers = (val) => {
      if (val === undefined) return undefined;
      if (val === null) return null;
      return Array.isArray(val) ? val.join(",") : val;
    };

    // Build update payload — only include fields that were sent
    const data = {};
    if (overtimeMode !== undefined) data.overtimeMode = overtimeMode;
    if (overtimeSubmissionWindowDays !== undefined)
      data.overtimeSubmissionWindowDays = Number(overtimeSubmissionWindowDays);
    if (overtimeAllowLateSubmission !== undefined)
      data.overtimeAllowLateSubmission = overtimeAllowLateSubmission;
    if (leaveApprovalSteps !== undefined)
      data.leaveApprovalSteps = Number(leaveApprovalSteps);
    if (leaveStep1Approvers !== undefined)
      data.leaveStep1Approvers = normalizeApprovers(leaveStep1Approvers);
    if (leaveStep2Approvers !== undefined)
      data.leaveStep2Approvers = normalizeApprovers(leaveStep2Approvers);
    if (overtimeRateWeekday !== undefined)
      data.overtimeRateWeekday = Number(overtimeRateWeekday);
    if (overtimeRateWeekend !== undefined)
      data.overtimeRateWeekend = Number(overtimeRateWeekend);
    if (overtimeRateHoliday !== undefined)
      data.overtimeRateHoliday = Number(overtimeRateHoliday);
    if (lateToleranceMinutes !== undefined)
      data.lateToleranceMinutes = Number(lateToleranceMinutes);
    if (internalPolicyUrl !== undefined)
      data.internalPolicyUrl = internalPolicyUrl || null; // ✅ was missing
    if (label !== undefined) data.label = label;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.entityPolicy.update({
      where: { id },
      data,
      include: {
        entityGroup: { select: { id: true, name: true, code: true } },
        plottingCompany: { select: { id: true, name: true, code: true } },
      },
    });

    // Bust cache
    invalidatePolicyCache(updated.entityId, updated.entityGroupId);

    console.log(
      `[EntityPolicy] Updated policy "${updated.label || updated.id}"`,
      {
        by: req.user?.name,
      },
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Policy not found" });
    }
    console.error("[EntityPolicy] updatePolicy error:", err);
    res.status(500).json({ error: "Failed to update policy" });
  }
};

// ─── DELETE /api/entity-policies/:id ──────────────────────────────────────────
// Delete a policy (entity/group falls back to default or group policy).
export const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await prisma.entityPolicy.findUnique({ where: { id } });
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }

    await prisma.entityPolicy.delete({ where: { id } });

    invalidatePolicyCache(policy.entityId, policy.entityGroupId);

    console.log(
      `[EntityPolicy] Deleted policy "${policy.label || policy.id}"`,
      {
        by: req.user?.name,
      },
    );

    res.json({ success: true, message: "Policy deleted" });
  } catch (err) {
    console.error("[EntityPolicy] deletePolicy error:", err);
    res.status(500).json({ error: "Failed to delete policy" });
  }
};

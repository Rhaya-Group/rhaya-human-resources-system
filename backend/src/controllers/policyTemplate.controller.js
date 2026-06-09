// backend/src/controllers/policyTemplate.controller.js
import prisma from "../config/database.js";
import {
  invalidatePolicyCache,
  clearPolicyCache,
} from "../helpers/policyResolver.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeApprovers = (val) => {
  if (val === undefined) return undefined;
  if (val === null) return null;
  return Array.isArray(val) ? val.join(",") : val;
};

const validateOvertimeMode = (mode) => !mode || ["pre", "post"].includes(mode);

const validateLeaveSteps = (steps) => !steps || [1, 2].includes(Number(steps));

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

// GET /api/policy-templates
export const getAllTemplates = async (req, res) => {
  try {
    const templates = await prisma.policyTemplate.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { assignments: { where: { isActive: true } } } },
        assignments: {
          where: { isActive: true },
          select: {
            id: true,
            priority: true,
            label: true,
            entityId: true,
            entityGroupId: true,
            entity: { select: { id: true, code: true, name: true } },
            entityGroup: {
              select: { id: true, code: true, name: true, color: true },
            },
          },
          orderBy: { priority: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: templates });
  } catch (err) {
    console.error("[PolicyTemplate] getAllTemplates error:", err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
};

// GET /api/policy-templates/:id
export const getTemplateById = async (req, res) => {
  try {
    const template = await prisma.policyTemplate.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            entity: { select: { id: true, code: true, name: true } },
            entityGroup: {
              select: { id: true, code: true, name: true, color: true },
            },
          },
          orderBy: { priority: "desc" },
        },
      },
    });

    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json({ success: true, data: template });
  } catch (err) {
    console.error("[PolicyTemplate] getTemplateById error:", err);
    res.status(500).json({ error: "Failed to fetch template" });
  }
};

// POST /api/policy-templates
export const createTemplate = async (req, res) => {
  try {
    const {
      name,
      description,
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
      internalPolicyUrl,
      hrEmail,
      smtpProfile,
      notes,
    } = req.body;

    if (!name?.trim())
      return res.status(400).json({ error: "Template name is required" });
    if (!validateOvertimeMode(overtimeMode))
      return res
        .status(400)
        .json({ error: 'overtimeMode must be "pre" or "post"' });
    if (!validateLeaveSteps(leaveApprovalSteps))
      return res
        .status(400)
        .json({ error: "leaveApprovalSteps must be 1 or 2" });

    const template = await prisma.policyTemplate.create({
      data: {
        name: name.trim(),
        description,
        overtimeMode: overtimeMode ?? "post",
        overtimeSubmissionWindowDays: Number(overtimeSubmissionWindowDays ?? 7),
        overtimeAllowLateSubmission: overtimeAllowLateSubmission ?? false,
        leaveApprovalSteps: Number(leaveApprovalSteps ?? 1),
        leaveStep1Approvers:
          normalizeApprovers(leaveStep1Approvers) ?? "supervisor,dept_head,hr",
        leaveStep2Approvers: normalizeApprovers(leaveStep2Approvers) ?? "hr",
        overtimeRateWeekday: Number(overtimeRateWeekday ?? 1.5),
        overtimeRateWeekend: Number(overtimeRateWeekend ?? 2.0),
        overtimeRateHoliday: Number(overtimeRateHoliday ?? 3.0),
        lateToleranceMinutes: Number(lateToleranceMinutes ?? 15),
        internalPolicyUrl: internalPolicyUrl || null,
        hrEmail: hrEmail || null,
        smtpProfile: smtpProfile || null,
        notes,
      },
    });

    console.log(
      `[PolicyTemplate] Created "${template.name}" by ${req.user?.name}`,
    );
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    console.error("[PolicyTemplate] createTemplate error:", err);
    res.status(500).json({ error: "Failed to create template" });
  }
};

// PUT /api/policy-templates/:id
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
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
      internalPolicyUrl,
      hrEmail,
      smtpProfile,
      notes,
    } = req.body;

    if (!validateOvertimeMode(overtimeMode))
      return res
        .status(400)
        .json({ error: 'overtimeMode must be "pre" or "post"' });
    if (!validateLeaveSteps(leaveApprovalSteps))
      return res
        .status(400)
        .json({ error: "leaveApprovalSteps must be 1 or 2" });

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description;
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
      data.internalPolicyUrl = internalPolicyUrl || null;
    if (hrEmail !== undefined) data.hrEmail = hrEmail || null;
    if (smtpProfile !== undefined) data.smtpProfile = smtpProfile || null;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.policyTemplate.update({ where: { id }, data });

    // Bust cache for all entities/groups that use this template
    clearPolicyCache();

    console.log(
      `[PolicyTemplate] Updated "${updated.name}" by ${req.user?.name}`,
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Template not found" });
    console.error("[PolicyTemplate] updateTemplate error:", err);
    res.status(500).json({ error: "Failed to update template" });
  }
};

// DELETE /api/policy-templates/:id  (soft delete — sets isActive=false)
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any active assignments use this template
    const assignmentCount = await prisma.policyAssignment.count({
      where: { templateId: id, isActive: true },
    });

    if (assignmentCount > 0) {
      return res.status(409).json({
        error: `Cannot delete template — it has ${assignmentCount} active assignment(s). Remove assignments first.`,
      });
    }

    await prisma.policyTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    clearPolicyCache();
    console.log(`[PolicyTemplate] Deleted template ${id} by ${req.user?.name}`);
    res.json({ success: true, message: "Template deleted" });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Template not found" });
    console.error("[PolicyTemplate] deleteTemplate error:", err);
    res.status(500).json({ error: "Failed to delete template" });
  }
};

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

// GET /api/policy-templates/assignments
export const getAllAssignments = async (req, res) => {
  try {
    const assignments = await prisma.policyAssignment.findMany({
      where: { isActive: true },
      include: {
        template: { select: { id: true, name: true } },
        entity: { select: { id: true, code: true, name: true } },
        entityGroup: {
          select: { id: true, code: true, name: true, color: true },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    res.json({ success: true, data: assignments });
  } catch (err) {
    console.error("[PolicyTemplate] getAllAssignments error:", err);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
};

// POST /api/policy-templates/assignments
// Assign a template to one or more entities/groups in one call.
// Body: { templateId, targets: [{ entityId? | entityGroupId?, priority?, label? }] }
export const createAssignments = async (req, res) => {
  try {
    const { templateId, targets } = req.body;

    if (!templateId)
      return res.status(400).json({ error: "templateId is required" });
    if (!Array.isArray(targets) || targets.length === 0)
      return res
        .status(400)
        .json({ error: "targets must be a non-empty array" });

    // Validate each target
    for (const t of targets) {
      if (!t.entityId && !t.entityGroupId)
        return res
          .status(400)
          .json({ error: "Each target must have entityId or entityGroupId" });
      if (t.entityId && t.entityGroupId)
        return res.status(400).json({
          error: "Each target must have only one of entityId or entityGroupId",
        });
    }

    // Verify template exists
    const template = await prisma.policyTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) return res.status(404).json({ error: "Template not found" });

    // Upsert each assignment (handles re-assigning an already-assigned entity)
    const created = await prisma.$transaction(
      targets.map((t) =>
        prisma.policyAssignment.upsert({
          where: t.entityId
            ? { templateId_entityId: { templateId, entityId: t.entityId } }
            : {
                templateId_entityGroupId: {
                  templateId,
                  entityGroupId: t.entityGroupId,
                },
              },
          update: {
            priority: t.priority ?? 10,
            label: t.label ?? null,
            isActive: true,
          },
          create: {
            templateId,
            entityId: t.entityId || null,
            entityGroupId: t.entityGroupId || null,
            priority: t.priority ?? 10,
            label: t.label || null,
          },
          include: {
            entity: { select: { id: true, code: true, name: true } },
            entityGroup: { select: { id: true, code: true, name: true } },
          },
        }),
      ),
    );

    // Bust cache for all affected entities/groups
    for (const t of targets) {
      invalidatePolicyCache(t.entityId, t.entityGroupId);
    }

    console.log(
      `[PolicyTemplate] Assigned "${template.name}" to ${targets.length} target(s) by ${req.user?.name}`,
    );

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error("[PolicyTemplate] createAssignments error:", err);
    res.status(500).json({ error: "Failed to create assignments" });
  }
};

// PUT /api/policy-templates/assignments/:id  — update priority or label
export const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, label } = req.body;

    const data = {};
    if (priority !== undefined) data.priority = Number(priority);
    if (label !== undefined) data.label = label || null;

    const updated = await prisma.policyAssignment.update({
      where: { id },
      data,
      include: {
        entity: { select: { id: true, code: true, name: true } },
        entityGroup: { select: { id: true, code: true, name: true } },
      },
    });

    invalidatePolicyCache(updated.entityId, updated.entityGroupId);

    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Assignment not found" });
    console.error("[PolicyTemplate] updateAssignment error:", err);
    res.status(500).json({ error: "Failed to update assignment" });
  }
};

// DELETE /api/policy-templates/assignments/:id
export const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.policyAssignment.findUnique({
      where: { id },
    });
    if (!assignment)
      return res.status(404).json({ error: "Assignment not found" });

    await prisma.policyAssignment.update({
      where: { id },
      data: { isActive: false },
    });

    invalidatePolicyCache(assignment.entityId, assignment.entityGroupId);

    console.log(
      `[PolicyTemplate] Removed assignment ${id} by ${req.user?.name}`,
    );
    res.json({ success: true, message: "Assignment removed" });
  } catch (err) {
    console.error("[PolicyTemplate] deleteAssignment error:", err);
    res.status(500).json({ error: "Failed to delete assignment" });
  }
};

// GET /api/policy-templates/resolved/:entityId
// Returns the effective policy for a given entity (used by admin UI preview)
export const getResolvedPolicy = async (req, res) => {
  try {
    const { getEntityPolicy } = await import("../helpers/policyResolver.js");
    const policy = await getEntityPolicy(req.params.entityId);
    res.json({ success: true, data: policy });
  } catch (err) {
    console.error("[PolicyTemplate] getResolvedPolicy error:", err);
    res.status(500).json({ error: "Failed to resolve policy" });
  }
};

// GET /api/policy-templates/my-policy-url
// Returns internal policy URL for logged-in user's entity (sidebar link)
export const getMyPolicyUrl = async (req, res) => {
  try {
    const entityId = req.user?.plottingCompanyId ?? null;

    // ✅ Bug fix 1: No entity assigned to user → return null cleanly
    if (!entityId) {
      return res.json({ success: true, data: { url: null, label: null } });
    }

    // ✅ Bug fix 2: Query directly here instead of going through resolver
    // The resolver caches for 5 min — if admin just set URL and user refreshes
    // sidebar, the cache hides it. This endpoint bypasses cache intentionally.
    const entity = await prisma.plottingCompany.findUnique({
      where: { id: entityId },
      select: {
        groupId: true,
        policyAssignments: {
          // ← relation name from schema
          where: { isActive: true },
          include: {
            template: {
              select: {
                name: true,
                internalPolicyUrl: true,
                isActive: true,
                overtimeMode: true,
              },
            },
          },
          orderBy: { priority: "desc" },
        },
        group: {
          select: {
            policyAssignments: {
              // ← relation name from schema
              where: { isActive: true },
              include: {
                template: {
                  select: {
                    name: true,
                    internalPolicyUrl: true,
                    isActive: true,
                    overtimeMode: true,
                  },
                },
              },
              orderBy: { priority: "desc" },
            },
          },
        },
      },
    });

    if (!entity) {
      return res.json({ success: true, data: { url: null, label: null } });
    }

    // Merge and sort by priority — highest wins
    const allAssignments = [
      ...(entity.policyAssignments || []),
      ...(entity.group?.policyAssignments || []),
    ]
      .filter((a) => a.template?.isActive) // ✅ Bug fix 3: skip if template soft-deleted
      .sort((a, b) => b.priority - a.priority);

    const winner = allAssignments[0] ?? null;
    console.log("Winner data : ", winner);
    res.json({
      success: true,
      data: {
        url: winner?.template?.internalPolicyUrl || null,
        label: winner?.label || winner?.template?.name || null,
        overtimeMode:
          winner?.overtimeMode || winner?.template?.overtimeMode || null,
      },
    });
  } catch (err) {
    console.error("[PolicyTemplate] getMyPolicyUrl error:", err);
    res.status(500).json({ error: "Failed to fetch policy URL" });
  }
};

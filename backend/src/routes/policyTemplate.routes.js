// backend/src/routes/policyTemplate.routes.js
import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getAllAssignments,
  createAssignments,
  updateAssignment,
  deleteAssignment,
  getResolvedPolicy,
  getMyPolicyUrl,
} from "../controllers/policyTemplate.controller.js";

const router = express.Router();
router.use(authenticate);

// ── Public (all authenticated users) ─────────────────────────────────────────
// ⚠️  my-policy-url and resolved MUST come before /:id
router.get("/my-policy-url", getMyPolicyUrl);
router.get("/resolved/:entityId", requireRole([1, 2]), getResolvedPolicy);

// ── Assignments ───────────────────────────────────────────────────────────────
router.get("/assignments", requireRole([1]), getAllAssignments);
router.post("/assignments", requireRole([1]), createAssignments);
router.put("/assignments/:id", requireRole([1]), updateAssignment);
router.delete("/assignments/:id", requireRole([1]), deleteAssignment);

// ── Templates ─────────────────────────────────────────────────────────────────
router.get("/", requireRole([1]), getAllTemplates);
// ─────────────────────────────────────────────────────────────────────────────
// DEBUG ENDPOINT — add temporarily to policyTemplate.routes.js
// Exposes the full resolution chain for a given entity so you can see
// exactly where the URL is (or isn't) at each step.
//
// Usage: GET /api/policy-templates/debug/:entityId
// ─────────────────────────────────────────────────────────────────────────────

// In policyTemplate.routes.js, add BEFORE the /:id routes:
// router.get('/debug/:entityId', requireRole([1]), debugPolicyResolution);

export const debugPolicyResolution = async (req, res) => {
  try {
    const { entityId } = req.params;

    // Step 1: Raw entity row
    const entity = await prisma.plottingCompany.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        code: true,
        name: true,
        groupId: true,
        assignments: {
          include: { template: true },
          orderBy: { priority: "desc" },
        },
        group: {
          select: {
            id: true,
            code: true,
            name: true,
            assignments: {
              include: { template: true },
              orderBy: { priority: "desc" },
            },
          },
        },
      },
    });

    if (!entity) {
      return res.status(404).json({ error: "Entity not found", entityId });
    }

    // Step 2: All assignments merged and sorted
    const allAssignments = [
      ...(entity.assignments || []).map((a) => ({ ...a, source: "entity" })),
      ...(entity.group?.assignments || []).map((a) => ({
        ...a,
        source: "group",
      })),
    ].sort((a, b) => b.priority - a.priority);

    // Step 3: Winner
    const winner = allAssignments[0] || null;

    res.json({
      debug: true,
      entity: {
        id: entity.id,
        code: entity.code,
        name: entity.name,
        groupId: entity.groupId,
        group: entity.group
          ? {
              id: entity.group.id,
              code: entity.group.code,
              name: entity.group.name,
            }
          : null,
      },
      directAssignments: entity.assignments.map((a) => ({
        id: a.id,
        priority: a.priority,
        isActive: a.isActive,
        label: a.label,
        template: {
          id: a.template.id,
          name: a.template.name,
          internalPolicyUrl: a.template.internalPolicyUrl,
          isActive: a.template.isActive,
        },
      })),
      groupAssignments: (entity.group?.assignments || []).map((a) => ({
        id: a.id,
        priority: a.priority,
        isActive: a.isActive,
        label: a.label,
        template: {
          id: a.template.id,
          name: a.template.name,
          internalPolicyUrl: a.template.internalPolicyUrl,
          isActive: a.template.isActive,
        },
      })),
      allAssignmentsSorted: allAssignments.map((a) => ({
        source: a.source,
        priority: a.priority,
        isActive: a.isActive,
        templateName: a.template.name,
        internalPolicyUrl: a.template.internalPolicyUrl,
      })),
      winner: winner
        ? {
            source: winner.source,
            priority: winner.priority,
            templateId: winner.template.id,
            templateName: winner.template.name,
            internalPolicyUrl: winner.template.internalPolicyUrl,
          }
        : null,
      resolvedInternalPolicyUrl: winner?.template?.internalPolicyUrl ?? null,
      verdict: winner
        ? winner.template.internalPolicyUrl
          ? "✅ URL found — should work"
          : "❌ Winner template has no internalPolicyUrl set"
        : "❌ No assignments found — falling back to DEFAULT_POLICY (no URL)",
    });
  } catch (err) {
    console.error("[Debug] debugPolicyResolution error:", err);
    res.status(500).json({ error: err.message });
  }
};
router.get("/debug/:entityId", requireRole([1]), debugPolicyResolution);
router.get("/:id", requireRole([1]), getTemplateById);
router.post("/", requireRole([1]), createTemplate);
router.put("/:id", requireRole([1]), updateTemplate);
router.delete("/:id", requireRole([1]), deleteTemplate);

export default router;

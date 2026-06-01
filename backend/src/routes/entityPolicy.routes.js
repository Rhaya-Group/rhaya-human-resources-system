// backend/src/routes/entityPolicy.routes.js
import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  getAllPolicies,
  getResolvedPolicy,
  getMyPolicyUrl,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from "../controllers/entityPolicy.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET  /api/entity-policies/my-policy-url        — URL for logged-in user's entity (all levels)
// GET  /api/entity-policies                       — list all policies (Level 1 only)
// GET  /api/entity-policies/resolved/:entityId   — resolved policy for an entity (Level 1-2)
// POST /api/entity-policies                       — create policy (Level 1 only)
// PUT  /api/entity-policies/:id                   — update policy (Level 1 only)
// DELETE /api/entity-policies/:id                 — delete policy (Level 1 only)

// my-policy-url MUST come before /:id to avoid route conflict
router.get("/my-policy-url", getMyPolicyUrl);
router.get("/", requireRole([1]), getAllPolicies);
router.get("/resolved/:entityId", requireRole([1, 2]), getResolvedPolicy);
router.post("/", requireRole([1]), createPolicy);
router.put("/:id", requireRole([1]), updatePolicy);
router.delete("/:id", requireRole([1]), deletePolicy);

export default router;

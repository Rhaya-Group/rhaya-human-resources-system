// backend/src/routes/wfh.routes.js
import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  listScopes,
  addScope,
  updateScope,
  deleteScope,
  listQuotas,
  setQuota,
  deleteQuota,
  getSchedule,
  submitSchedule,
  deleteSchedule,
  listEligibleEmployees,
  checkScope,
  getWindowOverride,
  setWindowOverride,
  addExclusion,
  removeExclusion,
} from "../controllers/wfh.controller.js";

const router = express.Router();
router.use(authenticate);

// ── Scope config (admin only) ─────────────────────────────────────────────────
router.get("/scope", listScopes);
router.post("/scope", addScope);
router.patch("/scope/:id", updateScope);
router.delete("/scope/:id", deleteScope);

// ── Quota management ──────────────────────────────────────────────────────────
router.get("/quota", listQuotas);
router.post("/quota", setQuota);
router.delete("/quota/:employeeId", deleteQuota);

// ── Schedule ──────────────────────────────────────────────────────────────────
router.get("/schedule", getSchedule);
router.post("/schedule", submitSchedule);
router.delete("/schedule/:id", deleteSchedule);

// ── Admin utilities ───────────────────────────────────────────────────────────
router.get("/admin/employees", listEligibleEmployees);

// ── Submission window override (admin only) ───────────────────────────────────
router.get("/admin/window-override", getWindowOverride);
router.post("/admin/window-override", setWindowOverride);

// ── Employee WFH exclusion (admin only) ──────────────────────────────────────
router.post("/admin/excluded", addExclusion);
router.delete("/admin/excluded/:employeeId", removeExclusion);

// ── Scope check (employee + admin) ───────────────────────────────────────────
router.get("/check-scope", checkScope);

export default router;

// backend/src/routes/offboarding.routes.js
import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  createOffboarding,
  getOffboardingByEmployee,
  updateOffboardingChecklist,
  approveOffboarding,
  getAllOffboardings,
  deleteOffboarding,
} from "../controllers/offboarding.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Admin-only routes
router.post("/", requireRole([1, 2]), createOffboarding);
router.get("/all", requireRole([1, 2]), getAllOffboardings);
router.delete("/:id", requireRole([1, 2]), deleteOffboarding);

// Admin or employee can view their own
router.get("/employee/:employeeId", getOffboardingByEmployee);

// Admin-only update
router.put("/:id/checklist", requireRole([1, 2]), updateOffboardingChecklist);

// Approval routes (different access levels)
router.post("/:id/approve", approveOffboarding);

export default router;

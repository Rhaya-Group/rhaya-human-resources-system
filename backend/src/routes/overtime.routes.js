// backend/src/routes/overtime.routes.js
import express from "express";
import * as overtimeController from "../controllers/overtime.controller.js";
import {
  authenticate,
  requireActiveUser,
  requireRole,
} from "../middleware/auth.js";
import { checkRecapLock } from "../middleware/recapLock.middleware.js";

const router = express.Router();

// ============================================
// EMPLOYEE ROUTES
// ============================================

// Submit new overtime request
// Submit overtime (Flow 1 post | Flow 2A planned | Flow 2B incidental)
// Body auto-detected from dates + policy
router.post(
  "/submit",
  authenticate,
  requireActiveUser,
  overtimeController.submitOvertimeRequest,
);

// Get my overtime requests (with filters)
router.get(
  "/my-requests",
  authenticate,
  overtimeController.getMyOvertimeRequests,
);

// Get my overtime balance
router.get(
  "/my-balance",
  authenticate,
  overtimeController.getMyOvertimeBalance,
);

// Edit pending overtime request
// My requests awaiting actualization (Flow 2A only)
router.get(
  "/pending-actualization",
  authenticate,
  overtimeController.getPendingActualization,
);

// Actualize overtime (Flow 2A — submit actual hours after the date)
router.post(
  "/:requestId/actualize",
  authenticate,
  requireActiveUser,
  overtimeController.actualizeOvertime,
);

// Edit/delete pending request
router.put(
  "/:requestId",
  authenticate,
  requireActiveUser,
  overtimeController.editOvertimeRequest,
);

// Delete pending overtime request
router.delete(
  "/:requestId",
  authenticate,
  requireActiveUser,
  overtimeController.deleteOvertimeRequest,
);

// Get single overtime request details
router.get(
  "/:requestId",
  authenticate,
  overtimeController.getOvertimeRequestById,
);

// ============================================
// APPROVER ROUTES
// ============================================

// List pending approvals
router.get(
  "/pending-approval/list",
  authenticate,
  overtimeController.getPendingApprovals,
);

// Approve the PLAN (Flow 2A only — before the date)
router.post(
  "/:requestId/approve-plan",
  authenticate,
  overtimeController.approvePlan,
);

// Approve actual hours (Flow 1, 2B, 2A post-actualization)
router.post(
  "/:requestId/approve",
  authenticate,
  checkRecapLock,
  overtimeController.approveOvertimeRequest,
);

// Reject (all flows)
router.post(
  "/:requestId/reject",
  authenticate,
  checkRecapLock,
  overtimeController.rejectOvertimeRequest,
);

// Request revision
router.post(
  "/:requestId/request-revision",
  authenticate,
  overtimeController.requestRevision,
);

// ============================================
// ADMIN/HR ROUTES
// ============================================

router.get(
  "/admin/all-requests",
  authenticate,
  overtimeController.getAllOvertimeRequests,
);

router.post(
  "/admin/process-balance",
  authenticate,
  overtimeController.processMonthlyBalance,
);

router.post(
  "/admin/reset-balance/:userId",
  authenticate,
  overtimeController.resetEmployeeBalance,
);

router.get(
  "/admin/statistics",
  authenticate,
  overtimeController.getOvertimeStatistics,
);

// Manually trigger actualization check (admin)
router.post(
  "/admin/trigger-actualization-check",
  authenticate,
  requireRole([1]),
  overtimeController.triggerActualizationCheck,
);

router.post(
  "/:requestId/admin-reject",
  authenticate,
  requireRole([1, 2]),
  overtimeController.adminRejectApprovedOvertime,
);

router.put(
  "/:requestId/admin-edit",
  authenticate,
  requireRole([1, 2]),
  overtimeController.adminEditOvertime,
);

export default router;

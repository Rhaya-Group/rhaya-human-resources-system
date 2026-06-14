// backend/src/routes/workStatus.routes.js
import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getWorkStatuses,
  setWorkStatus,
  deleteWorkStatus,
  getDefault,
  setDefault,
  deleteDefault,
  getAttendancePermissions,
  grantAttendancePermission,
  revokeAttendancePermission,
  searchUsersForPermission,
  getIndonesianHolidays,
} from "../controllers/workStatus.controller.js";

const router = express.Router();
router.use(authenticate);

// ── Specific routes first (before generic /:id) ───────────────────────────────

// Default status (must come before /:id)
router.get("/defaults", getDefault);
router.post("/defaults", setDefault);
router.delete("/defaults/:employeeId", deleteDefault);

// Attendance view permissions (must come before /:id)
router.get("/permissions/users", searchUsersForPermission);
router.get("/permissions", getAttendancePermissions);
router.post("/permissions", grantAttendancePermission);
router.delete("/permissions/:id", revokeAttendancePermission);

// Indonesian public holidays proxy (must be before /:id)
router.get("/holidays", getIndonesianHolidays);

// ── Generic routes last ───────────────────────────────────────────────────────

// Work status CRUD
router.get("/", getWorkStatuses);
router.post("/", setWorkStatus);
router.delete("/:id", deleteWorkStatus);  // Must be last — matches any single segment

export default router;

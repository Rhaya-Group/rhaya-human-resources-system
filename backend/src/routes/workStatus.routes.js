// backend/src/routes/workStatus.routes.js
import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getWorkStatuses,
  setWorkStatus,
  deleteWorkStatus,
  getAttendancePermissions,
  grantAttendancePermission,
  revokeAttendancePermission,
  searchUsersForPermission,
} from "../controllers/workStatus.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Work status
router.get("/", getWorkStatuses);
router.post("/", setWorkStatus);
router.delete("/:id", deleteWorkStatus);

// Attendance view permissions
router.get("/permissions/users", searchUsersForPermission);
router.get("/permissions", getAttendancePermissions);
router.post("/permissions", grantAttendancePermission);
router.delete("/permissions/:id", revokeAttendancePermission);

export default router;

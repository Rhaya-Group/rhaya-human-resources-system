// backend/src/routes/announcement.routes.js
import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  getMyAnnouncements,
  getManagedAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcement.controller.js";

const router = express.Router();
router.use(authenticate);

// Self-view — announcements targeted at the current user
router.get("/", getMyAnnouncements);

// HR management (must come before /:id-style routes if any are added later)
router.get("/manage", requireRole([1, 2]), getManagedAnnouncements);
router.post("/", requireRole([1, 2]), createAnnouncement);
router.put("/:id", requireRole([1, 2]), updateAnnouncement);
router.delete("/:id", requireRole([1, 2]), deleteAnnouncement);

export default router;

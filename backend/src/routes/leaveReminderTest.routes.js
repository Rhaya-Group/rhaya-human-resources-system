// backend/src/routes/leaveReminderTest.routes.js
//
// ⚠️  TEST/DEBUG ROUTES ONLY — protect with ADMIN_TEST_KEY or Level 1 only.
// Do NOT expose in production without auth.
//
// Register in index.js:
//   import leaveReminderTestRoutes from './routes/leaveReminderTest.routes.js';
//   app.use('/api/admin/leave-reminder', leaveReminderTestRoutes);

import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  sendLeaveRemindersH7,
  sendImmediateLeaveReminder,
  previewLeaveReminderForDate,
} from "../services/leaveReminder.service.js";

const router = express.Router();
router.use(authenticate);
router.use(requireRole([1])); // Level 1 admin only

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/leave-reminder/preview/h7
//
// Dry-run of today's H-7 batch.
// Shows what would be sent for leaves starting in 7 days.
//
// Response:
// {
//   dryRun: true,
//   leavesFound: 2,
//   previews: [
//     {
//       leaveId: "...",
//       employee: { name, email, entity, subgroup, division },
//       leaveType: "Annual Leave",
//       startDate: "...",
//       daysUntilLeave: 7,
//       to: { email, name, type },
//       cc: ["email1@...", "email2@..."],
//       ccCount: 12,
//       wouldSend: true
//     }
//   ]
// }
// ─────────────────────────────────────────────────────────────────────────────
router.get("/preview/h7", async (req, res) => {
  try {
    const result = await sendLeaveRemindersH7({ dryRun: true });
    res.json(result);
  } catch (err) {
    console.error("[LeaveReminderTest] preview/h7 error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/leave-reminder/preview/date/:date
//
// Dry-run for any specific date.
// Useful when you don't have leaves starting in exactly 7 days.
//
// Example:
//   GET /api/admin/leave-reminder/preview/date/2025-05-20
//   → Shows what would be sent for all approved leaves starting on 2025-05-20
// ─────────────────────────────────────────────────────────────────────────────
router.get("/preview/date/:date", async (req, res) => {
  try {
    const { date } = req.params;

    // Basic YYYY-MM-DD validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD.",
        example: "/preview/date/2025-05-20",
      });
    }

    const result = await previewLeaveReminderForDate(date);
    res.json(result);
  } catch (err) {
    console.error("[LeaveReminderTest] preview/date error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/leave-reminder/preview/leave/:leaveId
//
// Dry-run for a specific leave request by ID.
// Works regardless of how many days away the leave is.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/preview/leave/:leaveId", async (req, res) => {
  try {
    const result = await sendImmediateLeaveReminder(req.params.leaveId, {
      dryRun: true,
    });
    res.json(result);
  } catch (err) {
    console.error("[LeaveReminderTest] preview/leave error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/leave-reminder/send/h7
//
// Actually trigger the H-7 batch right now (real emails sent).
// Useful if the scheduler missed a run.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/send/h7", async (req, res) => {
  try {
    const result = await sendLeaveRemindersH7({ dryRun: false });
    res.json(result);
  } catch (err) {
    console.error("[LeaveReminderTest] send/h7 error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/leave-reminder/send/leave/:leaveId
//
// Actually send immediate reminder for a specific leave (real email).
// ─────────────────────────────────────────────────────────────────────────────
router.post("/send/leave/:leaveId", async (req, res) => {
  try {
    const result = await sendImmediateLeaveReminder(req.params.leaveId, {
      dryRun: false,
    });
    res.json(result);
  } catch (err) {
    console.error("[LeaveReminderTest] send/leave error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

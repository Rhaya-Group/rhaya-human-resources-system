// backend/src/routes/contractReminderTest.routes.js
//
// ⚠️  TEST/DEBUG ROUTES ONLY — Level 1 admin only.
//
// Register in index.js:
//   import contractReminderTestRoutes from './routes/contractReminderTest.routes.js';
//   app.use('/api/admin/contract-reminder', contractReminderTestRoutes);

import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { sendContractExpiryReminders } from "../services/contractReminder.service.js";

const router = express.Router();
router.use(authenticate);
router.use(requireRole([1])); // Level 1 admin only

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/contract-reminder/preview
//
// Dry-run of today's H-30/H-14/H-7/expired batch — no emails sent.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/preview", async (req, res) => {
  try {
    const result = await sendContractExpiryReminders({ dryRun: true });
    res.json(result);
  } catch (err) {
    console.error("[ContractReminderTest] preview error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/contract-reminder/send
//
// Actually trigger the batch right now (real emails sent). Useful if the
// scheduler missed a run.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/send", async (req, res) => {
  try {
    const result = await sendContractExpiryReminders({ dryRun: false });
    res.json(result);
  } catch (err) {
    console.error("[ContractReminderTest] send error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

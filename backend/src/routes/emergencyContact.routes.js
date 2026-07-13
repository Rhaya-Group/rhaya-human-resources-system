// backend/src/routes/emergencyContact.routes.js
import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getEmergencyContacts,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
} from "../controllers/emergencyContact.controller.js";

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/users/:userId/emergency-contacts — self or HR
router.get("/", getEmergencyContacts);

// POST/PUT/DELETE — self only (access enforced in controller)
router.post("/", createEmergencyContact);
router.put("/:contactId", updateEmergencyContact);
router.delete("/:contactId", deleteEmergencyContact);

export default router;

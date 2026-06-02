// backend/src/routes/division.routes.js
import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  getAllDivisions,
  getDivisionById,
  createDivision,
  updateDivision,
  deleteDivision,
} from "../controllers/division.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all divisions (accessible to all authenticated users)
router.get("/", getAllDivisions);

// Get single division
router.get("/:id", getDivisionById);

// Admin-only routes
router.post("/create", requireRole([1, 2]), createDivision);
router.put("/:id", requireRole([1, 2]), updateDivision);
router.delete("/:id", requireRole([1, 2]), deleteDivision);

export default router;

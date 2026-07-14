// backend/src/routes/user.routes.js
import express from "express";
import {
  authenticate,
  authorizeAdmin,
  requireActiveUser,
  requireRole,
  authorizeHR,
} from "../middleware/auth.js";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  permanentDeleteUser,
  adjustUserBalance,
  getUserProfile,
  updateUserProfile,
  hasSubordinates,
  getAccessibleEntities,
  getContractExpirations,
} from "../controllers/user.controller.js";
import { assignScopeToAdmin } from "../controllers/admin.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// PROFILE ROUTES (Available to all authenticated users)
router.get("/profile", getUserProfile);
router.put("/profile", requireActiveUser, updateUserProfile);

// Get all users
router.get("/", requireRole([1, 2]), getAllUsers);

// Check if user has subordinates
router.get("/has-subordinates", authenticate, hasSubordinates);

// router.get("/accessible-entities", authenticate, getAccessibleEntities);
router.get(
  "/accessible-entities",
  authenticate,
  authorizeHR,
  getAccessibleEntities,
);

// Contract expirations widget (must come before /:userId)
router.get("/contract-expirations", requireRole([1, 2]), getContractExpirations);

// Get single user
router.get("/:userId", requireRole([1, 2]), getUserById);

// Create user
router.post("/create", requireRole([1, 2]), createUser);

// Update user
router.put("/:userId", requireRole([1, 2]), updateUser);

// Soft delete (deactivate)
router.put("/:userId/deactivate", requireRole([1, 2]), deactivateUser);

// Hard delete (permanent)
router.delete("/:userId/permanent", authorizeAdmin, permanentDeleteUser);

// Adjust balance
router.post("/:userId/adjust-balance", requireRole([1, 2]), adjustUserBalance);

router.put(
  "/:userId/scope",
  authenticate,
  requireRole([1]),
  assignScopeToAdmin,
);

export default router;

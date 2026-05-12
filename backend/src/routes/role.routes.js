// backend/src/routes/role.routes.js
import express from "express";
import {
  authenticate,
  authorizeAdmin,
  requireRole,
} from "../middleware/auth.js";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// Get all roles
router.get("/", async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// Create new role (Admin only)
router.post("/create", requireRole([1, 2]), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Role name is required" });
    }

    // Check if role already exists
    const existing = await prisma.role.findFirst({
      where: { name: name.trim() },
    });

    if (existing) {
      return res.status(400).json({ error: "Role already exists" });
    }

    const role = await prisma.role.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role,
    });
  } catch (error) {
    console.error("Create role error:", error);
    res.status(500).json({ error: "Failed to create role" });
  }
});

export default router;

// backend/src/controllers/applicantAuth.controller.js
// Register / login / me for external recruitment candidates.
// Mirrors employee auth.controller hashing (bcrypt cost 10) + JWT, but signs
// payload { applicantId } and reads the Applicant table.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import prisma from "../config/database.js";

function signApplicantToken(applicant) {
  return jwt.sign({ applicantId: applicant.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// POST /api/recruitment/applicant-auth/register
export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Validation failed", details: errors.array() });
    }

    const { email, password, name, phone } = req.body;
    const normalizedEmail = email.toLowerCase();

    const existing = await prisma.applicant.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const applicant = await prisma.applicant.create({
      data: { email: normalizedEmail, password: hashedPassword, name, phone: phone || null },
      select: { id: true, email: true, name: true, phone: true, resumeUrl: true },
    });

    const token = signApplicantToken(applicant);
    return res.status(201).json({ token, applicant });
  } catch (error) {
    console.error("Applicant register error:", error);
    return res.status(500).json({ error: "Failed to register. Please try again later." });
  }
};

// POST /api/recruitment/applicant-auth/login
export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Validation failed", details: errors.array() });
    }

    const { email, password } = req.body;

    const applicant = await prisma.applicant.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Generic message to avoid account enumeration
    if (!applicant) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isValid = await bcrypt.compare(password, applicant.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signApplicantToken(applicant);
    const { password: _, ...safe } = applicant;
    return res.json({ token, applicant: safe });
  } catch (error) {
    console.error("Applicant login error:", error);
    return res.status(500).json({ error: "Failed to log in. Please try again later." });
  }
};

// GET /api/recruitment/applicant-auth/me
export const me = async (req, res) => {
  // req.applicant set by applicantAuthenticate
  return res.json({ applicant: req.applicant });
};

export default { register, login, me };

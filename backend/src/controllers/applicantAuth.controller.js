// backend/src/controllers/applicantAuth.controller.js
// Register / login / me for external recruitment candidates.
// Mirrors employee auth.controller hashing (bcrypt cost 10) + JWT, but signs
// payload { applicantId } and reads the Applicant table.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import prisma from "../config/database.js";
import { publicFileUrl } from "../services/r2.service.js";
import {
  generateResetToken,
  getTokenExpiration,
  hashToken,
  verifyToken,
} from "../services/passwordResetToken.service.js";
import { sendApplicantPasswordResetEmail } from "../services/email.service.js";
import { validatePassword } from "../utils/passwordValidator.js";

function withPublicCv(applicant) {
  return applicant ? { ...applicant, cvFileUrl: publicFileUrl(applicant.cvFileUrl) } : applicant;
}

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
      select: { id: true, email: true, name: true, phone: true, resumeUrl: true, cvFileUrl: true },
    });

    const token = signApplicantToken(applicant);
    return res.status(201).json({ token, applicant: withPublicCv(applicant) });
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
    return res.json({ token, applicant: withPublicCv(safe) });
  } catch (error) {
    console.error("Applicant login error:", error);
    return res.status(500).json({ error: "Failed to log in. Please try again later." });
  }
};

// GET /api/recruitment/applicant-auth/me
export const me = async (req, res) => {
  // req.applicant set by applicantAuthenticate
  return res.json({ applicant: withPublicCv(req.applicant) });
};

// POST /api/recruitment/applicant-auth/forgot-password
export const requestPasswordReset = async (req, res) => {
  const message = "If an account with that email exists, a password reset link has been sent.";

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Validation failed", details: errors.array() });
    }

    const applicant = await prisma.applicant.findUnique({
      where: { email: req.body.email.toLowerCase() },
      select: { id: true, email: true, name: true },
    });

    if (!applicant) {
      return res.json({ message });
    }

    const plainToken = generateResetToken();
    const hashedToken = await hashToken(plainToken);
    const expiresAt = getTokenExpiration();
    const now = new Date();

    await prisma.applicantPasswordResetToken.updateMany({
      where: {
        applicantId: applicant.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    await prisma.applicantPasswordResetToken.create({
      data: {
        applicantId: applicant.id,
        token: hashedToken,
        tempPasswordHash: "",
        expiresAt,
      },
    });

    void sendApplicantPasswordResetEmail(applicant, plainToken)
      .then((result) => {
        if (result?.success === false) {
          console.error("Applicant password reset email failed:", result.error);
        }
      })
      .catch((emailError) => {
        console.error("Applicant password reset email failed:", emailError);
      });

    return res.json({ message });
  } catch (error) {
    console.error("Applicant forgot password error:", error);
    return res.json({ message });
  }
};

// GET /api/recruitment/applicant-auth/verify-reset-token/:token
export const verifyResetToken = async (req, res) => {
  try {
    const records = await prisma.applicantPasswordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      include: { applicant: { select: { email: true } } },
    });

    for (const record of records) {
      if (await verifyToken(req.params.token, record.token)) {
        return res.json({ valid: true, email: record.applicant.email });
      }
    }

    return res.status(400).json({ valid: false, message: "Invalid or expired reset token" });
  } catch (error) {
    console.error("Applicant verify reset token error:", error);
    return res.status(500).json({ error: "Failed to verify reset token" });
  }
};

// POST /api/recruitment/applicant-auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Validation failed", details: errors.array() });
    }

    const { token, newPassword } = req.body;
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: "Password does not meet requirements", details: passwordCheck.errors });
    }

    const records = await prisma.applicantPasswordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
    });

    let validRecord = null;
    for (const record of records) {
      if (await verifyToken(token, record.token)) {
        validRecord = record;
        break;
      }
    }

    if (!validRecord) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const now = new Date();

    await prisma.$transaction([
      prisma.applicant.update({
        where: { id: validRecord.applicantId },
        data: { password: hashedPassword },
      }),
      prisma.applicantPasswordResetToken.update({
        where: { id: validRecord.id },
        data: { usedAt: now },
      }),
      prisma.applicantPasswordResetToken.updateMany({
        where: {
          applicantId: validRecord.applicantId,
          usedAt: null,
        },
        data: { usedAt: now },
      }),
    ]);

    return res.json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error("Applicant reset password error:", error);
    return res.status(500).json({ error: "Failed to reset password" });
  }
};

export default { register, login, me, requestPasswordReset, verifyResetToken, resetPassword };

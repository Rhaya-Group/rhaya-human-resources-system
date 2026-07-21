// backend/src/middleware/applicantAuth.js
// Auth for external recruitment candidates (Applicant table).
// Separate from employee `authenticate`: token payload carries { applicantId }.
// An HR token (payload { userId }) has no applicantId → rejected here, and an
// applicant token has no userId → rejected by employee `authenticate`.

import jwt from "jsonwebtoken";
import prisma from "../config/database.js";

export const applicantAuthenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.applicantId) {
      return res.status(401).json({ error: "Not an applicant token" });
    }

    const applicant = await prisma.applicant.findUnique({
      where: { id: decoded.applicantId },
      select: { id: true, email: true, name: true, phone: true, resumeUrl: true, cvFileUrl: true },
    });

    if (!applicant) {
      return res.status(401).json({ error: "Applicant not found" });
    }

    req.applicant = applicant;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export default { applicantAuthenticate };

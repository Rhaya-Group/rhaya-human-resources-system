import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { uploadToR2 } from "../services/r2.service.js";
import { uploadSingle } from "../middleware/uploadMiddleware.js";

const router = Router();
const prisma = new PrismaClient();

// POST /api/recruitment/my/cv  — candidate uploads their CV file to R2
router.post("/", uploadSingle, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = await uploadToR2(req.file, "recruitment/cvs");

  const applicant = await prisma.applicant.update({
    where: { id: req.applicant.id },
    data: { cvFileUrl: fileUrl },
    select: { id: true, cvFileUrl: true },
  });

  res.json(applicant);
});

export default router;

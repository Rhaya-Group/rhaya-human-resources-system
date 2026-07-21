import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { publicFileUrl, uploadToR2, getFileFromR2 } from "../services/r2.service.js";
import { uploadSingle } from "../middleware/uploadMiddleware.js";

const router = Router();
const prisma = new PrismaClient();

async function streamCv(fileUrl, res) {
  if (!fileUrl) return res.status(404).json({ error: "CV not found" });
  const file = await getFileFromR2(fileUrl);
  res.setHeader("Content-Type", file.ContentType || "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="cv"');
  file.Body.pipe(res);
}

router.get("/view", async (req, res) => {
  try {
    return streamCv(req.applicant.cvFileUrl || req.applicant.resumeUrl, res);
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({ error: error.message || "Failed to open CV" });
  }
});

// POST /api/recruitment/my/cv  — candidate uploads their CV file to R2
router.post("/", uploadSingle, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const fileUrl = await uploadToR2(req.file, "recruitment/cvs");

    const applicant = await prisma.applicant.update({
      where: { id: req.applicant.id },
      data: { cvFileUrl: fileUrl },
      select: { id: true, cvFileUrl: true },
    });

    res.json({ ...applicant, cvFileUrl: publicFileUrl(applicant.cvFileUrl) });
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({ error: error.message || "Failed to upload CV" });
  }
});

export default router;

import { PrismaClient } from "@prisma/client";
import { uploadToR2, deleteFromR2 } from "../services/r2.service.js";

const prisma = new PrismaClient();

// ── HR: issue outbound document ───────────────────────────────────────────────

export const issueDocument = async (req, res) => {
  const { applicationId, jobPostingId, stage, kind, title, linkUrl } = req.body;

  let fileUrl = null;
  if (kind === "file") {
    if (!req.file) return res.status(400).json({ error: "File required for kind=file" });
    fileUrl = await uploadToR2(req.file, "recruitment/documents");
  } else if (kind === "link") {
    if (!linkUrl) return res.status(400).json({ error: "linkUrl required for kind=link" });
  } else {
    return res.status(400).json({ error: "kind must be file or link" });
  }

  const doc = await prisma.recruitmentDocument.create({
    data: {
      applicationId,
      jobPostingId,
      stage,
      direction: "outbound",
      kind,
      title,
      fileUrl,
      linkUrl,
      uploadedBy: req.user.id,
    },
  });

  res.status(201).json(doc);
};

// ── HR: list documents for an application or posting ─────────────────────────

export const listDocuments = async (req, res) => {
  const { applicationId, jobPostingId } = req.query;
  const where = {};
  if (applicationId) where.applicationId = applicationId;
  if (jobPostingId) where.jobPostingId = jobPostingId;

  const docs = await prisma.recruitmentDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json(docs);
};

export const deleteDocument = async (req, res) => {
  const doc = await prisma.recruitmentDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  if (doc.fileUrl) await deleteFromR2(doc.fileUrl);
  await prisma.recruitmentDocument.delete({ where: { id: req.params.id } });
  res.status(204).end();
};

// ── Candidate: submit inbound document ───────────────────────────────────────

export const submitDocument = async (req, res) => {
  const { applicationId, stage, kind, title, linkUrl } = req.body;

  // Verify application belongs to this candidate
  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, applicantId: req.applicant.id },
  });
  if (!application) return res.status(403).json({ error: "Application not found" });

  let fileUrl = null;
  if (kind === "file") {
    if (!req.file) return res.status(400).json({ error: "File required for kind=file" });
    fileUrl = await uploadToR2(req.file, "recruitment/submissions");
  } else if (kind === "link") {
    if (!linkUrl) return res.status(400).json({ error: "linkUrl required for kind=link" });
  } else {
    return res.status(400).json({ error: "kind must be file or link" });
  }

  const doc = await prisma.recruitmentDocument.create({
    data: { applicationId, stage, direction: "inbound", kind, title, fileUrl, linkUrl },
  });

  res.status(201).json(doc);
};

// ── Candidate: view documents issued to them ─────────────────────────────────

export const listMyDocuments = async (req, res) => {
  const { applicationId } = req.query;

  // Verify application belongs to this candidate
  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, applicantId: req.applicant.id },
  });
  if (!application) return res.status(403).json({ error: "Application not found" });

  const docs = await prisma.recruitmentDocument.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
  });
  res.json(docs);
};

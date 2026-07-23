import { PrismaClient } from "@prisma/client";
import { uploadToR2, deleteFromR2, publicFileUrl, getFileFromR2 } from "../services/r2.service.js";
import { sendDocumentIssuedEmail, sendInboundDocumentSubmittedEmail } from "../services/email.service.js";

const prisma = new PrismaClient();

function withPublicFile(doc) {
  return doc ? { ...doc, fileUrl: publicFileUrl(doc.fileUrl) } : doc;
}

async function streamDocument(doc, res) {
  if (!doc?.fileUrl) return res.status(404).json({ error: "File not found" });
  const file = await getFileFromR2(doc.fileUrl);
  res.setHeader("Content-Type", file.ContentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.title || "document")}"`);
  file.Body.pipe(res);
}

// ── HR: issue outbound document ───────────────────────────────────────────────

export const issueDocument = async (req, res) => {
  try {
    const { applicationId, jobPostingId, stage, kind, title, linkUrl } = req.body;

    if (!applicationId && !jobPostingId) {
      return res.status(400).json({ error: "applicationId or jobPostingId required" });
    }

    if (applicationId) {
      const application = await prisma.jobApplication.findUnique({ where: { id: applicationId }, select: { id: true } });
      if (!application) return res.status(404).json({ error: "Application not found" });
    }

    if (jobPostingId) {
      const posting = await prisma.jobPosting.findUnique({ where: { id: jobPostingId }, select: { id: true } });
      if (!posting) return res.status(404).json({ error: "Job posting not found" });
    }

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

    if (applicationId) {
      prisma.jobApplication.findUnique({
        where: { id: applicationId },
        include: {
          applicant: { select: { email: true, name: true } },
          jobPosting: { select: { title: true } },
        },
      }).then((application) =>
        sendDocumentIssuedEmail({
          applicant: application?.applicant,
          jobTitle: application?.jobPosting?.title,
          title,
        })
      ).catch((error) => console.error("Recruitment document issued email error:", error));
    }

    res.status(201).json(withPublicFile(doc));
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({ error: error.message || "Failed to issue document" });
  }
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
  res.json(docs.map(withPublicFile));
};

export const deleteDocument = async (req, res) => {
  const doc = await prisma.recruitmentDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  if (doc.fileUrl) await deleteFromR2(doc.fileUrl);
  await prisma.recruitmentDocument.delete({ where: { id: req.params.id } });
  res.status(204).end();
};

export const viewDocument = async (req, res) => {
  try {
    const doc = await prisma.recruitmentDocument.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: "Document not found" });
    return streamDocument(doc, res);
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({ error: error.message || "Failed to open document" });
  }
};

// ── Candidate: submit inbound document ───────────────────────────────────────

export const submitDocument = async (req, res) => {
  try {
    const { applicationId, kind, title, linkUrl } = req.body;

    // Verify application belongs to this candidate
    const application = await prisma.jobApplication.findFirst({
      where: { id: applicationId, applicantId: req.applicant.id },
      include: { jobPosting: { select: { title: true } } },
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
      data: { applicationId, stage: application.stage, direction: "inbound", kind, title, fileUrl, linkUrl },
    });

    prisma.positionOverseer.findMany({
      where: { jobPostingId: application.jobPostingId, access: "manage" },
      include: { hrisUser: { select: { email: true, name: true } } },
    }).then((overseers) =>
      sendInboundDocumentSubmittedEmail({
        recipients: overseers.map((row) => row.hrisUser),
        applicant: req.applicant,
        jobTitle: application.jobPosting?.title,
        title,
      })
    ).catch((error) => console.error("Recruitment inbound document email error:", error));

    res.status(201).json(withPublicFile(doc));
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({ error: error.message || "Failed to submit document" });
  }
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
  res.json(docs.map(withPublicFile));
};

export const viewMyDocument = async (req, res) => {
  try {
    const doc = await prisma.recruitmentDocument.findUnique({
      where: { id: req.params.id },
      include: { application: { select: { applicantId: true } } },
    });
    if (!doc || doc.application?.applicantId !== req.applicant.id) {
      return res.status(404).json({ error: "Document not found" });
    }
    return streamDocument(doc, res);
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({ error: error.message || "Failed to open document" });
  }
};

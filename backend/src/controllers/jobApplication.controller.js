// backend/src/controllers/jobApplication.controller.js
// Candidate side (req.applicant): apply, list own, withdraw.
// HR side (req.user, entity-scoped): list by posting, detail, advance stage, add note.
// Every stage change / note writes an ApplicationEvent (pipeline audit trail).

import prisma from "../config/database.js";
import { canAccessEntity } from "./jobPosting.controller.js";
import { ruleMatches } from "../utils/recruitmentKnockout.js";
import { publicFileUrl, getFileFromR2 } from "../services/r2.service.js";
import { sendApplicationConfirmationEmail, sendStageChangeEmail } from "../services/email.service.js";

const STAGES = [
  "applied",
  "screening",
  "case_study_1",
  "interview",
  "case_study_2",
  "final_interview",
  "col_issued",
  "background_check",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
];

// ─── Candidate ─────────────────────────────────────────────────────────────────

// GET /api/recruitment/public/jobs/:id/questions
export const listPublicQuestions = async (req, res) => {
  try {
    const jobPostingId = req.params.id;

    const posting = await prisma.jobPosting.findUnique({
      where: { id: jobPostingId },
      select: { id: true, status: true, title: true },
    });
    if (!posting || posting.status !== "OPEN") {
      return res.status(404).json({ error: "Job not found or not open" });
    }

    const questions = await prisma.positionQuestion.findMany({
      where: { jobPostingId, question: { is: { scope: "position" } } },
      include: {
        question: {
          select: {
            id: true,
            text: true,
            type: true,
          },
        },
      },
      orderBy: { order: "asc" },
    });

    return res.json(questions);
  } catch (error) {
    console.error("List public questions error:", error);
    return res.status(500).json({ error: "Failed to fetch questions" });
  }
};

// POST /api/recruitment/public/jobs/:id/apply   (applicantAuthenticate)
export const apply = async (req, res) => {
  try {
    const jobPostingId = req.params.id;
    const { coverLetter, resumeUrl, answers = [] } = req.body;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: "answers must be an array" });
    }

    const posting = await prisma.jobPosting.findUnique({
      where: { id: jobPostingId },
      select: { id: true, status: true },
    });
    if (!posting || posting.status !== "OPEN") {
      return res.status(404).json({ error: "Job not found or not open" });
    }

    const existing = await prisma.jobApplication.findUnique({
      where: { jobPostingId_applicantId: { jobPostingId, applicantId: req.applicant.id } },
    });
    if (existing) {
      return res.status(409).json({ error: "You have already applied to this job" });
    }

    const submittedAnswers = answers.filter((answer) => answer.value !== undefined && answer.value !== null);
    const assignedQuestions = await prisma.positionQuestion.findMany({
      where: { jobPostingId, question: { is: { scope: "position" } } },
      include: { question: true },
    });
    const questionsById = new Map(assignedQuestions.map((row) => [row.questionId, row.question]));
    const answeredIds = new Set();
    for (const answer of submittedAnswers) {
      if (!questionsById.has(answer.questionId)) {
        return res.status(400).json({ error: "answers contain a question not assigned to this job" });
      }
      if (answeredIds.has(answer.questionId)) {
        return res.status(400).json({ error: "answers contain duplicate questions" });
      }
      answeredIds.add(answer.questionId);
    }

    const matchedRules = submittedAnswers
      .map((answer) => ({ answer, question: questionsById.get(answer.questionId) }))
      .filter(({ answer, question }) =>
        question?.isKnockout && ruleMatches(question.knockoutRule, answer.value)
      );
    const hardRejected = matchedRules.some(({ question }) => question.knockoutRule?.soft !== true);
    const softFlagged = !hardRejected && matchedRules.some(({ question }) => question.knockoutRule?.soft === true);
    const stage = hardRejected ? "rejected" : "applied";

    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.jobApplication.create({
        data: {
          jobPostingId,
          applicantId: req.applicant.id,
          stage,
          knockoutFlagged: softFlagged,
          coverLetter: coverLetter || null,
          resumeUrl: resumeUrl || publicFileUrl(req.applicant.cvFileUrl) || null,
          rejectedReason: hardRejected ? "Screening knockout" : null,
          events: {
            create: {
              type: "STAGE_CHANGE",
              toStage: stage,
              actorType: hardRejected ? "SYSTEM" : "APPLICANT",
              actorId: req.applicant.id,
            },
          },
        },
      });

      if (submittedAnswers.length) {
        await tx.answer.createMany({
          data: submittedAnswers.map((answer) => ({
            applicationId: created.id,
            questionId: answer.questionId,
            value: answer.value,
          })),
        });
      }

      return created;
    });
    sendApplicationConfirmationEmail({ applicant: req.applicant, jobTitle: posting.title }).catch((error) =>
      console.error("Recruitment application email error:", error)
    );
    return res.status(201).json(application);
  } catch (error) {
    console.error("Apply error:", error);
    return res.status(500).json({ error: "Failed to submit application" });
  }
};

// GET /api/recruitment/my/applications   (applicantAuthenticate)
export const listMine = async (req, res) => {
  try {
    const applications = await prisma.jobApplication.findMany({
      where: { applicantId: req.applicant.id },
      include: {
        jobPosting: {
          select: {
            id: true, title: true, department: true, location: true, status: true,
            plottingCompany: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { appliedAt: "desc" },
    });
    return res.json(applications);
  } catch (error) {
    console.error("List my applications error:", error);
    return res.status(500).json({ error: "Failed to fetch applications" });
  }
};

// DELETE /api/recruitment/my/applications/:id   (applicantAuthenticate)
export const withdraw = async (req, res) => {
  try {
    const application = await prisma.jobApplication.findUnique({
      where: { id: req.params.id },
      select: { id: true, applicantId: true },
    });
    if (!application || application.applicantId !== req.applicant.id) {
      return res.status(404).json({ error: "Application not found" });
    }
    await prisma.jobApplication.delete({ where: { id: req.params.id } });
    return res.json({ message: "Application withdrawn" });
  } catch (error) {
    console.error("Withdraw error:", error);
    return res.status(500).json({ error: "Failed to withdraw application" });
  }
};

// ─── HR ────────────────────────────────────────────────────────────────────────

// Load an application + verify the HR user can access its posting's entity.
async function loadScopedApplication(applicationId, user) {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          resumeUrl: true,
          cvFileUrl: true,
          parsedCv: true,
        },
      },
      jobPosting: { select: { id: true, title: true, plottingCompanyId: true } },
      events: { orderBy: { createdAt: "desc" } },
      answers: { include: { question: true } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!application) return { error: 404 };
  const allowed = await canAccessEntity(user, application.jobPosting.plottingCompanyId);
  if (!allowed) return { error: 403 };

  const positionQuestions = await prisma.positionQuestion.findMany({
    where: { jobPostingId: application.jobPostingId },
    select: { questionId: true, order: true },
  });
  const orderByQuestionId = new Map(positionQuestions.map((row) => [row.questionId, row.order]));
  application.answers.sort((a, b) =>
    (orderByQuestionId.get(a.questionId) ?? 9999) - (orderByQuestionId.get(b.questionId) ?? 9999)
  );
  application.applicant.cvFileUrl = publicFileUrl(application.applicant.cvFileUrl);
  application.applicant.resumeUrl = publicFileUrl(application.applicant.resumeUrl);
  application.resumeUrl = publicFileUrl(application.resumeUrl);
  application.documents = application.documents.map((doc) => ({ ...doc, fileUrl: publicFileUrl(doc.fileUrl) }));

  return { application };
}

// GET /api/recruitment/applications?postingId=...&stage=...   (HR, scoped)
export const listForHr = async (req, res) => {
  try {
    const { postingId, stage } = req.query;
    if (!postingId) {
      return res.status(400).json({ error: "postingId query param is required" });
    }

    const posting = await prisma.jobPosting.findUnique({
      where: { id: postingId },
      select: { id: true, plottingCompanyId: true },
    });
    if (!posting) return res.status(404).json({ error: "Job posting not found" });
    if (!(await canAccessEntity(req.user, posting.plottingCompanyId))) {
      return res.status(403).json({ error: "Access denied for this entity" });
    }

    const where = { jobPostingId: postingId };
    if (stage) where.stage = stage;

    const applications = await prisma.jobApplication.findMany({
      where,
      include: {
        applicant: { select: { id: true, name: true, email: true, phone: true, resumeUrl: true } },
      },
      orderBy: { appliedAt: "desc" },
    });
    return res.json(applications);
  } catch (error) {
    console.error("List applications (HR) error:", error);
    return res.status(500).json({ error: "Failed to fetch applications" });
  }
};

// GET /api/recruitment/applications/:id   (HR, scoped) — full detail + event timeline
export const getForHr = async (req, res) => {
  try {
    const { application, error } = await loadScopedApplication(req.params.id, req.user);
    if (error === 404) return res.status(404).json({ error: "Application not found" });
    if (error === 403) return res.status(403).json({ error: "Access denied for this entity" });
    return res.json(application);
  } catch (error) {
    console.error("Get application (HR) error:", error);
    return res.status(500).json({ error: "Failed to fetch application" });
  }
};

export const viewResumeForHr = async (req, res) => {
  try {
    const { application, error } = await loadScopedApplication(req.params.id, req.user);
    if (error === 404) return res.status(404).json({ error: "Application not found" });
    if (error === 403) return res.status(403).json({ error: "Access denied for this entity" });
    const fileUrl = application.resumeUrl || application.applicant?.cvFileUrl || application.applicant?.resumeUrl;
    if (!fileUrl) return res.status(404).json({ error: "Resume not found" });
    const file = await getFileFromR2(fileUrl);
    res.setHeader("Content-Type", file.ContentType || "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="resume"');
    file.Body.pipe(res);
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({ error: error.message || "Failed to open resume" });
  }
};

// PATCH /api/recruitment/applications/:id/stage   (HR, scoped)
export const updateStage = async (req, res) => {
  try {
    const { stage, note, rejectedReason } = req.body;
    if (!STAGES.includes(stage)) {
      return res.status(400).json({ error: `stage must be one of ${STAGES.join(", ")}` });
    }

    const { application, error } = await loadScopedApplication(req.params.id, req.user);
    if (error === 404) return res.status(404).json({ error: "Application not found" });
    if (error === 403) return res.status(403).json({ error: "Access denied for this entity" });

    const fromStage = application.stage;
    if (fromStage === stage) {
      return res.status(400).json({ error: "Application already at this stage" });
    }

    const [updated] = await prisma.$transaction([
      prisma.jobApplication.update({
        where: { id: application.id },
        data: {
          stage,
          rejectedReason: stage === "rejected" ? rejectedReason || null : null,
        },
      }),
      prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          type: "STAGE_CHANGE",
          fromStage,
          toStage: stage,
          note: note || null,
          actorType: "HR",
          actorId: req.user.id,
        },
      }),
    ]);
    sendStageChangeEmail({
      applicant: application.applicant,
      jobTitle: application.jobPosting?.title,
      stage,
    }).catch((error) => console.error("Recruitment stage email error:", error));
    return res.json(updated);
  } catch (error) {
    console.error("Update stage error:", error);
    return res.status(500).json({ error: "Failed to update stage" });
  }
};

// POST /api/recruitment/applications/:id/notes   (HR, scoped)
export const addNote = async (req, res) => {
  try {
    const { note, scheduledAt, type = "NOTE" } = req.body;
    if (!note && !scheduledAt) {
      return res.status(400).json({ error: "note or scheduledAt is required" });
    }
    if (!["NOTE", "INTERVIEW_SCHEDULED"].includes(type)) {
      return res.status(400).json({ error: "type must be NOTE or INTERVIEW_SCHEDULED" });
    }

    const { application, error } = await loadScopedApplication(req.params.id, req.user);
    if (error === 404) return res.status(404).json({ error: "Application not found" });
    if (error === 403) return res.status(403).json({ error: "Access denied for this entity" });

    const event = await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        type,
        note: note || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        actorType: "HR",
        actorId: req.user.id,
      },
    });
    return res.status(201).json(event);
  } catch (error) {
    console.error("Add note error:", error);
    return res.status(500).json({ error: "Failed to add note" });
  }
};

export default {
  apply, listPublicQuestions, listMine, withdraw, listForHr, getForHr, updateStage, addNote,
};

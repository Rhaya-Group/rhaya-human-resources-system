import prisma from "../config/database.js";
import { publicFileUrl } from "../services/r2.service.js";

const emptyParsedCv = {
  summary: "",
  work_history: [],
  education: [],
  skills: [],
  languages: [],
  links: {
    linkedin: null,
    portfolio: null,
    github: null,
  },
};
const skillLevels = new Set(["beginner", "intermediate", "advanced", "expert"]);
const languageProficiencies = new Set(["basic", "conversational", "professional", "native"]);
const parsedCvKeys = new Set(["summary", "work_history", "education", "skills", "languages", "links"]);
const rowKeys = {
  work_history: new Set(["company", "title", "industry", "start", "end", "current", "description"]),
  education: new Set(["institution", "degree", "field_of_study", "start", "end", "graduated"]),
  skills: new Set(["name", "level"]),
  languages: new Set(["language", "proficiency"]),
  links: new Set(["linkedin", "portfolio", "github"]),
};

function cleanString(value) {
  return typeof value === "string" ? value : "";
}

function cleanNullableString(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function unknownKeys(value, allowed) {
  return Object.keys(value || {}).filter((key) => !allowed.has(key));
}

export function validateParsedCvShape(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return "parsedCv must be an object";
  }

  const rootUnknown = unknownKeys(value, parsedCvKeys);
  if (rootUnknown.length) return `parsedCv contains unknown keys: ${rootUnknown.join(", ")}`;

  for (const key of ["work_history", "education", "skills", "languages"]) {
    if (value[key] !== undefined && !Array.isArray(value[key])) return `parsedCv.${key} must be an array`;
    for (const [index, row] of (value[key] || []).entries()) {
      if (!row || Array.isArray(row) || typeof row !== "object") return `parsedCv.${key}[${index}] must be an object`;
      const extra = unknownKeys(row, rowKeys[key]);
      if (extra.length) return `parsedCv.${key}[${index}] contains unknown keys: ${extra.join(", ")}`;
    }
  }

  if (value.links !== undefined) {
    if (!value.links || Array.isArray(value.links) || typeof value.links !== "object") {
      return "parsedCv.links must be an object";
    }
    const extra = unknownKeys(value.links, rowKeys.links);
    if (extra.length) return `parsedCv.links contains unknown keys: ${extra.join(", ")}`;
  }

  return null;
}

function normalizeParsedCv(value = {}) {
  return {
    summary: cleanString(value.summary),
    work_history: Array.isArray(value.work_history) ? value.work_history.map((item) => {
      const row = item || {};
      return {
      company: cleanString(row.company),
      title: cleanString(row.title),
      industry: cleanString(row.industry),
      start: cleanString(row.start),
      end: row.current ? null : cleanNullableString(row.end),
      current: Boolean(row.current),
      description: cleanString(row.description),
    };
    }) : [],
    education: Array.isArray(value.education) ? value.education.map((item) => {
      const row = item || {};
      return {
      institution: cleanString(row.institution),
      degree: cleanString(row.degree),
      field_of_study: cleanString(row.field_of_study),
      start: cleanString(row.start),
      end: cleanNullableString(row.end),
      graduated: Boolean(row.graduated),
    };
    }) : [],
    skills: Array.isArray(value.skills) ? value.skills.map((item) => {
      const row = item || {};
      return {
      name: cleanString(row.name),
      level: skillLevels.has(row.level) ? row.level : "intermediate",
    };
    }) : [],
    languages: Array.isArray(value.languages) ? value.languages.map((item) => {
      const row = item || {};
      return {
      language: cleanString(row.language),
      proficiency: languageProficiencies.has(row.proficiency) ? row.proficiency : "professional",
    };
    }) : [],
    links: {
      linkedin: cleanNullableString(value.links?.linkedin),
      portfolio: cleanNullableString(value.links?.portfolio),
      github: cleanNullableString(value.links?.github),
    },
  };
}

export const getProfile = async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({
      where: { id: req.applicant.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        resumeUrl: true,
        cvFileUrl: true,
        parsedCv: true,
        profileAnswers: {
          where: { question: { is: { scope: "common" } } },
          include: { question: true },
        },
      },
    });
    return res.json({
      ...applicant,
      cvFileUrl: publicFileUrl(applicant?.cvFileUrl),
      parsedCv: normalizeParsedCv(applicant?.parsedCv || emptyParsedCv),
    });
  } catch (error) {
    console.error("Get applicant profile error:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { parsedCv, name, email } = req.body || {};
    const data = {};
    if (parsedCv !== undefined) {
      const shapeError = validateParsedCvShape(parsedCv);
      if (shapeError) return res.status(400).json({ error: shapeError });
      data.parsedCv = normalizeParsedCv(parsedCv);
    }
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "name is required" });
      data.name = name.trim();
    }
    if (email !== undefined) {
      if (!email.trim()) return res.status(400).json({ error: "email is required" });
      data.email = email.trim().toLowerCase();
    }
    const applicant = await prisma.applicant.update({
      where: { id: req.applicant.id },
      data,
      select: { id: true, name: true, email: true, cvFileUrl: true, parsedCv: true },
    });
    return res.json({ ...applicant, cvFileUrl: publicFileUrl(applicant.cvFileUrl) });
  } catch (error) {
    console.error("Update applicant profile error:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email is already in use" });
    }
    return res.status(500).json({ error: "Failed to update profile" });
  }
};

export const listProfileQuestions = async (_req, res) => {
  try {
    const questions = await prisma.question.findMany({
      where: { scope: "common" },
      orderBy: { createdAt: "asc" },
      select: { id: true, text: true, type: true },
    });
    return res.json(questions);
  } catch (error) {
    console.error("List profile questions error:", error);
    return res.status(500).json({ error: "Failed to fetch profile questions" });
  }
};

export const updateProfileAnswers = async (req, res) => {
  try {
    const { answers = [] } = req.body;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: "answers must be an array" });
    }

    const commonQuestions = await prisma.question.findMany({
      where: { scope: "common" },
      select: { id: true },
    });
    const commonIds = new Set(commonQuestions.map((question) => question.id));
    const seen = new Set();

    for (const answer of answers) {
      if (!commonIds.has(answer.questionId)) {
        return res.status(400).json({ error: "answers contain a non-common question" });
      }
      if (seen.has(answer.questionId)) {
        return res.status(400).json({ error: "answers contain duplicate questions" });
      }
      seen.add(answer.questionId);
    }

    await prisma.$transaction(answers.map((answer) => {
      if (answer.value === undefined || answer.value === null || answer.value === "") {
        return prisma.profileAnswer.deleteMany({
          where: { applicantId: req.applicant.id, questionId: answer.questionId },
        });
      }
      return prisma.profileAnswer.upsert({
        where: {
          applicantId_questionId: {
            applicantId: req.applicant.id,
            questionId: answer.questionId,
          },
        },
        update: { value: answer.value },
        create: {
          applicantId: req.applicant.id,
          questionId: answer.questionId,
          value: answer.value,
        },
      });
    }));

    const profileAnswers = await prisma.profileAnswer.findMany({
      where: { applicantId: req.applicant.id },
      include: { question: true },
    });
    return res.json(profileAnswers);
  } catch (error) {
    console.error("Update profile answers error:", error);
    return res.status(500).json({ error: "Failed to update profile answers" });
  }
};

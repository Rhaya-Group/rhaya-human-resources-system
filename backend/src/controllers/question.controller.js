import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const listQuestions = async (req, res) => {
  const { scope, type } = req.query;
  const where = {};
  if (scope) where.scope = scope;
  if (type) where.type = type;

  const questions = await prisma.question.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json(questions);
};

export const getQuestion = async (req, res) => {
  const q = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!q) return res.status(404).json({ error: "Question not found" });
  res.json(q);
};

export const createQuestion = async (req, res) => {
  const { text, type, isKnockout, knockoutRule, scope } = req.body;
  if (!text || !type) return res.status(400).json({ error: "text and type required" });

  const question = await prisma.question.create({
    data: { text, type, isKnockout: isKnockout ?? false, knockoutRule, scope: scope ?? "position" },
  });
  res.status(201).json(question);
};

export const updateQuestion = async (req, res) => {
  const { text, type, isKnockout, knockoutRule, scope } = req.body;
  const question = await prisma.question.update({
    where: { id: req.params.id },
    data: { text, type, isKnockout, knockoutRule, scope },
  });
  res.json(question);
};

export const deleteQuestion = async (req, res) => {
  // Block delete if question is assigned to any position
  const usedCount = await prisma.positionQuestion.count({ where: { questionId: req.params.id } });
  if (usedCount > 0)
    return res.status(409).json({ error: "Question is assigned to positions — remove assignments first" });

  await prisma.question.delete({ where: { id: req.params.id } });
  res.status(204).end();
};

// ── Position assignment ────────────────────────────────────────────────────────

export const getPositionQuestions = async (req, res) => {
  const questions = await prisma.positionQuestion.findMany({
    where: { jobPostingId: req.params.postingId },
    include: { question: true },
    orderBy: { order: "asc" },
  });
  res.json(questions);
};

export const setPositionQuestions = async (req, res) => {
  // Body: [{ questionId, order }]
  const { postingId } = req.params;
  const assignments = req.body;

  if (!Array.isArray(assignments))
    return res.status(400).json({ error: "Body must be an array of { questionId, order }" });

  await prisma.$transaction([
    prisma.positionQuestion.deleteMany({ where: { jobPostingId: postingId } }),
    ...assignments.map(({ questionId, order }) =>
      prisma.positionQuestion.create({ data: { jobPostingId: postingId, questionId, order: order ?? 0 } })
    ),
  ]);

  const result = await prisma.positionQuestion.findMany({
    where: { jobPostingId: postingId },
    include: { question: true },
    orderBy: { order: "asc" },
  });
  res.json(result);
};

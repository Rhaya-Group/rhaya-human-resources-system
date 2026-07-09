import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Verify HR user can manage overseers for this posting
async function assertManageAccess(postingId, user) {
  const posting = await prisma.jobPosting.findUnique({ where: { id: postingId } });
  if (!posting) throw Object.assign(new Error("Posting not found"), { status: 404 });

  if (user.accessLevel === 1) return posting;
  if (posting.createdById === user.id || posting.recruiterId === user.id) return posting;
  const isOverseer = await prisma.positionOverseer.findFirst({
    where: { jobPostingId: postingId, hrisUserId: user.id, access: "manage" },
  });
  if (!isOverseer) throw Object.assign(new Error("Not authorized to manage overseers"), { status: 403 });
  return posting;
}

export const listOverseers = async (req, res) => {
  await assertManageAccess(req.params.postingId, req.user);
  const overseers = await prisma.positionOverseer.findMany({
    where: { jobPostingId: req.params.postingId },
    include: { hrisUser: { select: { id: true, name: true, email: true, accessLevel: true } } },
  });
  res.json(overseers);
};

export const addOverseer = async (req, res) => {
  await assertManageAccess(req.params.postingId, req.user);
  const { hrisUserId, access } = req.body;
  if (!hrisUserId) return res.status(400).json({ error: "hrisUserId required" });

  const overseer = await prisma.positionOverseer.upsert({
    where: { jobPostingId_hrisUserId: { jobPostingId: req.params.postingId, hrisUserId } },
    create: { jobPostingId: req.params.postingId, hrisUserId, access: access ?? "view", addedBy: req.user.id },
    update: { access: access ?? "view" },
    include: { hrisUser: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json(overseer);
};

export const removeOverseer = async (req, res) => {
  await assertManageAccess(req.params.postingId, req.user);
  await prisma.positionOverseer.deleteMany({
    where: { jobPostingId: req.params.postingId, hrisUserId: req.params.userId },
  });
  res.status(204).end();
};

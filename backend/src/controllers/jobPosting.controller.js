// backend/src/controllers/jobPosting.controller.js
// HR-side CRUD for job postings, entity-scoped via existing scope model:
//   Level 1 → all entities, Level 2 → scopeEntityIds/scopeGroupIds, Level 3+ → n/a (route gated to HR).
// Public read endpoints (listPublic/getPublic) need no auth and only expose OPEN postings.

import prisma from "../config/database.js";
import { applyScopeFilter } from "../utils/scopeHelper.js";

const EMPLOYMENT_TYPES = ["FULL_TIME", "CONTRACT", "INTERN"];
const STATUSES = ["DRAFT", "OPEN", "CLOSED"];

/**
 * Check whether an HR user may act on a given entity.
 * Level 1 → always. Level 2 → entity in scopeEntityIds OR entity's group in scopeGroupIds.
 * (Implemented locally with a real prisma import; scopeHelper.validateScopeAccess
 *  references an unimported prisma and would throw on the group path.)
 */
async function canAccessEntity(user, plottingCompanyId) {
  if (user.accessLevel === 1) return true;
  if (user.accessLevel !== 2) return false;
  if (!plottingCompanyId) return false;

  const { scopeEntityIds = [], scopeGroupIds = [] } = user;
  if (scopeEntityIds.includes(plottingCompanyId)) return true;

  if (scopeGroupIds.length > 0) {
    const entity = await prisma.plottingCompany.findUnique({
      where: { id: plottingCompanyId },
      select: { groupId: true },
    });
    if (entity?.groupId && scopeGroupIds.includes(entity.groupId)) return true;
  }
  return false;
}

const POSTING_INCLUDE = {
  plottingCompany: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { applications: true } },
};

// GET /api/recruitment/jobs  — HR list (scoped). Optional ?status= & ?entityId=
export const listJobs = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.entityId) where.plottingCompanyId = req.query.entityId;

    applyScopeFilter(where, req.user);

    const postings = await prisma.jobPosting.findMany({
      where,
      include: POSTING_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return res.json(postings);
  } catch (error) {
    console.error("List job postings error:", error);
    return res.status(500).json({ error: "Failed to fetch job postings" });
  }
};

// GET /api/recruitment/jobs/:id — HR detail (scoped)
export const getJob = async (req, res) => {
  try {
    const posting = await prisma.jobPosting.findUnique({
      where: { id: req.params.id },
      include: POSTING_INCLUDE,
    });
    if (!posting) return res.status(404).json({ error: "Job posting not found" });

    if (!(await canAccessEntity(req.user, posting.plottingCompanyId))) {
      return res.status(403).json({ error: "Access denied for this entity" });
    }
    return res.json(posting);
  } catch (error) {
    console.error("Get job posting error:", error);
    return res.status(500).json({ error: "Failed to fetch job posting" });
  }
};

// POST /api/recruitment/jobs — HR create
export const createJob = async (req, res) => {
  try {
    const {
      title, description, department, location,
      employmentType = "FULL_TIME", status = "DRAFT",
      openings = 1, closeDate, plottingCompanyId,
    } = req.body;

    if (!title || !description || !plottingCompanyId) {
      return res.status(400).json({ error: "title, description and plottingCompanyId are required" });
    }
    if (!EMPLOYMENT_TYPES.includes(employmentType)) {
      return res.status(400).json({ error: `employmentType must be one of ${EMPLOYMENT_TYPES.join(", ")}` });
    }
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
    }
    if (!(await canAccessEntity(req.user, plottingCompanyId))) {
      return res.status(403).json({ error: "Access denied for this entity" });
    }

    const posting = await prisma.jobPosting.create({
      data: {
        title, description,
        department: department || null,
        location: location || null,
        employmentType, status,
        openings: Number(openings) || 1,
        closeDate: closeDate ? new Date(closeDate) : null,
        plottingCompanyId,
        createdById: req.user.id,
      },
      include: POSTING_INCLUDE,
    });
    return res.status(201).json(posting);
  } catch (error) {
    console.error("Create job posting error:", error);
    return res.status(500).json({ error: "Failed to create job posting" });
  }
};

// PUT /api/recruitment/jobs/:id — HR update
export const updateJob = async (req, res) => {
  try {
    const existing = await prisma.jobPosting.findUnique({
      where: { id: req.params.id },
      select: { id: true, plottingCompanyId: true },
    });
    if (!existing) return res.status(404).json({ error: "Job posting not found" });
    if (!(await canAccessEntity(req.user, existing.plottingCompanyId))) {
      return res.status(403).json({ error: "Access denied for this entity" });
    }

    const {
      title, description, department, location,
      employmentType, status, openings, closeDate, plottingCompanyId,
    } = req.body;

    if (employmentType && !EMPLOYMENT_TYPES.includes(employmentType)) {
      return res.status(400).json({ error: `employmentType must be one of ${EMPLOYMENT_TYPES.join(", ")}` });
    }
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
    }
    // Moving a posting to another entity requires access to the target too
    if (plottingCompanyId && plottingCompanyId !== existing.plottingCompanyId) {
      if (!(await canAccessEntity(req.user, plottingCompanyId))) {
        return res.status(403).json({ error: "Access denied for target entity" });
      }
    }

    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (department !== undefined) data.department = department || null;
    if (location !== undefined) data.location = location || null;
    if (employmentType !== undefined) data.employmentType = employmentType;
    if (status !== undefined) data.status = status;
    if (openings !== undefined) data.openings = Number(openings) || 1;
    if (closeDate !== undefined) data.closeDate = closeDate ? new Date(closeDate) : null;
    if (plottingCompanyId !== undefined) data.plottingCompanyId = plottingCompanyId;

    const posting = await prisma.jobPosting.update({
      where: { id: req.params.id },
      data,
      include: POSTING_INCLUDE,
    });
    return res.json(posting);
  } catch (error) {
    console.error("Update job posting error:", error);
    return res.status(500).json({ error: "Failed to update job posting" });
  }
};

// DELETE /api/recruitment/jobs/:id — HR delete (cascades applications + events)
export const deleteJob = async (req, res) => {
  try {
    const existing = await prisma.jobPosting.findUnique({
      where: { id: req.params.id },
      select: { id: true, plottingCompanyId: true },
    });
    if (!existing) return res.status(404).json({ error: "Job posting not found" });
    if (!(await canAccessEntity(req.user, existing.plottingCompanyId))) {
      return res.status(403).json({ error: "Access denied for this entity" });
    }

    await prisma.jobPosting.delete({ where: { id: req.params.id } });
    return res.json({ message: "Job posting deleted" });
  } catch (error) {
    console.error("Delete job posting error:", error);
    return res.status(500).json({ error: "Failed to delete job posting" });
  }
};

// ─── Public (no auth) ──────────────────────────────────────────────────────────

// GET /api/recruitment/public/jobs — only OPEN postings
export const listPublic = async (req, res) => {
  try {
    const postings = await prisma.jobPosting.findMany({
      where: { status: "OPEN" },
      select: {
        id: true, title: true, department: true, location: true,
        employmentType: true, openings: true, closeDate: true, createdAt: true,
        plottingCompany: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(postings);
  } catch (error) {
    console.error("List public jobs error:", error);
    return res.status(500).json({ error: "Failed to fetch jobs" });
  }
};

// GET /api/recruitment/public/jobs/:id — single OPEN posting detail
export const getPublic = async (req, res) => {
  try {
    const posting = await prisma.jobPosting.findFirst({
      where: { id: req.params.id, status: "OPEN" },
      select: {
        id: true, title: true, description: true, department: true, location: true,
        employmentType: true, openings: true, closeDate: true, createdAt: true,
        plottingCompany: { select: { id: true, name: true } },
      },
    });
    if (!posting) return res.status(404).json({ error: "Job not found or not open" });
    return res.json(posting);
  } catch (error) {
    console.error("Get public job error:", error);
    return res.status(500).json({ error: "Failed to fetch job" });
  }
};

export { canAccessEntity };
export default {
  listJobs, getJob, createJob, updateJob, deleteJob, listPublic, getPublic, canAccessEntity,
};

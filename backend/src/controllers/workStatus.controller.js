// backend/src/controllers/workStatus.controller.js
// Handles work status (WFO/WFH/LEAVE/OUTSIDE_OFFICE) per employee per day

import prisma from "../config/database.js";

const VALID_STATUSES = ["WFO", "WFH", "LEAVE", "OUTSIDE_OFFICE"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the set of employeeIds visible to the requesting user.
 * Returns null to mean "all employees".
 */
async function resolveVisibleEmployeeIds(user) {
  const level = user.accessLevel ?? 5;

  if (level === 1) return null; // super admin sees all

  // Collect entity IDs from user's natural scope
  let entityIds = [];

  if (level === 2) {
    // L2 scoped admin — use scopeEntityIds + scopeGroupIds
    entityIds = [...(user.scopeEntityIds || [])];
    if (user.scopeGroupIds?.length) {
      const groupEntities = await prisma.plottingCompany.findMany({
        where: { groupId: { in: user.scopeGroupIds } },
        select: { id: true },
      });
      entityIds.push(...groupEntities.map((e) => e.id));
    }
  } else {
    // L3/L4/L5 — own entity
    if (user.plottingCompanyId) entityIds = [user.plottingCompanyId];
  }

  // Expand with AttendanceViewPermission grants
  const grants = await prisma.attendanceViewPermission.findMany({
    where: { userId: user.id },
  });

  for (const grant of grants) {
    if (grant.scopeType === "ENTITY") {
      entityIds.push(grant.scopeId);
    } else if (grant.scopeType === "SUBGROUP") {
      const subgroupEntities = await prisma.plottingCompany.findMany({
        where: { subgroupId: grant.scopeId },
        select: { id: true },
      });
      entityIds.push(...subgroupEntities.map((e) => e.id));
    } else if (grant.scopeType === "GROUP") {
      const groupEntities = await prisma.plottingCompany.findMany({
        where: { groupId: grant.scopeId },
        select: { id: true },
      });
      entityIds.push(...groupEntities.map((e) => e.id));
    }
  }

  entityIds = [...new Set(entityIds)];

  // Get all employees in those entities
  const teamEmployees = await prisma.user.findMany({
    where: { plottingCompanyId: { in: entityIds } },
    select: { id: true },
  });

  const ids = new Set(teamEmployees.map((u) => u.id));

  // For SPV (L4) and managers (L3): also include subordinates (direct + indirect)
  if (level <= 4) {
    const subordinateIds = await getAllSubordinateIds(user.id);
    subordinateIds.forEach((id) => ids.add(id));
  }

  // Always include self
  ids.add(user.id);

  return [...ids];
}

/** Recursively collect all subordinate IDs (BFS) */
async function getAllSubordinateIds(supervisorId) {
  const result = new Set();
  const queue = [supervisorId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    const subs = await prisma.user.findMany({
      where: { supervisorId: currentId },
      select: { id: true },
    });
    for (const sub of subs) {
      if (!result.has(sub.id)) {
        result.add(sub.id);
        queue.push(sub.id);
      }
    }
  }
  return [...result];
}

/** Check if a date is today or in the future (no past edits) */
function isEditableDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return target >= today;
}

/** Check if a user can modify a specific employee's status */
function canModify(requestingUser, targetEmployeeId) {
  const level = requestingUser.accessLevel ?? 5;
  if (level <= 2) return true; // admin can modify anyone (in scope)
  if (requestingUser.id === targetEmployeeId) return true; // own status
  // SPV/manager can modify subordinates — checked separately via resolveVisibleEmployeeIds
  return false;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/work-status
 * Query: date (YYYY-MM-DD) | startDate + endDate for range
 */
export const getWorkStatuses = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!requestingUser) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const { date, startDate, endDate } = req.query;

    // Resolve date range
    let dateFrom, dateTo;
    if (startDate && endDate) {
      dateFrom = new Date(startDate);
      dateTo = new Date(endDate);
    } else {
      const targetDate = date ? new Date(date) : new Date();
      dateFrom = new Date(targetDate);
      dateTo = new Date(targetDate);
    }
    dateFrom.setHours(0, 0, 0, 0);
    dateTo.setHours(23, 59, 59, 999);

    // Resolve visible employee IDs
    const visibleIds = await resolveVisibleEmployeeIds(requestingUser);

    // Build employee filter
    const employeeFilter =
      visibleIds !== null ? { id: { in: visibleIds } } : {};

    // Fetch all visible employees (for showing WFO defaults)
    const employees = await prisma.user.findMany({
      where: employeeFilter,
      select: {
        id: true,
        name: true,
        nip: true,
        plottingCompanyId: true,
        plottingCompany: { select: { id: true, name: true, subgroupId: true, groupId: true } },
        division: { select: { id: true, name: true } },
        supervisorId: true,
        accessLevel: true,
      },
      orderBy: [{ plottingCompanyId: "asc" }, { name: "asc" }],
    });

    // Fetch statuses in date range
    const statusWhere = {
      date: { gte: dateFrom, lte: dateTo },
    };
    if (visibleIds !== null) {
      statusWhere.employeeId = { in: visibleIds };
    }

    const statuses = await prisma.workStatus.findMany({
      where: statusWhere,
      include: {
        submitter: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { employeeId: "asc" }],
    });

    // Enrich: attach status records to employees
    const statusMap = {};
    for (const s of statuses) {
      const key = `${s.employeeId}::${s.date.toISOString().split("T")[0]}`;
      statusMap[key] = s;
    }

    return res.json({
      success: true,
      employees,
      statuses,
      statusMap, // keyed by "employeeId::YYYY-MM-DD"
    });
  } catch (err) {
    console.error("[WorkStatus] getWorkStatuses error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/work-status
 * Body: { employeeId, date, status, note }
 */
export const setWorkStatus = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!requestingUser) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const { employeeId, date, status, note } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: "employeeId, date, and status are required",
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // Date validation — no editing past dates (except admin)
    const level = requestingUser.accessLevel ?? 5;
    if (level > 2 && !isEditableDate(date)) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify status for past dates",
      });
    }

    // Authorization — check if requester can modify target employee
    if (requestingUser.id !== employeeId) {
      const visibleIds = await resolveVisibleEmployeeIds(requestingUser);
      if (visibleIds !== null && !visibleIds.includes(employeeId)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to modify this employee's status",
        });
      }
    }

    // LEAVE status can only be set by system (leave approval hook) or admin
    if (status === "LEAVE" && level > 2 && requestingUser.id !== employeeId) {
      return res.status(403).json({
        success: false,
        message: "LEAVE status is managed automatically from approved leave requests",
      });
    }

    // Upsert
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const workStatus = await prisma.workStatus.upsert({
      where: {
        employeeId_date: { employeeId, date: targetDate },
      },
      create: {
        employeeId,
        date: targetDate,
        status,
        note: note || null,
        submittedBy: requestingUser.id,
      },
      update: {
        status,
        note: note || null,
        submittedBy: requestingUser.id,
      },
      include: {
        employee: { select: { id: true, name: true } },
        submitter: { select: { id: true, name: true } },
      },
    });

    return res.json({ success: true, data: workStatus });
  } catch (err) {
    console.error("[WorkStatus] setWorkStatus error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/work-status/:id
 * Removes a status record (resets to WFO default)
 */
export const deleteWorkStatus = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    const { id } = req.params;

    const record = await prisma.workStatus.findUnique({ where: { id } });
    if (!record) {
      return res.status(404).json({ success: false, message: "Status record not found" });
    }

    // Only allow deletion of today/future records for non-admins
    const level = requestingUser.accessLevel ?? 5;
    if (level > 2 && !isEditableDate(record.date.toISOString())) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete status for past dates",
      });
    }

    // Auth check
    if (requestingUser.id !== record.employeeId) {
      const visibleIds = await resolveVisibleEmployeeIds(requestingUser);
      if (visibleIds !== null && !visibleIds.includes(record.employeeId)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    }

    await prisma.workStatus.delete({ where: { id } });
    return res.json({ success: true, message: "Status removed (reset to WFO default)" });
  } catch (err) {
    console.error("[WorkStatus] deleteWorkStatus error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Attendance View Permission ────────────────────────────────────────────────

/**
 * GET /api/work-status/permissions
 * L1 admin: get all permissions. Others: get own.
 */
export const getAttendancePermissions = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    const level = requestingUser?.accessLevel ?? 5;

    const where = level === 1 ? {} : { userId: req.user.id };

    const permissions = await prisma.attendanceViewPermission.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        granter: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, data: permissions });
  } catch (err) {
    console.error("[AttendancePerm] getAttendancePermissions error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/work-status/permissions
 * L1 admin only: grant attendance view permission
 */
export const grantAttendancePermission = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if ((requestingUser?.accessLevel ?? 5) !== 1) {
      return res.status(403).json({ success: false, message: "L1 admin only" });
    }

    const { userId, scopeType, scopeId } = req.body;
    if (!userId || !scopeType || !scopeId) {
      return res.status(400).json({
        success: false,
        message: "userId, scopeType, and scopeId are required",
      });
    }
    if (!["ENTITY", "SUBGROUP", "GROUP"].includes(scopeType)) {
      return res.status(400).json({
        success: false,
        message: "scopeType must be ENTITY, SUBGROUP, or GROUP",
      });
    }

    const permission = await prisma.attendanceViewPermission.upsert({
      where: { userId_scopeType_scopeId: { userId, scopeType, scopeId } },
      create: { userId, scopeType, scopeId, grantedBy: req.user.id },
      update: { grantedBy: req.user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        granter: { select: { id: true, name: true } },
      },
    });

    return res.json({ success: true, data: permission });
  } catch (err) {
    console.error("[AttendancePerm] grantAttendancePermission error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/work-status/permissions/:id
 * L1 admin only: revoke permission
 */
export const revokeAttendancePermission = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if ((requestingUser?.accessLevel ?? 5) !== 1) {
      return res.status(403).json({ success: false, message: "L1 admin only" });
    }

    const { id } = req.params;
    await prisma.attendanceViewPermission.delete({ where: { id } });
    return res.json({ success: true, message: "Permission revoked" });
  } catch (err) {
    console.error("[AttendancePerm] revokeAttendancePermission error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/work-status/permissions/users
 * L1 admin: search users for permission assignment
 */
export const searchUsersForPermission = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if ((requestingUser?.accessLevel ?? 5) !== 1) {
      return res.status(403).json({ success: false, message: "L1 admin only" });
    }

    const { q } = req.query;
    const users = await prisma.user.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
        : {},
      select: { id: true, name: true, email: true, accessLevel: true },
      take: 20,
      orderBy: { name: "asc" },
    });
    return res.json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getWorkStatuses,
  setWorkStatus,
  deleteWorkStatus,
  getAttendancePermissions,
  grantAttendancePermission,
  revokeAttendancePermission,
  searchUsersForPermission,
};

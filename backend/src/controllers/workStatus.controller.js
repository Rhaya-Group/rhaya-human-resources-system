// backend/src/controllers/workStatus.controller.js
// Work Status (WFO/WFH/LEAVE/OUTSIDE_OFFICE) per employee per day

import prisma from "../config/database.js";

const VALID_STATUSES = ["WFO", "WFH", "LEAVE", "OUTSIDE_OFFICE"];
const BOD_ROLE_NAME = "Board of Director";

// In-memory holiday cache: "YYYY" -> { data: [], expiry: number }
const _holidayCache = new Map();

// Exclude employees from team view
const EXCLUDED_EMPLOYEE_STATUSES = ["INACTIVE", "ADMIN"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse "YYYY-MM-DD" string as UTC midnight Date.
 * Avoids the timezone trap: new Date("YYYY-MM-DD") is already UTC midnight,
 * but setHours(0,0,0,0) shifts it to LOCAL midnight which in e.g. UTC+7
 * equals the PREVIOUS day at 17:00 UTC — causing @db.Date to store wrong day.
 */
function parseDateUTC(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Check if date string (YYYY-MM-DD) is today or future, using UTC comparison */
function isEditableDate(dateStr) {
  const todayUTC = new Date();
  const todayMidnight = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate()));
  const target = parseDateUTC(dateStr);
  return target >= todayMidnight;
}

/** Active-employee filter (exclude inactive + admin employeeStatus + L1/L2) */
function activeEmployeeFilter() {
  return {
    employeeStatus: { notIn: EXCLUDED_EMPLOYEE_STATUSES },
    accessLevel: { gte: 3 },
  };
}

/** Recursively collect all subordinate IDs (BFS) */
async function getAllSubordinateIds(supervisorId) {
  const result = new Set();
  const queue = [supervisorId];
  while (queue.length > 0) {
    const cur = queue.shift();
    const subs = await prisma.user.findMany({
      where: { supervisorId: cur },
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

/**
 * Resolve set of visible (or editable) employee IDs for the requesting user.
 * null = all employees.
 * editableOnly = true → grant-added IDs limited to EDIT grants (VIEW grants are view-only).
 */
async function resolveVisibleEmployeeIds(user, editableOnly = false) {
  const level = user.accessLevel ?? 5;
  if (level === 1) return null; // super admin sees all

  const ids = new Set([user.id]); // always include self

  // ── L2 scoped admin: whole entities in their scope ────────────────────────
  if (level === 2) {
    let entityIds = [...(user.scopeEntityIds || [])];
    if (user.scopeGroupIds?.length) {
      const groupEntities = await prisma.plottingCompany.findMany({
        where: { groupId: { in: user.scopeGroupIds } },
        select: { id: true },
      });
      entityIds.push(...groupEntities.map((e) => e.id));
    }
    entityIds = [...new Set(entityIds)];
    const employees = await prisma.user.findMany({
      where: { plottingCompanyId: { in: entityIds }, ...activeEmployeeFilter() },
      select: { id: true },
    });
    employees.forEach((u) => ids.add(u.id));
  } else {
    // ── L3-L5: division-scoped + subordinates + division-head peers ──────────

    // 1. Same division
    if (user.divisionId) {
      const divisionEmployees = await prisma.user.findMany({
        where: { divisionId: user.divisionId, ...activeEmployeeFilter() },
        select: { id: true },
      });
      divisionEmployees.forEach((u) => ids.add(u.id));
    }

    // 2. Subordinates (recursive BFS)
    const subs = await getAllSubordinateIds(user.id);
    subs.forEach((id) => ids.add(id));

    // 3. Division-head peer view: if user IS a division head, see other div heads
    const myHeadDivision = await prisma.division.findFirst({
      where: { headId: user.id },
      select: { id: true },
    });
    if (myHeadDivision) {
      const allDivisions = await prisma.division.findMany({
        where: { headId: { not: null } },
        select: { headId: true },
      });
      allDivisions.forEach((d) => { if (d.headId) ids.add(d.headId); });
    }
  }

  // ── AttendanceViewPermission grants (any level) ───────────────────────────
  const grants = await prisma.attendanceViewPermission.findMany({
    where: {
      userId: user.id,
      ...(editableOnly ? { accessType: "EDIT" } : {}),
    },
  });
  for (const grant of grants) {
    let extraEntityIds = [];
    if (grant.scopeType === "ENTITY") {
      extraEntityIds = [grant.scopeId];
    } else if (grant.scopeType === "SUBGROUP") {
      const ents = await prisma.plottingCompany.findMany({
        where: { subgroupId: grant.scopeId }, select: { id: true },
      });
      extraEntityIds = ents.map((e) => e.id);
    } else if (grant.scopeType === "GROUP") {
      const ents = await prisma.plottingCompany.findMany({
        where: { groupId: grant.scopeId }, select: { id: true },
      });
      extraEntityIds = ents.map((e) => e.id);
    }
    if (extraEntityIds.length) {
      const extra = await prisma.user.findMany({
        where: { plottingCompanyId: { in: extraEntityIds }, ...activeEmployeeFilter() },
        select: { id: true },
      });
      extra.forEach((u) => ids.add(u.id));
    }
  }

  return [...ids];
}

// ─── Work Status CRUD ─────────────────────────────────────────────────────────

/**
 * GET /api/work-status
 * Query: date | startDate+endDate | page | pageSize | myCalendar
 *        filterEntityIds (comma-sep) | excludeEntityIds (comma-sep)
 */
export const getWorkStatuses = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!requestingUser) return res.status(401).json({ success: false, message: "User not found" });

    const {
      date,
      startDate,
      endDate,
      page = 1,
      pageSize = 25,
      myCalendar,
      filterEntityIds,   // "id1,id2" – include ONLY these entity IDs
      excludeEntityIds,  // "id1,id2" – exclude these entity IDs
    } = req.query;

    // ── Date range (UTC-safe) ─────────────────────────────────────────────────
    let dateFrom, dateTo;
    if (startDate && endDate) {
      dateFrom = parseDateUTC(startDate);
      dateTo   = parseDateUTC(endDate);
    } else if (date) {
      dateFrom = parseDateUTC(date);
      dateTo   = parseDateUTC(date);
    } else {
      const now = new Date();
      dateFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      dateTo   = new Date(dateFrom);
    }
    dateTo = new Date(Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth(), dateTo.getUTCDate(), 23, 59, 59, 999));

    // ── Personal calendar: own data only ──────────────────────────────────────
    if (myCalendar === "true") {
      const statuses = await prisma.workStatus.findMany({
        where: { employeeId: req.user.id, date: { gte: dateFrom, lte: dateTo } },
        orderBy: { date: "asc" },
      });
      const defaultRec = await prisma.workStatusDefault.findUnique({
        where: { employeeId: req.user.id },
      });
      return res.json({ success: true, statuses, default: defaultRec });
    }

    // ── Resolve visible employees + entity filter ─────────────────────────────
    const visibleIds = await resolveVisibleEmployeeIds(requestingUser);

    let entityPlottingFilter = {};
    if (filterEntityIds) {
      const ids = filterEntityIds.split(",").filter(Boolean);
      if (ids.length) entityPlottingFilter.plottingCompanyId = { in: ids };
    } else if (excludeEntityIds) {
      const ids = excludeEntityIds.split(",").filter(Boolean);
      if (ids.length) entityPlottingFilter.plottingCompanyId = { notIn: ids };
    }

    // Combined where clause for employees in scope + entity filter applied
    const employeeWhere = {
      ...(visibleIds !== null ? { id: { in: visibleIds } } : {}),
      ...activeEmployeeFilter(),
      ...entityPlottingFilter,
    };

    // ── All IDs in filtered scope (used for statuses + summary) ──────────────
    const allEmpIds = (await prisma.user.findMany({
      where: employeeWhere,
      select: { id: true },
    })).map((u) => u.id);

    // ── Pagination ────────────────────────────────────────────────────────────
    const totalEmployees = allEmpIds.length;
    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));

    const employees = await prisma.user.findMany({
      where: employeeWhere,
      select: {
        id: true,
        name: true,
        nip: true,
        accessLevel: true,
        plottingCompanyId: true,
        plottingCompany: { select: { id: true, name: true, subgroupId: true, groupId: true } },
        division: { select: { id: true, name: true } },
        supervisorId: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: [{ plottingCompanyId: "asc" }, { name: "asc" }],
      skip: (pageNum - 1) * size,
      take: size,
    });

    // All BOD in scope (not paginated, for pinning)
    const allBodEmployees = await prisma.user.findMany({
      where: { ...employeeWhere, role: { name: BOD_ROLE_NAME } },
      select: { id: true },
    });

    // ── Statuses for all employees in scope (includes all pages) ─────────────
    const statuses = await prisma.workStatus.findMany({
      where: { date: { gte: dateFrom, lte: dateTo }, employeeId: { in: allEmpIds } },
      include: { submitter: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { employeeId: "asc" }],
    });

    // ── Defaults for all employees in scope ───────────────────────────────────
    const defaults = await prisma.workStatusDefault.findMany({
      where: { employeeId: { in: allEmpIds } },
    });
    const defaultMap = {};
    for (const d of defaults) defaultMap[d.employeeId] = d;

    // ── Summary (for today/single-day view) across ALL filtered employees ─────
    // Build per-employee status map for the date range
    const empStatusMap = {}; // empId -> { dateStr -> status }
    for (const s of statuses) {
      const ds = s.date.toISOString().split("T")[0];
      if (!empStatusMap[s.employeeId]) empStatusMap[s.employeeId] = {};
      empStatusMap[s.employeeId][ds] = s.status;
    }

    const dateKey = dateFrom.toISOString().split("T")[0]; // primary date (today)
    const bodIds = new Set(allBodEmployees.map((b) => b.id));
    const summary = { WFO: 0, WFH: 0, LEAVE: 0, OUTSIDE_OFFICE: 0 };
    const bodSummary = { WFO: 0, WFH: 0, LEAVE: 0, OUTSIDE_OFFICE: 0 };

    for (const empId of allEmpIds) {
      const eff = empStatusMap[empId]?.[dateKey] || defaultMap[empId]?.status || "WFO";
      if (bodIds.has(empId)) {
        bodSummary[eff] = (bodSummary[eff] || 0) + 1;
      } else {
        summary[eff] = (summary[eff] || 0) + 1;
      }
    }

    // ── Per-day summary for week range (for tfoot in WeekView) ───────────────
    let weekDaySummary = null;
    if (startDate && endDate) {
      weekDaySummary = {};
      const cursor = parseDateUTC(startDate);
      const endUTC  = parseDateUTC(endDate);
      while (cursor <= endUTC) {
        const dow = cursor.getUTCDay();
        if (dow !== 0 && dow !== 6) { // weekdays only
          const ds = cursor.toISOString().split("T")[0];
          weekDaySummary[ds] = { WFO: 0, WFH: 0, OUTSIDE_OFFICE: 0, LEAVE: 0 };
          for (const empId of allEmpIds) {
            if (bodIds.has(empId)) continue;
            const eff = empStatusMap[empId]?.[ds] || defaultMap[empId]?.status || "WFO";
            weekDaySummary[ds][eff] = (weekDaySummary[ds][eff] || 0) + 1;
          }
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    // ── Visible entities for filter dropdown (unfiltered scope) ──────────────
    const visibleEntitiesWhere = {
      users: {
        some: {
          ...(visibleIds !== null ? { id: { in: visibleIds } } : {}),
          ...activeEmployeeFilter(),
        },
      },
    };
    const visibleEntities = await prisma.plottingCompany.findMany({
      where: visibleEntitiesWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return res.json({
      success: true,
      employees,          // paginated current page
      statuses,           // statuses for ALL employees in filtered scope
      defaults: defaultMap,
      summary,            // non-BOD counts for primary date (all pages)
      bodSummary,
      weekDaySummary,     // per working-day counts for week range (null for single-day)
      visibleEntities,    // all entities user can potentially see (for dropdown)
      totalEmployees,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(totalEmployees / size),
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
    if (!requestingUser) return res.status(401).json({ success: false, message: "User not found" });

    const { employeeId, date, status, note } = req.body;

    if (!employeeId || !date || !status)
      return res.status(400).json({ success: false, message: "employeeId, date, and status required" });

    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({ success: false, message: `Status must be: ${VALID_STATUSES.join(", ")}` });

    const level = requestingUser.accessLevel ?? 5;
    if (level > 2 && !isEditableDate(date))
      return res.status(403).json({ success: false, message: "Cannot modify status for past dates" });

    // Weekend block for non-admins (L3+)
    if (level > 2) {
      const dow = parseDateUTC(date).getUTCDay();
      if (dow === 0 || dow === 6)
        return res.status(400).json({ success: false, message: "Cannot set status on weekends" });
    }

    if (requestingUser.id !== employeeId) {
      const editableIds = await resolveVisibleEmployeeIds(requestingUser, true);
      if (editableIds !== null && !editableIds.includes(employeeId))
        return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const targetDate = parseDateUTC(date); // UTC midnight — avoids timezone-shifted date storage

    const workStatus = await prisma.workStatus.upsert({
      where: { employeeId_date: { employeeId, date: targetDate } },
      create: { employeeId, date: targetDate, status, note: note || null, submittedBy: requestingUser.id },
      update: { status, note: note || null, submittedBy: requestingUser.id },
      include: { employee: { select: { id: true, name: true } }, submitter: { select: { id: true, name: true } } },
    });

    return res.json({ success: true, data: workStatus });
  } catch (err) {
    console.error("[WorkStatus] setWorkStatus error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/work-status/:id
 */
export const deleteWorkStatus = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    const { id } = req.params;

    const record = await prisma.workStatus.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ success: false, message: "Not found" });

    const level = requestingUser.accessLevel ?? 5;
    if (level > 2 && !isEditableDate(record.date.toISOString().split("T")[0]))
      return res.status(403).json({ success: false, message: "Cannot delete past dates" });

    if (requestingUser.id !== record.employeeId) {
      const editableIds = await resolveVisibleEmployeeIds(requestingUser, true);
      if (editableIds !== null && !editableIds.includes(record.employeeId))
        return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await prisma.workStatus.delete({ where: { id } });
    return res.json({ success: true, message: "Status removed (reset to default)" });
  } catch (err) {
    console.error("[WorkStatus] deleteWorkStatus error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Default Status ───────────────────────────────────────────────────────────

/**
 * GET /api/work-status/defaults?employeeId=xxx
 * Own default (or admin querying another employee)
 */
export const getDefault = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    const targetId = req.query.employeeId || req.user.id;

    // Auth: admin can query anyone; others only self
    if (targetId !== req.user.id && (requestingUser?.accessLevel ?? 5) > 2) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const record = await prisma.workStatusDefault.findUnique({
      where: { employeeId: targetId },
    });

    return res.json({ success: true, data: record }); // null = WFO default
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/work-status/defaults
 * Body: { employeeId?, status, note }
 * Employee: sets own default. Admin: sets for any employee.
 */
export const setDefault = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    const level = requestingUser?.accessLevel ?? 5;

    const { status, note } = req.body;
    const employeeId = req.body.employeeId || req.user.id;

    // Auth: only self or admin
    if (employeeId !== req.user.id && level > 2) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status` });
    }

    const record = await prisma.workStatusDefault.upsert({
      where: { employeeId },
      create: { employeeId, status, note: note || null, setBy: req.user.id },
      update: { status, note: note || null, setBy: req.user.id },
    });

    return res.json({ success: true, data: record });
  } catch (err) {
    console.error("[WorkStatus] setDefault error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/work-status/defaults/:employeeId
 * Resets default to WFO (deletes the override record)
 */
export const deleteDefault = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    const { employeeId } = req.params;
    const level = requestingUser?.accessLevel ?? 5;

    if (employeeId !== req.user.id && level > 2)
      return res.status(403).json({ success: false, message: "Forbidden" });

    await prisma.workStatusDefault.deleteMany({ where: { employeeId } });
    return res.json({ success: true, message: "Default reset to WFO" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Attendance View Permission ────────────────────────────────────────────────

export const getAttendancePermissions = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
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
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const grantAttendancePermission = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if ((requestingUser?.accessLevel ?? 5) !== 1)
      return res.status(403).json({ success: false, message: "L1 admin only" });

    const { userId, scopeType, scopeId, accessType = "VIEW" } = req.body;
    if (!userId || !scopeType || !scopeId)
      return res.status(400).json({ success: false, message: "userId, scopeType, scopeId required" });

    if (!["ENTITY", "SUBGROUP", "GROUP"].includes(scopeType))
      return res.status(400).json({ success: false, message: "Invalid scopeType" });

    if (!["VIEW", "EDIT"].includes(accessType))
      return res.status(400).json({ success: false, message: "accessType must be VIEW or EDIT" });

    const permission = await prisma.attendanceViewPermission.upsert({
      where: { userId_scopeType_scopeId: { userId, scopeType, scopeId } },
      create: { userId, scopeType, scopeId, accessType, grantedBy: req.user.id },
      update: { accessType, grantedBy: req.user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        granter: { select: { id: true, name: true } },
      },
    });

    return res.json({ success: true, data: permission });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const revokeAttendancePermission = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if ((requestingUser?.accessLevel ?? 5) !== 1)
      return res.status(403).json({ success: false, message: "L1 admin only" });

    await prisma.attendanceViewPermission.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: "Permission revoked" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const searchUsersForPermission = async (req, res) => {
  try {
    const requestingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if ((requestingUser?.accessLevel ?? 5) !== 1)
      return res.status(403).json({ success: false, message: "L1 admin only" });

    const { q } = req.query;
    const users = await prisma.user.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
      select: { id: true, name: true, email: true, accessLevel: true },
      take: 20,
      orderBy: { name: "asc" },
    });
    return res.json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Indonesian Public Holidays ───────────────────────────────────────────────

/**
 * GET /api/work-status/holidays?year=2026
 * Returns Indonesian public holidays for the given year.
 * Source: api-harilibur.vercel.app (covers Islamic + national holidays).
 * Fallback: Nager.Date (international-only, no Islamic holidays).
 * Results cached in-memory for 24 hours.
 */
export const getIndonesianHolidays = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getUTCFullYear();
    const now = Date.now();
    const cached = _holidayCache.get(String(year));
    if (cached && cached.expiry > now) {
      return res.json({ success: true, data: cached.data });
    }

    let data = [];

    // Source: libur.deno.dev — Indonesia-specific, includes Islamic + national holidays
    // Response: [{ date: "YYYY-MM-DD", name: "...", is_national_holiday: bool }]
    try {
      const resp = await fetch(`https://libur.deno.dev/api?year=${year}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) throw new Error(`libur.deno.dev HTTP ${resp.status}`);
      const raw = await resp.json();
      if (Array.isArray(raw) && raw.length > 0) {
        data = raw
          .filter((h) => h.is_national_holiday === true)
          .map((h) => ({
            date: h.date,
            name: h.name,
            localName: h.name,
          }));
      }
    } catch (err) {
      console.error("[Holidays] libur.deno.dev failed:", err.message);
      return res.json({ success: true, data: [], warning: "Holiday API unavailable" });
    }

    _holidayCache.set(String(year), { data, expiry: now + 24 * 60 * 60 * 1000 });
    return res.json({ success: true, data });
  } catch (err) {
    console.error("[Holidays]", err.message);
    return res.json({ success: true, data: [], warning: err.message });
  }
};

export default {
  getWorkStatuses,
  setWorkStatus,
  deleteWorkStatus,
  getDefault,
  setDefault,
  deleteDefault,
  getAttendancePermissions,
  grantAttendancePermission,
  revokeAttendancePermission,
  searchUsersForPermission,
  getIndonesianHolidays,
};

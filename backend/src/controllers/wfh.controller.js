// backend/src/controllers/wfh.controller.js
// Work-From-Home scheduling system.
// Scope: configurable per entity/subgroup/group (initially Rhaya Flicks Subgroup).
// Employees pick their WFH day(s) each week during the Sat-Sun submission window.
// Division cap: max ceil(eligibleMembers / workingDays) WFH per day per division.
// First-come-first-served. Lock: once Monday starts, employee cannot change (admin can).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────────────

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

/** Roles excluded from WFH eligibility */
const EXCLUDED_ROLES = ["Driver", "Office Boy"];

/** Employee statuses eligible for WFH */
const ELIGIBLE_STATUSES = ["PKWT", "PKWTT"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Current time in WIB */
function nowWIB() {
  return new Date(Date.now() + WIB_OFFSET_MS);
}

/** Date string YYYY-MM-DD from a Date object using UTC fields */
function toDateStr(d) {
  return d.toISOString().split("T")[0];
}

/** Parse "YYYY-MM-DD" → UTC midnight Date */
function parseDateUTC(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Given a WIB Date, return the Monday of the week containing that date (UTC midnight).
 */
function getWeekStart(wibDate) {
  const dow = wibDate.getUTCDay(); // Sun=0 … Sat=6
  const daysFromMonday = (dow + 6) % 7;
  const monday = new Date(wibDate);
  monday.setUTCDate(wibDate.getUTCDate() - daysFromMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/**
 * True if current WIB time is Saturday or Sunday — OR an admin window override is active.
 * Returns { open: bool, overrideActive: bool }
 */
async function checkSubmissionWindow() {
  const wib = nowWIB();
  const dow = wib.getUTCDay();
  const isSatSun = dow === 0 || dow === 6; // Sun=0, Sat=6

  // Check admin override
  const override = await prisma.wfhWindowOverride.findUnique({ where: { id: "global" } });
  const overrideActive = !!(
    override?.isActive &&
    (!override.expiresAt || override.expiresAt > new Date())
  );

  return { open: isSatSun || overrideActive, overrideActive };
}

/**
 * Returns the Monday (UTC midnight) of the NEXT week from now (WIB).
 * Works from any day: Sun(0)→+1, Mon(1)→+7, Tue(2)→+6, ..., Sat(6)→+2.
 */
function getNextWeekStart() {
  const wib = nowWIB();
  const dow = wib.getUTCDay();
  const daysToMonday = dow === 0 ? 1 : 8 - dow;
  const monday = new Date(wib);
  monday.setUTCDate(wib.getUTCDate() + daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/**
 * Returns true if today (WIB) is >= Monday of the given weekStartDate.
 * Used to determine if a week is "locked" for regular employees.
 */
function isWeekLocked(weekStartDate) {
  const wib = nowWIB();
  wib.setUTCHours(0, 0, 0, 0);
  return wib >= weekStartDate;
}

/** Prisma filter for WFH-eligible employees */
function eligibleFilter() {
  return {
    employeeStatus: { in: ELIGIBLE_STATUSES },
    accessLevel: { gte: 3 },
    role: { name: { notIn: EXCLUDED_ROLES } },
  };
}

/**
 * Fetch all employee IDs that belong to a WfhFeatureScope via their plottingCompany.
 * By default filters out excluded employees.
 * Pass includeExcluded = true to get all IDs regardless of exclusion.
 */
async function getScopedEmployeeIds(includeExcluded = false) {
  const scopes = await prisma.wfhFeatureScope.findMany({ where: { isActive: true } });
  if (scopes.length === 0) return new Set();

  const entityIds = new Set();
  for (const s of scopes) {
    if (s.scopeType === "ENTITY") {
      entityIds.add(s.scopeId);
    } else if (s.scopeType === "SUBGROUP") {
      const ents = await prisma.plottingCompany.findMany({
        where: { subgroupId: s.scopeId },
        select: { id: true },
      });
      ents.forEach((e) => entityIds.add(e.id));
    } else if (s.scopeType === "GROUP") {
      const ents = await prisma.plottingCompany.findMany({
        where: { groupId: s.scopeId },
        select: { id: true },
      });
      ents.forEach((e) => entityIds.add(e.id));
    }
  }

  if (entityIds.size === 0) return new Set();

  const users = await prisma.user.findMany({
    where: { plottingCompanyId: { in: [...entityIds] }, ...eligibleFilter() },
    select: { id: true },
  });

  const ids = users.map((u) => u.id);
  if (includeExcluded) return new Set(ids);

  const excluded = await getExcludedEmployeeIds();
  return new Set(ids.filter((id) => !excluded.has(id)));
}

/**
 * Check if a single employee is in any active WFH scope (and not excluded).
 */
async function isEmployeeInScope(employeeId) {
  const scoped = await getScopedEmployeeIds(); // excludes blacklisted by default
  return scoped.has(employeeId);
}

/**
 * Get non-holiday working days (Mon-Fri) for a week starting at weekStartDate.
 * weekStartDate: UTC midnight of Monday.
 * holidays: Map of dateStr → name.
 */
function getWorkingDays(weekStartDate, holidays) {
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekStartDate);
    d.setUTCDate(weekStartDate.getUTCDate() + i);
    const ds = toDateStr(d);
    if (!holidays[ds]) days.push(ds);
  }
  return days;
}

/**
 * Fetch cached holidays for a year from the workStatus holiday cache.
 * Falls back to empty map on error.
 */
async function fetchHolidaysForWeek(weekStartDate) {
  try {
    const year = weekStartDate.getUTCFullYear();
    const resp = await fetch(
      `https://libur.deno.dev/api?year=${year}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!resp.ok) return {};
    const raw = await resp.json();
    const map = {};
    for (const h of raw) {
      if (h.is_national_holiday) map[h.date] = h.name;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Returns set of employee IDs explicitly excluded from WFH.
 */
async function getExcludedEmployeeIds() {
  const rows = await prisma.wfhExcludedEmployee.findMany({ select: { employeeId: true } });
  return new Set(rows.map((r) => r.employeeId));
}

/**
 * Compute division WFH cap info for a given week.
 * Returns { cap, memberCount, baseCap, extraDays }
 * cap = max(1, ceil(eligibleMembersInScope / workingDays)) — used for enforcement.
 * extraDays = memberCount % workingDays — number of days that theoretically need +1 slot.
 */
async function getDivisionCapInfo(divisionId, workingDayCount, scopedIds) {
  const members = await prisma.user.findMany({
    where: { divisionId, ...eligibleFilter(), id: { in: [...scopedIds] } },
    select: { id: true },
  });
  const count = members.length;
  const days = Math.max(1, workingDayCount);
  const cap = Math.max(1, Math.ceil(count / days));
  const baseCap = Math.max(1, Math.floor(count / days));
  const extraDays = count % days;
  return { cap, memberCount: count, baseCap, extraDays };
}

/**
 * Compute max WFH per day for a division in a given week.
 * cap = max(1, ceil(eligibleMembersInScope / workingDays))
 */
async function getDivisionDayCap(divisionId, workingDayCount, scopedIds) {
  const info = await getDivisionCapInfo(divisionId, workingDayCount, scopedIds);
  return info.cap;
}

// ─── Feature Scope CRUD ───────────────────────────────────────────────────────

/** GET /api/wfh/scope */
export const listScopes = async (req, res) => {
  try {
    const scopes = await prisma.wfhFeatureScope.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, data: scopes });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** POST /api/wfh/scope  body: { scopeType, scopeId } */
export const addScope = async (req, res) => {
  try {
    if ((req.user?.accessLevel ?? 5) > 2)
      return res.status(403).json({ success: false, message: "Admin only" });

    const { scopeType, scopeId } = req.body;
    if (!scopeType || !scopeId)
      return res.status(400).json({ success: false, message: "scopeType and scopeId required" });
    if (!["ENTITY", "SUBGROUP", "GROUP"].includes(scopeType))
      return res.status(400).json({ success: false, message: "Invalid scopeType" });

    const scope = await prisma.wfhFeatureScope.upsert({
      where: { scopeType_scopeId: { scopeType, scopeId } },
      create: { scopeType, scopeId, isActive: true, createdBy: req.user.id },
      update: { isActive: true },
    });
    return res.json({ success: true, data: scope });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** PATCH /api/wfh/scope/:id  body: { isActive } */
export const updateScope = async (req, res) => {
  try {
    if ((req.user?.accessLevel ?? 5) > 2)
      return res.status(403).json({ success: false, message: "Admin only" });

    const { isActive } = req.body;
    const scope = await prisma.wfhFeatureScope.update({
      where: { id: req.params.id },
      data: { isActive: Boolean(isActive) },
    });
    return res.json({ success: true, data: scope });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** DELETE /api/wfh/scope/:id */
export const deleteScope = async (req, res) => {
  try {
    if ((req.user?.accessLevel ?? 5) > 2)
      return res.status(403).json({ success: false, message: "Admin only" });

    await prisma.wfhFeatureScope.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Quota CRUD ───────────────────────────────────────────────────────────────

/** GET /api/wfh/quota  — admin: list all; employee: own quota */
export const listQuotas = async (req, res) => {
  try {
    const level = req.user?.accessLevel ?? 5;
    if (level <= 2) {
      const quotas = await prisma.wfhQuota.findMany({
        include: { employee: { select: { id: true, name: true, email: true } } },
        orderBy: { updatedAt: "desc" },
      });
      return res.json({ success: true, data: quotas });
    }
    // Employee: own quota
    const quota = await prisma.wfhQuota.findUnique({ where: { employeeId: req.user.id } });
    return res.json({ success: true, data: quota ?? { employeeId: req.user.id, quotaPerWeek: 1 } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** POST /api/wfh/quota  body: { employeeId, quotaPerWeek } — admin only */
export const setQuota = async (req, res) => {
  try {
    if ((req.user?.accessLevel ?? 5) > 2)
      return res.status(403).json({ success: false, message: "Admin only" });

    const { employeeId, quotaPerWeek } = req.body;
    if (!employeeId || !quotaPerWeek || quotaPerWeek < 1)
      return res.status(400).json({ success: false, message: "employeeId and quotaPerWeek (≥1) required" });

    const quota = await prisma.wfhQuota.upsert({
      where: { employeeId },
      create: { employeeId, quotaPerWeek: parseInt(quotaPerWeek), setBy: req.user.id },
      update: { quotaPerWeek: parseInt(quotaPerWeek), setBy: req.user.id },
      include: { employee: { select: { id: true, name: true } } },
    });
    return res.json({ success: true, data: quota });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** DELETE /api/wfh/quota/:employeeId — admin only (resets to default 1) */
export const deleteQuota = async (req, res) => {
  try {
    if ((req.user?.accessLevel ?? 5) > 2)
      return res.status(403).json({ success: false, message: "Admin only" });

    await prisma.wfhQuota.deleteMany({ where: { employeeId: req.params.employeeId } });
    return res.json({ success: true, message: "Quota reset to default (1)" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Schedule ─────────────────────────────────────────────────────────────────

/**
 * GET /api/wfh/schedule?weekStartDate=YYYY-MM-DD
 * Employee: own schedule + division visibility for that week.
 * Admin: full week schedule with employee details.
 */
export const getSchedule = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: { select: { name: true } } },
    });
    if (!user) return res.status(401).json({ success: false, message: "Not found" });

    const level = user.accessLevel ?? 5;

    // Resolve weekStartDate
    let weekStartDate;
    if (req.query.weekStartDate) {
      weekStartDate = parseDateUTC(req.query.weekStartDate);
    } else {
      // Default: current week (or next if in submission window)
      const wib = nowWIB();
      const { open: winOpen } = await checkSubmissionWindow();
      weekStartDate = winOpen ? getNextWeekStart() : getWeekStart(wib);
    }

    const holidays = await fetchHolidaysForWeek(weekStartDate);
    const workingDays = getWorkingDays(weekStartDate, holidays);

    if (level <= 2) {
      // Admin: all schedules for the week
      const schedules = await prisma.wfhSchedule.findMany({
        where: { weekStartDate },
        include: {
          employee: {
            select: {
              id: true, name: true, email: true, divisionId: true,
              division: { select: { id: true, name: true } },
              plottingCompany: { select: { id: true, name: true } },
            },
          },
          overrider: { select: { id: true, name: true } },
        },
        orderBy: { wfhDate: "asc" },
      });

      // Per-division cap breakdown for admin display
      const scopedIds = await getScopedEmployeeIds();
      const divisionCaps = {};
      const uniqueDivisions = [...new Set(schedules.map((s) => s.employee.divisionId).filter(Boolean))];
      for (const divId of uniqueDivisions) {
        divisionCaps[divId] = await getDivisionCapInfo(divId, workingDays.length, scopedIds);
      }

      return res.json({
        success: true,
        data: { schedules, weekStartDate: toDateStr(weekStartDate), workingDays, holidays, divisionCaps },
      });
    }

    // Employee: eligibility + scope check
    const inScope = await isEmployeeInScope(user.id);
    if (!inScope)
      return res.status(403).json({ success: false, message: "WFH scheduling not available for your entity" });

    // Own schedules
    const mySchedules = await prisma.wfhSchedule.findMany({
      where: { employeeId: user.id, weekStartDate },
      orderBy: { wfhDate: "asc" },
    });

    // Division members' WFH dates (for visibility / cap check)
    const scopedIds = await getScopedEmployeeIds();
    const divisionSchedules = user.divisionId
      ? await prisma.wfhSchedule.findMany({
          where: {
            weekStartDate,
            employee: { divisionId: user.divisionId, id: { in: [...scopedIds] } },
          },
          include: { employee: { select: { id: true, name: true } } },
          orderBy: { wfhDate: "asc" },
        })
      : [];

    // All eligible division members (including those who haven't filled WFH yet)
    const divisionMembers = user.divisionId
      ? await prisma.user.findMany({
          where: {
            divisionId: user.divisionId,
            id: { in: [...scopedIds], not: user.id },
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

    const quota = await prisma.wfhQuota.findUnique({ where: { employeeId: user.id } });
    const quotaPerWeek = quota?.quotaPerWeek ?? 1;

    const divisionCap = user.divisionId
      ? await getDivisionDayCap(user.divisionId, workingDays.length, scopedIds)
      : 1;

    // Per-day count in division (for frontend slot availability)
    const divisionDayCounts = {};
    for (const ds of workingDays) {
      divisionDayCounts[ds] = divisionSchedules.filter(
        (s) => toDateStr(new Date(s.wfhDate)) === ds
      ).length;
    }

    return res.json({
      success: true,
      data: {
        mySchedules,
        divisionSchedules,
        divisionMembers,
        weekStartDate: toDateStr(weekStartDate),
        workingDays,
        holidays,
        quotaPerWeek,
        usedQuota: mySchedules.length,
        divisionCap,
        divisionDayCounts,
        isSubmissionWindow: (await checkSubmissionWindow()).open,
        isLocked: isWeekLocked(weekStartDate),
      },
    });
  } catch (err) {
    console.error("[WFH] getSchedule:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/wfh/schedule
 * Body: { wfhDate: "YYYY-MM-DD" }
 * Validates: scope, eligibility, window, quota, no holiday, division cap.
 */
export const submitSchedule = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: { select: { name: true } } },
    });
    if (!user) return res.status(401).json({ success: false, message: "Not found" });

    const level = user.accessLevel ?? 5;
    const { wfhDate, employeeId: targetId, adminOverride } = req.body;
    if (!wfhDate) return res.status(400).json({ success: false, message: "wfhDate required" });

    const isAdmin = level <= 2;
    const empId = isAdmin && targetId ? targetId : user.id;

    // Non-admins: scope + eligibility + window checks
    if (!isAdmin) {
      // Scope check
      if (!(await isEmployeeInScope(empId)))
        return res.status(403).json({ success: false, message: "WFH scheduling not available for your entity" });

      // Eligibility
      if (!ELIGIBLE_STATUSES.includes(user.employeeStatus))
        return res.status(403).json({ success: false, message: "Not eligible for WFH scheduling" });
      if (EXCLUDED_ROLES.includes(user.role?.name))
        return res.status(403).json({ success: false, message: "Not eligible for WFH scheduling" });

      // Submission window
      const { open: winOpen } = await checkSubmissionWindow();
      if (!winOpen)
        return res.status(403).json({ success: false, message: "Submissions only accepted on Saturday and Sunday" });
    }

    const targetDate = parseDateUTC(wfhDate);
    const weekStart = getWeekStart(targetDate);

    // Target date must be Mon-Fri (day-of-week check)
    const dow = targetDate.getUTCDay();
    if (dow === 0 || dow === 6)
      return res.status(400).json({ success: false, message: "WFH date must be a weekday (Mon-Fri)" });

    // For non-admins: week being submitted must be next week
    if (!isAdmin) {
      const expectedWeekStart = getNextWeekStart();
      if (weekStart.getTime() !== expectedWeekStart.getTime())
        return res.status(400).json({ success: false, message: "Can only schedule WFH for next week during submission window" });
    }

    // Holiday check
    const holidays = await fetchHolidaysForWeek(weekStart);
    if (holidays[wfhDate])
      return res.status(400).json({ success: false, message: `${wfhDate} is a public holiday (${holidays[wfhDate]})` });

    // Quota check
    const quota = await prisma.wfhQuota.findUnique({ where: { employeeId: empId } });
    const quotaPerWeek = quota?.quotaPerWeek ?? 1;
    const existingThisWeek = await prisma.wfhSchedule.count({ where: { employeeId: empId, weekStartDate: weekStart } });
    if (!isAdmin && existingThisWeek >= quotaPerWeek)
      return res.status(400).json({ success: false, message: `Weekly WFH quota (${quotaPerWeek}) already reached` });

    // Division cap check (non-admin, first-come-first-served)
    if (!isAdmin && user.divisionId) {
      const scopedIds = await getScopedEmployeeIds();
      const workingDays = getWorkingDays(weekStart, holidays);
      const cap = await getDivisionDayCap(user.divisionId, workingDays.length, scopedIds);

      const dayCount = await prisma.wfhSchedule.count({
        where: {
          wfhDate: targetDate,
          weekStartDate: weekStart,
          employee: { divisionId: user.divisionId },
        },
      });
      if (dayCount >= cap)
        return res.status(409).json({ success: false, message: `Division WFH cap reached for ${wfhDate} (max ${cap}/day). Please pick another day.` });
    }

    const status = isAdmin && adminOverride ? "ADMIN_OVERRIDE" : "PENDING";

    const schedule = await prisma.wfhSchedule.upsert({
      where: { employeeId_wfhDate: { employeeId: empId, wfhDate: targetDate } },
      create: {
        employeeId: empId,
        weekStartDate: weekStart,
        wfhDate: targetDate,
        status,
        overriddenBy: isAdmin ? user.id : null,
      },
      update: {
        weekStartDate: weekStart,
        status,
        overriddenBy: isAdmin ? user.id : null,
      },
      include: { employee: { select: { id: true, name: true } } },
    });

    // Auto-write WorkStatus WFH record for that day.
    // submittedBy = null marks it as system-generated so deleteSchedule can clean it up.
    // Admin overrides use user.id for audit trail.
    await upsertWfhWorkStatus(empId, wfhDate, isAdmin ? user.id : null);

    return res.json({ success: true, data: schedule });
  } catch (err) {
    console.error("[WFH] submitSchedule:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/wfh/schedule/:id
 * Employee: only within submission window and for next week.
 * Admin: any time.
 */
export const deleteSchedule = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(401).json({ success: false, message: "Not found" });

    const level = user.accessLevel ?? 5;
    const isAdmin = level <= 2;

    const schedule = await prisma.wfhSchedule.findUnique({ where: { id: req.params.id } });
    if (!schedule) return res.status(404).json({ success: false, message: "Schedule not found" });

    // Ownership check
    if (!isAdmin && schedule.employeeId !== user.id)
      return res.status(403).json({ success: false, message: "Forbidden" });

    // Lock check for non-admins
    if (!isAdmin) {
      const { open: winOpen } = await checkSubmissionWindow();
      if (!winOpen)
        return res.status(403).json({ success: false, message: "Submissions only editable on Saturday and Sunday" });
      if (isWeekLocked(schedule.weekStartDate))
        return res.status(403).json({ success: false, message: "Week is locked. Contact HR to change your WFH day." });
    }

    await prisma.wfhSchedule.delete({ where: { id: req.params.id } });

    // Remove the auto-written WorkStatus record if it exists
    const wfhDateStr = toDateStr(new Date(schedule.wfhDate));
    const wsRecord = await prisma.workStatus.findUnique({
      where: { employeeId_date: { employeeId: schedule.employeeId, date: schedule.wfhDate } },
    });
    if (wsRecord?.status === "WFH" && wsRecord?.submittedBy === null) {
      // Only delete auto-written records (submittedBy is null for auto-writes)
      await prisma.workStatus.delete({ where: { id: wsRecord.id } });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[WFH] deleteSchedule:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Admin schedule override ──────────────────────────────────────────────────

/**
 * GET /api/wfh/admin/employees
 * Returns eligible employees in scope with their current quota.
 */
export const listEligibleEmployees = async (req, res) => {
  try {
    if ((req.user?.accessLevel ?? 5) > 2)
      return res.status(403).json({ success: false, message: "Admin only" });

    // Include excluded employees so admin can toggle them back
    const allScopedIds = await getScopedEmployeeIds(true);
    if (allScopedIds.size === 0)
      return res.json({ success: true, data: [] });

    const excludedIds = await getExcludedEmployeeIds();

    const employees = await prisma.user.findMany({
      where: { id: { in: [...allScopedIds] }, ...eligibleFilter() },
      select: {
        id: true, name: true, email: true,
        divisionId: true,
        division: { select: { id: true, name: true } },
        plottingCompany: { select: { id: true, name: true } },
        employeeStatus: true,
        role: { select: { name: true } },
        wfhQuota: { select: { quotaPerWeek: true } },
        wfhExclusion: { select: { id: true, reason: true, createdAt: true } },
      },
      orderBy: { name: "asc" },
    });

    const data = employees.map((e) => ({
      ...e,
      isExcluded: excludedIds.has(e.id),
    }));

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/wfh/check-scope  — quick check if requesting user is in WFH scope
 * Used by frontend to decide whether to disable WFH in Work Status.
 */
export const checkScope = async (req, res) => {
  try {
    const inScope = await isEmployeeInScope(req.user.id);
    return res.json({ success: true, inScope });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Auto-write WorkStatus helper ─────────────────────────────────────────────

/**
 * Upsert a WFH WorkStatus record for an employee on their WFH date.
 * submittedBy = null signals it's system-generated (used for cleanup on deletion).
 */
export async function upsertWfhWorkStatus(employeeId, wfhDateStr, submittedById) {
  try {
    const targetDate = parseDateUTC(wfhDateStr);
    await prisma.workStatus.upsert({
      where: { employeeId_date: { employeeId, date: targetDate } },
      create: { employeeId, date: targetDate, status: "WFH", submittedBy: submittedById },
      update: { status: "WFH", submittedBy: submittedById },
    });
  } catch (err) {
    console.error("[WFH] upsertWfhWorkStatus error:", err.message);
  }
}

/**
 * Cron job: daily at 00:01 WIB — write WorkStatus WFH for today's scheduled employees.
 * This catches any schedules that were submitted BEFORE today (normal flow),
 * ensuring the Work Status dashboard always shows WFH correctly on the day.
 */
export async function syncTodayWfhStatuses() {
  const wib = nowWIB();
  const todayStr = toDateStr(wib);
  const todayUTC = parseDateUTC(todayStr);

  const schedules = await prisma.wfhSchedule.findMany({
    where: { wfhDate: todayUTC },
    select: { employeeId: true },
  });

  let synced = 0;
  for (const s of schedules) {
    await upsertWfhWorkStatus(s.employeeId, todayStr, null);
    synced++;
  }
  return { synced, date: todayStr };
}

// ─── Submission Window Override ────────────────────────────────────────────────

/**
 * GET /api/wfh/admin/window-override
 * Returns current override state.
 */
export const getWindowOverride = async (req, res) => {
  try {
    if ((req.user?.accessLevel ?? 5) > 2)
      return res.status(403).json({ success: false, message: "Admin only" });

    const override = await prisma.wfhWindowOverride.findUnique({
      where: { id: "global" },
      include: { opener: { select: { id: true, name: true } } },
    });

    // Auto-expire: if expiresAt is past, treat as inactive
    const isExpired = override?.expiresAt && override.expiresAt <= new Date();
    const isActive  = !!(override?.isActive && !isExpired);

    return res.json({ success: true, data: { ...override, isActive } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/wfh/admin/window-override
 * Body: { open: bool, expiresAt?: "YYYY-MM-DDTHH:mm", note?: string }
 * Opens or closes the submission window override.
 */
export const setWindowOverride = async (req, res) => {
  try {
    if ((req.user?.accessLevel ?? 5) > 2)
      return res.status(403).json({ success: false, message: "Admin only" });

    const { open, expiresAt, note } = req.body;
    if (typeof open !== "boolean")
      return res.status(400).json({ success: false, message: "open (boolean) required" });

    const override = await prisma.wfhWindowOverride.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        isActive: open,
        openedBy: open ? req.user.id : null,
        openedAt: open ? new Date() : null,
        expiresAt: open && expiresAt ? new Date(expiresAt) : null,
        note: note || null,
      },
      update: {
        isActive: open,
        openedBy: open ? req.user.id : null,
        openedAt: open ? new Date() : null,
        expiresAt: open && expiresAt ? new Date(expiresAt) : null,
        note: note || null,
      },
      include: { opener: { select: { id: true, name: true } } },
    });

    return res.json({ success: true, data: override });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Employee WFH Exclusion ────────────────────────────────────────────────────

/**
 * POST /api/wfh/admin/excluded
 * Body: { employeeId, reason? }
 * Excludes an employee from WFH scheduling.
 */
export const addExclusion = async (req, res) => {
  try {
    if ((req.user?.accessLevel ?? 5) > 2)
      return res.status(403).json({ success: false, message: "Admin only" });

    const { employeeId, reason } = req.body;
    if (!employeeId)
      return res.status(400).json({ success: false, message: "employeeId required" });

    const record = await prisma.wfhExcludedEmployee.upsert({
      where: { employeeId },
      create: { employeeId, excludedBy: req.user.id, reason: reason || null },
      update: { excludedBy: req.user.id, reason: reason || null },
      include: { employee: { select: { id: true, name: true } } },
    });

    return res.json({ success: true, data: record });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/wfh/admin/excluded/:employeeId
 * Re-includes a previously excluded employee.
 */
export const removeExclusion = async (req, res) => {
  try {
    if ((req.user?.accessLevel ?? 5) > 2)
      return res.status(403).json({ success: false, message: "Admin only" });

    await prisma.wfhExcludedEmployee.deleteMany({
      where: { employeeId: req.params.employeeId },
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

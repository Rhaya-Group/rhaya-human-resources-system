// backend/src/controllers/overtime.controller.js
import * as overtimeService from "../services/overtime.service.js";
import * as revisionService from "../services/overtimeRevision.service.js";
import { isAfter, isBefore, subDays, startOfDay, endOfDay } from "date-fns";
import { PrismaClient } from "@prisma/client";
import {
  sendOvertimeApprovedEmail,
  sendOvertimeRejectedEmail,
  sendOvertimeRequestNotification,
  sendOvertimeRevisionRequestedEmail,
  sendOvertimePlanApprovedEmail,
  sendOvertimeActualizationNeededEmail,
} from "../services/email.service.js";
const prisma = new PrismaClient();

// ============================================
// EMPLOYEE CONTROLLERS
// ============================================

/**
 * Submit new overtime request (weekly batch)
 * POST /api/overtime/submit
 * Body: {
 *   entries: [
 *     { date: "2025-01-20", hours: 3, description: "Client deployment" },
 *     { date: "2025-01-21", hours: 2, description: "Bug fixing" }
 *   ]
 * }
 */
export const submitOvertimeRequest = async (req, res) => {
  try {
    const { entries, incidentalReason } = req.body;
    const employeeId = req.user.id;

    // ── Basic validation ────────────────────────────────────────────────────
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one overtime entry is required" });
    }

    for (const entry of entries) {
      if (!entry.date || !entry.hours || !entry.description) {
        return res.status(400).json({
          error: "Each entry must have date, hours, and description",
        });
      }
      if (entry.hours <= 0 || entry.hours > 12) {
        return res.status(400).json({
          error: `Invalid hours for ${entry.date}. Must be between 0.5 and 12`,
        });
      }
    }

    // ── Get employee + policy ───────────────────────────────────────────────
    const employee = await overtimeService.getEmployeeData(employeeId);
    const { getEntityPolicy } = await import("../helpers/policyResolver.js");
    const policy = await getEntityPolicy(employee.plottingCompanyId);
    const mode = policy.overtimeMode; // "post" | "pre"

    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 7);

    // ── Classify dates ──────────────────────────────────────────────────────
    const entryDates = entries.map((e) => startOfDay(new Date(e.date)));
    const allFuture = entryDates.every((d) => isAfter(d, today));
    const allPastOrToday = entryDates.every((d) => !isAfter(d, today));

    // ── Determine sub-flow ──────────────────────────────────────────────────
    // flow1      → POST mode, always past dates
    // flow2a     → PRE mode, all future dates → planned overtime
    // flow2b     → PRE mode, past dates → incidental (no prior plan)
    let subFlow;

    if (mode === "post") {
      subFlow = "flow1";
    } else if (mode === "pre" && allFuture) {
      subFlow = "flow2a"; // planned
    } else if (mode === "pre" && allPastOrToday) {
      subFlow = "flow2b"; // incidental
    } else {
      return res.status(400).json({
        error: "Cannot mix past and future dates in a single request",
      });
    }

    // ── Flow-specific date validation ───────────────────────────────────────

    if (subFlow === "flow1" || subFlow === "flow2b") {
      // Past dates only — same H+7 window for both
      for (let i = 0; i < entries.length; i++) {
        const d = entryDates[i];
        if (isAfter(d, today)) {
          return res.status(400).json({
            error: `${entries[i].date} is in the future. Use planned overtime for future dates.`,
          });
        }
        if (isBefore(d, sevenDaysAgo)) {
          return res.status(400).json({
            error: `${entries[i].date} is more than 7 days ago. Cannot submit.`,
          });
        }
      }
    }

    // flow2b requires a justification reason
    if (subFlow === "flow2b") {
      if (!incidentalReason || !incidentalReason.trim()) {
        return res.status(400).json({
          error:
            "incidentalReason is required for incidental overtime. Please explain why a plan was not submitted.",
        });
      }
    }

    // future dates: no H+7 check needed for flow2a

    // ── Check recap lock (only for past-date flows) ─────────────────────────
    if (subFlow === "flow1" || subFlow === "flow2b") {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: "system-settings-singleton" },
      });
      if (settings?.lastRecapDate) {
        for (const entry of entries) {
          const entryDate = new Date(entry.date);
          if (entryDate <= settings.lastRecapDate) {
            return res.status(400).json({
              error: `Date ${entry.date} has already been recapped.`,
            });
          }
        }
      }
    }

    // ── Duplicate date check ────────────────────────────────────────────────
    const dates = entries.map((e) => e.date);
    const uniqueDates = new Set(dates);
    if (dates.length !== uniqueDates.size) {
      return res.status(400).json({
        error: "Duplicate dates in submission. Each date must be unique.",
      });
    }

    // For past-date flows, check against existing PENDING/APPROVED requests
    // For flow2a, check against existing plans (PLAN_PENDING / PLAN_APPROVED)
    const statusesToCheck =
      subFlow === "flow2a"
        ? ["PLAN_PENDING", "PLAN_APPROVED"]
        : ["PENDING", "APPROVED"];

    const existingEntries = await prisma.overtimeEntry.findMany({
      where: {
        date: { in: dates.map((d) => new Date(d)) },
        overtimeRequest: {
          employeeId,
          status: { in: statusesToCheck },
        },
      },
      select: { date: true },
    });

    if (existingEntries.length > 0) {
      const dupes = existingEntries.map(
        (e) => e.date.toISOString().split("T")[0],
      );
      return res.status(400).json({
        error: `Dates already have ${subFlow === "flow2a" ? "a plan" : "a request"}: ${dupes.join(", ")}`,
        duplicateDates: dupes,
      });
    }

    // ── Calculate totals ────────────────────────────────────────────────────
    const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hours), 0);
    const overtimeRate = parseFloat(employee.overtimeRate) || 37500;
    const totalAmount = (totalHours / 8) * overtimeRate;

    // ── Determine approver ──────────────────────────────────────────────────
    const approverId = await overtimeService.determineApprover(employee);

    // ── Map sub-flow to initial status ──────────────────────────────────────
    const statusMap = {
      flow1: "PENDING",
      flow2a: "PLAN_PENDING",
      flow2b: "PENDING", // incidental goes straight to PENDING (same as flow1)
    };
    const initialStatus = statusMap[subFlow];

    // ── Create the request ──────────────────────────────────────────────────
    const overtimeRequest = await prisma.overtimeRequest.create({
      data: {
        employeeId,
        totalHours,
        totalAmount,
        status: initialStatus,
        overtimeMode: mode,
        isIncidental: subFlow === "flow2b",
        incidentalReason: subFlow === "flow2b" ? incidentalReason.trim() : null,
        currentApproverId: approverId,
        supervisorId: employee.supervisorId || approverId,
        supervisorStatus: "PENDING",
        entries: {
          create: entries.map((entry) => ({
            date: new Date(entry.date),
            hours: parseFloat(entry.hours),
            plannedHours: subFlow === "flow2a" ? parseFloat(entry.hours) : null,
            description: entry.description,
          })),
        },
      },
      include: {
        entries: true,
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            nip: true,
            role: true,
            division: true,
          },
        },
        currentApprover: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // ── Log submission ──────────────────────────────────────────────────────
    await revisionService.logSubmission(overtimeRequest.id, employeeId, {
      totalHours,
      totalAmount,
      entries,
      subFlow,
      isIncidental: subFlow === "flow2b",
    });

    // ── Update pending hours (only for actual-hours flows) ──────────────────
    // For flow2a (planned), we don't touch balance until actualization
    if (subFlow !== "flow2a") {
      await overtimeService.updatePendingHours(employeeId, totalHours, "ADD");
    }

    // ── Send email notification ─────────────────────────────────────────────
    try {
      const approver = await prisma.user.findUnique({
        where: { id: approverId },
        select: { id: true, name: true, email: true },
      });
      if (approver?.email) {
        await sendOvertimeRequestNotification(
          approver,
          overtimeRequest,
          employee,
        );
      }
    } catch (emailErr) {
      console.error("⚠️ Notification email failed:", emailErr.message);
    }

    return res.status(201).json({
      message:
        subFlow === "flow2a"
          ? "Overtime plan submitted successfully. Awaiting supervisor approval."
          : "Overtime request submitted successfully.",
      subFlow,
      isIncidental: subFlow === "flow2b",
      data: overtimeRequest,
    });
  } catch (error) {
    console.error("Submit overtime error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to submit overtime request" });
  }
};

// =============================================================================
// NEW: approvePlan
// POST /api/overtime/:requestId/approve-plan
// SPV approves the overtime PLAN before the date.
// Only works for PLAN_PENDING status.
// =============================================================================

export const approvePlan = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { comment } = req.body;
    const approverId = req.user.id;
    const approverLevel = req.user.accessLevel;
    const scopeEntityIds = req.user.scopeEntityIds;

    const request = await prisma.overtimeRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: { include: { division: true, plottingCompany: true } },
        entries: true,
      },
    });

    if (!request) {
      return res.status(404).json({ error: "Overtime request not found" });
    }
    if (request.status !== "PLAN_PENDING") {
      return res.status(400).json({
        error: `Cannot approve plan — current status is "${request.status}". Only PLAN_PENDING requests can have their plan approved.`,
      });
    }
    if (request.overtimeMode !== "pre") {
      return res.status(400).json({
        error: "Plan approval is only for pre-approval overtime mode",
      });
    }

    // Scope check for Level 2
    if (approverLevel === 2) {
      const entityId = request.employee?.plottingCompanyId;
      if (!entityId || !scopeEntityIds?.includes(entityId)) {
        return res.status(403).json({
          error: "Access denied — employee is outside your scope",
        });
      }
    }

    // Auth check: must be admin or the assigned approver
    const isAdmin = approverLevel <= 2;
    const isAssignedApprover = request.currentApproverId === approverId;
    if (!isAdmin && !isAssignedApprover) {
      return res
        .status(403)
        .json({ error: "Not authorized to approve this plan" });
    }

    // Move to PLAN_APPROVED
    const updated = await prisma.overtimeRequest.update({
      where: { id: requestId },
      data: {
        status: "PLAN_APPROVED",
        supervisorStatus: "APPROVED",
        supervisorComment: comment || null,
        supervisorDate: new Date(),
        currentApproverId: approverId,
      },
      include: { employee: true, entries: true },
    });

    // Notify employee that plan is approved
    try {
      await sendOvertimePlanApprovedEmail(request.employee, updated);
    } catch (emailErr) {
      console.error("⚠️ Plan approval email failed:", emailErr.message);
    }

    return res.json({
      success: true,
      message:
        "Overtime plan approved. Employee will be reminded to actualize after the overtime date.",
      data: updated,
    });
  } catch (error) {
    console.error("Approve plan error:", error);
    return res.status(500).json({ error: "Failed to approve overtime plan" });
  }
};

// =============================================================================
// NEW: actualize
// POST /api/overtime/:requestId/actualize
// Employee submits actual hours after overtime is done.
// Only works for PLAN_APPROVED requests where all entry dates have passed.
// =============================================================================

export const actualizeOvertime = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { entries } = req.body; // [{ entryId, actualHours }]
    const employeeId = req.user.id;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res
        .status(400)
        .json({ error: "Actualization entries are required" });
    }

    const request = await prisma.overtimeRequest.findUnique({
      where: { id: requestId },
      include: { entries: true, employee: true },
    });

    if (!request) {
      return res.status(404).json({ error: "Overtime request not found" });
    }
    if (request.employeeId !== employeeId) {
      return res
        .status(403)
        .json({ error: "Not authorized to actualize this request" });
    }
    if (request.status !== "PENDING_ACTUALIZATION") {
      return res.status(400).json({
        error: `Cannot actualize — status is "${request.status}". Only PENDING_ACTUALIZATION requests can be actualized.`,
      });
    }

    // Validate all entry dates have passed
    const today = startOfDay(new Date());
    for (const entry of request.entries) {
      if (isAfter(startOfDay(new Date(entry.date)), today)) {
        return res.status(400).json({
          error: `Entry date ${entry.date.toISOString().split("T")[0]} has not passed yet. Cannot actualize future dates.`,
        });
      }
    }

    // Validate submitted actualization entries
    for (const ae of entries) {
      if (!ae.entryId || ae.actualHours === undefined) {
        return res
          .status(400)
          .json({ error: "Each entry needs entryId and actualHours" });
      }
      if (ae.actualHours < 0 || ae.actualHours > 12) {
        return res.status(400).json({
          error: `actualHours must be between 0 and 12 (0 means overtime was cancelled)`,
        });
      }
    }

    // Map entryId → actualHours
    const actualizationMap = Object.fromEntries(
      entries.map((e) => [e.entryId, parseFloat(e.actualHours)]),
    );

    // Verify all request entries are covered
    const missingEntries = request.entries.filter(
      (e) => actualizationMap[e.id] === undefined,
    );
    if (missingEntries.length > 0) {
      return res.status(400).json({
        error: "All entries must be actualized",
        missing: missingEntries.map((e) => e.id),
      });
    }

    // Calculate totals
    const totalActualHours = Object.values(actualizationMap).reduce(
      (sum, h) => sum + h,
      0,
    );
    const overtimeRate = parseFloat(request.employee.overtimeRate) || 37500;
    const totalActualAmount = (totalActualHours / 8) * overtimeRate;

    // Auto-approve if actual ≤ planned, re-route to SPV if actual > planned
    const totalPlannedHours = request.entries.reduce(
      (sum, e) => sum + (e.plannedHours ?? e.hours),
      0,
    );
    const exceedsPlanned = totalActualHours > totalPlannedHours;
    const newStatus = exceedsPlanned ? "PENDING" : "APPROVED";

    // Update all entries with actual hours
    await prisma.$transaction([
      ...request.entries.map((e) =>
        prisma.overtimeEntry.update({
          where: { id: e.id },
          data: {
            actualHours: actualizationMap[e.id],
            actualizedAt: new Date(),
            hours: actualizationMap[e.id], // update hours to reflect actual
          },
        }),
      ),
      prisma.overtimeRequest.update({
        where: { id: requestId },
        data: {
          totalHours: totalActualHours,
          totalAmount: totalActualAmount,
          status: newStatus,
          approvedAt: newStatus === "APPROVED" ? new Date() : null,
          supervisorStatus: newStatus === "APPROVED" ? "APPROVED" : "PENDING",
          supervisorDate: newStatus === "APPROVED" ? new Date() : null,
          supervisorComment:
            newStatus === "APPROVED"
              ? "Auto-approved: actual hours ≤ planned"
              : null,
        },
      }),
    ]);

    // If auto-approved, update balance
    if (newStatus === "APPROVED") {
      await prisma.overtimeBalance.upsert({
        where: { employeeId },
        update: {
          currentBalance: { increment: totalActualHours },
          pendingHours: { decrement: 0 }, // was never in pending (pre-flow)
        },
        create: {
          employeeId,
          currentBalance: totalActualHours,
          totalPaid: 0,
        },
      });
    } else {
      // Exceeds planned — goes back to SPV, add to pending
      await overtimeService.updatePendingHours(
        employeeId,
        totalActualHours,
        "ADD",
      );
    }

    const updated = await prisma.overtimeRequest.findUnique({
      where: { id: requestId },
      include: { entries: true, employee: true, currentApprover: true },
    });

    return res.json({
      success: true,
      message: exceedsPlanned
        ? `Actual hours (${totalActualHours}h) exceed planned (${totalPlannedHours}h). Request sent back to supervisor for re-approval.`
        : `Actualization complete. ${totalActualHours}h approved automatically.`,
      autoApproved: !exceedsPlanned,
      exceedsPlanned,
      totalPlannedHours,
      totalActualHours,
      data: updated,
    });
  } catch (error) {
    console.error("Actualize overtime error:", error);
    return res.status(500).json({ error: "Failed to actualize overtime" });
  }
};

// =============================================================================
// NEW: getPendingActualization
// GET /api/overtime/pending-actualization
// Employee fetches their PLAN_APPROVED requests where date has passed.
// =============================================================================

export const getPendingActualization = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = endOfDay(new Date());

    // Requests that are PENDING_ACTUALIZATION
    const pendingActualization = await prisma.overtimeRequest.findMany({
      where: {
        employeeId,
        status: "PENDING_ACTUALIZATION",
      },
      include: {
        entries: { orderBy: { date: "asc" } },
        currentApprover: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    // Also include PLAN_APPROVED where all dates have passed (in case scheduler hasn't run yet)
    const planApprovedPastDue = await prisma.overtimeRequest.findMany({
      where: {
        employeeId,
        status: "PLAN_APPROVED",
        entries: {
          every: { date: { lte: today } },
        },
      },
      include: {
        entries: { orderBy: { date: "asc" } },
        currentApprover: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    return res.json({
      success: true,
      data: [...pendingActualization, ...planApprovedPastDue],
      count: pendingActualization.length + planApprovedPastDue.length,
    });
  } catch (error) {
    console.error("Get pending actualization error:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch pending actualization" });
  }
};

// =============================================================================
// NEW: scheduledActualizationCheck (called by scheduler daily)
// Moves PLAN_APPROVED requests to PENDING_ACTUALIZATION once dates have passed
// =============================================================================

export const triggerActualizationCheck = async (req, res) => {
  try {
    const result = await moveExpiredPlansToActualization();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("Actualization check error:", error);
    return res.status(500).json({ error: "Failed to run actualization check" });
  }
};

export async function moveExpiredPlansToActualization() {
  const today = endOfDay(new Date());

  // Find all PLAN_APPROVED requests where ALL entry dates have passed
  const expiredPlans = await prisma.overtimeRequest.findMany({
    where: {
      status: "PLAN_APPROVED",
      entries: {
        every: { date: { lte: today } },
      },
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      entries: true,
    },
  });

  if (expiredPlans.length === 0) {
    console.log("[ActualizationCheck] No expired plans found");
    return { moved: 0 };
  }

  let moved = 0;
  for (const plan of expiredPlans) {
    await prisma.overtimeRequest.update({
      where: { id: plan.id },
      data: { status: "PENDING_ACTUALIZATION" },
    });

    // Notify employee they need to actualize
    try {
      await sendOvertimeActualizationNeededEmail(plan.employee, plan);
    } catch (emailErr) {
      console.error(
        `[ActualizationCheck] Email failed for ${plan.id}:`,
        emailErr.message,
      );
    }

    moved++;
  }

  console.log(
    `[ActualizationCheck] Moved ${moved} plan(s) to PENDING_ACTUALIZATION`,
  );
  return { moved, planIds: expiredPlans.map((p) => p.id) };
}

/**
 * Get my overtime requests
 * GET /api/overtime/my-requests?status=PENDING&year=2025
 */
export const getMyOvertimeRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const where = { employeeId: userId };
    if (status && status !== "all") {
      where.status = status;
    }

    const requests = await prisma.overtimeRequest.findMany({
      where,
      include: {
        entries: { orderBy: { date: "asc" } },
        currentApprover: {
          select: { id: true, name: true, email: true },
        },
        supervisor: {
          select: { id: true, name: true },
        },
        divisionHead: {
          select: { id: true, name: true },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    return res.json({ success: true, data: requests });
  } catch (error) {
    console.error("Get my requests error:", error);
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
};

/**
 * Get my overtime balance
 * GET /api/overtime/my-balance
 */
export const getMyOvertimeBalance = async (req, res) => {
  try {
    const employeeId = req.user.id;

    let balance = await overtimeService.getOvertimeBalance(employeeId);

    // Create balance if doesn't exist
    if (!balance) {
      balance = await overtimeService.createOvertimeBalance(employeeId);
    }

    res.json({ data: balance });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Edit overtime request (only PENDING or REVISION_REQUESTED)
 * PUT /api/overtime/:requestId
 * Body: {
 *   entries: [...]
 * }
 */
export const editOvertimeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { entries } = req.body;
    const employeeId = req.user.id;

    // Get existing request
    const existingRequest =
      await overtimeService.getOvertimeRequestById(requestId);

    if (!existingRequest) {
      return res.status(404).json({ error: "Overtime request not found" });
    }

    // Check ownership
    if (existingRequest.employeeId !== employeeId) {
      return res
        .status(403)
        .json({ error: "Not authorized to edit this request" });
    }

    // Check if editable
    if (!["PENDING", "REVISION_REQUESTED"].includes(existingRequest.status)) {
      return res.status(400).json({
        error:
          "Can only edit requests with PENDING or REVISION_REQUESTED status",
      });
    }

    // Validate new entries (same validation as submit)
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one overtime entry is required" });
    }

    // Validate each entry (similar to submit validation)
    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 7);

    for (const entry of entries) {
      if (!entry.date || !entry.hours || !entry.description) {
        return res.status(400).json({
          error: "Each entry must have date, hours, and description",
        });
      }

      if (entry.hours <= 0 || entry.hours > 12) {
        return res.status(400).json({
          error: `Invalid hours for ${entry.date}. Must be between 0.5 and 12 hours`,
        });
      }

      const entryDate = startOfDay(new Date(entry.date));
      if (isAfter(sevenDaysAgo, entryDate)) {
        return res.status(400).json({
          error: `Date ${entry.date} is more than 7 days ago. Cannot submit.`,
        });
      }

      if (isAfter(entryDate, today)) {
        return res.status(400).json({
          error: `Date ${entry.date} is in the future. Cannot submit.`,
        });
      }
    }

    // Check duplicate dates in submission
    const dates = entries.map((e) => e.date);
    const uniqueDates = new Set(dates);
    if (dates.length !== uniqueDates.size) {
      return res.status(400).json({
        error: "Duplicate dates found in submission.",
      });
    }

    // Check duplicate with OTHER requests (exclude current request)
    const existingDates = await overtimeService.checkDuplicateDatesExcluding(
      employeeId,
      dates,
      requestId,
    );
    if (existingDates.length > 0) {
      return res.status(400).json({
        error: `Dates already exist in other requests: ${existingDates.join(", ")}`,
        duplicateDates: existingDates,
      });
    }

    // Get employee data for recalculation
    const employee = await overtimeService.getEmployeeData(employeeId);

    // Recalculate totals
    const newTotalHours = entries.reduce(
      (sum, e) => sum + parseFloat(e.hours),
      0,
    );
    const overtimeRate = parseFloat(employee.overtimeRate) || 37500;
    const newTotalAmount = (newTotalHours / 8) * overtimeRate;

    // Update pending hours (subtract old, add new)
    const oldTotalHours = existingRequest.totalHours;
    await overtimeService.updatePendingHours(
      employeeId,
      oldTotalHours,
      "SUBTRACT",
    );
    await overtimeService.updatePendingHours(employeeId, newTotalHours, "ADD");

    // Update request
    const updatedRequest = await overtimeService.updateOvertimeRequest(
      requestId,
      {
        entries,
        totalHours: newTotalHours,
        totalAmount: newTotalAmount,
        status: "PENDING", // Reset to PENDING if was REVISION_REQUESTED
      },
    );

    // Log revision
    await revisionService.logEdit(
      requestId,
      employeeId,
      {
        totalHours: oldTotalHours,
        totalAmount: existingRequest.totalAmount,
        entries: existingRequest.entries,
      },
      {
        totalHours: newTotalHours,
        totalAmount: newTotalAmount,
        entries: entries,
      },
    );

    res.json({
      message: "Overtime request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Edit overtime error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete overtime request (only PENDING or REVISION_REQUESTED or REJECTED)
 * DELETE /api/overtime/:requestId
 */
export const deleteOvertimeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const employeeId = req.user.id;

    const request = await overtimeService.getOvertimeRequestById(requestId);

    if (!request) {
      return res.status(404).json({ error: "Overtime request not found" });
    }

    // Check ownership
    if (request.employeeId !== employeeId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this request" });
    }

    // Check if deletable
    if (
      !["PENDING", "REVISION_REQUESTED", "REJECTED"].includes(request.status)
    ) {
      return res.status(400).json({
        error: "Cannot delete approved overtime requests",
      });
    }

    // Update pending hours if PENDING or REVISION_REQUESTED
    if (["PENDING", "REVISION_REQUESTED"].includes(request.status)) {
      await overtimeService.updatePendingHours(
        employeeId,
        request.totalHours,
        "SUBTRACT",
      );
    }

    // Delete request
    await overtimeService.deleteOvertimeRequest(requestId);

    res.json({ message: "Overtime request deleted successfully" });
  } catch (error) {
    console.error("Delete overtime error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get single overtime request details
 * GET /api/overtime/:requestId
 */
export const getOvertimeRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;
    const { accessLevel, scopeEntityIds } = req.user;

    const request = await overtimeService.getOvertimeRequestById(requestId);

    if (!request) {
      return res.status(404).json({ error: "Overtime request not found" });
    }

    // Check access
    const isOwner = request.employeeId === userId;
    const isApprover = request.currentApproverId === userId;

    // Level 1: Full access
    if (accessLevel === 1) {
      return res.json({ data: request });
    }

    // Level 2: Scope-based access
    if (accessLevel === 2) {
      const employeeEntityId = request.employee?.plottingCompanyId;

      if (!employeeEntityId || !scopeEntityIds?.includes(employeeEntityId)) {
        console.warn(
          `[OVERTIME DETAILS] Level 2 admin ${userId} denied access to request ${requestId}`,
        );
        console.warn(
          `[OVERTIME DETAILS] Employee entity: ${employeeEntityId}, Admin scope: ${JSON.stringify(scopeEntityIds)}`,
        );

        return res.status(403).json({
          error: "Access denied",
          message: "You do not have permission to view this overtime request",
        });
      }

      console.log(
        `[OVERTIME DETAILS] Level 2 admin viewing scoped request ${requestId}`,
      );
      return res.json({ data: request });
    }

    // Level 3+: Owner or assigned approver only
    if (isOwner || isApprover) {
      return res.json({ data: request });
    }

    return res.status(403).json({
      error: "Access denied",
      message: "Not authorized to view this request",
    });
  } catch (error) {
    console.error("Get request by ID error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// APPROVER CONTROLLERS
// ============================================

/**
 * Get pending approvals
 * For regular users: Only requests assigned to them
 * For Admin/HR (accessLevel 1-2): ALL pending requests
 * GET /api/overtime/pending-approval/list
 */
export const getPendingApprovals = async (req, res) => {
  try {
    const userId = req.user.id;
    const accessLevel = req.user.accessLevel;
    const scopeEntityIds = req.user.scopeEntityIds;

    // Support status parameter (for tabs: pending, approved, rejected)
    const { status = "PENDING" } = req.query;

    console.log(
      `[OVERTIME APPROVAL] User Level ${accessLevel} fetching ${status} requests`,
    );
    if (accessLevel === 2) {
      console.log(`[OVERTIME APPROVAL] Scope:`, scopeEntityIds);
    }

    // Build where clause based on access level
    let whereClause = {
      status, // Use status from query parameter
    };

    if (accessLevel === 1) {
      // Level 1: See ALL requests
      console.log(
        `[OVERTIME APPROVAL] Level 1 - viewing all ${status} requests`,
      );
    } else if (accessLevel === 2) {
      // Level 2: See only scoped requests
      console.log(
        `[OVERTIME APPROVAL] Level 2 - filtering by scope for ${status}`,
      );

      if (!scopeEntityIds || scopeEntityIds.length === 0) {
        console.warn(
          "[OVERTIME APPROVAL] Level 2 admin has no scopeEntityIds!",
        );
        return res.json({
          success: true,
          data: [],
          message: "No entities assigned to your scope",
        });
      }

      // Filter by employee's plottingCompanyId
      whereClause.employee = {
        plottingCompanyId: { in: scopeEntityIds },
      };
    } else {
      // Level 3+ (SPV, Manager): See requests where they are the assigned approver
      // Applies to ALL statuses — they can see their full history (pending, approved, rejected)
      whereClause.currentApproverId = userId;

      // Also include PLAN_PENDING requests assigned to them
      if (status === "PLAN_PENDING") {
        whereClause.status = "PLAN_PENDING";
      }

      console.log(
        `[OVERTIME APPROVAL] Level 3+ - viewing assigned ${status} requests`,
      );
    }

    const requests = await prisma.overtimeRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            role: true,
            division: true,
            plottingCompany: {
              // Add for display
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        entries: {
          orderBy: { date: "asc" },
        },
        currentApprover: true,
        supervisor: true,
        divisionHead: true,
      },
      orderBy: {
        submittedAt: "desc",
      },
    });

    console.log(
      `[OVERTIME APPROVAL] Found ${requests.length} ${status} requests`,
    );

    return res.json({
      success: true,
      data: requests,
      count: requests.length,
      status: status,
    });
  } catch (error) {
    console.error("Get pending approvals error:", error);
    return res.status(500).json({ error: "Failed to fetch pending approvals" });
  }
};

/**
 * Approve overtime request
 * POST /api/overtime/:requestId/approve
 * Body: { comment: "Approved for project work" }
 */
export const approveOvertimeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { comment } = req.body;
    const approverId = req.user.id;
    const approverLevel = req.user.accessLevel;
    const scopeEntityIds = req.user.scopeEntityIds;

    const request = await prisma.overtimeRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: {
          include: {
            supervisor: true,
            division: true,
            plottingCompany: true,
          },
        },
        currentApprover: true,
      },
    });

    if (!request) {
      return res.status(404).json({ error: "Overtime request not found" });
    }
    if (approverLevel === 2) {
      const employeeEntityId = request.employee?.plottingCompanyId;

      if (!employeeEntityId || !scopeEntityIds?.includes(employeeEntityId)) {
        console.warn(
          `[OVERTIME APPROVE] Level 2 admin ${approverId} tried to approve request ${requestId} outside scope`,
        );
        console.warn(
          `[OVERTIME APPROVE] Employee entity: ${employeeEntityId}, Admin scope: ${JSON.stringify(scopeEntityIds)}`,
        );

        return res.status(403).json({
          error: "Access denied",
          message:
            "You cannot approve overtime requests for employees outside your scope",
        });
      }
    }
    if (request.status === "APPROVED") {
      return res.status(400).json({ error: "Request already approved" });
    }
    if (request.status === "REJECTED") {
      return res.status(400).json({ error: "Request already rejected" });
    }

    // Authorization check
    const isAdmin = approverLevel <= 2;
    const isCurrentApprover = request.currentApproverId === approverId;

    if (!isAdmin && !isCurrentApprover) {
      return res.status(403).json({
        error: "You are not authorized to approve this request",
      });
    }

    let updateData = {};

    // ADMIN OVERRIDE (Level 1-2) - Can approve anything directly
    if (isAdmin && !isCurrentApprover) {
      updateData = {
        status: "APPROVED",
        approvedAt: new Date(),
        finalApproverId: approverId,
        supervisorStatus: "APPROVED",
        supervisorComment: comment || "Approved by Admin",
        supervisorDate: new Date(),
        divisionHeadStatus: "APPROVED",
        divisionHeadComment: comment || "Approved by Admin",
        divisionHeadDate: new Date(),
        currentApproverId: approverId,
      };
    }

    // Supervisor approval
    else if (request.supervisorId && !request.supervisorDate) {
      // const nextApproverId = request.employee.division?.headId || null;

      updateData = {
        supervisorStatus: "APPROVED",
        supervisorComment: comment || null,
        supervisorDate: new Date(),
        currentApproverId: approverId,
        status: "APPROVED",
        approvedAt: new Date(),

        // currentApproverId: nextApproverId,
        // status: nextApproverId ? 'PENDING_DIVISION_HEAD' : 'APPROVED',
        // approvedAt: nextApproverId ? null : new Date()
      };

      // if (!nextApproverId) {
      //   updateData.currentApproverId = approverId;
      // }
    }

    // Division head approval
    else if (request.employee.division?.headId && !request.divisionHeadDate) {
      updateData = {
        divisionHeadStatus: "APPROVED",
        divisionHeadComment: comment || null,
        divisionHeadDate: new Date(),
        currentApproverId: approverId,
        status: "APPROVED",
        approvedAt: new Date(),
      };
    }
    // Direct approval (no multi-stage)
    else {
      updateData = {
        status: "APPROVED",
        approvedAt: new Date(),
        currentApproverId: approverId,
        supervisorStatus: "APPROVED",
        supervisorComment: comment || "Direct approval",
        supervisorDate: new Date(),
      };
    }

    console.log("Approval update data:", updateData); // Debug log

    const updatedRequest = await prisma.overtimeRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        employee: true,
        currentApprover: true,
      },
    });

    console.log("Updated request status:", updatedRequest.status); // Debug log

    // If fully approved, update balance
    if (updatedRequest.status === "APPROVED") {
      await prisma.overtimeBalance.upsert({
        where: { employeeId: request.employeeId },
        update: {
          currentBalance: { increment: request.totalHours },
          pendingHours: { decrement: request.totalHours },
        },
        create: {
          employeeId: request.employeeId,
          currentBalance: request.totalHours,
          totalPaid: 0,
        },
      });

      console.log("Balance updated for employee:", request.employeeId);
    }

    // Send email notification
    try {
      await sendOvertimeApprovedEmail(request.employee, request);
      console.log("Approval email sent to:", request.employee.email);
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("⚠️ Email failed but overtime approved:", emailError);
    }

    if (request.supervisorId && !request.supervisorDate) {
      // Supervisor approval
      await revisionService.logSupervisorApproval(
        requestId,
        approverId,
        comment,
      );
    } else if (request.employee.division?.headId && !request.divisionHeadDate) {
      // Division head approval
      await revisionService.logDivisionHeadApproval(
        requestId,
        approverId,
        comment,
      );
    } else {
      // Direct/final approval
      await revisionService.logFinalApproval(requestId, approverId, comment);
    }

    return res.json({
      success: true,
      message: "Overtime request approved successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("❌ Approve overtime error:", error);
    return res
      .status(500)
      .json({ error: "Failed to approve overtime request" });
  }
};

/**
 * Reject overtime request
 * POST /api/overtime/:requestId/reject
 * Body: { comment: "Not a valid holiday" }
 */
export const rejectOvertimeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { comment } = req.body;
    const approverId = req.user.id;
    const approverLevel = req.user.accessLevel;
    const scopeEntityIds = req.user.scopeEntityIds;

    if (!comment || !comment.trim()) {
      return res
        .status(400)
        .json({ error: "Comment is required for rejection" });
    }

    const request = await prisma.overtimeRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: {
          include: {
            division: true,
            plottingCompany: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({ error: "Overtime request not found" });
    }
    if (approverLevel === 2) {
      const employeeEntityId = request.employee?.plottingCompanyId;

      if (!employeeEntityId || !scopeEntityIds?.includes(employeeEntityId)) {
        console.warn(
          `[OVERTIME REJECT] Level 2 admin ${approverId} tried to reject request ${requestId} outside scope`,
        );
        console.warn(
          `[OVERTIME REJECT] Employee entity: ${employeeEntityId}, Admin scope: ${JSON.stringify(scopeEntityIds)}`,
        );

        return res.status(403).json({
          error: "Access denied",
          message:
            "You cannot reject overtime requests for employees outside your scope",
        });
      }

      console.log(
        `[OVERTIME REJECT] Level 2 admin rejecting scoped request ${requestId}`,
      );
    }
    if (request.status === "APPROVED") {
      return res.status(400).json({ error: "Cannot reject approved request" });
    }
    if (request.status === "REJECTED") {
      return res.status(400).json({ error: "Request already rejected" });
    }

    // Authorization check
    const isAdmin = approverLevel === 1;
    const isCurrentApprover = request.currentApproverId === approverId;

    if (!isAdmin && !isCurrentApprover) {
      return res.status(403).json({
        error: "You are not authorized to reject this request",
      });
    }

    // Update with rejection - keep currentApproverId for history
    let updateData = {
      status: "REJECTED",
      rejectedAt: new Date(),
      currentApproverId: approverId,
    };

    // Log rejection in appropriate field
    if (request.supervisorId && !request.supervisorDate) {
      updateData.supervisorStatus = "REJECTED";
      updateData.supervisorComment = comment;
      updateData.supervisorDate = new Date();
    } else if (request.employee.division?.headId && !request.divisionHeadDate) {
      updateData.divisionHeadStatus = "REJECTED";
      updateData.divisionHeadComment = comment;
      updateData.divisionHeadDate = new Date();
    } else if (isAdmin) {
      updateData.supervisorStatus = "REJECTED";
      updateData.supervisorComment = comment;
      updateData.supervisorDate = new Date();
    }

    const updatedRequest = await prisma.overtimeRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        employee: true,
        currentApprover: true,
      },
    });

    if (updatedRequest.status === "REJECTED") {
      await prisma.overtimeBalance.upsert({
        where: { employeeId: request.employeeId },
        update: {
          pendingHours: {
            decrement: request.totalHours,
          },
        },
        create: {
          employeeId: request.employeeId,
          currentBalance: request.totalHours,
          totalPaid: 0,
        },
      });
    }

    // Send rejection email notification to employee
    try {
      await sendOvertimeRejectedEmail(
        updatedRequest.employee,
        updatedRequest,
        comment,
        req.user.name,
      );
      console.log("Rejection email sent to:", updatedRequest.employee.email);
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("⚠️ Rejection email failed:", emailError.message);
    }

    if (request.supervisorId && !request.supervisorDate) {
      // Supervisor rejection
      await revisionService.logSupervisorRejection(
        requestId,
        approverId,
        comment,
      );
    } else if (request.employee.division?.headId && !request.divisionHeadDate) {
      // Division head rejection
      await revisionService.logDivisionHeadRejection(
        requestId,
        approverId,
        comment,
      );
    } else {
      // Final rejection
      await revisionService.logFinalRejection(requestId, approverId, comment);
    }

    return res.json({
      success: true,
      message: "Overtime request rejected",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Reject overtime error:", error);
    return res.status(500).json({ error: "Failed to reject overtime request" });
  }
};

/**
 * Request revision
 * POST /api/overtime/:requestId/request-revision
 * Body: { comment: "Please clarify dates - Jan 20 was not a holiday" }
 */
export const requestRevision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { comment } = req.body;
    const approverId = req.user.id;
    const approverLevel = req.user.accessLevel;
    const scopeEntityIds = req.user.scopeEntityIds;

    if (!comment || !comment.trim()) {
      return res
        .status(400)
        .json({ error: "Comment is required for revision request" });
    }

    const request = await prisma.overtimeRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: {
          include: {
            division: true,
            plottingCompany: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({ error: "Overtime request not found" });
    }
    if (approverLevel === 2) {
      const employeeEntityId = request.employee?.plottingCompanyId;

      if (!employeeEntityId || !scopeEntityIds?.includes(employeeEntityId)) {
        console.warn(
          `[OVERTIME REVISION] Level 2 admin ${approverId} tried to request revision for ${requestId} outside scope`,
        );
        console.warn(
          `[OVERTIME REVISION] Employee entity: ${employeeEntityId}, Admin scope: ${JSON.stringify(scopeEntityIds)}`,
        );

        return res.status(403).json({
          error: "Access denied",
          message:
            "You cannot request revision for overtime requests outside your scope",
        });
      }

      console.log(
        `[OVERTIME REVISION] Level 2 admin requesting revision for scoped request ${requestId}`,
      );
    }
    if (request.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: "Can only request revision for pending requests" });
    }

    // Authorization check
    const isAdmin = approverLevel === 1;
    const isCurrentApprover = request.currentApproverId === approverId;

    if (!isAdmin && !isCurrentApprover) {
      return res.status(403).json({
        error: "You are not authorized to request revision for this request",
      });
    }

    // Update request - keep currentApproverId for history
    let updateData = {
      status: "REVISION_REQUESTED",
      currentApproverId: approverId,
    };

    // Log revision request
    if (request.supervisorId && !request.supervisorDate) {
      updateData.supervisorStatus = "REVISION_REQUESTED";
      updateData.supervisorComment = comment;
      updateData.supervisorDate = new Date();
    } else if (request.employee.division?.headId && !request.divisionHeadDate) {
      updateData.divisionHeadStatus = "REVISION_REQUESTED";
      updateData.divisionHeadComment = comment;
      updateData.divisionHeadDate = new Date();
    } else if (isAdmin) {
      updateData.supervisorStatus = "REVISION_REQUESTED";
      updateData.supervisorComment = comment;
      updateData.supervisorDate = new Date();
    }

    const updatedRequest = await prisma.overtimeRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        employee: true,
        currentApprover: true,
        entries: true, // Include entries for email
      },
    });

    // Send revision request email notification to employee
    await revisionService.logRevisionRequest(requestId, approverId, comment);

    // Send revision request email notification to employee
    try {
      await sendOvertimeRevisionRequestedEmail(
        updatedRequest.employee,
        updatedRequest,
        comment,
        req.user.name,
      );
      console.log(
        "Revision request email sent to:",
        updatedRequest.employee.email,
      );
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("⚠️ Revision request email failed:", emailError.message);
    }

    // if (updatedRequest.status === 'REVISION_REQUESTED') {
    //   await prisma.overtimeBalance.upsert({
    //     where: { employeeId: request.employeeId },
    //     update: {
    //       pendingHours: {
    //         decrement: request.totalHours }
    //     },
    //     create: {
    //       employeeId: request.employeeId,
    //       currentBalance: request.totalHours,
    //       totalPaid: 0
    //     }
    //   });
    // }

    return res.json({
      success: true,
      message: "Revision requested successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Request revision error:", error);
    return res.status(500).json({ error: "Failed to request revision" });
  }
};

// ============================================
// ADMIN/HR CONTROLLERS
// ============================================

/**
 * Get all overtime requests (Admin/HR)
 * GET /api/overtime/admin/all-requests?status=PENDING&divisionId=xxx
 */
export const getAllOvertimeRequests = async (req, res) => {
  try {
    // Check admin access
    if (req.user.accessLevel > 2) {
      return res.status(403).json({ error: "Admin/HR access required" });
    }

    const { accessLevel, scopeEntityIds } = req.user;
    const { status, employeeId, isRecapped } = req.query;

    console.log("[OVERTIME ALL] Query params:", req.query);
    console.log("[OVERTIME ALL] User level:", accessLevel);

    const where = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;

    if (isRecapped !== undefined) {
      where.isRecapped = isRecapped === "true";
    }

    // Apply scope filter for Level 2
    if (accessLevel === 2) {
      if (!scopeEntityIds || scopeEntityIds.length === 0) {
        console.warn("[OVERTIME ALL] Level 2 admin has no scopeEntityIds!");
        return res.json({
          success: true,
          count: 0,
          totalHours: 0,
          data: [],
          message: "No entities assigned to your scope",
        });
      }

      where.employee = {
        plottingCompanyId: { in: scopeEntityIds },
      };

      console.log("[OVERTIME ALL] Filtering by scope:", scopeEntityIds);
    }

    const requests = await prisma.overtimeRequest.findMany({
      where,
      include: {
        entries: { orderBy: { date: "asc" } },
        employee: {
          select: {
            id: true,
            name: true,
            nip: true,
            email: true,
            plottingCompanyId: true,
            plottingCompany: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            role: {
              select: {
                id: true,
                name: true,
              },
            },
            division: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        supervisor: { select: { id: true, name: true } },
        divisionHead: { select: { id: true, name: true } },
        finalApprover: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    console.log(`[OVERTIME ALL] Found ${requests.length} requests`);

    return res.json({
      success: true,
      count: requests.length,
      totalHours: requests.reduce((sum, req) => sum + (req.totalHours || 0), 0),
      data: requests,
    });
  } catch (error) {
    console.error("[OVERTIME ALL] Error:", error);
    return res.status(500).json({ error: "Failed to fetch overtime requests" });
  }
};

/**
 * Process monthly balance (HR processes approved overtimes)
 * POST /api/overtime/admin/process-balance
 * Body: {
 *   month: 1,
 *   year: 2025,
 *   employeeIds: ["user1", "user2"] // optional, if empty = all employees
 * }
 */
export const processMonthlyBalance = async (req, res) => {
  try {
    // Check admin access
    if (req.user.accessLevel > 2) {
      return res.status(403).json({ error: "Admin/HR access required" });
    }

    const { month, year, employeeIds } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required" });
    }

    const result = await overtimeService.processMonthlyBalance({
      month,
      year,
      employeeIds,
    });

    res.json({
      message: "Monthly balance processed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Process balance error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reset employee balance (after payment)
 * POST /api/overtime/admin/reset-balance/:userId
 */
export const resetEmployeeBalance = async (req, res) => {
  try {
    // Check admin access
    if (req.user.accessLevel > 2) {
      return res.status(403).json({ error: "Admin/HR access required" });
    }

    const { userId } = req.params;

    await overtimeService.resetEmployeeBalance(userId);

    res.json({ message: "Employee overtime balance reset successfully" });
  } catch (error) {
    console.error("Reset balance error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get overtime statistics
 * GET /api/overtime/admin/statistics?year=2025&month=1
 */
export const getOvertimeStatistics = async (req, res) => {
  try {
    // Check admin access
    if (req.user.accessLevel > 2) {
      return res.status(403).json({ error: "Admin/HR access required" });
    }

    const { year, month, divisionId } = req.query;

    const filters = {};
    if (year) filters.year = parseInt(year);
    if (month) filters.month = parseInt(month);
    if (divisionId) filters.divisionId = divisionId;

    const statistics = await overtimeService.getOvertimeStatistics(filters);

    res.json({ data: statistics });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Admin reject approved overtime (Override)
 * POST /api/overtime/:requestId/admin-reject
 * Only for System Administrator (Level 1)
 */
export const adminRejectApprovedOvertime = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { comment } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    console.log(
      `[Admin Reject] Admin ${adminName} attempting to reject approved overtime ${requestId}`,
    );

    // Validate comment
    if (!comment || comment.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: "Admin rejection reason required (minimum 20 characters)",
        details: [
          "Please provide a detailed reason for rejecting this approved overtime",
        ],
      });
    }

    // Get overtime request with all details
    const overtimeRequest = await prisma.overtimeRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: {
          include: {
            division: true,
            role: true,
          },
        },
        entries: true,
        supervisor: {
          select: { id: true, name: true, email: true },
        },
        finalApprover: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!overtimeRequest) {
      return res.status(404).json({
        success: false,
        error: "Overtime request not found",
      });
    }

    // Check 1: Must be APPROVED
    if (overtimeRequest.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        error: "Can only reject approved overtime requests",
        currentStatus: overtimeRequest.status,
      });
    }

    // Check 2: Cannot reject if already recapped (in payroll)
    if (overtimeRequest.isRecapped) {
      return res.status(400).json({
        success: false,
        error: "Cannot reject overtime that has been recapped for payroll",
        recappedDate: overtimeRequest.recappedDate,
      });
    }

    console.log(`All validations passed. Proceeding with admin rejection...`);

    // Save original data before overwriting (Solves Problem #2!)
    const originalData = {
      supervisorComment: overtimeRequest.supervisorComment,
      approvedAt: overtimeRequest.approvedAt,
      finalApproverId: overtimeRequest.finalApproverId,
      totalHours: overtimeRequest.totalHours,
      status: overtimeRequest.status,
    };

    // Update overtime request status to REJECTED
    const updatedRequest = await prisma.overtimeRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        supervisorComment: `[ADMIN OVERRIDE] ${comment}`, // Prefix to indicate admin action
        currentApproverId: adminId, // Record who rejected it
      },
      include: {
        employee: {
          include: {
            division: true,
            role: true,
          },
        },
        entries: true,
      },
    });

    console.log(`Overtime status updated to REJECTED by admin`);

    // CRITICAL: Log admin rejection (Preserves original data!)
    await revisionService.logAdminRejection(
      requestId,
      adminId,
      comment,
      originalData,
    );

    // Deduct overtime balance (remove the hours that were added)
    try {
      await revisionService.deductOvertimeBalance(
        overtimeRequest.employeeId,
        overtimeRequest.totalHours,
      );
      console.log(
        `Overtime balance deducted: -${overtimeRequest.totalHours} hours`,
      );
    } catch (balanceError) {
      console.error("⚠️ Failed to deduct overtime balance:", balanceError);
      // Don't fail the rejection if balance deduction fails
    }

    // Send notification emails
    try {
      const { sendAdminRejectOvertimeEmail } =
        await import("../services/email.service.js");

      // Send to employee, supervisor, and HR
      await sendAdminRejectOvertimeEmail(
        overtimeRequest.employee,
        overtimeRequest,
        comment,
        adminName,
        [
          overtimeRequest.supervisor?.email,
          overtimeRequest.finalApprover?.email,
          process.env.HR_EMAIL,
        ].filter((email) => email), // Remove nulls
      );
      console.log(`Admin rejection notification emails sent`);
    } catch (emailError) {
      console.error("⚠️ Failed to send admin rejection emails:", emailError);
      // Don't fail the rejection if email fails
    }

    // Log audit trail
    console.log(`[AUDIT] Admin Override Rejection:`, {
      overtimeId: requestId,
      adminId: adminId,
      adminName: adminName,
      employeeId: overtimeRequest.employeeId,
      employeeName: overtimeRequest.employee.name,
      hours: overtimeRequest.totalHours,
      amount: overtimeRequest.totalAmount,
      reason: comment,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Overtime request rejected by admin successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("❌ Admin reject overtime error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to reject overtime request",
      message: error.message,
    });
  }
};

/**
 * Admin edit overtime request (Both APPROVED and REJECTED)
 * PUT /api/overtime/:requestId/admin-edit
 * Only for System Administrator (Level 1)
 *
 * Cases:
 * 1. Edit APPROVED → Stays APPROVED, balance auto-adjusted
 * 2. Edit REJECTED → Changes to PENDING, reassign to current supervisor
 */
export const adminEditOvertime = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { entries, reason } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    console.log(
      `[Admin Edit] Admin ${adminName} editing overtime ${requestId}`,
    );

    // Validate reason
    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: "Admin edit reason required (minimum 20 characters)",
        details: ["Please provide a detailed reason for editing this overtime"],
      });
    }

    // Validate entries
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one overtime entry is required",
      });
    }

    // Get existing overtime request
    const existingRequest = await prisma.overtimeRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: {
          include: {
            division: true,
            role: true,
            supervisor: true,
          },
        },
        entries: true,
        supervisor: true,
      },
    });

    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: "Overtime request not found",
      });
    }

    // Check: Cannot edit if recapped
    if (existingRequest.isRecapped) {
      return res.status(400).json({
        success: false,
        error: "Cannot edit recapped overtime",
        recappedDate: existingRequest.recappedDate,
      });
    }

    // Check: Can only edit APPROVED or REJECTED
    if (!["APPROVED", "REJECTED"].includes(existingRequest.status)) {
      return res.status(400).json({
        success: false,
        error: "Can only edit APPROVED or REJECTED overtime requests",
        currentStatus: existingRequest.status,
      });
    }

    console.log(`Validation passed. Current status: ${existingRequest.status}`);

    // Validate each entry
    const today = startOfDay(new Date());
    for (const entry of entries) {
      if (!entry.date || !entry.hours || !entry.description) {
        return res.status(400).json({
          error: "Each entry must have date, hours, and description",
        });
      }

      if (entry.hours <= 0 || entry.hours > 12) {
        return res.status(400).json({
          error: `Invalid hours for ${entry.date}. Must be between 0.5 and 12 hours`,
        });
      }

      // Admin can edit any historical date (not recapped)
      const entryDate = startOfDay(new Date(entry.date));
      if (isAfter(entryDate, today)) {
        return res.status(400).json({
          error: `Date ${entry.date} is in the future. Cannot submit.`,
        });
      }
    }

    // Check for duplicate dates in submission
    const dates = entries.map((e) => e.date);
    const uniqueDates = new Set(dates);
    if (dates.length !== uniqueDates.size) {
      return res.status(400).json({
        error: "Duplicate dates found in submission.",
      });
    }

    // Check duplicate with OTHER requests (exclude current)
    const existingDates = await overtimeService.checkDuplicateDatesExcluding(
      existingRequest.employeeId,
      dates,
      requestId,
    );
    if (existingDates.length > 0) {
      return res.status(400).json({
        error: `Dates already exist in other requests: ${existingDates.join(", ")}`,
        duplicateDates: existingDates,
      });
    }

    // Save original data for revision history
    const originalData = {
      status: existingRequest.status,
      totalHours: existingRequest.totalHours,
      totalAmount: existingRequest.totalAmount,
      entries: existingRequest.entries,
    };

    // Calculate new totals
    const newTotalHours = entries.reduce(
      (sum, e) => sum + parseFloat(e.hours),
      0,
    );
    const overtimeRate =
      parseFloat(existingRequest.employee.overtimeRate) || 37500;
    const newTotalAmount = (newTotalHours / 8) * overtimeRate;

    console.log(
      `[Admin Edit] Hours: ${originalData.totalHours} → ${newTotalHours}`,
    );

    // Prepare update data based on current status
    let updateData = {};
    let newStatus = existingRequest.status;

    // Case 1: Editing APPROVED → Stays APPROVED
    if (existingRequest.status === "APPROVED") {
      newStatus = "APPROVED";
      updateData = {
        totalHours: newTotalHours,
        totalAmount: newTotalAmount,
        status: "APPROVED", // Stays approved
      };

      // Adjust balance automatically
      const hoursDifference = newTotalHours - originalData.totalHours;
      if (hoursDifference !== 0) {
        await prisma.overtimeBalance.upsert({
          where: { employeeId: existingRequest.employeeId },
          update: {
            currentBalance: { increment: hoursDifference },
          },
          create: {
            employeeId: existingRequest.employeeId,
            currentBalance: newTotalHours,
            pendingHours: 0,
            totalPaid: 0,
          },
        });
        console.log(
          `Balance adjusted: ${hoursDifference > 0 ? "+" : ""}${hoursDifference} hours`,
        );
      }
    }
    // Case 2: Editing REJECTED → Changes to PENDING
    else if (existingRequest.status === "REJECTED") {
      newStatus = "PENDING";

      // Get employee's current supervisor
      const currentSupervisorId = existingRequest.employee.supervisorId;
      if (!currentSupervisorId) {
        return res.status(400).json({
          error: "Employee has no supervisor assigned",
        });
      }

      updateData = {
        totalHours: newTotalHours,
        totalAmount: newTotalAmount,
        status: "PENDING",
        currentApproverId: currentSupervisorId,
        supervisorId: currentSupervisorId,
        supervisorStatus: "PENDING",
        supervisorComment: null,
        supervisorDate: null,
        rejectedAt: null,
      };

      // Add to pending hours (REJECTED had 0, now needs tracking)
      await prisma.overtimeBalance.upsert({
        where: { employeeId: existingRequest.employeeId },
        update: {
          pendingHours: { increment: newTotalHours },
        },
        create: {
          employeeId: existingRequest.employeeId,
          currentBalance: 0,
          pendingHours: newTotalHours,
          totalPaid: 0,
        },
      });

      console.log(`Status changed: REJECTED → PENDING`);
      console.log(`Pending hours added: +${newTotalHours} hours`);
      console.log(`Reassigned to current supervisor: ${currentSupervisorId}`);
    }

    // Update overtime request
    const updatedRequest = await overtimeService.updateOvertimeRequest(
      requestId,
      {
        entries,
        totalHours: newTotalHours,
        totalAmount: newTotalAmount,
        status: newStatus,
      },
    );

    // Apply additional updates
    await prisma.overtimeRequest.update({
      where: { id: requestId },
      data: updateData,
    });

    // Log admin edit in revision history
    const action =
      existingRequest.status === "APPROVED"
        ? "ADMIN_EDITED_APPROVED"
        : "ADMIN_EDITED_REJECTED";

    await revisionService.logRevision({
      overtimeRequestId: requestId,
      revisedBy: adminId,
      action: action,
      changes: {
        before: {
          status: originalData.status,
          totalHours: originalData.totalHours,
          totalAmount: originalData.totalAmount,
          entriesCount: originalData.entries.length,
        },
        after: {
          status: newStatus,
          totalHours: newTotalHours,
          totalAmount: newTotalAmount,
          entriesCount: entries.length,
        },
        balanceAdjustment:
          existingRequest.status === "APPROVED"
            ? newTotalHours - originalData.totalHours
            : null,
        reassignedTo:
          existingRequest.status === "REJECTED"
            ? updateData.currentApproverId
            : null,
      },
      comment: reason,
    });

    console.log(`Admin edit completed successfully`);

    // Log audit trail
    console.log(`[AUDIT] Admin Edit:`, {
      overtimeId: requestId,
      adminId: adminId,
      adminName: adminName,
      employeeId: existingRequest.employeeId,
      employeeName: existingRequest.employee.name,
      originalStatus: originalData.status,
      newStatus: newStatus,
      hoursChange: `${originalData.totalHours} → ${newTotalHours}`,
      reason: reason,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Overtime request edited successfully",
      data: {
        ...updatedRequest,
        previousStatus: originalData.status,
        newStatus: newStatus,
      },
    });
  } catch (error) {
    console.error("❌ Admin edit overtime error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to edit overtime request",
      message: error.message,
    });
  }
};

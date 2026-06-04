// backend/src/services/leaveReminder.service.js
import { PrismaClient } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";
import { sendLeaveReminderH7Email } from "./email.service.js";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Daily scheduled job — H-7 reminder
// ─────────────────────────────────────────────────────────────────────────────

export async function sendLeaveRemindersH7({ dryRun = false } = {}) {
  try {
    const today = startOfDay(new Date());
    const targetDate = addDays(today, 7);

    if (dryRun) {
      console.log(
        `[LeaveReminder][DRY RUN] Previewing leaves starting on ${targetDate.toDateString()}...`,
      );
    } else {
      console.log(
        `[LeaveReminder] Checking leaves starting on ${targetDate.toDateString()}...`,
      );
    }

    const upcomingLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: {
          gte: startOfDay(targetDate),
          lt: addDays(startOfDay(targetDate), 1),
        },
      },
      include: {
        employee: {
          include: {
            division: true,
            role: true,
            plottingCompany: {
              include: {
                subgroup: {
                  include: {
                    companies: {
                      where: { isActive: true },
                      select: { id: true, code: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    console.log(
      `[LeaveReminder] Found ${upcomingLeaves.length} leave(s) starting in 7 days`,
    );
    if (upcomingLeaves.length === 0) {
      return {
        success: true,
        message: "No leaves starting in 7 days",
        sent: 0,
        previews: [],
      };
    }

    let totalSent = 0;
    const previews = [];

    for (const leave of upcomingLeaves) {
      try {
        const result = await sendReminderForLeave(leave, 7, dryRun);
        if (dryRun) {
          previews.push(result);
        } else {
          totalSent += result;
        }
      } catch (err) {
        console.error(
          `[LeaveReminder] Error processing leave ${leave.id}:`,
          err,
        );
      }
    }

    return dryRun
      ? {
          success: true,
          dryRun: true,
          leavesFound: upcomingLeaves.length,
          previews,
        }
      : {
          success: true,
          leavesProcessed: upcomingLeaves.length,
          emailsSent: totalSent,
        };
  } catch (err) {
    console.error("[LeaveReminder] sendLeaveRemindersH7 failed:", err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Immediate reminder — called on approval when < 7 days notice
// ─────────────────────────────────────────────────────────────────────────────

export async function sendImmediateLeaveReminder(
  leaveRequestId,
  { dryRun = false } = {},
) {
  try {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: {
        employee: {
          include: {
            division: true,
            role: true,
            plottingCompany: {
              include: {
                subgroup: {
                  include: {
                    companies: {
                      where: { isActive: true },
                      select: { id: true, code: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "APPROVED")
      return { success: true, sent: 0, reason: "Not approved" };

    const today = startOfDay(new Date());
    const leaveStart = startOfDay(new Date(leave.startDate));
    const daysUntilLeave = Math.ceil(
      (leaveStart - today) / (1000 * 60 * 60 * 24),
    );

    if (!dryRun && (daysUntilLeave >= 7 || daysUntilLeave < 0)) {
      return { success: true, sent: 0, reason: "Handled by scheduler" };
    }

    const result = await sendReminderForLeave(leave, daysUntilLeave, dryRun);

    return dryRun
      ? { success: true, dryRun: true, preview: result }
      : { success: true, sent: result, reason: "Immediate reminder sent" };
  } catch (err) {
    console.error("[LeaveReminder] sendImmediateLeaveReminder failed:", err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE: Core notification logic
//
// TO (priority order):
//   1. Employee's direct supervisor
//   2. Employee's division head
//   3. HR fallback
//
// CC:
//   1. All active members of the employee's division (same division)
//   2. All division heads within the same SUBGROUP
//      e.g. employee in PT Rhaya Media Utama (subgroup: Rhaya Flicks)
//           → CCs division heads from ALL 8 Rhaya Flicks entities
//      NOT division heads from KRV, Crave Digital, Metamora
//   3. HR (unless already TO)
//
// Scope boundary = EntitySubgroup, not EntityGroup.
// This ensures Rhaya Flicks leave doesn't notify KRV/Crave Digital heads.
// ─────────────────────────────────────────────────────────────────────────────

async function sendReminderForLeave(leave, daysUntilLeave = 7, dryRun = false) {
  const employee = leave.employee;
  const divisionId = employee.divisionId;
  const plottingCompanyId = employee.plottingCompanyId;
  const subgroup = employee.plottingCompany?.subgroup ?? null;
  const hrEmail = process.env.HR_EMAIL || "hr@rhayaflicks.com";

  const prefix = dryRun ? "[DRY RUN]" : "";

  console.log(
    `[LeaveReminder]${prefix} Processing leave ${leave.id} — ${employee.name}` +
      ` (entity: ${employee.plottingCompany?.code ?? "none"}` +
      `, subgroup: ${subgroup?.name ?? "none"})`,
  );

  // ── Step 1: Resolve TO ────────────────────────────────────────────────────
  let toRecipient = null;
  let toRecipientType = "";

  if (employee.supervisorId) {
    const sup = await prisma.user.findUnique({
      where: { id: employee.supervisorId },
      select: { id: true, name: true, email: true, employeeStatus: true },
    });
    if (sup?.email && sup.employeeStatus !== "INACTIVE") {
      toRecipient = sup;
      toRecipientType = "Supervisor";
    }
  }

  if (!toRecipient && divisionId) {
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: { headId: true },
    });
    if (division?.headId) {
      const head = await prisma.user.findUnique({
        where: { id: division.headId },
        select: { id: true, name: true, email: true, employeeStatus: true },
      });
      if (head?.email && head.employeeStatus !== "INACTIVE") {
        toRecipient = head;
        toRecipientType = "Division Head";
      }
    }
  }

  if (!toRecipient) {
    toRecipient = { id: "hr", name: "HR Department", email: hrEmail };
    toRecipientType = "HR (fallback)";
  }

  console.log(
    `[LeaveReminder]${prefix} TO: ${toRecipient.email} (${toRecipientType})`,
  );

  // ── Step 2: Build CC ──────────────────────────────────────────────────────
  const ccEmails = new Set();

  if (divisionId) {
    const divisionMembers = await prisma.user.findMany({
      where: {
        divisionId,
        employeeStatus: { not: "INACTIVE" },
        id: { not: employee.id },
      },
      select: { email: true, name: true },
    });
    divisionMembers.forEach((m) => {
      if (m.email) ccEmails.add(m.email);
    });
    console.log(
      `[LeaveReminder]${prefix} CC: ${divisionMembers.length} division member(s)`,
    );
  }

  if (subgroup?.companies?.length > 0) {
    const siblingEntityIds = subgroup.companies.map((c) => c.id);

    const allDivisions = await prisma.division.findMany({
      where: { headId: { not: null } },
      select: { headId: true },
    });
    const allHeadIds = allDivisions.map((d) => d.headId).filter(Boolean);

    if (allHeadIds.length > 0) {
      const subgroupHeads = await prisma.user.findMany({
        where: {
          id: { in: allHeadIds },
          plottingCompanyId: { in: siblingEntityIds },
          employeeStatus: { not: "INACTIVE" },
        },
        select: {
          email: true,
          name: true,
          plottingCompany: { select: { code: true, name: true } },
        },
      });
      subgroupHeads.forEach((u) => {
        if (u.email) ccEmails.add(u.email);
      });
      console.log(
        `[LeaveReminder]${prefix} CC: ${subgroupHeads.length} subgroup division head(s)`,
      );
    }
  } else if (plottingCompanyId && !subgroup) {
    const entityDivisions = await prisma.division.findMany({
      where: {
        headId: { not: null },
        head: {
          plottingCompanyId,
          employeeStatus: { not: "INACTIVE" },
        },
      },
      select: { head: { select: { email: true } } },
    });
    entityDivisions.forEach((d) => {
      if (d.head?.email) ccEmails.add(d.head.email);
    });
  }

  if (toRecipient.email !== hrEmail) {
    ccEmails.add(hrEmail);
  }
  ccEmails.delete(toRecipient.email);

  const ccList = [...ccEmails].filter(Boolean);
  console.log(`[LeaveReminder]${prefix} CC total: ${ccList.length}`);

  // ── Step 3: Send or return preview ───────────────────────────────────────
  if (dryRun) {
    // ✅ DRY RUN — return preview object, no email sent
    const preview = {
      leaveId: leave.id,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        entity: employee.plottingCompany?.name ?? null,
        entityCode: employee.plottingCompany?.code ?? null,
        subgroup: subgroup?.name ?? null,
        division: employee.division?.name ?? null,
      },
      leaveType: leave.type ?? leave.leaveType ?? "—",
      startDate: leave.startDate,
      endDate: leave.endDate,
      daysUntilLeave,
      to: {
        email: toRecipient.email,
        name: toRecipient.name,
        type: toRecipientType,
      },
      cc: ccList,
      ccCount: ccList.length,
      wouldSend: !!toRecipient.email,
    };

    console.log(
      `[LeaveReminder][DRY RUN] Would send to ${toRecipient.email}, CC ${ccList.length}`,
    );
    return preview;
  }

  // ── Real send ─────────────────────────────────────────────────────────────
  if (!toRecipient.email) {
    console.error(
      `[LeaveReminder] No valid TO for leave ${leave.id} — skipping`,
    );
    return 0;
  }

  try {
    await sendLeaveReminderH7Email(
      toRecipient,
      leave,
      employee,
      ccList,
      daysUntilLeave,
    );
    console.log(
      `[LeaveReminder] ✅ Sent — TO: ${toRecipient.email}  CC: ${ccList.length}`,
    );
    return 1;
  } catch (err) {
    console.error(`[LeaveReminder] ❌ Failed for leave ${leave.id}:`, err);
    return 0;
  }
}

export async function previewLeaveReminderForDate(targetDateStr) {
  // targetDateStr: "YYYY-MM-DD" e.g. "2025-05-01"
  const targetDate = startOfDay(new Date(targetDateStr));

  if (isNaN(targetDate.getTime())) {
    throw new Error(`Invalid date: "${targetDateStr}". Use YYYY-MM-DD format.`);
  }

  console.log(
    `[LeaveReminder][DRY RUN] Previewing leaves starting on ${targetDate.toDateString()}...`,
  );

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: {
        gte: startOfDay(targetDate),
        lt: addDays(startOfDay(targetDate), 1),
      },
    },
    include: {
      employee: {
        include: {
          division: true,
          role: true,
          plottingCompany: {
            include: {
              subgroup: {
                include: {
                  companies: {
                    where: { isActive: true },
                    select: { id: true, code: true, name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (leaves.length === 0) {
    return {
      success: true,
      dryRun: true,
      targetDate: targetDate.toISOString(),
      leavesFound: 0,
      previews: [],
      message: `No approved leaves found starting on ${targetDateStr}`,
    };
  }

  const previews = [];
  for (const leave of leaves) {
    try {
      const preview = await sendReminderForLeave(leave, 7, true); // dryRun = true
      previews.push(preview);
    } catch (err) {
      previews.push({
        leaveId: leave.id,
        error: err.message,
      });
    }
  }

  return {
    success: true,
    dryRun: true,
    targetDate: targetDate.toISOString(),
    leavesFound: leaves.length,
    previews,
  };
}

export default {
  sendLeaveRemindersH7,
  sendImmediateLeaveReminder,
  previewLeaveReminderForDate,
};

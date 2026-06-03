// backend/src/services/leaveReminder.service.js
import { PrismaClient } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";
import { sendLeaveReminderH7Email } from "./email.service.js";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Daily scheduled job — H-7 reminder
// ─────────────────────────────────────────────────────────────────────────────

export async function sendLeaveRemindersH7() {
  try {
    const today = startOfDay(new Date());
    const targetDate = addDays(today, 7);

    console.log(
      `[LeaveReminder] Checking leaves starting on ${targetDate.toDateString()}...`,
    );

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
                  // include subgroup for scoped CC
                  include: {
                    companies: {
                      // all sibling entities in same subgroup
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
      };
    }

    let totalSent = 0;
    for (const leave of upcomingLeaves) {
      try {
        totalSent += await sendReminderForLeave(leave);
      } catch (err) {
        console.error(
          `[LeaveReminder] Error processing leave ${leave.id}:`,
          err,
        );
      }
    }

    return {
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

export async function sendImmediateLeaveReminder(leaveRequestId) {
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

    if (daysUntilLeave >= 7 || daysUntilLeave < 0) {
      return { success: true, sent: 0, reason: "Handled by scheduler" };
    }

    const sent = await sendReminderForLeave(leave, daysUntilLeave);
    return { success: true, sent, reason: "Immediate reminder sent" };
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

async function sendReminderForLeave(leave, daysUntilLeave = 7) {
  const employee = leave.employee;
  const divisionId = employee.divisionId;
  const plottingCompanyId = employee.plottingCompanyId;
  const subgroup = employee.plottingCompany?.subgroup ?? null;
  const hrEmail = process.env.HR_EMAIL || "hr@rhayaflicks.com";

  console.log(
    `[LeaveReminder] Processing leave ${leave.id} — ${employee.name}` +
      ` (entity: ${employee.plottingCompany?.code ?? "none"}` +
      `, subgroup: ${subgroup?.name ?? "none"})`,
  );

  // ── Step 1: TO recipient ──────────────────────────────────────────────────

  let toRecipient = null;
  let toRecipientType = "";

  // 1a. Direct supervisor
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

  // 1b. Division head (employee's own division)
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

  // 1c. HR fallback
  if (!toRecipient) {
    toRecipient = { id: "hr", name: "HR Department", email: hrEmail };
    toRecipientType = "HR (fallback)";
  }

  console.log(`[LeaveReminder] TO: ${toRecipient.email} (${toRecipientType})`);

  // ── Step 2: CC list ───────────────────────────────────────────────────────

  const ccEmails = new Set();

  // CC 1: All active members of the employee's own division (excluding leave taker)
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
      `[LeaveReminder] CC: ${divisionMembers.length} division member(s)`,
    );
  }

  // CC 2: All division heads across all entities in the SAME subgroup
  // Scope: subgroup (e.g. Rhaya Flicks) — NOT the full EntityGroup (Marketing)
  if (subgroup?.companies?.length > 0) {
    const siblingEntityIds = subgroup.companies.map((c) => c.id);

    // Find all divisions that belong to any entity in the subgroup
    // by looking at users' plottingCompanyId and their division heads
    const siblingDivisions = await prisma.division.findMany({
      where: {
        headId: { not: null },
        // Filter divisions whose head belongs to a sibling entity
        head: {
          plottingCompanyId: { in: siblingEntityIds },
          employeeStatus: { not: "INACTIVE" },
        },
      },
      select: {
        id: true,
        name: true,
        head: {
          select: {
            id: true,
            name: true,
            email: true,
            plottingCompanyId: true,
            plottingCompany: { select: { code: true, name: true } },
          },
        },
      },
    });

    siblingDivisions.forEach((d) => {
      if (d.head?.email) ccEmails.add(d.head.email);
    });

    console.log(
      `[LeaveReminder] CC: ${siblingDivisions.length} division head(s) from` +
        ` ${siblingEntityIds.length} sibling entities in subgroup "${subgroup.name}"`,
    );
  } else if (plottingCompanyId && !subgroup) {
    // No subgroup assigned — fall back to entity-level division heads only
    console.log(
      `[LeaveReminder] No subgroup found — using entity-level division heads only`,
    );
    const entityDivisions = await prisma.division.findMany({
      where: {
        headId: { not: null },
        head: {
          plottingCompanyId,
          employeeStatus: { not: "INACTIVE" },
        },
      },
      select: {
        head: { select: { email: true } },
      },
    });
    entityDivisions.forEach((d) => {
      if (d.head?.email) ccEmails.add(d.head.email);
    });
    console.log(
      `[LeaveReminder] CC: ${entityDivisions.length} entity division head(s) (fallback)`,
    );
  }

  // CC 3: HR (unless already TO)
  if (toRecipient.email !== hrEmail) {
    ccEmails.add(hrEmail);
  }

  // Dedup: never CC the TO recipient
  ccEmails.delete(toRecipient.email);

  const ccList = [...ccEmails].filter(Boolean);
  console.log(
    `[LeaveReminder] CC total: ${ccList.length} — ${ccList.join(", ")}`,
  );

  // ── Step 3: Send ──────────────────────────────────────────────────────────

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
      `[LeaveReminder] Sent — TO: ${toRecipient.email}  CC: ${ccList.length}`,
    );
    return 1;
  } catch (err) {
    console.error(`[LeaveReminder] ❌ Failed for leave ${leave.id}:`, err);
    return 0;
  }
}

export default { sendLeaveRemindersH7, sendImmediateLeaveReminder };

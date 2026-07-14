// backend/src/services/contractReminder.service.js
import { PrismaClient } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";
import { sendContractExpiryReminderEmail } from "./email.service.js";
import { getPolicyForUser } from "../helpers/policyResolver.js";

const prisma = new PrismaClient();

// Reminder checkpoints: 30/14/7 days before expiry, and the day it expires.
const THRESHOLDS = [30, 14, 7, 0];

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Daily scheduled job — H-30/H-14/H-7 + expired reminders
// ─────────────────────────────────────────────────────────────────────────────

export async function sendContractExpiryReminders({ dryRun = false } = {}) {
  const today = startOfDay(new Date());
  const prefix = dryRun ? "[ContractReminder][DRY RUN]" : "[ContractReminder]";
  const previews = [];
  let totalSent = 0;

  for (const days of THRESHOLDS) {
    const targetDate = addDays(today, days);

    const employees = await prisma.user.findMany({
      where: {
        contractEndDate: {
          gte: targetDate,
          lt: addDays(targetDate, 1),
        },
        employeeStatus: { not: "INACTIVE" },
      },
      include: {
        division: true,
        supervisor: { select: { id: true, name: true, email: true } },
      },
    });

    console.log(`${prefix} H-${days}: found ${employees.length} contract(s) ending ${targetDate.toDateString()}`);

    for (const employee of employees) {
      try {
        const policy = await getPolicyForUser(employee);

        if (dryRun) {
          previews.push({
            employee: employee.name,
            nip: employee.nip,
            daysUntilExpiry: days,
            contractEndDate: employee.contractEndDate,
            hrEmail: policy.hrEmail,
            supervisorEmail: employee.supervisor?.email || null,
          });
          continue;
        }

        await sendContractExpiryReminderEmail(employee, days, {
          hrEmail: policy.hrEmail,
          smtpProfile: policy.smtpProfile,
        });
        totalSent += 1;
      } catch (err) {
        console.error(`${prefix} Failed to notify for ${employee.name} (H-${days}):`, err);
      }
    }
  }

  return dryRun
    ? { success: true, dryRun: true, previews }
    : { success: true, emailsSent: totalSent };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: In-app dashboard data — contracts expiring within `withinDays` plus
// any already expired, grouped into buckets for the HR widget.
// ─────────────────────────────────────────────────────────────────────────────

export async function getUpcomingContractExpirations({ withinDays = 30, where = {} } = {}) {
  const today = startOfDay(new Date());
  const cutoff = addDays(today, withinDays);

  const employees = await prisma.user.findMany({
    where: {
      ...where,
      contractEndDate: { lte: cutoff },
      employeeStatus: { not: "INACTIVE" },
    },
    include: {
      division: { select: { name: true } },
      plottingCompany: { select: { id: true, name: true, code: true } },
    },
    orderBy: { contractEndDate: "asc" },
  });

  const bucketFor = (contractEndDate) => {
    const days = Math.ceil((startOfDay(contractEndDate) - today) / (1000 * 60 * 60 * 24));
    if (days < 0) return "expired";
    if (days <= 7) return "h7";
    if (days <= 14) return "h14";
    return "h30";
  };

  const buckets = { expired: [], h7: [], h14: [], h30: [] };

  for (const employee of employees) {
    const days = Math.ceil((startOfDay(employee.contractEndDate) - today) / (1000 * 60 * 60 * 24));
    buckets[bucketFor(employee.contractEndDate)].push({
      id: employee.id,
      name: employee.name,
      nip: employee.nip,
      division: employee.division?.name || null,
      entity: employee.plottingCompany
        ? { id: employee.plottingCompany.id, name: employee.plottingCompany.name, code: employee.plottingCompany.code }
        : null,
      contractEndDate: employee.contractEndDate,
      daysUntilExpiry: days,
    });
  }

  return buckets;
}

export default {
  sendContractExpiryReminders,
  getUpcomingContractExpirations,
};

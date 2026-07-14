// backend/src/services/scheduler.service.js
import cron from "node-cron";
import leaveReminderService from "./leaveReminder.service.js";
import contractReminderService from "./contractReminder.service.js";
import { moveExpiredPlansToActualization } from "../controllers/overtime.controller.js";
import { syncTodayWfhStatuses } from "../controllers/wfh.controller.js";

const TZ = "Asia/Jakarta";

let scheduledJobs = [];

// ─── Helper: register a job and log it ───────────────────────────────────────
function register(name, schedule, description, fn) {
  const job = cron.schedule(
    schedule,
    async () => {
      console.log(`[Scheduler] Running: ${name}`);
      try {
        const result = await fn();
        console.log(`[Scheduler] ${name} completed:`, result);
      } catch (err) {
        console.error(`[Scheduler] ${name} failed:`, err);
      }
    },
    { scheduled: true, timezone: TZ },
  );

  scheduledJobs.push({ name, job, schedule, description });
  console.log(`[Scheduler] Registered: ${name} (${schedule})`);
}

// =============================================================================
// Initialize all scheduled jobs
// =============================================================================

export function initializeScheduler() {
  console.log("[Scheduler] Initializing scheduled jobs...");

  // ── 1. Leave reminder H-7 ────────────────────────────────────────────────
  // Runs daily at 8:00 AM
  // Sends reminder emails for leaves starting in exactly 7 days
  register(
    "leave-reminder-h7",
    "0 8 * * *",
    "Send leave reminder emails 7 days before leave starts",
    () => leaveReminderService.sendLeaveRemindersH7(),
  );

  // ── 2. Overtime actualization check ──────────────────────────────────────
  // Runs daily at 6:00 AM
  // Moves PLAN_APPROVED overtime requests to PENDING_ACTUALIZATION
  // when all their entry dates have passed
  register(
    "overtime-actualization-check",
    "0 6 * * *",
    "Move expired overtime plans to PENDING_ACTUALIZATION",
    () => moveExpiredPlansToActualization(),
  );

  // ── 3. WFH status sync ───────────────────────────────────────────────────
  // Runs daily at 00:01 AM WIB — writes WorkStatus WFH record for employees
  // whose WFH schedule falls on today.
  register(
    "wfh-status-sync",
    "1 0 * * 1-5",  // Mon-Fri only at 00:01 WIB
    "Sync WFH schedules → WorkStatus records for today",
    () => syncTodayWfhStatuses(),
  );

  // ── 4. Contract expiry reminder ──────────────────────────────────────────
  // Runs daily at 8:15 AM
  // Sends HR (+ supervisor CC) reminders at H-30/H-14/H-7 and on the day
  // a contract expires (User.contractEndDate)
  register(
    "contract-expiry-reminder",
    "15 8 * * *",
    "Send contract expiry reminders at H-30/H-14/H-7 and on expiry day",
    () => contractReminderService.sendContractExpiryReminders(),
  );

  console.log(`[Scheduler] Active jobs: ${scheduledJobs.length}`);
}

// =============================================================================
// Stop all scheduled jobs
// =============================================================================

export function stopScheduler() {
  console.log("[Scheduler] Stopping all scheduled jobs...");
  scheduledJobs.forEach(({ name, job }) => {
    job.stop();
    console.log(`[Scheduler] Stopped: ${name}`);
  });
  scheduledJobs = [];
}

// =============================================================================
// Get status of all scheduled jobs
// =============================================================================

export function getSchedulerStatus() {
  return scheduledJobs.map(({ name, schedule, description }) => ({
    name,
    schedule,
    description,
    timezone: TZ,
    status: "active",
  }));
}

// =============================================================================
// Manual triggers (for testing / admin use)
// =============================================================================

export async function manualTriggerLeaveReminder() {
  console.log("[Scheduler] Manual trigger: leave-reminder-h7");
  try {
    const result = await leaveReminderService.sendLeaveRemindersH7();
    console.log("[Scheduler] Manual leave reminder completed:", result);
    return result;
  } catch (err) {
    console.error("[Scheduler] Manual leave reminder failed:", err);
    throw err;
  }
}

export async function manualTriggerActualizationCheck() {
  console.log("[Scheduler] Manual trigger: overtime-actualization-check");
  try {
    const result = await moveExpiredPlansToActualization();
    console.log("[Scheduler] Manual actualization check completed:", result);
    return result;
  } catch (err) {
    console.error("[Scheduler] Manual actualization check failed:", err);
    throw err;
  }
}

export async function manualTriggerContractExpiryReminder() {
  console.log("[Scheduler] Manual trigger: contract-expiry-reminder");
  try {
    const result = await contractReminderService.sendContractExpiryReminders();
    console.log("[Scheduler] Manual contract expiry reminder completed:", result);
    return result;
  } catch (err) {
    console.error("[Scheduler] Manual contract expiry reminder failed:", err);
    throw err;
  }
}

export default {
  initializeScheduler,
  stopScheduler,
  getSchedulerStatus,
  manualTriggerLeaveReminder,
  manualTriggerActualizationCheck,
  manualTriggerContractExpiryReminder,
};

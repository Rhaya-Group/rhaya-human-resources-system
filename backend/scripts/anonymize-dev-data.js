// backend/scripts/anonymize-dev-data.js
// Scrubs PII from the DEV database (cloned from prod via Neon branching).
// Refuses to run unless DATABASE_URL points at the known dev branch host,
// and unless --confirm is passed. Never touches prod.
//
// Usage:
//   DATABASE_URL='postgresql://...ep-withered-salad-a1oec7f2...' node -r dotenv/config scripts/anonymize-dev-data.js --confirm
//   (add --dry-run to only print counts, no writes)

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Only known-dev endpoint host is allowed to run this against. Update if the
// dev branch is ever recreated (`npx neonctl branches list --project-id fragrant-unit-71316792`).
const DEV_HOST_ALLOWLIST = ["ep-withered-salad-a1oec7f2"];
const PROD_HOST_BLOCKLIST = ["ep-billowing-mouse-a1bczhr0"];

const DEV_PASSWORD = "DevPassword123!";

const args = process.argv.slice(2);
const CONFIRM = args.includes("--confirm");
const DRY_RUN = args.includes("--dry-run");

function assertSafeTarget() {
  const url = process.env.DATABASE_URL || "";

  if (PROD_HOST_BLOCKLIST.some((h) => url.includes(h))) {
    console.error("REFUSING: DATABASE_URL points at the prod host. Aborting.");
    process.exit(1);
  }

  if (!DEV_HOST_ALLOWLIST.some((h) => url.includes(h))) {
    console.error(
      "REFUSING: DATABASE_URL does not match the known dev branch host.\n" +
        `Expected one of: ${DEV_HOST_ALLOWLIST.join(", ")}\n` +
        "If the dev branch was recreated, update DEV_HOST_ALLOWLIST in this script first.",
    );
    process.exit(1);
  }

  if (!CONFIRM && !DRY_RUN) {
    console.error("Refusing to write without --confirm. Pass --dry-run to preview instead.");
    process.exit(1);
  }
}

async function anonymizeUsers(devPasswordHash) {
  const users = await prisma.user.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });
  console.log(`users: ${users.length} rows`);
  if (DRY_RUN) return;

  for (let i = 0; i < users.length; i++) {
    const n = i + 1;
    await prisma.user.update({
      where: { id: users[i].id },
      data: {
        name: `Dev User ${n}`,
        username: `devuser${n}`,
        email: `devuser${n}@example.dev`,
        password: devPasswordHash,
        phone: `0800000${String(n).padStart(4, "0")}`,
        address: "Anonymized Address",
        dateOfBirth: null,
        placeOfBirth: null,
        nip: `DEVNIP${String(n).padStart(6, "0")}`,
        nik: null,
        npwp: null,
        bpjsHealth: null,
        bpjsEmployment: null,
      },
    });
  }
}

async function anonymizeApplicants(devPasswordHash) {
  const applicants = await prisma.applicant.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });
  console.log(`applicants: ${applicants.length} rows`);
  if (DRY_RUN) return;

  for (let i = 0; i < applicants.length; i++) {
    const n = i + 1;
    await prisma.applicant.update({
      where: { id: applicants[i].id },
      data: {
        name: `Dev Applicant ${n}`,
        email: `devapplicant${n}@example.dev`,
        phone: `0810000${String(n).padStart(4, "0")}`,
        password: devPasswordHash,
        resumeUrl: null,
      },
    });
  }
}

async function anonymizePayslips() {
  const count = await prisma.payslip.count();
  console.log(`payslips: ${count} rows`);
  if (DRY_RUN) return;

  await prisma.payslip.updateMany({
    data: {
      grossSalary: null,
      netSalary: null,
      fileUrl: "REDACTED_DEV_PLACEHOLDER",
      notes: null,
    },
  });
}

async function anonymizeEmployeeDocuments() {
  const count = await prisma.employeeDocument.count();
  console.log(`employee documents: ${count} rows`);
  if (DRY_RUN) return;

  await prisma.employeeDocument.updateMany({
    data: {
      fileUrl: "REDACTED_DEV_PLACEHOLDER",
      notes: null,
    },
  });
}

async function anonymizeJobApplications() {
  const count = await prisma.jobApplication.count();
  console.log(`job applications: ${count} rows`);
  if (DRY_RUN) return;

  await prisma.jobApplication.updateMany({
    data: {
      coverLetter: null,
      resumeUrl: null,
      hrNotes: null,
      rejectedReason: null,
    },
  });
}

async function anonymizeApplicationEvents() {
  const count = await prisma.applicationEvent.count();
  console.log(`application events: ${count} rows`);
  if (DRY_RUN) return;

  await prisma.applicationEvent.updateMany({ data: { note: null } });
}

async function anonymizeOffboarding() {
  const count = await prisma.offboarding.count();
  console.log(`offboarding: ${count} rows`);
  if (DRY_RUN) return;

  await prisma.offboarding.updateMany({
    data: {
      resignReason: null,
      reasonDetails: null,
      handoverNotes: null,
      documentationNotes: null,
      accessNotes: null,
      laptopNotes: null,
      idCardNotes: null,
      emailNotes: null,
      otherAssetNotes: null,
      loanNotes: null,
      reimbursementNotes: null,
      finalPayrollNotes: null,
      exitInterviewLink: null,
      exitInterviewNotes: null,
    },
  });
}

async function anonymizeAuditReasons() {
  const [balanceLogCount, recapAdjCount] = await Promise.all([
    prisma.balanceAdjustmentLog.count(),
    prisma.recapDateAdjustment.count(),
  ]);
  console.log(`balance adjustment logs: ${balanceLogCount} rows`);
  console.log(`recap date adjustments: ${recapAdjCount} rows`);
  if (DRY_RUN) return;

  await prisma.balanceAdjustmentLog.updateMany({ data: { reason: "Dev anonymized reason" } });
  await prisma.recapDateAdjustment.updateMany({ data: { reason: "Dev anonymized reason" } });
}

async function invalidatePasswordResets() {
  const [tokenCount, resetCount] = await Promise.all([
    prisma.passwordResetToken.count(),
    prisma.passwordReset.count(),
  ]);
  console.log(`password reset tokens: ${tokenCount} rows (will delete)`);
  console.log(`password resets: ${resetCount} rows (will delete)`);
  if (DRY_RUN) return;

  await prisma.passwordResetToken.deleteMany({});
  await prisma.passwordReset.deleteMany({});
}

async function main() {
  assertSafeTarget();

  console.log(DRY_RUN ? "DRY RUN — no writes will happen\n" : "Anonymizing dev database...\n");

  const devPasswordHash = DRY_RUN ? null : await bcrypt.hash(DEV_PASSWORD, 10);

  await anonymizeUsers(devPasswordHash);
  await anonymizeApplicants(devPasswordHash);
  await anonymizePayslips();
  await anonymizeEmployeeDocuments();
  await anonymizeJobApplications();
  await anonymizeApplicationEvents();
  await anonymizeOffboarding();
  await anonymizeAuditReasons();
  await invalidatePasswordResets();

  if (!DRY_RUN) {
    console.log(`\nDone. All users/applicants now log in with password: ${DEV_PASSWORD}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

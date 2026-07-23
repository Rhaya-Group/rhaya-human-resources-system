// backend/src/services/email.service.js
// SMTP2go API with Custom Brand Theme (Black, White, #152A55)

import axios from "axios";
import nodemailer from "nodemailer";
import {
  renderEmailDocument,
  renderStatusBadge,
  renderInfoCard,
  renderCalloutBox,
  renderChecklist,
  renderButton,
  renderActionButtons,
  renderFooter,
  escapeHtml,
} from "../templates/email/index.js";

// const SMTP2GO_API_URL = "https://api.smtp2go.com/v3/email/send";
const SMTP_API_URL = process.env.SMTP_API_URL;
const API_KEY = process.env.SMTP2GO_API_KEY;

// Brand colors
const BRAND_COLORS = {
  primary: "#152A55", // Dark Blue
  secondary: "#000000", // Black
  accent: "#FFFFFF", // White
  cardBg: "#F5F5F5", // Light Grey
  cardBorder: "#E0E0E0", // Border Grey
  textPrimary: "#000000", // Black text
  textSecondary: "#666666", // Grey text
};

// Reserved for genuinely positive-outcome headers/badges only (approved, welcome,
// payslip-ready) — kept distinct from BRAND_COLORS.primary so a scanning inbox
// can tell "good news" apart from routine/neutral notifications at a glance.
const POSITIVE_COLORS = {
  headerBg: "#15803D",
  headerBg2: "#166534",
  badgeBg: "#15803D",
};

if (!API_KEY) {
  console.error("SMTP2GO_API_KEY not configured in .env");
} else {
  console.log("SMTP2go API configured");
}

function createTransporter() {
  // Check for Mailtrap SMTP credentials (Development)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log("📧 [EMAIL] Using Mailtrap SMTP (Development Mode)");
    console.log("📧 [EMAIL] Host:", process.env.SMTP_HOST);

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "2525"),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Check for SMTP2GO credentials (Production)
  if (
    process.env.SMTP2GO_HOST &&
    process.env.SMTP2GO_USER &&
    process.env.SMTP2GO_PASS
  ) {
    console.log("📧 [EMAIL] Using SMTP2GO (Production Mode)");
    console.log("📧 [EMAIL] Host:", process.env.SMTP2GO_HOST);

    return nodemailer.createTransport({
      host: process.env.SMTP2GO_HOST,
      port: parseInt(process.env.SMTP2GO_PORT || "2525"),
      auth: {
        user: process.env.SMTP2GO_USER,
        pass: process.env.SMTP2GO_PASS,
      },
    });
  }

  // Fallback: Generic SMTP configuration
  console.warn(
    "⚠️  [EMAIL] No specific email service detected. Using generic SMTP config.",
  );

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "587"),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Create a transporter for a named SMTP profile.
 * Profile key maps to env vars: SMTP2GO_{KEY}_USER / PASS / HOST / PORT / FROM_EMAIL / FROM_NAME
 * Falls back to default transporter if profile is null/undefined/"default" or env vars missing.
 *
 * Example env for profile "kgi":
 *   SMTP2GO_KGI_USER=sender@kgi.com
 *   SMTP2GO_KGI_PASS=secret
 *   SMTP2GO_KGI_HOST=mail.smtp2go.com      (optional, defaults to SMTP2GO_HOST)
 *   SMTP2GO_KGI_PORT=2525                  (optional)
 *   SMTP2GO_KGI_FROM_EMAIL=hr@kgi.com
 *   SMTP2GO_KGI_FROM_NAME=KGI HR
 *
 * @param {string|null} profile - smtpProfile key from PolicyTemplate
 * @returns {{ transporter: import("nodemailer").Transporter, fromEmail: string, fromName: string }}
 */
function createTransporterForProfile(profile) {
  // null / undefined / "default" → use shared default transporter
  if (!profile || profile === "default") {
    return {
      transporter: createTransporter(),
      fromEmail:
        process.env.SMTP_FROM_EMAIL ||
        process.env.SMTP_FROM ||
        "noreply@company.com",
      fromName: process.env.SMTP_FROM_NAME || "HR System",
    };
  }

  const key = profile.toUpperCase();
  const user = process.env[`SMTP2GO_${key}_USER`];
  const pass = process.env[`SMTP2GO_${key}_PASS`];

  if (!user || !pass) {
    console.warn(
      `⚠️  [EMAIL] smtpProfile "${profile}" missing env vars SMTP2GO_${key}_USER / SMTP2GO_${key}_PASS — falling back to default transporter`,
    );
    return {
      transporter: createTransporter(),
      fromEmail:
        process.env.SMTP_FROM_EMAIL ||
        process.env.SMTP_FROM ||
        "noreply@company.com",
      fromName: process.env.SMTP_FROM_NAME || "HR System",
    };
  }

  const host =
    process.env[`SMTP2GO_${key}_HOST`] ||
    process.env.SMTP2GO_HOST ||
    "mail.smtp2go.com";
  const port = parseInt(
    process.env[`SMTP2GO_${key}_PORT`] || process.env.SMTP2GO_PORT || "2525",
  );

  console.log(
    `📧 [EMAIL] Using SMTP2GO profile "${profile}" (host: ${host}, user: ${user})`,
  );

  return {
    transporter: nodemailer.createTransport({ host, port, auth: { user, pass } }),
    fromEmail:
      process.env[`SMTP2GO_${key}_FROM_EMAIL`] ||
      process.env.SMTP_FROM_EMAIL ||
      process.env.SMTP_FROM ||
      "noreply@company.com",
    fromName:
      process.env[`SMTP2GO_${key}_FROM_NAME`] ||
      process.env.SMTP_FROM_NAME ||
      "HR System",
  };
}

/**
 * Send email via configured SMTP service (Mailtrap or SMTP2GO)
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text body (optional)
 * @param {string|string[]} [options.cc] - CC recipients (optional)
 * @param {string|null} [options.smtpProfile] - SMTP profile key from PolicyTemplate (optional)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail({ to, subject, html, text, cc, smtpProfile }) {
  try {
    const { transporter: t, fromEmail, fromName } =
      createTransporterForProfile(smtpProfile ?? null);

    // Build email options
    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML tags for plain text
    };

    // Add CC if provided
    if (cc) {
      mailOptions.cc = Array.isArray(cc) ? cc.join(", ") : cc;
    }

    console.log("[EMAIL] Sending email:", {
      to,
      cc: cc || "none",
      subject,
      smtpProfile: smtpProfile || "default",
      service: process.env.SMTP_HOST ? "Mailtrap/SMTP" : "SMTP2GO",
    });

    // Send email
    const info = await t.sendMail(mailOptions);

    console.log("[EMAIL] Email sent successfully:", {
      to,
      messageId: info.messageId,
      response: info.response,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("❌ [EMAIL] Email send error:", {
      to,
      cc: cc || "none",
      subject,
      error: error.message,
      code: error.code,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

function recruitmentJobText(jobTitle) {
  return jobTitle ? ` for ${jobTitle}` : "";
}

function recruitmentEmailDocument({ title, bodyHtml }) {
  return renderEmailDocument({
    title,
    headerTitle: title,
    colors: {
      headerBg: BRAND_COLORS.primary,
      headerBg2: BRAND_COLORS.secondary,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      companyName: "Rhaya Group",
      note: "This is an automated notification from the HR system.",
    }),
  });
}

export function sendApplicationConfirmationEmail({ applicant, jobTitle }) {
  if (!applicant?.email) return Promise.resolve();
  const subject = `Application received${recruitmentJobText(jobTitle)}`;
  const text = `Hi ${applicant.name || "there"},\n\nWe received your application${recruitmentJobText(jobTitle)}. You can track updates from your candidate dashboard.`;
  return sendEmail({
    to: applicant.email,
    subject,
    text,
    html: recruitmentEmailDocument({
      title: "Application Received",
      bodyHtml: `
        <p style="text-align: center;">Hi <strong>${escapeHtml(applicant.name || "there")}</strong>,</p>
        <p style="text-align: center;">We received your application. You can track updates from your candidate dashboard.</p>
        ${renderInfoCard({
          title: "Application Details",
          rows: [{ label: "Position:", value: jobTitle || "N/A" }],
        })}
      `,
    }),
  });
}

export function sendStageChangeEmail({ applicant, jobTitle, stage }) {
  if (!applicant?.email) return Promise.resolve();
  const subject = `Application stage updated${recruitmentJobText(jobTitle)}`;
  const text = `Hi ${applicant.name || "there"},\n\nYour application${recruitmentJobText(jobTitle)} is now at stage: ${stage}.`;
  return sendEmail({
    to: applicant.email,
    subject,
    text,
    html: recruitmentEmailDocument({
      title: "Application Stage Updated",
      bodyHtml: `
        <p style="text-align: center;">Hi <strong>${escapeHtml(applicant.name || "there")}</strong>,</p>
        <p style="text-align: center;">Your application has moved to a new stage.</p>
        ${renderInfoCard({
          title: "Application Details",
          rows: [
            { label: "Position:", value: jobTitle || "N/A" },
            { label: "Current Stage:", value: stage },
          ],
        })}
      `,
    }),
  });
}

export function sendDocumentIssuedEmail({ applicant, jobTitle, title }) {
  if (!applicant?.email) return Promise.resolve();
  const subject = `New recruitment document${recruitmentJobText(jobTitle)}`;
  const text = `Hi ${applicant.name || "there"},\n\nA document is waiting in your candidate portal: ${title}.`;
  return sendEmail({
    to: applicant.email,
    subject,
    text,
    html: recruitmentEmailDocument({
      title: "New Recruitment Document",
      bodyHtml: `
        <p style="text-align: center;">Hi <strong>${escapeHtml(applicant.name || "there")}</strong>,</p>
        <p style="text-align: center;">A document is waiting for you in your candidate portal.</p>
        ${renderInfoCard({
          title: "Document Details",
          rows: [
            { label: "Position:", value: jobTitle || "N/A" },
            { label: "Document:", value: title },
          ],
        })}
      `,
    }),
  });
}

export function sendInboundDocumentSubmittedEmail({ recipients, applicant, jobTitle, title }) {
  const to = recipients?.map((user) => user.email).filter(Boolean);
  if (!to?.length) return Promise.resolve();
  const subject = `Candidate submitted a document${recruitmentJobText(jobTitle)}`;
  const text = `${applicant?.name || "A candidate"} submitted a document${recruitmentJobText(jobTitle)}: ${title}.`;
  return sendEmail({
    to,
    subject,
    text,
    html: recruitmentEmailDocument({
      title: "Candidate Document Submitted",
      bodyHtml: `
        <p style="text-align: center;"><strong>${escapeHtml(applicant?.name || "A candidate")}</strong> submitted a document.</p>
        ${renderInfoCard({
          title: "Document Details",
          rows: [
            { label: "Candidate:", value: applicant?.name || "N/A" },
            { label: "Position:", value: jobTitle || "N/A" },
            { label: "Document:", value: title },
          ],
        })}
      `,
    }),
  });
}

/**
 * Helper functions for field extraction
 */
function getOvertimeDate(overtimeRequest) {
  return (
    overtimeRequest.overtimeDate ||
    overtimeRequest.date ||
    overtimeRequest.workDate ||
    overtimeRequest.requestDate ||
    overtimeRequest.createdAt ||
    new Date()
  );
}

function getOvertimeHours(overtimeRequest) {
  return (
    overtimeRequest.totalHours ||
    overtimeRequest.hours ||
    overtimeRequest.overtimeHours ||
    0
  );
}

function getOvertimeDescription(overtimeRequest) {
  return (
    overtimeRequest.description ||
    overtimeRequest.taskDescription ||
    overtimeRequest.task ||
    overtimeRequest.reason ||
    overtimeRequest.workDescription ||
    overtimeRequest.notes ||
    "No description provided"
  );
}

/**
 * Send overtime approval email
 */
export async function sendOvertimeApprovedEmail(user, overtimeRequest, { smtpProfile, hrEmail } = {}) {
  const overtimeDate = getOvertimeDate(overtimeRequest);
  const overtimeHours = getOvertimeHours(overtimeRequest);
  const description = getOvertimeDescription(overtimeRequest);

  const formattedDate = new Date(overtimeDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const bodyHtml = `
    <p style="text-align: center;">Hi <strong>${escapeHtml(user.name)}</strong>,</p>
    <p style="text-align: center;">${renderStatusBadge("APPROVED", {
      bg: POSITIVE_COLORS.badgeBg,
    })}</p>
    <p style="text-align: center;">Your overtime request has been approved and the hours have been added to your balance.</p>
    ${renderInfoCard({
      title: "Request Details",
      rows: [
        { label: "Date:", value: formattedDate },
        { label: "Hours:", value: `${overtimeHours} hours` },
        { label: "Task:", value: description },
      ],
    })}
    ${
      process.env.FRONTEND_URL
        ? renderActionButtons([
            renderButton({
              href: `${process.env.FRONTEND_URL}/overtime/history`,
              text: "View Overtime History",
              bg: BRAND_COLORS.primary,
            }),
          ])
        : ""
    }
  `;

  const html = renderEmailDocument({
    title: "Overtime Request Approved",
    headerTitle: "Overtime Request Approved",
    colors: {
      headerBg: POSITIVE_COLORS.headerBg,
      headerBg2: POSITIVE_COLORS.headerBg2,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated notification from the HR system.",
    }),
  });

  return sendEmail({
    to: user.email,
    cc: hrEmail || process.env.HR_EMAIL || "hr@rhayaflicks.com",
    subject: "Overtime Request Approved",
    html: html,
    smtpProfile,
  });
}

/**
 * Send overtime rejection email
 */
export async function sendOvertimeRejectedEmail(user, overtimeRequest, { smtpProfile, hrEmail } = {}) {
  const overtimeDate = getOvertimeDate(overtimeRequest);
  const overtimeHours = getOvertimeHours(overtimeRequest);
  const description = getOvertimeDescription(overtimeRequest);

  const formattedDate = new Date(overtimeDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const bodyHtml = `
    <p style="text-align: center;">Hi <strong>${escapeHtml(user.name)}</strong>,</p>
    <p style="text-align: center;">${renderStatusBadge("NOT APPROVED", {
      bg: "#DC3545",
    })}</p>
    <p style="text-align: center;">Your overtime request has not been approved.</p>
    ${renderInfoCard({
      title: "Request Details",
      titleColor: "#DC3545",
      rows: [
        { label: "Date:", value: formattedDate },
        { label: "Hours:", value: `${overtimeHours} hours` },
        { label: "Task:", value: description },
      ],
    })}
    ${
      overtimeRequest.rejectionReason || overtimeRequest.supervisorComment
        ? renderCalloutBox({
            label: "Reason:",
            bodyHtml: escapeHtml(
              overtimeRequest.rejectionReason ||
                overtimeRequest.supervisorComment,
            ),
            bg: "#FFF3CD",
            border: "#FFE69C",
            textColor: BRAND_COLORS.textPrimary,
            labelColor: BRAND_COLORS.textPrimary,
          })
        : ""
    }
    <p style="text-align: center;">If you have questions, please contact your supervisor.</p>
  `;

  const html = renderEmailDocument({
    title: "Overtime Request Not Approved",
    headerTitle: "Overtime Request Not Approved",
    colors: {
      headerBg: "#DC3545",
      headerBg2: BRAND_COLORS.secondary,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated notification from the HR system.",
    }),
  });

  return sendEmail({
    to: user.email,
    cc: hrEmail || process.env.HR_EMAIL || "hr@rhayaflicks.com",
    subject: "Overtime Request - Not Approved",
    html: html,
    smtpProfile,
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(user, tempPassword) {
  const bodyHtml = `
    <p style="text-align: center;">Hi <strong>${escapeHtml(user.name)}</strong>,</p>
    <p style="text-align: center;">Welcome! Your HR system account has been created.</p>
    ${renderInfoCard({
      title: "Your Login Credentials",
      rows: [
        { label: "Username:", value: user.username, mono: true },
        { label: "Email:", value: user.email, mono: true },
        { label: "Temporary Password:", value: tempPassword, mono: true },
      ],
    })}
    ${renderCalloutBox({
      bodyHtml:
        "<strong>Important:</strong> Please change your password after your first login for security purposes.",
      bg: "#FFF3CD",
      border: "#FFE69C",
      textColor: BRAND_COLORS.textPrimary,
    })}
    ${
      process.env.FRONTEND_URL
        ? renderActionButtons([
            renderButton({
              href: `${process.env.FRONTEND_URL}/login`,
              text: "Login to HR System",
              bg: BRAND_COLORS.primary,
            }),
          ])
        : ""
    }
    <p style="text-align: center; margin-top: 30px;">If you have any questions, please contact the HR department.</p>
  `;

  const html = renderEmailDocument({
    title: "Welcome - HR System Access",
    headerTitle: "Welcome to the Team!",
    colors: {
      headerBg: POSITIVE_COLORS.headerBg,
      headerBg2: POSITIVE_COLORS.headerBg2,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated notification from the HR system.",
    }),
  });

  return sendEmail({
    to: user.email,
    subject: "Welcome - HR System Access",
    html: html,
  });
}

/**
 * Send overtime reminder email (Bahasa Indonesia)
 * For reminding employees about overtime submission deadline
 */
export async function sendOvertimeReminderEmail({
  employeeName,
  employeeEmail,
  recapDate,
  fromDate,
  toDate,
  periodLabel,
  systemUrl,
}) {
  const bodyHtml = `
    <p style="text-align: center;">${renderStatusBadge("OVERTIME REMINDER", {
      bg: BRAND_COLORS.primary,
    })}</p>
    <p>Kepada <strong>${escapeHtml(employeeName)}</strong>,</p>
    <p>Dengan hormat,</p>
    <p>
      Kami informasikan bahwa <strong>hari ini, ${recapDate}</strong>, adalah
      <strong>batas akhir</strong> untuk submit lembur periode payroll bulan ini.
    </p>
    ${renderInfoCard({
      title: "PERIODE LEMBUR",
      rows: [
        { label: "Periode:", value: periodLabel },
        { label: "Dari Tanggal:", value: fromDate },
        { label: "Sampai Tanggal:", value: toDate },
      ],
    })}
    ${renderCalloutBox({
      label: "! CATATAN - ABAIKAN JIKA SUDAH MENGAJUKAN OVERTIME",
      bodyHtml: renderChecklist(
        [
          "Semua lembur dalam periode tersebut <strong>HARUS sudah disubmit hari ini</strong>",
          "Setelah hari ini, submit lembur untuk tanggal-tanggal tersebut akan <strong>DIKUNCI</strong>",
          "Pastikan semua supervisor/atasan sudah <strong>menyetujui lembur Anda</strong>",
          "Lembur yang belum diapprove <strong>tidak akan masuk payroll</strong>",
        ],
        { checkColor: "#856404", glyph: "&#9650;" },
      ),
      bg: "#FFF3CD",
      border: "#FFE69C",
      textColor: BRAND_COLORS.textPrimary,
      labelColor: "#856404",
    })}
    <p style="text-align: center; margin-top: 30px;">
      <strong>Submit lembur Anda sekarang:</strong>
    </p>
    ${renderActionButtons([
      renderButton({
        href: `${systemUrl}/overtime/submit`,
        text: "Submit Lembur Sekarang",
        bg: BRAND_COLORS.primary,
      }),
    ])}
    <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
      Jika Anda sudah submit semua lembur dan sudah diapprove atasan,
      Anda tidak perlu melakukan tindakan apapun.
    </p>
    <p style="margin-top: 20px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
      Jika ada pertanyaan atau kendala, segera hubungi departemen HR.
    </p>
  `;

  const html = renderEmailDocument({
    title: "Batas Akhir Submit Lembur",
    headerTitle: "Batas Akhir Submit Lembur",
    lang: "id",
    colors: {
      headerBg: BRAND_COLORS.primary,
      headerBg2: BRAND_COLORS.secondary,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      signature: "",
      companyName: "PT Rhayakan Film Indonesia",
      note: "Email otomatis dari HR System. Mohon tidak membalas email ini.",
    }),
  });

  const text = `
[OVERTIME REMINDER] Batas Akhir Submit Lembur - ${recapDate}

Kepada ${employeeName},

Dengan hormat,

Kami informasikan bahwa hari ini, ${recapDate}, adalah batas akhir untuk submit lembur periode payroll bulan ini.

PERIODE LEMBUR:
• Periode: ${periodLabel}
• Dari: ${fromDate}
• Sampai: ${toDate}

PENTING:
✓ Semua lembur dalam periode tersebut HARUS sudah disubmit hari ini
✓ Setelah hari ini, submit lembur untuk tanggal-tanggal tersebut akan DIKUNCI
✓ Pastikan semua supervisor sudah menyetujui lembur Anda
✓ Lembur yang belum diapprove tidak akan masuk payroll

Submit lembur Anda sekarang:
${systemUrl}/overtime/submit

Jika sudah submit semua lembur dan sudah diapprove, Anda tidak perlu melakukan tindakan apapun.

Jika ada pertanyaan, hubungi HR.

Terima kasih,
Human Resources Department
PT Rhayakan Film Indonesia
  `;

  return sendEmail({
    to: employeeEmail,
    subject: `[OVERTIME REMINDER] Batas Akhir Submit Lembur - ${recapDate}`,
    html: html,
    text: text,
  });
}

/**
 * Send overtime request notification to approver (SPV/Admin)
 */
export async function sendOvertimeRequestNotification(
  approver,
  overtimeRequest,
  employee,
  { smtpProfile, hrEmail } = {},
) {
  const overtimeHours = getOvertimeHours(overtimeRequest);
  const description = getOvertimeDescription(overtimeRequest);
  const systemUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  // Format all overtime dates from entries
  let overtimeDatesText = "";
  let overtimeDatesRows = [];

  if (overtimeRequest.entries && overtimeRequest.entries.length > 0) {
    const sortedEntries = overtimeRequest.entries.sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    overtimeDatesRows = sortedEntries.map((entry) => ({
      label: `${new Date(entry.date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })}:`,
      value: `<strong>${escapeHtml(entry.hours)} hours</strong> - ${escapeHtml(entry.description)}`,
      raw: true,
    }));

    overtimeDatesText = sortedEntries
      .map(
        (entry) =>
          `• ${new Date(entry.date).toLocaleDateString("en-US", { dateStyle: "medium" })}: ${entry.hours} hours - ${entry.description}`,
      )
      .join("\n");
  }

  const bodyHtml = `
    <p>Dear <strong>${escapeHtml(approver.name)}</strong>,</p>
    <p>You have received a new overtime request that requires your approval:</p>
    <p style="text-align: center;">${renderStatusBadge("PENDING APPROVAL", {
      bg: "#FFC107",
      color: BRAND_COLORS.secondary,
    })}</p>
    ${renderInfoCard({
      title: "Employee Information",
      rows: [
        { label: "Employee:", value: `<strong>${escapeHtml(employee.name)}</strong>`, raw: true },
        { label: "Employee ID:", value: employee.nip || employee.id },
        { label: "Division:", value: employee.division?.name || "N/A" },
        { label: "Role:", value: employee.role?.name || "N/A" },
      ],
    })}
    ${renderInfoCard({
      title: "Overtime Details",
      rows: [
        ...overtimeDatesRows,
        {
          label: "Total Hours:",
          value: `<strong style="color: ${BRAND_COLORS.primary}; font-size: 18px;">${escapeHtml(overtimeHours)} hours</strong>`,
          raw: true,
        },
        {
          label: "Submitted At:",
          value: new Date(
            overtimeRequest.submittedAt || overtimeRequest.createdAt,
          ).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        },
      ],
    })}
    <p style="text-align: center; margin-top: 30px;">
      <strong>Please review and approve this request:</strong>
    </p>
    ${renderActionButtons([
      renderButton({
        href: `${systemUrl}/overtime/approval`,
        text: "Review Request",
        bg: BRAND_COLORS.primary,
      }),
    ])}
    <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary}; text-align: center;">
      Please process this request at your earliest convenience to ensure timely payroll processing.
    </p>
  `;

  const html = renderEmailDocument({
    title: "Overtime Approval Request",
    headerTitle: "Overtime Approval Request",
    headerSubtitle: "New overtime request awaiting your approval",
    colors: {
      headerBg: BRAND_COLORS.primary,
      headerBg2: BRAND_COLORS.secondary,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      signature: "",
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated email from HR System. Please do not reply to this email.",
    }),
  });

  const text = `
New Overtime Approval Request

Dear ${approver.name},

You have received a new overtime request that requires your approval.

EMPLOYEE INFORMATION:
• Employee: ${employee.name}
• Employee ID: ${employee.nip || employee.id}
• Division: ${employee.division?.name || "N/A"}
• Role: ${employee.role?.name || "N/A"}

OVERTIME DETAILS:
${overtimeDatesText}

Total Hours: ${overtimeHours} hours
Submitted: ${new Date(overtimeRequest.submittedAt || overtimeRequest.createdAt).toLocaleString()}

Review this request: ${systemUrl}/overtime/approval

Please process this request at your earliest convenience.

Best regards,
Human Resources Department
PT Rhayakan Film Indonesia
  `;

  return sendEmail({
    to: approver.email,
    cc: hrEmail || process.env.HR_EMAIL || "hr@rhayaflicks.com",
    subject: `[Action Required] Overtime Approval Request from ${employee.name}`,
    html: html,
    text: text,
    smtpProfile,
  });
}

/**
 * Send overtime revision requested notification to employee
 */
export async function sendOvertimeRevisionRequestedEmail(
  employee,
  overtimeRequest,
  revisionComment,
  approverName,
  { smtpProfile, hrEmail } = {},
) {
  const overtimeHours = getOvertimeHours(overtimeRequest);
  const systemUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  // Format all overtime dates from entries
  let overtimeDatesRows = [];
  let overtimeDatesText = "";

  if (overtimeRequest.entries && overtimeRequest.entries.length > 0) {
    const sortedEntries = overtimeRequest.entries.sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    overtimeDatesRows = sortedEntries.map((entry) => ({
      label: `${new Date(entry.date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })}:`,
      value: `${entry.hours} hours - ${entry.description}`,
    }));

    overtimeDatesText = sortedEntries
      .map(
        (entry) =>
          `• ${new Date(entry.date).toLocaleDateString("en-US", { dateStyle: "medium" })}: ${entry.hours} hours`,
      )
      .join("\n");
  }

  const bodyHtml = `
    <p>Dear <strong>${escapeHtml(employee.name)}</strong>,</p>
    <p>Your overtime request has been reviewed and requires revision before it can be approved.</p>
    <p style="text-align: center;">${renderStatusBadge("REVISION REQUESTED", {
      bg: "#FFC107",
      color: BRAND_COLORS.secondary,
    })}</p>
    ${renderInfoCard({
      title: "Request Details",
      rows: [
        ...overtimeDatesRows,
        {
          label: "Total Hours:",
          value: `<strong>${escapeHtml(overtimeHours)} hours</strong>`,
          raw: true,
        },
        { label: "Reviewed By:", value: approverName },
      ],
    })}
    ${renderCalloutBox({
      label: "Reviewer's Comment:",
      bodyHtml: `<span style="font-style: italic;">${escapeHtml(revisionComment)}</span>`,
      bg: "#FFF3CD",
      border: "#FFC107",
      textColor: BRAND_COLORS.textPrimary,
      labelColor: "#856404",
    })}
    <p style="margin-top: 30px;">
      <strong>What to do next:</strong>
    </p>
    <ul style="color: ${BRAND_COLORS.textSecondary}; padding-left: 20px;">
      <li>Review the comment from your approver</li>
      <li>Edit your overtime request with the necessary changes</li>
      <li>Resubmit for approval</li>
    </ul>
    ${renderActionButtons([
      renderButton({
        href: `${systemUrl}/overtime/history`,
        text: "Edit Request Now",
        bg: "#FFC107",
        color: BRAND_COLORS.secondary,
      }),
    ])}
    <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
      If you have any questions about the requested revisions, please contact your supervisor or HR department.
    </p>
  `;

  const html = renderEmailDocument({
    title: "Overtime Revision Requested",
    headerTitle: "Overtime Revision Requested",
    headerSubtitle: "Your overtime request requires revision",
    colors: {
      headerBg: "#FFC107",
      headerBg2: "#FF9800",
      headerTextColor: BRAND_COLORS.secondary,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      signature: "",
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated email from HR System. Please do not reply to this email.",
    }),
  });

  const text = `
Overtime Revision Requested

Dear ${employee.name},

Your overtime request has been reviewed and requires revision before it can be approved.

REQUEST DETAILS:
${overtimeDatesText}
Total Hours: ${overtimeHours} hours
Reviewed By: ${approverName}

REVIEWER'S COMMENT:
${revisionComment}

WHAT TO DO NEXT:
1. Review the comment from your approver
2. Edit your overtime request with the necessary changes
3. Resubmit for approval

Edit your request: ${systemUrl}/overtime/history

If you have any questions, please contact your supervisor or HR.

Best regards,
Human Resources Department
PT Rhayakan Film Indonesia
  `;

  return sendEmail({
    to: employee.email,
    cc: hrEmail || process.env.HR_EMAIL || "hr@rhayaflicks.com",
    subject: `[Action Required] Overtime Revision Requested`,
    html: html,
    text: text,
    smtpProfile,
  });
}

/**
 * Send leave request notification to approver (SPV/Admin)
 */
export async function sendLeaveRequestNotification(
  approver,
  leaveRequest,
  employee,
) {
  const systemUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const formattedStartDate = new Date(
    leaveRequest.startDate,
  ).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedEndDate = new Date(leaveRequest.endDate).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  const bodyHtml = `
    <p>Dear <strong>${escapeHtml(approver.name)}</strong>,</p>
    <p>You have received a new leave request that requires your approval:</p>
    <p style="text-align: center;">${renderStatusBadge("PENDING APPROVAL", {
      bg: "#FFC107",
      color: BRAND_COLORS.secondary,
    })}</p>
    ${renderInfoCard({
      title: "Employee Information",
      rows: [
        { label: "Employee:", value: `<strong>${escapeHtml(employee.name)}</strong>`, raw: true },
        { label: "Employee ID:", value: employee.nip || employee.id },
        { label: "Division:", value: employee.division?.name || "N/A" },
        { label: "Role:", value: employee.role?.name || "N/A" },
      ],
    })}
    ${renderInfoCard({
      title: "Leave Details",
      rows: [
        {
          label: "Leave Type:",
          value: `<strong>${escapeHtml(leaveRequest.leaveType)}</strong>`,
          raw: true,
        },
        { label: "Start Date:", value: formattedStartDate },
        { label: "End Date:", value: formattedEndDate },
        {
          label: "Duration:",
          value: `<strong style="color: ${BRAND_COLORS.primary}; font-size: 18px;">${escapeHtml(leaveRequest.totalDays)} day${leaveRequest.totalDays > 1 ? "s" : ""}</strong>`,
          raw: true,
        },
        {
          label: "Submitted:",
          value: new Date(leaveRequest.createdAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        },
      ],
    })}
    ${renderCalloutBox({
      label: "Reason:",
      bodyHtml: escapeHtml(leaveRequest.reason),
      bg: "#FFF9E6",
      border: "#FFC107",
      textColor: BRAND_COLORS.textPrimary,
      labelColor: BRAND_COLORS.primary,
    })}
    <p style="text-align: center; margin-top: 30px;">
      <strong>Please review and approve this request:</strong>
    </p>
    ${renderActionButtons([
      renderButton({
        href: `${systemUrl}/leave/approval`,
        text: "Review Request",
        bg: BRAND_COLORS.primary,
      }),
    ])}
    <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary}; text-align: center;">
      Please process this request at your earliest convenience.
    </p>
  `;

  const html = renderEmailDocument({
    title: "Leave Approval Request",
    headerTitle: "Leave Approval Request",
    headerSubtitle: "New leave request awaiting your approval",
    colors: {
      headerBg: BRAND_COLORS.primary,
      headerBg2: BRAND_COLORS.secondary,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      signature: "",
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated email from HR System. Please do not reply to this email.",
    }),
  });

  const text = `
New Leave Approval Request

Dear ${approver.name},

You have received a new leave request that requires your approval.

EMPLOYEE INFORMATION:
• Employee: ${employee.name}
• Employee ID: ${employee.nip || employee.id}
• Division: ${employee.division?.name || "N/A"}
• Role: ${employee.role?.name || "N/A"}

LEAVE DETAILS:
• Leave Type: ${leaveRequest.leaveType}
• Start Date: ${formattedStartDate}
• End Date: ${formattedEndDate}
• Duration: ${leaveRequest.totalDays} day${leaveRequest.totalDays > 1 ? "s" : ""}
• Submitted: ${new Date(leaveRequest.createdAt).toLocaleString()}

REASON:
${leaveRequest.reason}

Review this request: ${systemUrl}/leave/approval

Please process this request at your earliest convenience.

Best regards,
Human Resources Department
PT Rhayakan Film Indonesia
  `;

  return sendEmail({
    to: approver.email,
    cc: process.env.HR_EMAIL || "hr@rhayaflicks.com",
    subject: `[Action Required] Leave Approval Request from ${employee.name}`,
    html: html,
    text: text,
  });
}

/**
 * Send leave approved notification to employee
 */
export async function sendLeaveApprovedEmail(
  employee,
  leaveRequest,
  approverName,
) {
  const systemUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const formattedStartDate = new Date(
    leaveRequest.startDate,
  ).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedEndDate = new Date(leaveRequest.endDate).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  const bodyHtml = `
    <p>Dear <strong>${escapeHtml(employee.name)}</strong>,</p>
    <p>Great news! Your leave request has been approved.</p>
    <p style="text-align: center;">${renderStatusBadge("APPROVED", {
      bg: POSITIVE_COLORS.badgeBg,
    })}</p>
    ${renderCalloutBox({
      label: "Enjoy Your Time Off!",
      bodyHtml: "Your leave has been confirmed and processed.",
      bg: "#E8F5E9",
      border: POSITIVE_COLORS.badgeBg,
      textColor: BRAND_COLORS.textSecondary,
      labelColor: POSITIVE_COLORS.badgeBg,
    })}
    ${renderInfoCard({
      title: "Leave Details",
      rows: [
        {
          label: "Leave Type:",
          value: `<strong>${escapeHtml(leaveRequest.leaveType)}</strong>`,
          raw: true,
        },
        { label: "Start Date:", value: formattedStartDate },
        { label: "End Date:", value: formattedEndDate },
        {
          label: "Duration:",
          value: `<strong style="color: ${POSITIVE_COLORS.badgeBg}; font-size: 18px;">${escapeHtml(leaveRequest.totalDays)} day${leaveRequest.totalDays > 1 ? "s" : ""}</strong>`,
          raw: true,
        },
        { label: "Approved By:", value: approverName },
        {
          label: "Approved At:",
          value: new Date(leaveRequest.approvedAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        },
      ],
    })}
    ${renderActionButtons([
      renderButton({
        href: `${systemUrl}/leave/history`,
        text: "View Leave History",
        bg: POSITIVE_COLORS.badgeBg,
      }),
    ])}
    <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
      Have a great time off! If you have any questions, please contact HR.
    </p>
  `;

  const html = renderEmailDocument({
    title: "Leave Request Approved",
    headerTitle: "Leave Request Approved",
    headerSubtitle: "Your leave has been approved!",
    colors: {
      headerBg: POSITIVE_COLORS.badgeBg,
      headerBg2: POSITIVE_COLORS.headerBg2,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      signature: "",
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated email from HR System. Please do not reply to this email.",
    }),
  });

  const text = `
Leave Request Approved

Dear ${employee.name},

Great news! Your leave request has been approved.

LEAVE DETAILS:
• Leave Type: ${leaveRequest.leaveType}
• Start Date: ${formattedStartDate}
• End Date: ${formattedEndDate}
• Duration: ${leaveRequest.totalDays} day${leaveRequest.totalDays > 1 ? "s" : ""}
• Approved By: ${approverName}
• Approved At: ${new Date(leaveRequest.approvedAt).toLocaleString()}

View your leave history: ${systemUrl}/leave/history

Have a great time off!

Best regards,
Human Resources Department
PT Rhayakan Film Indonesia
  `;

  return sendEmail({
    to: employee.email,
    cc: process.env.HR_EMAIL || "hr@rhayaflicks.com",
    subject: `Leave Request Approved - ${leaveRequest.leaveType}`,
    html: html,
    text: text,
  });
}

/**
 * Send leave rejected notification to employee
 */
export async function sendLeaveRejectedEmail(
  employee,
  leaveRequest,
  rejectionReason,
  approverName,
) {
  const systemUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const formattedStartDate = new Date(
    leaveRequest.startDate,
  ).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedEndDate = new Date(leaveRequest.endDate).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  const bodyHtml = `
    <p>Dear <strong>${escapeHtml(employee.name)}</strong>,</p>
    <p>We regret to inform you that your leave request has not been approved.</p>
    <p style="text-align: center;">${renderStatusBadge("NOT APPROVED", {
      bg: "#DC3545",
    })}</p>
    ${renderInfoCard({
      title: "Request Details",
      rows: [
        {
          label: "Leave Type:",
          value: `<strong>${escapeHtml(leaveRequest.leaveType)}</strong>`,
          raw: true,
        },
        { label: "Start Date:", value: formattedStartDate },
        { label: "End Date:", value: formattedEndDate },
        {
          label: "Duration:",
          value: `${leaveRequest.totalDays} day${leaveRequest.totalDays > 1 ? "s" : ""}`,
        },
        { label: "Reviewed By:", value: approverName },
      ],
    })}
    ${renderCalloutBox({
      label: "Reason for Rejection:",
      bodyHtml: `<span style="font-style: italic;">${escapeHtml(rejectionReason)}</span>`,
      bg: "#FFF3CD",
      border: "#DC3545",
      textColor: BRAND_COLORS.textPrimary,
      labelColor: "#856404",
    })}
    <p style="margin-top: 30px;">
      <strong>What to do next:</strong>
    </p>
    <ul style="color: ${BRAND_COLORS.textSecondary}; padding-left: 20px;">
      <li>Review the rejection reason above</li>
      <li>You can submit a new leave request with adjusted dates if needed</li>
      <li>Contact your supervisor or HR if you have questions</li>
    </ul>
    ${renderActionButtons([
      renderButton({
        href: `${systemUrl}/leave/history`,
        text: "View Leave History",
        bg: BRAND_COLORS.primary,
      }),
    ])}
    <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
      If you have any questions or concerns, please contact your supervisor or HR department.
    </p>
  `;

  const html = renderEmailDocument({
    title: "Leave Request Not Approved",
    headerTitle: "Leave Request Not Approved",
    headerSubtitle: "Your leave request has been declined",
    colors: {
      headerBg: "#DC3545",
      headerBg2: "#C82333",
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      signature: "",
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated email from HR System. Please do not reply to this email.",
    }),
  });

  const text = `
Leave Request Not Approved

Dear ${employee.name},

We regret to inform you that your leave request has not been approved.

REQUEST DETAILS:
• Leave Type: ${leaveRequest.leaveType}
• Start Date: ${formattedStartDate}
• End Date: ${formattedEndDate}
• Duration: ${leaveRequest.totalDays} day${leaveRequest.totalDays > 1 ? "s" : ""}
• Reviewed By: ${approverName}

REASON FOR REJECTION:
${rejectionReason}

WHAT TO DO NEXT:
1. Review the rejection reason above
2. You can submit a new leave request with adjusted dates if needed
3. Contact your supervisor or HR if you have questions

View your leave history: ${systemUrl}/leave/history

If you have any questions, please contact your supervisor or HR.

Best regards,
Human Resources Department
PT Rhayakan Film Indonesia
  `;

  return sendEmail({
    to: employee.email,
    cc: process.env.HR_EMAIL || "hr@rhayaflicks.com",
    subject: `Leave Request Not Approved - ${leaveRequest.leaveType}`,
    html: html,
    text: text,
  });
}

/**
 * Send leave reminder H-7 notification - ONE consolidated email
 *
 * TO (Priority Order):
 * 1. Employee's Supervisor (if exists)
 * 2. Division Head (if no supervisor)
 * 3. HR (if no supervisor and no division head)
 *
 * CC:
 * 1. All division members (excluding employee taking leave)
 * 2. All division heads in the company
 * 3. HR (unless HR is already TO)
 *
 * Smart deduplication ensures no one receives duplicate emails
 */
export async function sendLeaveReminderH7Email(
  recipient,
  leaveRequest,
  employee,
  ccList = [],
  daysUntilLeave = 7,
) {
  const systemUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const formattedStartDate = new Date(
    leaveRequest.startDate,
  ).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedEndDate = new Date(leaveRequest.endDate).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  const bodyHtml = `
    <p>Dear <strong>${escapeHtml(recipient.name)}</strong>,</p>
    <p>This is a reminder that <strong>${escapeHtml(employee.name)}</strong> from your division will be on leave starting in ${daysUntilLeave} days.</p>
    <p style="text-align: center;">${renderStatusBadge("UPCOMING LEAVE", {
      bg: "#17A2B8",
    })}</p>
    ${renderInfoCard({
      title: "Employee Information",
      rows: [
        { label: "Employee:", value: `<strong>${escapeHtml(employee.name)}</strong>`, raw: true },
        { label: "Division:", value: employee.division?.name || "N/A" },
        { label: "Role:", value: employee.role?.name || "N/A" },
      ],
    })}
    ${renderInfoCard({
      title: "Leave Details",
      rows: [
        {
          label: "Leave Type:",
          value: `<strong>${escapeHtml(leaveRequest.leaveType)}</strong>`,
          raw: true,
        },
        { label: "Start Date:", value: formattedStartDate },
        { label: "End Date:", value: formattedEndDate },
        {
          label: "Duration:",
          value: `<strong style="color: ${BRAND_COLORS.primary}; font-size: 18px;">${escapeHtml(leaveRequest.totalDays)} day${leaveRequest.totalDays > 1 ? "s" : ""}</strong>`,
          raw: true,
        },
      ],
    })}
    ${renderCalloutBox({
      label: "Action Required",
      bodyHtml: `Please plan accordingly for <strong>${escapeHtml(employee.name)}</strong>'s absence from <strong>${formattedStartDate}</strong> to <strong>${formattedEndDate}</strong>.<br style="margin-top: 10px;" />If you need to reassign tasks or responsibilities, please coordinate with your team in advance.`,
      bg: "#E7F6F8",
      border: "#17A2B8",
      textColor: BRAND_COLORS.textPrimary,
      labelColor: "#17A2B8",
    })}
    <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
      This is an automated reminder sent 7 days before the leave starts. If you have any questions, please contact HR.
    </p>
  `;

  const html = renderEmailDocument({
    title: "Leave Reminder Notice",
    headerTitle: "Leave Reminder Notice",
    headerSubtitle: "Upcoming absence notification for your team",
    colors: {
      headerBg: "#17A2B8",
      headerBg2: "#138496",
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      signature: "",
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated email from HR System. Please do not reply to this email.",
    }),
  });

  const text = `
Leave Reminder Notice

Dear ${recipient.name},

This is a reminder that ${employee.name} from your division will be on leave starting in 7 days.

EMPLOYEE INFORMATION:
• Employee: ${employee.name}
• Employee ID: ${employee.nip || employee.id}
• Division: ${employee.division?.name || "N/A"}
• Role: ${employee.role?.name || "N/A"}

LEAVE DETAILS:
• Leave Type: ${leaveRequest.leaveType}
• Start Date: ${formattedStartDate}
• End Date: ${formattedEndDate}
• Duration: ${leaveRequest.totalDays} day${leaveRequest.totalDays > 1 ? "s" : ""}

ACTION REQUIRED:
Please plan accordingly for ${employee.name}'s absence from ${formattedStartDate} to ${formattedEndDate}.

If you need to reassign tasks or responsibilities, please coordinate with your team in advance.

This is an automated reminder sent 7 days before the leave starts.

Best regards,
Human Resources Department
PT Rhayakan Film Indonesia
  `;

  return sendEmail({
    to: recipient.email,
    cc: ccList.length > 0 ? ccList : undefined, // Only include CC if there are recipients
    subject: `[Reminder] Upcoming Team Leave - ${employee.name} (${formattedStartDate})`,
    html: html,
    text: text,
  });
}

/**
 * Send password reset email with secure token link
 * Add this to your email_service.js file
 */
export async function sendPasswordResetEmail(user, resetToken) {
  const systemUrl = (
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/$/, "");
  const resetUrl = `${systemUrl}/reset-password?token=${resetToken}`;

  // Token expires in 1 hour
  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() + 1);
  const formattedExpiration = expirationTime.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const bodyHtml = `
    <p>Dear <strong>${escapeHtml(user.name)}</strong>,</p>
    <p>We received a request to reset your password for your HR System account. Click the button below to create a new password:</p>
    ${renderActionButtons([
      renderButton({
        href: resetUrl,
        text: "Reset Password",
        bg: BRAND_COLORS.primary,
      }),
    ])}
    ${renderCalloutBox({
      label: "Request Details:",
      bodyHtml: `Email: ${escapeHtml(user.email)}<br/>Time: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}<br/>Expires: ${formattedExpiration}`,
      bg: "#E7F3FF",
      border: BRAND_COLORS.primary,
      textColor: BRAND_COLORS.textPrimary,
    })}
    <p>This link will expire in <strong>1 hour</strong> for security reasons. If you need a new link, you can request another password reset.</p>
    ${renderCalloutBox({
      label: "Security Notice",
      bodyHtml: `<strong>If you didn't request this password reset, please ignore this email.</strong> Your password will remain unchanged and secure.<br/><br/>If you're concerned about your account security, please contact HR immediately.`,
      bg: "#FFF3CD",
      border: "#FFC107",
      textColor: BRAND_COLORS.textPrimary,
      labelColor: "#856404",
    })}
    <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="word-break: break-all; color: ${BRAND_COLORS.textSecondary}; font-size: 12px; margin-top: 15px;">
      ${resetUrl}
    </p>
  `;

  const html = renderEmailDocument({
    title: "Password Reset Request - HR System",
    headerTitle: "Password Reset Request",
    headerSubtitle: "Reset your HR System password",
    colors: {
      headerBg: BRAND_COLORS.primary,
      headerBg2: BRAND_COLORS.secondary,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      signature: "",
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated email from HR System. Please do not reply to this email.",
    }),
  });

  const text = `
Password Reset Request

Dear ${user.name},

We received a request to reset your password for your HR System account.

To reset your password, click the link below or copy it into your browser:
${resetUrl}

Request Details:
• Email: ${user.email}
• Time: ${new Date().toLocaleString()}
• Expires: ${formattedExpiration}

This link will expire in 1 hour for security reasons.

SECURITY NOTICE:
If you didn't request this password reset, please ignore this email.
Your password will remain unchanged and secure.

If you're concerned about your account security, please contact HR immediately.

Best regards,
Human Resources Department
PT Rhayakan Film Indonesia
  `;

  return sendEmail({
    to: user.email,
    subject: "Password Reset Request - HR System",
    html: html,
    text: text,
  });
}

export async function sendApplicantPasswordResetEmail(applicant, resetToken) {
  const recruitmentUrl = (
    process.env.RECRUITMENT_URL || "http://localhost:5176"
  ).replace(/\/$/, "");
  const resetUrl = `${recruitmentUrl}/reset-password?token=${resetToken}`;
  const requestedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() + 1);
  const formattedExpiration = expirationTime.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const bodyHtml = `
    <p>Dear <strong>${escapeHtml(applicant.name)}</strong>,</p>
    <p>We received a request to reset your password for your Rhaya Group Careers account. Click the button below to create a new password:</p>
    ${renderActionButtons([
      renderButton({
        href: resetUrl,
        text: "Reset Password",
        bg: BRAND_COLORS.primary,
      }),
    ])}
    ${renderCalloutBox({
      label: "Request Details:",
      bodyHtml: `Email: ${escapeHtml(applicant.email)}<br/>Time: ${requestedAt}<br/>Expires: ${formattedExpiration}`,
      bg: "#E7F3FF",
      border: BRAND_COLORS.primary,
      textColor: BRAND_COLORS.textPrimary,
    })}
    <p>This link will expire in <strong>1 hour</strong> for security reasons. If you need a new link, you can request another password reset.</p>
    ${renderCalloutBox({
      label: "Security Notice",
      bodyHtml: `<strong>If you didn't request this password reset, please ignore this email.</strong> Your password will remain unchanged and secure.`,
      bg: "#FFF3CD",
      border: "#FFC107",
      textColor: BRAND_COLORS.textPrimary,
      labelColor: "#856404",
    })}
    <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="word-break: break-all; color: ${BRAND_COLORS.textSecondary}; font-size: 12px; margin-top: 15px;">
      ${resetUrl}
    </p>
  `;

  const html = recruitmentEmailDocument({
    title: "Password Reset Request",
    bodyHtml,
  });

  const text = `
Password Reset Request

Dear ${applicant.name},

We received a request to reset your Rhaya Group Careers password.

To reset your password, click the link below or copy it into your browser:
${resetUrl}

Request Details:
Email: ${applicant.email}
Time: ${requestedAt}
Expires: ${formattedExpiration}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email.
  `;

  return sendEmail({
    to: applicant.email,
    subject: "Password Reset Request - Rhaya Group Careers",
    html,
    text,
  });
}

/**
 * Send password changed confirmation email
 * Add this to your email_service.js file
 */
export async function sendPasswordChangedEmail(user) {
  const systemUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const bodyHtml = `
    <p>Dear <strong>${escapeHtml(user.name)}</strong>,</p>
    <p>This email confirms that your HR System password was successfully changed.</p>
    ${renderCalloutBox({
      label: "Change Details:",
      bodyHtml: `Account: ${escapeHtml(user.email)}<br/>Changed: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
      bg: "#E8F5E9",
      border: POSITIVE_COLORS.badgeBg,
      textColor: BRAND_COLORS.textPrimary,
    })}
    ${renderCalloutBox({
      label: "Didn't make this change?",
      bodyHtml: `<strong>If you did not change your password, your account may be compromised.</strong><br/><br/>Please contact HR immediately and change your password again to secure your account.`,
      bg: "#FFF3CD",
      border: "#FFC107",
      textColor: BRAND_COLORS.textPrimary,
      labelColor: "#856404",
    })}
    <p>You can now log in with your new password.</p>
    ${renderActionButtons([
      renderButton({
        href: `${systemUrl}/login`,
        text: "Go to Login",
        bg: POSITIVE_COLORS.badgeBg,
      }),
    ])}
    <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
      If you have any questions, please contact the HR department.
    </p>
  `;

  const html = renderEmailDocument({
    title: "Password Successfully Changed - HR System",
    headerTitle: "Password Successfully Changed",
    headerSubtitle: "Your password has been updated",
    colors: {
      headerBg: POSITIVE_COLORS.badgeBg,
      headerBg2: POSITIVE_COLORS.headerBg2,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      signature: "",
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated email from HR System. Please do not reply to this email.",
    }),
  });

  const text = `
Password Successfully Changed

Dear ${user.name},

This email confirms that your HR System password was successfully changed.

Change Details:
• Account: ${user.email}
• Changed: ${new Date().toLocaleString()}

DIDN'T MAKE THIS CHANGE?
If you did not change your password, your account may be compromised.
Please contact HR immediately and change your password again to secure your account.

You can now log in with your new password at: ${systemUrl}/login

Best regards,
Human Resources Department
PT Rhayakan Film Indonesia
  `;

  return sendEmail({
    to: user.email,
    subject: "Password Successfully Changed - HR System",
    html: html,
    text: text,
  });
}

/**
 * Send payslip available notification to employee
 * Add this to your email_service.js file
 */
export async function sendPayslipNotificationEmail(employee, payslipDetails) {
  const { year, month } = payslipDetails;
  const systemUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const payslipUrl = `${systemUrl}/my-payslips`;

  // Format month name
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthName = monthNames[month - 1];
  const periodText = `${monthName} ${year}`;

  const bodyHtml = `
    <p>Dear <strong>${escapeHtml(employee.name)}</strong>,</p>
    <p>Good news! Your payslip for <strong>${periodText}</strong> has been uploaded to the HR system and is now ready for download.</p>
    ${renderInfoCard({
      title: "Payslip Details",
      rows: [
        { label: "Period:", value: periodText },
        { label: "Employee:", value: employee.name },
        { label: "Status:", value: "Available for Download" },
      ],
    })}
    ${renderActionButtons([
      renderButton({
        href: payslipUrl,
        text: "View My Payslips",
        bg: BRAND_COLORS.primary,
      }),
    ])}
    ${renderCalloutBox({
      bodyHtml: `<strong>Important:</strong> Your payslip contains confidential salary information. Please keep it secure and do not share it with unauthorized persons.`,
      bg: "#FEF3C7",
      border: "#F59E0B",
      textColor: BRAND_COLORS.textPrimary,
    })}
    <p>Questions or discrepancies? Contact the HR department.</p>
  `;

  const html = renderEmailDocument({
    title: "Your Payslip is Ready",
    headerTitle: "Your Payslip is Ready",
    headerSubtitle: `Your salary slip for ${periodText} is now available`,
    colors: {
      headerBg: POSITIVE_COLORS.headerBg,
      headerBg2: POSITIVE_COLORS.headerBg2,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      signature: "",
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated email from HR System. Please do not reply to this email.",
    }),
  });

  const text = `
Your Payslip is Ready

Dear ${employee.name},

Your payslip for ${periodText} has been uploaded to the HR system and is now available for download.

Payslip Details:
- Period: ${periodText}
- Employee: ${employee.name}
- Status: Available for Download

View your payslip: ${payslipUrl}

IMPORTANT: Your payslip contains confidential salary information. Please keep it secure.

Questions or discrepancies? Contact the HR department.

Best regards,
Human Resources Department
PT Rhayakan Film Indonesia
  `;

  return sendEmail({
    to: employee.email,
    subject: `Payslip Available - ${periodText}`,
    html: html,
    text: text,
  });
}

/**
 * Send batch payslip upload notification (for bulk uploads)
 * Use this when uploading multiple payslips at once
 */
export async function sendBatchPayslipNotification(employees, payslipDetails) {
  const { year, month } = payslipDetails;
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const periodText = `${monthNames[month - 1]} ${year}`;

  console.log(
    `[Payslip Notification] Sending batch notification for ${periodText} to ${employees.length} employees`,
  );

  let successCount = 0;
  let failedCount = 0;
  const failedEmails = [];

  for (const employee of employees) {
    try {
      await sendPayslipNotificationEmail(employee, payslipDetails);
      successCount++;
      console.log(`Payslip notification sent to: ${employee.email}`);

      // Don't delay after last email
      await new Promise((resolve) => setTimeout(resolve, 600));
      console.log(`[Rate Limit] Waiting 600ms before next email sent)`);
    } catch (error) {
      failedCount++;
      failedEmails.push(employee.email);
      console.error(
        `❌ Failed to send payslip notification to ${employee.email}:`,
        error.message,
      );
    }
  }

  console.log(
    `[Payslip Notification] Batch complete: ${successCount} sent, ${failedCount} failed`,
  );

  return {
    success: successCount,
    failed: failedCount,
    failedEmails,
  };
}

/**
 * Send leave cancellation notification email
 * @param {Object} employee - Employee who cancelled the leave
 * @param {Object} leaveRequest - Leave request that was cancelled
 * @param {string} cancellationReason - Reason for cancellation
 * @param {Array<string>} ccEmails - List of emails to CC
 */
export async function sendLeaveCancellationEmail(
  employee,
  leaveRequest,
  cancellationReason,
  ccEmails = [],
) {
  const leaveTypeLabels = {
    ANNUAL_LEAVE: "Annual Leave",
    SICK_LEAVE: "Sick Leave",
    MATERNITY_LEAVE: "Maternity Leave",
    MENSTRUAL_LEAVE: "Menstrual Leave",
    MARRIAGE_LEAVE: "Marriage Leave",
    UNPAID_LEAVE: "Unpaid Leave",
  };

  const leaveTypeLabel =
    leaveTypeLabels[leaveRequest.leaveType] || leaveRequest.leaveType;

  const startDate = new Date(leaveRequest.startDate).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  const endDate = new Date(leaveRequest.endDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const bodyHtml = `
    <p>Dear Team,</p>
    <p><strong>${escapeHtml(employee.name)}</strong> has cancelled their previously approved leave request.</p>
    <p style="text-align: center;">${renderStatusBadge("CANCELLED", {
      bg: "#dc2626",
    })}</p>
    ${renderInfoCard({
      title: "Employee Information",
      rows: [
        { label: "Name:", value: employee.name },
        { label: "Division:", value: employee.division?.name || "-" },
        { label: "Role:", value: employee.role?.name || "-" },
      ],
    })}
    ${renderInfoCard({
      title: "Cancelled Leave Details",
      rows: [
        { label: "Leave Type:", value: leaveTypeLabel },
        { label: "Start Date:", value: startDate },
        { label: "End Date:", value: endDate },
        {
          label: "Duration:",
          value: `${leaveRequest.totalDays} ${leaveRequest.totalDays === 1 ? "day" : "days"}`,
        },
        { label: "Original Reason:", value: leaveRequest.reason },
      ],
    })}
    ${
      cancellationReason && cancellationReason !== "No reason provided"
        ? renderCalloutBox({
            label: "Cancellation Reason:",
            bodyHtml: `<span style="font-style: italic;">${escapeHtml(cancellationReason)}</span>`,
            bg: "#FFF7ED",
            border: "#FED7AA",
            textColor: "#78350F",
            labelColor: "#92400E",
          })
        : ""
    }
    ${renderCalloutBox({
      label: "Important Notice",
      bodyHtml: `${
        leaveRequest.leaveType === "ANNUAL_LEAVE"
          ? `The employee's leave balance has been restored (+${leaveRequest.totalDays} days).`
          : "This cancellation has been recorded in the system."
      }<br/><br/>The employee is now expected to be available during the originally scheduled leave dates.`,
      bg: "#FEF3C7",
      border: "#F59E0B",
      textColor: "#78350F",
      labelColor: "#92400E",
    })}
  `;

  const html = renderEmailDocument({
    title: "Leave Cancelled",
    headerTitle: "Leave Cancelled",
    colors: {
      headerBg: "#dc2626",
      headerBg2: "#991b1b",
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated notification from the HR system.",
    }),
  });

  // Use your existing sendEmail function that calls SMTP2go API
  return sendEmail({
    to: process.env.HR_EMAIL || "hr@rhayaflicks.com",
    cc: ccEmails.length > 0 ? ccEmails : undefined,
    subject: `Leave Cancelled: ${employee.name} - ${leaveTypeLabel}`,
    html: html,
  });
}

/**
 * Send admin rejection notification email
 * Notifies employee, supervisor, and HR that admin rejected an approved overtime
 *
 * @param {Object} employee - Employee whose overtime was rejected
 * @param {Object} overtimeRequest - Overtime request that was rejected
 * @param {string} adminReason - Admin's reason for rejection
 * @param {string} adminName - Name of admin who rejected
 * @param {Array<string>} ccEmails - List of emails to CC
 */
export async function sendAdminRejectOvertimeEmail(
  employee,
  overtimeRequest,
  adminReason,
  adminName,
  ccEmails = [],
  { smtpProfile, hrEmail } = {},
) {
  try {
    // Format dates and amounts
    const formattedDates = overtimeRequest.entries
      .map((entry) => {
        return new Date(entry.date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      })
      .join(", ");

    const formattedAmount = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(overtimeRequest.totalAmount);

    // Approval date
    const approvalDate = overtimeRequest.approvedAt
      ? new Date(overtimeRequest.approvedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "N/A";

    const bodyHtml = `
      <p>Dear <strong>${escapeHtml(employee.name)}</strong>,</p>
      <p>Your previously <strong>approved</strong> overtime request has been <strong>rejected by HR Administration</strong>.</p>
      <p style="text-align: center;">${renderStatusBadge("ADMIN OVERRIDE", {
        bg: "#dc2626",
      })}</p>
      ${renderInfoCard({
        title: "Overtime Details",
        rows: [
          { label: "Employee:", value: employee.name },
          { label: "Division:", value: employee.division?.name || "-" },
          { label: "Date(s):", value: formattedDates },
          {
            label: "Hours:",
            value: `${overtimeRequest.totalHours} hours`,
          },
          { label: "Amount:", value: formattedAmount },
          { label: "Originally Approved:", value: approvalDate },
          { label: "Rejected By:", value: `${adminName} (HR Admin)` },
        ],
      })}
      ${renderCalloutBox({
        label: "Admin Rejection Reason:",
        bodyHtml: `<span style="font-style: italic;">"${escapeHtml(adminReason)}"</span>`,
        bg: "#FFF7ED",
        border: "#FED7AA",
        textColor: "#78350F",
        labelColor: "#92400E",
      })}
      ${renderCalloutBox({
        label: "Balance Adjustment",
        bodyHtml: `Your overtime balance has been adjusted: <strong>-${overtimeRequest.totalHours} hours</strong><br/><br/>This overtime will <strong>not</strong> be included in your payroll.`,
        bg: "#FEF3C7",
        border: "#F59E0B",
        textColor: "#78350F",
        labelColor: "#92400E",
      })}
      <p>
        If you believe this rejection is in error or have questions, please contact the HR department.
      </p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>HR Administration</strong>
      </p>
    `;

    const html = renderEmailDocument({
      title: "Overtime Rejected by HR Admin",
      headerTitle: "Overtime Rejected by HR Admin",
      colors: {
        headerBg: "#dc2626",
        headerBg2: "#991b1b",
        primary: BRAND_COLORS.primary,
        secondary: BRAND_COLORS.secondary,
        accent: BRAND_COLORS.accent,
        cardBg: BRAND_COLORS.cardBg,
        cardBorder: BRAND_COLORS.cardBorder,
        textPrimary: BRAND_COLORS.textPrimary,
        textSecondary: BRAND_COLORS.textSecondary,
      },
      bodyHtml,
      footerHtml: renderFooter({
        companyName: "PT Rhayakan Film Indonesia",
        note: "This is an automated notification from the HR system. For questions, please contact HR directly.",
      }),
    });

    // Use existing sendEmail helper (SMTP2go API)
    return sendEmail({
      to: employee.email,
      cc:
        ccEmails.length > 0
          ? ccEmails.filter((e) => e !== employee.email)
          : undefined,
      subject: `Overtime Rejected by HR Admin: ${overtimeRequest.totalHours} hours`,
      html: html,
      smtpProfile,
    });
  } catch (error) {
    console.error("❌ Send admin rejection email error:", error);
    throw error;
  }
}

/**
 * Send email when SPV approves an overtime PLAN (Flow 2A)
 * Notifies employee: "Your plan is approved, go ahead with the overtime"
 *
 * @param {Object} user            - The employee (to recipient)
 * @param {Object} overtimeRequest - The overtime request (must include entries[])
 */
export async function sendOvertimePlanApprovedEmail(user, overtimeRequest, { smtpProfile, hrEmail } = {}) {
  const entries = overtimeRequest.entries || [];
  const totalHours = overtimeRequest.totalHours || 0;
  const submittedAt = new Date(
    overtimeRequest.submittedAt || overtimeRequest.createdAt || new Date(),
  );

  const entryRows = entries.map((e) => {
    const dateStr = new Date(e.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return {
      label: dateStr,
      value: `${e.plannedHours ?? e.hours}h — ${e.description}`,
    };
  });

  const bodyHtml = `
    <p>Hi <strong>${escapeHtml(user.name)}</strong>,</p>
    <p>${renderStatusBadge("PLAN APPROVED", { bg: POSITIVE_COLORS.badgeBg })}</p>
    <p>
      Your supervisor has approved your overtime plan.
      You are cleared to proceed with the planned overtime on the scheduled date(s).
    </p>
    ${renderCalloutBox({
      bodyHtml: `📋 <strong>Next step:</strong> After completing the overtime, please submit your actual hours in the HR system within <strong>7 days</strong>. The system will remind you automatically.`,
      bg: "#EFF6FF",
      border: "#BFDBFE",
      textColor: "#1E40AF",
    })}
    ${renderInfoCard({
      title: `Approved Plan — ${totalHours}h total`,
      rows: entryRows,
    })}
    ${
      process.env.FRONTEND_URL
        ? renderButton({
            href: `${process.env.FRONTEND_URL}/overtime/my-requests`,
            text: "View My Requests",
            bg: "#152A55",
          })
        : ""
    }
  `;

  const html = renderEmailDocument({
    title: "Overtime Plan Approved — Please Actualize After Completion",
    headerTitle: "✅ Overtime Plan Approved",
    headerSubtitle: "Your overtime plan has been approved",
    colors: {
      headerBg: POSITIVE_COLORS.headerBg,
      headerBg2: POSITIVE_COLORS.headerBg2,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated notification from the HR system.",
    }),
  });

  return sendEmail({
    to: user.email,
    cc: hrEmail || process.env.HR_EMAIL || "hr@rhayaflicks.com",
    subject: "Overtime Plan Approved — Please Actualize After Completion",
    html,
    smtpProfile,
  });
}

/**
 * Send email when an overtime plan's date has passed and actualization is needed (Flow 2A)
 * Notifies employee: "Your overtime date passed — please submit actual hours"
 *
 * @param {Object} user            - The employee (to recipient)
 * @param {Object} overtimeRequest - The overtime request (must include entries[])
 */
export async function sendOvertimeActualizationNeededEmail(
  user,
  overtimeRequest,
  { smtpProfile, hrEmail } = {},
) {
  const entries = overtimeRequest.entries || [];
  const totalHours = overtimeRequest.totalHours || 0;

  const entryRows = entries.map((e) => {
    const dateStr = new Date(e.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return {
      label: dateStr,
      value: `Planned: ${e.plannedHours ?? e.hours}h — ${e.description}`,
    };
  });

  // Deadline: 7 days from latest entry date
  const latestDate = entries.reduce((latest, e) => {
    const d = new Date(e.date);
    return d > latest ? d : latest;
  }, new Date(0));

  const deadline = new Date(latestDate);
  deadline.setDate(deadline.getDate() + 7);
  const deadlineStr = deadline.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const bodyHtml = `
    <p>Hi <strong>${escapeHtml(user.name)}</strong>,</p>
    <p>${renderStatusBadge("ACTION NEEDED", { bg: "#7C3AED" })}</p>
    <p>
      Your approved overtime plan has passed. Please log into the HR system
      and submit your <strong>actual hours</strong> worked.
    </p>
    ${renderCalloutBox({
      bodyHtml: `⚠️ <strong>Deadline:</strong> ${deadlineStr}<br>Please actualize before this date to ensure your overtime is counted.`,
      bg: "#FEF3C7",
      border: "#FCD34D",
      textColor: "#92400E",
    })}
    ${renderCalloutBox({
      label: "How to actualize:",
      bodyHtml: `<ol style="margin: 8px 0 0 0; padding-left: 20px;"><li style="margin-bottom: 6px;">Go to <em>Overtime → Needs Actualization</em></li><li style="margin-bottom: 6px;">Find this request and click <em>Actualize</em></li><li style="margin-bottom: 6px;">Enter the actual hours for each date</li><li style="margin-bottom: 6px;">Enter <strong>0</strong> for any date where overtime was cancelled</li><li style="margin-bottom: 6px;">Submit — if actual ≤ planned, it auto-approves</li></ol>`,
      bg: "#F0FDF4",
      border: "#86EFAC",
      textColor: "#166534",
    })}
    ${renderInfoCard({
      title: `Original Plan — ${totalHours}h planned`,
      rows: entryRows,
    })}
    ${
      process.env.FRONTEND_URL
        ? renderButton({
            href: `${process.env.FRONTEND_URL}/overtime/pending-actualization`,
            text: "Actualize Now",
            bg: "#7C3AED",
          })
        : ""
    }
  `;

  const html = renderEmailDocument({
    title: "Actualization Required",
    headerTitle: "⏰ Actualization Required",
    headerSubtitle: "Please submit your actual overtime hours",
    colors: {
      headerBg: "#7C3AED",
      headerBg2: "#152A55",
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated notification from the HR system.",
    }),
  });

  return sendEmail({
    to: user.email,
    cc: hrEmail || process.env.HR_EMAIL || "hr@rhayaflicks.com",
    subject: `Action Required: Actualize Your Overtime by ${deadlineStr}`,
    html,
    smtpProfile,
  });
}

/**
 * Contract expiry reminder — sent to HR (to) with the employee's supervisor
 * CC'd, at H-30/H-14/H-7 and on the day the contract expires.
 *
 * @param {Object} employee          - User record (must include division, supervisor)
 * @param {number} daysUntilExpiry   - 30, 14, 7, or 0 (0 = expires today)
 * @param {Object} [options]
 * @param {string} [options.hrEmail]
 * @param {string} [options.smtpProfile]
 */
export async function sendContractExpiryReminderEmail(
  employee,
  daysUntilExpiry,
  { hrEmail, smtpProfile } = {},
) {
  const isExpired = daysUntilExpiry <= 0;
  const contractEndStr = new Date(employee.contractEndDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statusColor = isExpired ? "#DC2626" : daysUntilExpiry <= 7 ? "#D97706" : BRAND_COLORS.primary;
  const statusColor2 = isExpired ? "#991B1B" : daysUntilExpiry <= 7 ? "#92400E" : BRAND_COLORS.secondary;
  const headline = isExpired ? "Contract Expired" : `Contract Expiring — H-${daysUntilExpiry}`;
  const subject = isExpired
    ? `Contract Expired: ${employee.name}${employee.nip ? ` (${employee.nip})` : ""}`
    : `Contract Expiring in ${daysUntilExpiry} Day${daysUntilExpiry === 1 ? "" : "s"}: ${employee.name}`;

  const bodyHtml = `
    <p style="text-align: center;">${renderStatusBadge(isExpired ? "EXPIRED" : "EXPIRING SOON", {
      bg: statusColor,
    })}</p>
    <p>
      ${
        isExpired
          ? "This employee's contract has <strong>expired</strong>. Please review and take action (renew, extend, or process offboarding)."
          : `This employee's contract is set to expire in <strong>${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}</strong>. Please review and plan for renewal or offboarding.`
      }
    </p>
    ${renderInfoCard({
      title: "Contract Details",
      rows: [
        { label: "Employee", value: employee.name },
        { label: "NIP", value: employee.nip || "N/A" },
        { label: "Division", value: employee.division?.name || "N/A" },
        { label: "Status", value: employee.employeeStatus },
        { label: "Contract End", value: contractEndStr },
      ],
    })}
    ${
      process.env.FRONTEND_URL && employee.id
        ? renderActionButtons([
            renderButton({
              href: `${process.env.FRONTEND_URL}/employees/${employee.id}`,
              text: "View Employee Record",
              bg: BRAND_COLORS.primary,
            }),
          ])
        : ""
    }
  `;

  const html = renderEmailDocument({
    title: headline,
    headerTitle: headline,
    colors: {
      headerBg: statusColor,
      headerBg2: statusColor2,
      primary: BRAND_COLORS.primary,
      secondary: BRAND_COLORS.secondary,
      accent: BRAND_COLORS.accent,
      cardBg: BRAND_COLORS.cardBg,
      cardBorder: BRAND_COLORS.cardBorder,
      textPrimary: BRAND_COLORS.textPrimary,
      textSecondary: BRAND_COLORS.textSecondary,
    },
    bodyHtml,
    footerHtml: renderFooter({
      companyName: "PT Rhayakan Film Indonesia",
      note: "This is an automated notification from the HR system.",
    }),
  });

  return sendEmail({
    to: hrEmail || process.env.HR_EMAIL || "hr@rhayaflicks.com",
    cc: employee.supervisor?.email || undefined,
    subject,
    html,
    smtpProfile,
  });
}

export default {
  sendEmail,
  sendOvertimeApprovedEmail,
  sendOvertimeRejectedEmail,
  sendOvertimeRequestNotification,
  sendOvertimeRevisionRequestedEmail,
  sendLeaveRequestNotification,
  sendLeaveRejectedEmail,
  sendLeaveApprovedEmail,
  sendWelcomeEmail,
  sendOvertimeReminderEmail,
  sendPasswordResetEmail,
  sendApplicantPasswordResetEmail,
  sendPasswordChangedEmail,
  sendPayslipNotificationEmail,
  sendBatchPayslipNotification,
  sendLeaveCancellationEmail,
  sendAdminRejectOvertimeEmail,
  sendOvertimePlanApprovedEmail,
  sendOvertimeActualizationNeededEmail,
  sendContractExpiryReminderEmail,
  sendApplicationConfirmationEmail,
  sendStageChangeEmail,
  sendDocumentIssuedEmail,
  sendInboundDocumentSubmittedEmail,
};

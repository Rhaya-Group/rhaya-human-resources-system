// backend/src/services/email.service.js
// SMTP2go API with Custom Brand Theme (Black, White, #152A55)

import axios from "axios";
import nodemailer from "nodemailer";

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

const transporter = createTransporter();

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
      transporter,
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
      transporter,
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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);
          color: ${BRAND_COLORS.accent};
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .status-badge {
          display: inline-block;
          background: ${BRAND_COLORS.primary};
          color: ${BRAND_COLORS.accent};
          padding: 10px 24px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 0;
        }
        .details-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 30px 0;
          text-align: left;
        }
        .details-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: ${BRAND_COLORS.primary};
          text-align: center;
        }
        .detail-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          min-width: 100px;
          flex-shrink: 0;
        }
        .detail-value {
          color: ${BRAND_COLORS.textSecondary};
          flex: 1;
        }
        .button {
          display: inline-block;
          background: ${BRAND_COLORS.primary};
          color: ${BRAND_COLORS.accent};
          padding: 14px 35px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin-top: 25px;
          transition: all 0.3s ease;
        }
        .button:hover {
          background: ${BRAND_COLORS.secondary};
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-text {
          margin: 5px 0;
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }
        .footer-note {
          font-size: 12px;
          color: #999999;
          margin-top: 15px;
        }

        /* Mobile responsive */
        @media only screen and (max-width: 600px) {
          .email-wrapper {
            padding: 20px 10px;
          }
          .content {
            padding: 30px 20px;
          }
          .details-card {
            padding: 20px 15px;
          }
          .detail-row {
            flex-direction: column;
          }
          .detail-label {
            min-width: auto;
            margin-bottom: 5px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Overtime Request Approved</h1>
          </div>

          <div class="content">
            <p>Hi <strong>${user.name}</strong>,</p>

            <div class="status-badge">
              APPROVED
            </div>

            <p>Your overtime request has been approved and the hours have been added to your balance.</p>

            <div class="details-card">
              <h3>Request Details</h3>

              <div class="detail-row">
                <div class="detail-label">Date:</div>
                <div class="detail-value">${formattedDate}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Hours:</div>
                <div class="detail-value">${overtimeHours} hours</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Task:</div>
                <div class="detail-value">${description}</div>
              </div>
            </div>

            ${
              process.env.FRONTEND_URL
                ? `
              <a href="${process.env.FRONTEND_URL}/overtime/history" class="button">
                View Overtime History
              </a>
            `
                : ""
            }
          </div>

          <div class="footer">
            <div class="footer-signature">HR Team</div>
            <div class="footer-text">Human Resources Department</div>
            <div class="footer-note">This is an automated notification from the HR system.</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #DC3545 0%, ${BRAND_COLORS.secondary} 100%);
          color: ${BRAND_COLORS.accent};
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
        }
        .status-badge {
          display: inline-block;
          background: #DC3545;
          color: white;
          padding: 10px 24px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 0;
        }
        .details-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 30px 0;
          text-align: left;
        }
        .details-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #DC3545;
          text-align: center;
        }
        .detail-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          min-width: 100px;
        }
        .detail-value {
          color: ${BRAND_COLORS.textSecondary};
          flex: 1;
        }
        .reason-box {
          background: #FFF3CD;
          border: 1px solid #FFE69C;
          border-radius: 8px;
          padding: 15px;
          margin-top: 20px;
          text-align: left;
        }
        .reason-box strong {
          color: ${BRAND_COLORS.textPrimary};
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 600px) {
          .detail-row {
            flex-direction: column;
          }
          .detail-label {
            margin-bottom: 5px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Overtime Request Not Approved</h1>
          </div>

          <div class="content">
            <p>Hi <strong>${user.name}</strong>,</p>

            <div class="status-badge">
              NOT APPROVED
            </div>

            <p>Your overtime request has not been approved.</p>

            <div class="details-card">
              <h3>Request Details</h3>

              <div class="detail-row">
                <div class="detail-label">Date:</div>
                <div class="detail-value">${formattedDate}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Hours:</div>
                <div class="detail-value">${overtimeHours} hours</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Task:</div>
                <div class="detail-value">${description}</div>
              </div>

              ${
                overtimeRequest.rejectionReason ||
                overtimeRequest.supervisorComment
                  ? `
                <div class="reason-box">
                  <strong>Reason:</strong><br>
                  ${overtimeRequest.rejectionReason || overtimeRequest.supervisorComment}
                </div>
              `
                  : ""
              }
            </div>

            <p>If you have questions, please contact your supervisor.</p>
          </div>

          <div class="footer">
            <div class="footer-signature">HR Team</div>
            <div class="footer-text">Human Resources Department</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);
          color: ${BRAND_COLORS.accent};
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
        }
        .credentials-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 30px 0;
          text-align: left;
        }
        .credentials-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: ${BRAND_COLORS.primary};
          text-align: center;
        }
        .credential-row {
          padding: 12px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .credential-row:last-child {
          border-bottom: none;
        }
        .credential-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          display: block;
          margin-bottom: 5px;
        }
        .credential-value {
          color: ${BRAND_COLORS.textSecondary};
          font-family: monospace;
          background: white;
          padding: 8px 12px;
          border-radius: 5px;
          display: inline-block;
          font-size: 14px;
        }
        .warning-box {
          background: #FFF3CD;
          border: 1px solid #FFE69C;
          border-radius: 8px;
          padding: 15px;
          margin: 25px 0;
          text-align: left;
        }
        .warning-box strong {
          color: ${BRAND_COLORS.textPrimary};
        }
        .button {
          display: inline-block;
          background: ${BRAND_COLORS.primary};
          color: white;
          padding: 14px 35px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin-top: 25px;
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Welcome to the Team!</h1>
          </div>

          <div class="content">
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>Welcome! Your HR system account has been created.</p>

            <div class="credentials-card">
              <h3>Your Login Credentials</h3>

              <div class="credential-row">
                <div class="credential-label">Username:</div>
                <div class="credential-value">${user.username}</div>
              </div>

              <div class="credential-row">
                <div class="credential-label">Email:</div>
                <div class="credential-value">${user.email}</div>
              </div>

              <div class="credential-row">
                <div class="credential-label">Temporary Password:</div>
                <div class="credential-value">${tempPassword}</div>
              </div>
            </div>

            <div class="warning-box">
              <strong>Important:</strong> Please change your password after your first login for security purposes.
            </div>

            ${
              process.env.FRONTEND_URL
                ? `
              <a href="${process.env.FRONTEND_URL}/login" class="button">
                Login to HR System
              </a>
            `
                : ""
            }

            <p style="margin-top: 30px;">If you have any questions, please contact the HR department.</p>
          </div>

          <div class="footer">
            <div class="footer-signature">HR Team</div>
            <div class="footer-text">Human Resources Department</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);
          color: ${BRAND_COLORS.accent};
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .urgent-badge {
          display: inline-block;
          background: #DC3545;
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.6;
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 20px;
        }
        .info-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 25px 0;
        }
        .info-card h3 {
          margin: 0 0 15px 0;
          font-size: 16px;
          font-weight: 600;
          color: ${BRAND_COLORS.primary};
        }
        .info-row {
          display: flex;
          padding: 10px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          min-width: 120px;
        }
        .info-value {
          color: ${BRAND_COLORS.textSecondary};
          flex: 1;
        }
        .warning-box {
          background: #FFF3CD;
          border: 2px solid #FFE69C;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .warning-box h3 {
          margin: 0 0 10px 0;
          font-size: 15px;
          font-weight: 600;
          color: #856404;
          display: flex;
          align-items: center;
        }
        .warning-icon {
          width: 20px;
          height: 20px;
          background: #FFC107;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 8px;
          font-weight: bold;
          color: ${BRAND_COLORS.secondary};
        }
        .checklist {
          margin: 15px 0;
          padding-left: 0;
          list-style: none;
        }
        .checklist li {
          padding: 8px 0;
          padding-left: 30px;
          position: relative;
        }
        .checklist li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #28A745;
          font-weight: bold;
          font-size: 18px;
        }
        .button {
          display: inline-block;
          background: ${BRAND_COLORS.primary};
          color: white;
          padding: 14px 35px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin-top: 25px;
          text-align: center;
        }
        .button:hover {
          background: ${BRAND_COLORS.secondary};
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper {
            padding: 20px 10px;
          }
          .content {
            padding: 30px 20px;
          }
          .info-card {
            padding: 20px 15px;
          }
          .info-row {
            flex-direction: column;
          }
          .info-label {
            min-width: auto;
            margin-bottom: 5px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <div class="urgent-badge">OVERTIME REMINDER</div>
            <h1>Batas Akhir Submit Lembur</h1>
          </div>

          <div class="content">
            <p class="greeting">Kepada <strong>${employeeName}</strong>,</p>

            <p>Dengan hormat,</p>

            <p>
              Kami informasikan bahwa <strong>hari ini, ${recapDate}</strong>, adalah
              <strong>batas akhir</strong> untuk submit lembur periode payroll bulan ini.
            </p>

            <div class="info-card">
              <h3>PERIODE LEMBUR</h3>

              <div class="info-row">
                <div class="info-label">Periode:</div>
                <div class="info-value">${periodLabel}</div>
              </div>

              <div class="info-row">
                <div class="info-label">Dari Tanggal:</div>
                <div class="info-value">${fromDate}</div>
              </div>

              <div class="info-row">
                <div class="info-label">Sampai Tanggal:</div>
                <div class="info-value">${toDate}</div>
              </div>
            </div>

            <div class="warning-box">
              <h3>
                <span class="warning-icon">!</span>
                CATATAN - ABAIKAN JIKA SUDAH MENGAJUKAN OVERTIME
              </h3>

              <ul class="checklist">
                <li>Semua lembur dalam periode tersebut <strong>HARUS sudah disubmit hari ini</strong></li>
                <li>Setelah hari ini, submit lembur untuk tanggal-tanggal tersebut akan <strong>DIKUNCI</strong></li>
                <li>Pastikan semua supervisor/atasan sudah <strong>menyetujui lembur Anda</strong></li>
                <li>Lembur yang belum diapprove <strong>tidak akan masuk payroll</strong></li>
              </ul>
            </div>

            <p style="text-align: center; margin-top: 30px;">
              <strong>Submit lembur Anda sekarang:</strong>
            </p>

            <p style="text-align: center;">
              <a href="${systemUrl}/overtime/submit" class="button">
                Submit Lembur Sekarang
              </a>
            </p>

            <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
              Jika Anda sudah submit semua lembur dan sudah diapprove atasan,
              Anda tidak perlu melakukan tindakan apapun.
            </p>

            <p style="margin-top: 20px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
              Jika ada pertanyaan atau kendala, segera hubungi departemen HR.
            </p>
          </div>

          <div class="footer">
            <div class="footer-signature">Human Resources Department</div>
            <div>PT Rhayakan Film Indonesia</div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
              Email otomatis dari HR System. Mohon tidak membalas email ini.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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
  let overtimeDatesHtml = "";

  if (overtimeRequest.entries && overtimeRequest.entries.length > 0) {
    const sortedEntries = overtimeRequest.entries.sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    overtimeDatesHtml = sortedEntries
      .map(
        (entry) => `
      <div class="detail-row">
        <div class="detail-label">${new Date(entry.date).toLocaleDateString(
          "en-US",
          {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          },
        )}:</div>
        <div class="detail-value"><strong>${entry.hours} hours</strong> - ${entry.description}</div>
      </div>
    `,
      )
      .join("");

    overtimeDatesText = sortedEntries
      .map(
        (entry) =>
          `• ${new Date(entry.date).toLocaleDateString("en-US", { dateStyle: "medium" })}: ${entry.hours} hours - ${entry.description}`,
      )
      .join("\n");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);
          color: ${BRAND_COLORS.accent};
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .status-badge {
          display: inline-block;
          background: #FFC107;
          color: ${BRAND_COLORS.secondary};
          padding: 10px 24px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 0;
        }
        .employee-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 30px 0;
        }
        .employee-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: ${BRAND_COLORS.primary};
          text-align: center;
        }
        .detail-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          min-width: 140px;
          flex-shrink: 0;
        }
        .detail-value {
          color: ${BRAND_COLORS.textSecondary};
          flex: 1;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 35px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin: 5px;
          transition: all 0.3s ease;
        }
        .button-review {
          background: ${BRAND_COLORS.primary};
          color: white;
        }
        .button-review:hover {
          background: ${BRAND_COLORS.secondary};
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
          .employee-card { padding: 20px 15px; }
          .detail-row { flex-direction: column; }
          .detail-label { min-width: auto; margin-bottom: 5px; }
          .button { display: block; margin: 10px 0; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Overtime Approval Request</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              New overtime request awaiting your approval
            </p>
          </div>

          <div class="content">
            <p>Dear <strong>${approver.name}</strong>,</p>

            <p>You have received a new overtime request that requires your approval:</p>

            <div style="text-align: center;">
              <div class="status-badge">PENDING APPROVAL</div>
            </div>

            <div class="employee-card">
              <h3>Employee Information</h3>

              <div class="detail-row">
                <div class="detail-label">Employee:</div>
                <div class="detail-value"><strong>${employee.name}</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Employee ID:</div>
                <div class="detail-value">${employee.nip || employee.id}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Division:</div>
                <div class="detail-value">${employee.division?.name || "N/A"}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Role:</div>
                <div class="detail-value">${employee.role?.name || "N/A"}</div>
              </div>
            </div>

            <div class="employee-card">
              <h3>Overtime Details</h3>

              ${overtimeDatesHtml}

              <div class="detail-row" style="border-top: 2px solid ${BRAND_COLORS.primary}; margin-top: 15px; padding-top: 15px;">
                <div class="detail-label">Total Hours:</div>
                <div class="detail-value"><strong style="color: ${BRAND_COLORS.primary}; font-size: 18px;">${overtimeHours} hours</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Submitted At:</div>
                <div class="detail-value">${new Date(
                  overtimeRequest.submittedAt || overtimeRequest.createdAt,
                ).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}</div>
              </div>
            </div>

            <p style="text-align: center; margin-top: 30px;">
              <strong>Please review and approve this request:</strong>
            </p>

            <div class="action-buttons">
              <a href="${systemUrl}/overtime/approval" class="button button-review">
                Review Request
              </a>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary}; text-align: center;">
              Please process this request at your earliest convenience to ensure timely payroll processing.
            </p>
          </div>

          <div class="footer">
            <div class="footer-signature">Human Resources Department</div>
            <div>PT Rhayakan Film Indonesia</div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
              This is an automated email from HR System. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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
  let overtimeDatesHtml = "";
  let overtimeDatesText = "";

  if (overtimeRequest.entries && overtimeRequest.entries.length > 0) {
    const sortedEntries = overtimeRequest.entries.sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    overtimeDatesHtml = sortedEntries
      .map(
        (entry) => `
      <div class="detail-row">
        <div class="detail-label">${new Date(entry.date).toLocaleDateString(
          "en-US",
          {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          },
        )}:</div>
        <div class="detail-value">${entry.hours} hours - ${entry.description}</div>
      </div>
    `,
      )
      .join("");

    overtimeDatesText = sortedEntries
      .map(
        (entry) =>
          `• ${new Date(entry.date).toLocaleDateString("en-US", { dateStyle: "medium" })}: ${entry.hours} hours`,
      )
      .join("\n");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
          color: ${BRAND_COLORS.secondary};
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .status-badge {
          display: inline-block;
          background: #FFC107;
          color: ${BRAND_COLORS.secondary};
          padding: 10px 24px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 0;
        }
        .details-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 30px 0;
        }
        .details-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: ${BRAND_COLORS.primary};
          text-align: center;
        }
        .detail-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          min-width: 120px;
          flex-shrink: 0;
        }
        .detail-value {
          color: ${BRAND_COLORS.textSecondary};
          flex: 1;
        }
        .comment-box {
          background: #FFF3CD;
          border-left: 4px solid #FFC107;
          padding: 20px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .comment-box h4 {
          margin: 0 0 10px 0;
          font-size: 16px;
          font-weight: 600;
          color: #856404;
        }
        .comment-text {
          color: ${BRAND_COLORS.textPrimary};
          font-style: italic;
          line-height: 1.6;
        }
        .button {
          display: inline-block;
          background: #FFC107;
          color: ${BRAND_COLORS.secondary};
          padding: 14px 35px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin-top: 25px;
          transition: all 0.3s ease;
        }
        .button:hover {
          background: #FF9800;
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
          .details-card { padding: 20px 15px; }
          .detail-row { flex-direction: column; }
          .detail-label { min-width: auto; margin-bottom: 5px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Overtime Revision Requested</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              Your overtime request requires revision
            </p>
          </div>

          <div class="content">
            <p>Dear <strong>${employee.name}</strong>,</p>

            <p>Your overtime request has been reviewed and requires revision before it can be approved.</p>

            <div style="text-align: center;">
              <div class="status-badge">REVISION REQUESTED</div>
            </div>

            <div class="details-card">
              <h3>Request Details</h3>

              ${overtimeDatesHtml}

              <div class="detail-row" style="border-top: 2px solid ${BRAND_COLORS.primary}; margin-top: 15px; padding-top: 15px;">
                <div class="detail-label">Total Hours:</div>
                <div class="detail-value"><strong>${overtimeHours} hours</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Reviewed By:</div>
                <div class="detail-value">${approverName}</div>
              </div>
            </div>

            <div class="comment-box">
              <h4>Reviewer's Comment:</h4>
              <div class="comment-text">${revisionComment}</div>
            </div>

            <p style="margin-top: 30px;">
              <strong>What to do next:</strong>
            </p>

            <ul style="color: ${BRAND_COLORS.textSecondary}; padding-left: 20px;">
              <li>Review the comment from your approver</li>
              <li>Edit your overtime request with the necessary changes</li>
              <li>Resubmit for approval</li>
            </ul>

            <p style="text-align: center;">
              <a href="${systemUrl}/overtime/history" class="button">
                Edit Request Now
              </a>
            </p>

            <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
              If you have any questions about the requested revisions, please contact your supervisor or HR department.
            </p>
          </div>

          <div class="footer">
            <div class="footer-signature">Human Resources Department</div>
            <div>PT Rhayakan Film Indonesia</div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
              This is an automated email from HR System. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);
          color: ${BRAND_COLORS.accent};
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .status-badge {
          display: inline-block;
          background: #FFC107;
          color: ${BRAND_COLORS.secondary};
          padding: 10px 24px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 0;
        }
        .employee-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 30px 0;
        }
        .employee-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: ${BRAND_COLORS.primary};
          text-align: center;
        }
        .detail-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          min-width: 140px;
          flex-shrink: 0;
        }
        .detail-value {
          color: ${BRAND_COLORS.textSecondary};
          flex: 1;
        }
        .reason-box {
          background: #FFF9E6;
          border-left: 4px solid #FFC107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .reason-box strong {
          color: ${BRAND_COLORS.primary};
          display: block;
          margin-bottom: 8px;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 35px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin: 5px;
          transition: all 0.3s ease;
        }
        .button-review {
          background: ${BRAND_COLORS.primary};
          color: white;
        }
        .button-review:hover {
          background: ${BRAND_COLORS.secondary};
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
          .employee-card { padding: 20px 15px; }
          .detail-row { flex-direction: column; }
          .detail-label { min-width: auto; margin-bottom: 5px; }
          .button { display: block; margin: 10px 0; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Leave Approval Request</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              New leave request awaiting your approval
            </p>
          </div>

          <div class="content">
            <p>Dear <strong>${approver.name}</strong>,</p>

            <p>You have received a new leave request that requires your approval:</p>

            <div style="text-align: center;">
              <div class="status-badge">PENDING APPROVAL</div>
            </div>

            <div class="employee-card">
              <h3>Employee Information</h3>

              <div class="detail-row">
                <div class="detail-label">Employee:</div>
                <div class="detail-value"><strong>${employee.name}</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Employee ID:</div>
                <div class="detail-value">${employee.nip || employee.id}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Division:</div>
                <div class="detail-value">${employee.division?.name || "N/A"}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Role:</div>
                <div class="detail-value">${employee.role?.name || "N/A"}</div>
              </div>
            </div>

            <div class="employee-card">
              <h3>Leave Details</h3>

              <div class="detail-row">
                <div class="detail-label">Leave Type:</div>
                <div class="detail-value"><strong>${leaveRequest.leaveType}</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Start Date:</div>
                <div class="detail-value">${formattedStartDate}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">End Date:</div>
                <div class="detail-value">${formattedEndDate}</div>
              </div>

              <div class="detail-row" style="border-top: 2px solid ${BRAND_COLORS.primary}; margin-top: 15px; padding-top: 15px;">
                <div class="detail-label">Duration:</div>
                <div class="detail-value"><strong style="color: ${BRAND_COLORS.primary}; font-size: 18px;">${leaveRequest.totalDays} day${leaveRequest.totalDays > 1 ? "s" : ""}</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Submitted:</div>
                <div class="detail-value">${new Date(
                  leaveRequest.createdAt,
                ).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}</div>
              </div>
            </div>

            <div class="reason-box">
              <strong>Reason:</strong>
              ${leaveRequest.reason}
            </div>

            <p style="text-align: center; margin-top: 30px;">
              <strong>Please review and approve this request:</strong>
            </p>

            <div class="action-buttons">
              <a href="${systemUrl}/leave/approval" class="button button-review">
                Review Request
              </a>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary}; text-align: center;">
              Please process this request at your earliest convenience.
            </p>
          </div>

          <div class="footer">
            <div class="footer-signature">Human Resources Department</div>
            <div>PT Rhayakan Film Indonesia</div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
              This is an automated email from HR System. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #28A745 0%, #20C997 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .status-badge {
          display: inline-block;
          background: #28A745;
          color: white;
          padding: 10px 24px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 0;
        }
        .details-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 30px 0;
        }
        .details-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: ${BRAND_COLORS.primary};
          text-align: center;
        }
        .detail-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          min-width: 120px;
          flex-shrink: 0;
        }
        .detail-value {
          color: ${BRAND_COLORS.textSecondary};
          flex: 1;
        }
        .celebration-box {
          background: #E8F5E9;
          border: 2px solid #28A745;
          border-radius: 10px;
          padding: 20px;
          margin: 25px 0;
          text-align: center;
        }
        .celebration-box h4 {
          margin: 0 0 10px 0;
          font-size: 18px;
          font-weight: 600;
          color: #28A745;
        }
        .celebration-box p {
          margin: 5px 0;
          color: ${BRAND_COLORS.textSecondary};
        }
        .button {
          display: inline-block;
          background: #28A745;
          color: white;
          padding: 14px 35px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin-top: 25px;
          transition: all 0.3s ease;
        }
        .button:hover {
          background: #218838;
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
          .details-card { padding: 20px 15px; }
          .detail-row { flex-direction: column; }
          .detail-label { min-width: auto; margin-bottom: 5px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Leave Request Approved</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              Your leave has been approved!
            </p>
          </div>

          <div class="content">
            <p>Dear <strong>${employee.name}</strong>,</p>

            <p>Great news! Your leave request has been approved.</p>

            <div style="text-align: center;">
              <div class="status-badge">APPROVED</div>
            </div>

            <div class="celebration-box">
              <h4>Enjoy Your Time Off!</h4>
              <p>Your leave has been confirmed and processed.</p>
            </div>

            <div class="details-card">
              <h3>Leave Details</h3>

              <div class="detail-row">
                <div class="detail-label">Leave Type:</div>
                <div class="detail-value"><strong>${leaveRequest.leaveType}</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Start Date:</div>
                <div class="detail-value">${formattedStartDate}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">End Date:</div>
                <div class="detail-value">${formattedEndDate}</div>
              </div>

              <div class="detail-row" style="border-top: 2px solid #28A745; margin-top: 15px; padding-top: 15px;">
                <div class="detail-label">Duration:</div>
                <div class="detail-value"><strong style="color: #28A745; font-size: 18px;">${leaveRequest.totalDays} day${leaveRequest.totalDays > 1 ? "s" : ""}</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Approved By:</div>
                <div class="detail-value">${approverName}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Approved At:</div>
                <div class="detail-value">${new Date(
                  leaveRequest.approvedAt,
                ).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}</div>
              </div>
            </div>

            <p style="text-align: center;">
              <a href="${systemUrl}/leave/history" class="button">
                View Leave History
              </a>
            </p>

            <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
              Have a great time off! If you have any questions, please contact HR.
            </p>
          </div>

          <div class="footer">
            <div class="footer-signature">Human Resources Department</div>
            <div>PT Rhayakan Film Indonesia</div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
              This is an automated email from HR System. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #DC3545 0%, #C82333 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .status-badge {
          display: inline-block;
          background: #DC3545;
          color: white;
          padding: 10px 24px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 0;
        }
        .details-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 30px 0;
        }
        .details-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: ${BRAND_COLORS.primary};
          text-align: center;
        }
        .detail-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          min-width: 120px;
          flex-shrink: 0;
        }
        .detail-value {
          color: ${BRAND_COLORS.textSecondary};
          flex: 1;
        }
        .rejection-box {
          background: #FFF3CD;
          border-left: 4px solid #DC3545;
          padding: 20px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .rejection-box h4 {
          margin: 0 0 10px 0;
          font-size: 16px;
          font-weight: 600;
          color: #856404;
        }
        .rejection-text {
          color: ${BRAND_COLORS.textPrimary};
          font-style: italic;
          line-height: 1.6;
        }
        .button {
          display: inline-block;
          background: ${BRAND_COLORS.primary};
          color: white;
          padding: 14px 35px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin-top: 25px;
          transition: all 0.3s ease;
        }
        .button:hover {
          background: ${BRAND_COLORS.secondary};
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
          .details-card { padding: 20px 15px; }
          .detail-row { flex-direction: column; }
          .detail-label { min-width: auto; margin-bottom: 5px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Leave Request Not Approved</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              Your leave request has been declined
            </p>
          </div>

          <div class="content">
            <p>Dear <strong>${employee.name}</strong>,</p>

            <p>We regret to inform you that your leave request has not been approved.</p>

            <div style="text-align: center;">
              <div class="status-badge">NOT APPROVED</div>
            </div>

            <div class="details-card">
              <h3>Request Details</h3>

              <div class="detail-row">
                <div class="detail-label">Leave Type:</div>
                <div class="detail-value"><strong>${leaveRequest.leaveType}</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Start Date:</div>
                <div class="detail-value">${formattedStartDate}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">End Date:</div>
                <div class="detail-value">${formattedEndDate}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Duration:</div>
                <div class="detail-value">${leaveRequest.totalDays} day${leaveRequest.totalDays > 1 ? "s" : ""}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Reviewed By:</div>
                <div class="detail-value">${approverName}</div>
              </div>
            </div>

            <div class="rejection-box">
              <h4>Reason for Rejection:</h4>
              <div class="rejection-text">${rejectionReason}</div>
            </div>

            <p style="margin-top: 30px;">
              <strong>What to do next:</strong>
            </p>

            <ul style="color: ${BRAND_COLORS.textSecondary}; padding-left: 20px;">
              <li>Review the rejection reason above</li>
              <li>You can submit a new leave request with adjusted dates if needed</li>
              <li>Contact your supervisor or HR if you have questions</li>
            </ul>

            <p style="text-align: center;">
              <a href="${systemUrl}/leave/history" class="button">
                View Leave History
              </a>
            </p>

            <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
              If you have any questions or concerns, please contact your supervisor or HR department.
            </p>
          </div>

          <div class="footer">
            <div class="footer-signature">Human Resources Department</div>
            <div>PT Rhayakan Film Indonesia</div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
              This is an automated email from HR System. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #17A2B8 0%, #138496 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .info-badge {
          display: inline-block;
          background: #17A2B8;
          color: white;
          padding: 10px 24px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 0;
        }
        .employee-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 30px 0;
        }
        .employee-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: ${BRAND_COLORS.primary};
          text-align: center;
        }
        .detail-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          min-width: 140px;
          flex-shrink: 0;
        }
        .detail-value {
          color: ${BRAND_COLORS.textSecondary};
          flex: 1;
        }
        .highlight-box {
          background: #E7F6F8;
          border-left: 4px solid #17A2B8;
          padding: 20px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .highlight-box h4 {
          margin: 0 0 10px 0;
          font-size: 16px;
          font-weight: 600;
          color: #17A2B8;
        }
        .highlight-box p {
          margin: 5px 0;
          color: ${BRAND_COLORS.textPrimary};
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
          .employee-card { padding: 20px 15px; }
          .detail-row { flex-direction: column; }
          .detail-label { min-width: auto; margin-bottom: 5px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Leave Reminder Notice</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              Upcoming absence notification for your team
            </p>
          </div>

          <div class="content">
            <p>Dear <strong>${recipient.name}</strong>,</p>

            <p>This is a reminder that <strong>${employee.name}</strong> from your division will be on leave starting in ${daysUntilLeave} days.</p>

            <div style="text-align: center;">
              <div class="info-badge">UPCOMING LEAVE</div>
            </div>

            <div class="employee-card">
              <h3>Employee Information</h3>

              <div class="detail-row">
                <div class="detail-label">Employee:</div>
                <div class="detail-value"><strong>${employee.name}</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Division:</div>
                <div class="detail-value">${employee.division?.name || "N/A"}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Role:</div>
                <div class="detail-value">${employee.role?.name || "N/A"}</div>
              </div>
            </div>

            <div class="employee-card">
              <h3>Leave Details</h3>

              <div class="detail-row">
                <div class="detail-label">Leave Type:</div>
                <div class="detail-value"><strong>${leaveRequest.leaveType}</strong></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Start Date:</div>
                <div class="detail-value">${formattedStartDate}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">End Date:</div>
                <div class="detail-value">${formattedEndDate}</div>
              </div>

              <div class="detail-row" style="border-top: 2px solid ${BRAND_COLORS.primary}; margin-top: 15px; padding-top: 15px;">
                <div class="detail-label">Duration:</div>
                <div class="detail-value"><strong style="color: ${BRAND_COLORS.primary}; font-size: 18px;">${leaveRequest.totalDays} day${leaveRequest.totalDays > 1 ? "s" : ""}</strong></div>
              </div>
            </div>

            <div class="highlight-box">
              <h4>Action Required</h4>
              <p>Please plan accordingly for <strong>${employee.name}</strong>'s absence from <strong>${formattedStartDate}</strong> to <strong>${formattedEndDate}</strong>.</p>
              <p style="margin-top: 10px;">If you need to reassign tasks or responsibilities, please coordinate with your team in advance.</p>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
              This is an automated reminder sent 7 days before the leave starts. If you have any questions, please contact HR.
            </p>
          </div>

          <div class="footer">
            <div class="footer-signature">Human Resources Department</div>
            <div>PT Rhayakan Film Indonesia</div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
              This is an automated email from HR System. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .info-box {
          background: #E7F3FF;
          border-left: 4px solid ${BRAND_COLORS.primary};
          padding: 20px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .info-box p {
          margin: 5px 0;
          color: ${BRAND_COLORS.textPrimary};
        }
        .button {
          display: inline-block;
          background: ${BRAND_COLORS.primary};
          color: white;
          padding: 16px 40px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          transition: all 0.3s ease;
        }
        .button:hover {
          background: ${BRAND_COLORS.secondary};
        }
        .security-warning {
          background: #FFF3CD;
          border-left: 4px solid #FFC107;
          padding: 20px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .security-warning h4 {
          margin: 0 0 10px 0;
          font-size: 16px;
          font-weight: 600;
          color: #856404;
        }
        .security-warning p {
          margin: 5px 0;
          color: ${BRAND_COLORS.textPrimary};
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }
        .link-text {
          word-break: break-all;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 12px;
          margin-top: 15px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
          .button { display: block; width: 100%; text-align: center; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              Reset your HR System password
            </p>
          </div>

          <div class="content">
            <p>Dear <strong>${user.name}</strong>,</p>

            <p>We received a request to reset your password for your HR System account. Click the button below to create a new password:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="button">
                Reset Password
              </a>
            </div>

            <div class="info-box">
              <p><strong>Request Details:</strong></p>
              <p>Email: ${user.email}</p>
              <p>Time: ${new Date().toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
              <p>Expires: ${formattedExpiration}</p>
            </div>

            <p>This link will expire in <strong>1 hour</strong> for security reasons. If you need a new link, you can request another password reset.</p>

            <div class="security-warning">
              <h4>Security Notice</h4>
              <p><strong>If you didn't request this password reset, please ignore this email.</strong> Your password will remain unchanged and secure.</p>
              <p style="margin-top: 10px;">If you're concerned about your account security, please contact HR immediately.</p>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <div class="link-text">
              ${resetUrl}
            </div>
          </div>

          <div class="footer">
            <div class="footer-signature">Human Resources Department</div>
            <div>PT Rhayakan Film Indonesia</div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
              This is an automated email from HR System. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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

/**
 * Send password changed confirmation email
 * Add this to your email_service.js file
 */
export async function sendPasswordChangedEmail(user) {
  const systemUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #28A745 0%, #20C997 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .success-box {
          background: #E8F5E9;
          border-left: 4px solid #28A745;
          padding: 20px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .success-box p {
          margin: 5px 0;
          color: ${BRAND_COLORS.textPrimary};
        }
        .warning-box {
          background: #FFF3CD;
          border-left: 4px solid #FFC107;
          padding: 20px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .warning-box h4 {
          margin: 0 0 10px 0;
          font-size: 16px;
          font-weight: 600;
          color: #856404;
        }
        .warning-box p {
          margin: 5px 0;
          color: ${BRAND_COLORS.textPrimary};
        }
        .button {
          display: inline-block;
          background: #28A745;
          color: white;
          padding: 14px 35px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin-top: 20px;
          transition: all 0.3s ease;
        }
        .button:hover {
          background: #218838;
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Password Successfully Changed</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              Your password has been updated
            </p>
          </div>

          <div class="content">
            <p>Dear <strong>${user.name}</strong>,</p>

            <p>This email confirms that your HR System password was successfully changed.</p>

            <div class="success-box">
              <p><strong>Change Details:</strong></p>
              <p>Account: ${user.email}</p>
              <p>Changed: ${new Date().toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
            </div>

            <div class="warning-box">
              <h4>Didn't make this change?</h4>
              <p><strong>If you did not change your password, your account may be compromised.</strong></p>
              <p style="margin-top: 10px;">Please contact HR immediately and change your password again to secure your account.</p>
            </div>

            <p>You can now log in with your new password.</p>

            <div style="text-align: center;">
              <a href="${systemUrl}/login" class="button">
                Go to Login
              </a>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
              If you have any questions, please contact the HR department.
            </p>
          </div>

          <div class="footer">
            <div class="footer-signature">Human Resources Department</div>
            <div>PT Rhayakan Film Indonesia</div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
              This is an automated email from HR System. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .highlight-box {
          background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%);
          border-left: 4px solid #10B981;
          padding: 20px;
          margin: 25px 0;
          border-radius: 8px;
        }
        .highlight-box h2 {
          margin: 0 0 10px 0;
          font-size: 20px;
          font-weight: 600;
          color: #065F46;
        }
        .highlight-box p {
          margin: 5px 0;
          font-size: 16px;
          color: ${BRAND_COLORS.textPrimary};
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 25px 0;
        }
        .info-item {
          background: ${BRAND_COLORS.cardBg};
          padding: 15px;
          border-radius: 8px;
          border: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .info-label {
          font-size: 13px;
          color: ${BRAND_COLORS.textSecondary};
          margin-bottom: 5px;
        }
        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
        }
        .button {
          display: inline-block;
          background: #10B981;
          color: white;
          padding: 16px 40px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          transition: all 0.3s ease;
        }
        .button:hover {
          background: #059669;
        }
        .instructions {
          background: #EFF6FF;
          border-left: 4px solid #3B82F6;
          padding: 20px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .instructions h4 {
          margin: 0 0 10px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1E40AF;
        }
        .instructions ol {
          margin: 10px 0;
          padding-left: 20px;
        }
        .instructions li {
          margin: 8px 0;
          color: ${BRAND_COLORS.textPrimary};
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }
        .security-note {
          background: #FEF3C7;
          border-left: 4px solid #F59E0B;
          padding: 15px;
          margin: 25px 0;
          border-radius: 4px;
          font-size: 14px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
          .info-grid { grid-template-columns: 1fr; }
          .button { display: block; width: 100%; text-align: center; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Your Payslip is Ready</h1>
            <p>Your salary slip for ${periodText} is now available</p>
          </div>

          <div class="content">
            <p>Dear <strong>${employee.name}</strong>,</p>

            <p>Good news! Your payslip for <strong>${periodText}</strong> has been uploaded to the HR system and is now ready for download.</p>

            <div class="highlight-box">
              <h2>Payslip Details</h2>
              <p><strong>Period:</strong> ${periodText}</p>
              <p><strong>Employee:</strong> ${employee.name}</p>
              <p><strong>Status:</strong> Available for Download</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${payslipUrl}" class="button">
                View My Payslips
              </a>
            </div>

            <div class="instructions">
              <h4>How to Access Your Payslip:</h4>
              <ol>
                <li>Click the "View My Payslips" button above or log in to the HR system</li>
                <li>Navigate to "My Payslips" section</li>
                <li>Find the payslip for ${periodText}</li>
                <li>Click "Download PDF" to save your payslip</li>
              </ol>
            </div>

            <div class="security-note">
              <strong>Important:</strong> Your payslip contains confidential salary information. Please keep it secure and do not share it with unauthorized persons.
            </div>

            <p>If you have any questions about your payslip or notice any discrepancies, please contact the HR department immediately.</p>

            <p style="margin-top: 30px; font-size: 14px; color: ${BRAND_COLORS.textSecondary};">
              Direct link to payslips page:<br>
              <a href="${payslipUrl}" style="color: #10B981;">${payslipUrl}</a>
            </p>
          </div>

          <div class="footer">
            <div class="footer-signature">Human Resources Department</div>
            <div>PT Rhayakan Film Indonesia</div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
              This is an automated email from HR System. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Your Payslip is Ready

Dear ${employee.name},

Your payslip for ${periodText} has been uploaded to the HR system and is now available for download.

Payslip Details:
- Period: ${periodText}
- Employee: ${employee.name}
- Status: Available for Download

How to Access Your Payslip:
1. Log in to the HR system at: ${systemUrl}
2. Navigate to "My Payslips" section
3. Find the payslip for ${periodText}
4. Click "Download PDF" to save your payslip

Direct link: ${payslipUrl}

IMPORTANT: Your payslip contains confidential salary information. Please keep it secure.

If you have any questions about your payslip or notice any discrepancies, please contact the HR department immediately.

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: ${BRAND_COLORS.textPrimary};
          margin: 0;
          padding: 0;
          background-color: #F9F9F9;
        }
        .email-wrapper {
          width: 100%;
          background-color: #F9F9F9;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: ${BRAND_COLORS.accent};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: ${BRAND_COLORS.accent};
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.8;
        }
        .status-badge {
          display: inline-block;
          background: #dc2626;
          color: ${BRAND_COLORS.accent};
          padding: 10px 24px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 0;
        }
        .details-card {
          background: ${BRAND_COLORS.cardBg};
          border: 1px solid ${BRAND_COLORS.cardBorder};
          border-radius: 10px;
          padding: 25px;
          margin: 30px 0;
        }
        .details-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: ${BRAND_COLORS.primary};
          text-align: center;
        }
        .detail-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          min-width: 140px;
          flex-shrink: 0;
        }
        .detail-value {
          color: ${BRAND_COLORS.textSecondary};
          flex: 1;
        }
        .alert-box {
          background: #FEF3C7;
          border-left: 4px solid #F59E0B;
          padding: 20px;
          margin: 25px 0;
          border-radius: 8px;
        }
        .alert-box strong {
          color: #92400E;
          display: block;
          margin-bottom: 8px;
        }
        .alert-box p {
          margin: 0;
          color: #78350F;
          font-size: 15px;
        }
        .reason-box {
          background: #FFF7ED;
          border: 1px solid #FED7AA;
          padding: 20px;
          margin: 25px 0;
          border-radius: 8px;
        }
        .reason-box h4 {
          margin: 0 0 10px 0;
          color: #92400E;
          font-size: 16px;
        }
        .reason-text {
          color: #78350F;
          font-style: italic;
          margin: 0;
        }
        .footer {
          padding: 30px;
          background: ${BRAND_COLORS.cardBg};
          text-align: center;
          color: ${BRAND_COLORS.textSecondary};
          font-size: 14px;
          border-top: 1px solid ${BRAND_COLORS.cardBorder};
        }
        .footer-text {
          margin: 5px 0;
        }
        .footer-signature {
          font-weight: 600;
          color: ${BRAND_COLORS.textPrimary};
          margin-bottom: 10px;
        }
        .footer-note {
          font-size: 12px;
          color: #999999;
          margin-top: 15px;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper {
            padding: 20px 10px;
          }
          .content {
            padding: 30px 20px;
          }
          .details-card {
            padding: 20px 15px;
          }
          .detail-row {
            flex-direction: column;
          }
          .detail-label {
            min-width: auto;
            margin-bottom: 5px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>Leave Cancelled</h1>
          </div>

          <div class="content">
            <p>Dear Team,</p>

            <p><strong>${employee.name}</strong> has cancelled their previously approved leave request.</p>

            <div style="text-align: center;">
              <div class="status-badge">CANCELLED</div>
            </div>

            <div class="details-card">
              <h3>Employee Information</h3>

              <div class="detail-row">
                <div class="detail-label">Name:</div>
                <div class="detail-value">${employee.name}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Division:</div>
                <div class="detail-value">${employee.division?.name || "-"}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Role:</div>
                <div class="detail-value">${employee.role?.name || "-"}</div>
              </div>
            </div>

            <div class="details-card">
              <h3>Cancelled Leave Details</h3>

              <div class="detail-row">
                <div class="detail-label">Leave Type:</div>
                <div class="detail-value">${leaveTypeLabel}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Start Date:</div>
                <div class="detail-value">${startDate}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">End Date:</div>
                <div class="detail-value">${endDate}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Duration:</div>
                <div class="detail-value">${leaveRequest.totalDays} ${leaveRequest.totalDays === 1 ? "day" : "days"}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">Original Reason:</div>
                <div class="detail-value">${leaveRequest.reason}</div>
              </div>
            </div>

            ${
              cancellationReason && cancellationReason !== "No reason provided"
                ? `
              <div class="reason-box">
                <h4>Cancellation Reason:</h4>
                <p class="reason-text">${cancellationReason}</p>
              </div>
            `
                : ""
            }

            <div class="alert-box">
              <strong>Important Notice</strong>
              <p>
                ${
                  leaveRequest.leaveType === "ANNUAL_LEAVE"
                    ? `The employee's leave balance has been restored (+${leaveRequest.totalDays} days).`
                    : "This cancellation has been recorded in the system."
                }
              </p>
              <p style="margin-top: 10px;">
                The employee is now expected to be available during the originally scheduled leave dates.
              </p>
            </div>
          </div>

          <div class="footer">
            <div class="footer-signature">HR Team</div>
            <div class="footer-text">Human Resources Department</div>
            <div class="footer-note">This is an automated notification from the HR system.</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: ${BRAND_COLORS.textPrimary};
            margin: 0;
            padding: 0;
            background-color: #F9F9F9;
          }
          .email-wrapper {
            width: 100%;
            background-color: #F9F9F9;
            padding: 40px 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: ${BRAND_COLORS.accent};
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
            color: ${BRAND_COLORS.accent};
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
            letter-spacing: -0.5px;
          }
          .content {
            padding: 40px 30px;
          }
          .content p {
            margin: 0 0 20px 0;
            font-size: 16px;
            line-height: 1.8;
          }
          .status-badge {
            display: inline-block;
            background: #dc2626;
            color: ${BRAND_COLORS.accent};
            padding: 10px 24px;
            border-radius: 25px;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 20px 0;
          }
          .details-card {
            background: ${BRAND_COLORS.cardBg};
            border: 1px solid ${BRAND_COLORS.cardBorder};
            border-radius: 10px;
            padding: 25px;
            margin: 30px 0;
          }
          .details-card h3 {
            margin: 0 0 20px 0;
            font-size: 18px;
            font-weight: 600;
            color: ${BRAND_COLORS.primary};
            text-align: center;
          }
          .detail-row {
            display: flex;
            padding: 12px 0;
            border-bottom: 1px solid ${BRAND_COLORS.cardBorder};
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: ${BRAND_COLORS.textPrimary};
            min-width: 140px;
            flex-shrink: 0;
          }
          .detail-value {
            color: ${BRAND_COLORS.textSecondary};
            flex: 1;
          }
          .alert-box {
            background: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
          }
          .alert-box strong {
            color: #92400E;
            display: block;
            margin-bottom: 8px;
          }
          .alert-box p {
            margin: 0;
            color: #78350F;
            font-size: 15px;
          }
          .reason-box {
            background: #FFF7ED;
            border: 2px solid #FED7AA;
            padding: 20px;
            margin: 25px 0;
            border-radius: 10px;
          }
          .reason-box h4 {
            margin: 0 0 10px 0;
            color: #92400E;
            font-size: 16px;
            font-weight: 700;
          }
          .reason-text {
            color: #78350F;
            font-style: italic;
            margin: 0;
            line-height: 1.6;
          }
          .footer {
            padding: 30px;
            background: ${BRAND_COLORS.cardBg};
            text-align: center;
            color: ${BRAND_COLORS.textSecondary};
            font-size: 14px;
            border-top: 1px solid ${BRAND_COLORS.cardBorder};
          }
          .footer-text {
            margin: 5px 0;
          }
          .footer-signature {
            font-weight: 600;
            color: ${BRAND_COLORS.textPrimary};
            margin-bottom: 10px;
          }
          .footer-note {
            font-size: 12px;
            color: #999999;
            margin-top: 15px;
          }

          @media only screen and (max-width: 600px) {
            .email-wrapper {
              padding: 20px 10px;
            }
            .content {
              padding: 30px 20px;
            }
            .details-card {
              padding: 20px 15px;
            }
            .detail-row {
              flex-direction: column;
            }
            .detail-label {
              min-width: auto;
              margin-bottom: 5px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <h1>Overtime Rejected by HR Admin</h1>
            </div>

            <div class="content">
              <p>Dear <strong>${employee.name}</strong>,</p>

              <p>Your previously <strong>approved</strong> overtime request has been <strong>rejected by HR Administration</strong>.</p>

              <div style="text-align: center;">
                <div class="status-badge">ADMIN OVERRIDE</div>
              </div>

              <div class="details-card">
                <h3>Overtime Details</h3>

                <div class="detail-row">
                  <div class="detail-label">Employee:</div>
                  <div class="detail-value">${employee.name}</div>
                </div>

                <div class="detail-row">
                  <div class="detail-label">Division:</div>
                  <div class="detail-value">${employee.division?.name || "-"}</div>
                </div>

                <div class="detail-row">
                  <div class="detail-label">Date(s):</div>
                  <div class="detail-value">${formattedDates}</div>
                </div>

                <div class="detail-row">
                  <div class="detail-label">Hours:</div>
                  <div class="detail-value">${overtimeRequest.totalHours} hours</div>
                </div>

                <div class="detail-row">
                  <div class="detail-label">Amount:</div>
                  <div class="detail-value">${formattedAmount}</div>
                </div>

                <div class="detail-row">
                  <div class="detail-label">Originally Approved:</div>
                  <div class="detail-value">${approvalDate}</div>
                </div>

                <div class="detail-row">
                  <div class="detail-label">Rejected By:</div>
                  <div class="detail-value">${adminName} (HR Admin)</div>
                </div>
              </div>

              <div class="reason-box">
                <h4>Admin Rejection Reason:</h4>
                <p class="reason-text">"${adminReason}"</p>
              </div>

              <div class="alert-box">
                <strong>Balance Adjustment</strong>
                <p>
                  Your overtime balance has been adjusted: <strong>-${overtimeRequest.totalHours} hours</strong>
                </p>
                <p style="margin-top: 10px;">
                  This overtime will <strong>not</strong> be included in your payroll.
                </p>
              </div>

              <p>
                If you believe this rejection is in error or have questions, please contact the HR department.
              </p>

              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>HR Administration</strong>
              </p>
            </div>

            <div class="footer">
              <div class="footer-signature">HR Team</div>
              <div class="footer-text">Human Resources Department</div>
              <div class="footer-text">PT Rhaya Flicks Indonesia</div>
              <div class="footer-note">This is an automated notification from the HR system. For questions, please contact HR directly.</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

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

  const entryRows = entries
    .map((e) => {
      const dateStr = new Date(e.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return `
        <div class="detail-row">
          <div class="detail-label">${dateStr}</div>
          <div class="detail-value">${e.plannedHours ?? e.hours}h — ${e.description}</div>
        </div>`;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; margin: 0; padding: 0; background-color: #F9F9F9; }
        .email-wrapper { width: 100%; background-color: #F9F9F9; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #152A55 0%, #000000 100%); color: #FFFFFF; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 26px; font-weight: 600; }
        .header p  { margin: 8px 0 0 0; font-size: 14px; opacity: 0.8; }
        .content { padding: 40px 30px; }
        .content p { margin: 0 0 20px 0; font-size: 16px; line-height: 1.8; }
        .status-badge { display: inline-block; background: #152A55; color: #FFFFFF; padding: 10px 24px; border-radius: 25px; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 16px 0; }
        .info-box { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 16px 20px; margin: 20px 0; font-size: 14px; color: #1E40AF; }
        .details-card { background: #F5F5F5; border: 1px solid #E0E0E0; border-radius: 10px; padding: 25px; margin: 24px 0; }
        .details-card h3 { margin: 0 0 18px 0; font-size: 16px; font-weight: 600; color: #152A55; }
        .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #E0E0E0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: 600; color: #000000; min-width: 160px; flex-shrink: 0; }
        .detail-value { color: #666666; flex: 1; }
        .button { display: inline-block; background: #152A55; color: #FFFFFF; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 20px; }
        .footer { padding: 30px; background: #F5F5F5; text-align: center; color: #666666; font-size: 14px; border-top: 1px solid #E0E0E0; }
        .footer-signature { font-weight: 600; color: #000000; margin-bottom: 6px; }
        .footer-note { font-size: 12px; color: #999999; margin-top: 12px; }
        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
          .detail-row { flex-direction: column; }
          .detail-label { min-width: auto; margin-bottom: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>✅ Overtime Plan Approved</h1>
            <p>Your overtime plan has been approved</p>
          </div>

          <div class="content">
            <p>Hi <strong>${user.name}</strong>,</p>

            <div class="status-badge">PLAN APPROVED</div>

            <p>
              Your supervisor has approved your overtime plan.
              You are cleared to proceed with the planned overtime on the scheduled date(s).
            </p>

            <div class="info-box">
              📋 <strong>Next step:</strong> After completing the overtime, please submit your
              actual hours in the HR system within <strong>7 days</strong>. The system will
              remind you automatically.
            </div>

            <div class="details-card">
              <h3>Approved Plan — ${totalHours}h total</h3>
              ${entryRows}
            </div>

            ${
              process.env.FRONTEND_URL
                ? `<a href="${process.env.FRONTEND_URL}/overtime/my-requests" class="button">View My Requests</a>`
                : ""
            }
          </div>

          <div class="footer">
            <div class="footer-signature">HR Team</div>
            <div>Human Resources Department</div>
            <div class="footer-note">This is an automated notification from the HR system.</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

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

  const entryRows = entries
    .map((e) => {
      const dateStr = new Date(e.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return `
        <div class="detail-row">
          <div class="detail-label">${dateStr}</div>
          <div class="detail-value">Planned: ${e.plannedHours ?? e.hours}h — ${e.description}</div>
        </div>`;
    })
    .join("");

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; margin: 0; padding: 0; background-color: #F9F9F9; }
        .email-wrapper { width: 100%; background-color: #F9F9F9; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #7C3AED 0%, #152A55 100%); color: #FFFFFF; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 26px; font-weight: 600; }
        .header p  { margin: 8px 0 0 0; font-size: 14px; opacity: 0.8; }
        .content { padding: 40px 30px; }
        .content p { margin: 0 0 20px 0; font-size: 16px; line-height: 1.8; }
        .status-badge { display: inline-block; background: #7C3AED; color: #FFFFFF; padding: 10px 24px; border-radius: 25px; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 16px 0; }
        .deadline-box { background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 10px; padding: 16px 20px; margin: 20px 0; font-size: 14px; color: #92400E; }
        .steps-box { background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 10px; padding: 16px 20px; margin: 20px 0; font-size: 14px; color: #166534; }
        .steps-box ol { margin: 8px 0 0 0; padding-left: 20px; }
        .steps-box li { margin-bottom: 6px; }
        .details-card { background: #F5F5F5; border: 1px solid #E0E0E0; border-radius: 10px; padding: 25px; margin: 24px 0; }
        .details-card h3 { margin: 0 0 18px 0; font-size: 16px; font-weight: 600; color: #152A55; }
        .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #E0E0E0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: 600; color: #000000; min-width: 160px; flex-shrink: 0; }
        .detail-value { color: #666666; flex: 1; }
        .button { display: inline-block; background: #7C3AED; color: #FFFFFF; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 20px; }
        .footer { padding: 30px; background: #F5F5F5; text-align: center; color: #666666; font-size: 14px; border-top: 1px solid #E0E0E0; }
        .footer-signature { font-weight: 600; color: #000000; margin-bottom: 6px; }
        .footer-note { font-size: 12px; color: #999999; margin-top: 12px; }
        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .content { padding: 30px 20px; }
          .detail-row { flex-direction: column; }
          .detail-label { min-width: auto; margin-bottom: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <h1>⏰ Actualization Required</h1>
            <p>Please submit your actual overtime hours</p>
          </div>

          <div class="content">
            <p>Hi <strong>${user.name}</strong>,</p>

            <div class="status-badge">ACTION NEEDED</div>

            <p>
              Your approved overtime plan has passed. Please log into the HR system
              and submit your <strong>actual hours</strong> worked.
            </p>

            <div class="deadline-box">
              ⚠️ <strong>Deadline:</strong> ${deadlineStr}
              <br>Please actualize before this date to ensure your overtime is counted.
            </div>

            <div class="steps-box">
              <strong>How to actualize:</strong>
              <ol>
                <li>Go to <em>Overtime → Needs Actualization</em></li>
                <li>Find this request and click <em>Actualize</em></li>
                <li>Enter the actual hours for each date</li>
                <li>Enter <strong>0</strong> for any date where overtime was cancelled</li>
                <li>Submit — if actual ≤ planned, it auto-approves</li>
              </ol>
            </div>

            <div class="details-card">
              <h3>Original Plan — ${totalHours}h planned</h3>
              ${entryRows}
            </div>

            ${
              process.env.FRONTEND_URL
                ? `<a href="${process.env.FRONTEND_URL}/overtime/pending-actualization" class="button">Actualize Now</a>`
                : ""
            }
          </div>

          <div class="footer">
            <div class="footer-signature">HR Team</div>
            <div>Human Resources Department</div>
            <div class="footer-note">This is an automated notification from the HR system.</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: user.email,
    cc: hrEmail || process.env.HR_EMAIL || "hr@rhayaflicks.com",
    subject: `Action Required: Actualize Your Overtime by ${deadlineStr}`,
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
  sendPasswordChangedEmail,
  sendPayslipNotificationEmail,
  sendBatchPayslipNotification,
  sendLeaveCancellationEmail,
  sendAdminRejectOvertimeEmail,
  sendOvertimePlanApprovedEmail,
  sendOvertimeActualizationNeededEmail,
};

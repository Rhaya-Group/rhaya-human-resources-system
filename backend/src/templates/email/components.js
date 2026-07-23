// Reusable HTML fragments for "card + detail-row" era emails.
// Tables, not flex/grid — flex/grid drop silently in Outlook desktop.

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function renderStatusBadge(text, { bg, color = "#FFFFFF" }) {
  return `<span class="status-badge" style="background-color: ${bg}; color: ${color};">${text}</span>`;
}

export function renderInfoCard({ title, titleColor, rows, accentColor }) {
  const rowsHtml = rows
    .map(
      (row) => `
        <tr>
          <td class="detail-label">${escapeHtml(row.label)}</td>
          <td class="detail-value${row.mono ? " mono" : ""}"${
        row.color ? ` style="color: ${row.color};"` : ""
      }>${row.raw ? row.value : escapeHtml(row.value)}</td>
        </tr>`
    )
    .join("");

  return `
    <div class="details-card">
      ${title ? `<h3${titleColor ? ` style="color: ${titleColor};"` : ""}>${escapeHtml(title)}</h3>` : ""}
      <table class="detail-table" role="presentation" cellpadding="0" cellspacing="0">
        ${rowsHtml}
      </table>
    </div>`;
}

export function renderCalloutBox({ label, bodyHtml, bg, border, textColor, labelColor }) {
  return `
    <div class="callout-box" style="background-color: ${bg}; border: 1px solid ${border};">
      ${label ? `<p class="callout-label" style="color: ${labelColor || textColor};">${label}</p>` : ""}
      <p class="callout-body" style="color: ${textColor};">${bodyHtml}</p>
    </div>`;
}

export function renderChecklist(items, { checkColor = "#28A745", glyph = "&#10003;" } = {}) {
  const itemsHtml = items
    .map(
      (item) =>
        `<li style="list-style: none;"><span style="color: ${checkColor}; position: absolute; left: 0; font-weight: 700;">${glyph}</span>${item}</li>`
    )
    .join("");
  return `<ul class="checklist">${itemsHtml}</ul>`;
}

export function renderButton({ href, text, bg, color = "#FFFFFF" }) {
  return `
    <table class="button-table" role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background-color: ${bg}; border-radius: 8px;">
          <a href="${href}" class="button" style="color: ${color};" target="_blank">${text}</a>
        </td>
      </tr>
    </table>`;
}

export function renderActionButtons(buttonsHtml) {
  return `<div style="text-align: center;">${buttonsHtml.join("")}</div>`;
}

export function renderFooter({ signature = "HR Team", companyName, note }) {
  return `
    <div class="footer">
      <p class="footer-signature">${signature}</p>
      <p class="footer-text">Human Resources Department${companyName ? `<br/>${companyName}` : ""}</p>
      ${note ? `<p class="footer-note">${note}</p>` : ""}
    </div>`;
}

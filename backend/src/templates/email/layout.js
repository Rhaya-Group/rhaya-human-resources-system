// Shared shell for "card + detail-row" era emails.
// Table-based detail rows/buttons by design — flex/grid breaks in Outlook desktop.

export function renderBaseStyles({
  headerBg,
  headerBg2,
  headerTextColor = "#FFFFFF",
  primary,
  secondary,
  accent,
  cardBg,
  cardBorder,
  textPrimary,
  textSecondary,
}) {
  const headerBackground = headerBg2
    ? `linear-gradient(135deg, ${headerBg} 0%, ${headerBg2} 100%)`
    : headerBg;

  return `
    <style>
      body { margin: 0; padding: 0; background-color: #F9F9F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
      .email-wrapper { width: 100%; background-color: #F9F9F9; padding: 40px 20px; }
      .container { max-width: 600px; margin: 0 auto; background-color: ${accent}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      .header { background: ${headerBackground}; padding: 32px 40px; text-align: center; }
      .header h1 { margin: 0; color: ${headerTextColor}; font-size: 28px; font-weight: 600; letter-spacing: -0.5px; }
      .header p { margin: 8px 0 0; color: ${headerTextColor}; opacity: 0.9; font-size: 14px; }
      .content { padding: 32px 40px; color: ${textPrimary}; }
      .content p { margin: 0 0 16px; line-height: 1.6; font-size: 15px; color: ${textPrimary}; }
      .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
      .details-card { background-color: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 10px; padding: 20px 25px; margin: 20px 0; }
      .details-card h3 { margin: 0 0 14px; font-size: 15px; font-weight: 600; color: ${primary}; text-align: center; }
      .detail-table { width: 100%; border-collapse: collapse; }
      .detail-table td { padding: 8px 0; font-size: 14px; vertical-align: top; }
      .detail-label { color: ${textSecondary}; width: 40%; }
      .detail-value { color: ${textPrimary}; font-weight: 600; text-align: right; }
      .detail-value.mono { font-family: 'Courier New', monospace; }
      .callout-box { border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
      .callout-box .callout-label { margin: 0 0 6px; font-size: 13px; font-weight: 700; }
      .callout-box .callout-body { margin: 0; font-size: 14px; line-height: 1.6; }
      .checklist { margin: 16px 0; padding: 0; list-style: none; }
      .checklist li { padding: 6px 0 6px 26px; font-size: 14px; position: relative; color: ${textPrimary}; }
      .button-table { margin: 24px auto; border-collapse: collapse; }
      .button-table td { border-radius: 8px; }
      .button { display: inline-block; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; }
      .footer { padding: 24px 40px; text-align: center; border-top: 1px solid ${cardBorder}; }
      .footer-signature { font-size: 14px; font-weight: 600; color: ${primary}; margin: 0 0 4px; }
      .footer-text { font-size: 13px; color: ${textSecondary}; margin: 0 0 12px; }
      .footer-note { font-size: 12px; color: ${textSecondary}; opacity: 0.8; margin: 0; }
      @media only screen and (max-width: 600px) {
        .content, .header, .footer { padding-left: 24px; padding-right: 24px; }
      }
    </style>`;
}

export function renderEmailDocument({
  title,
  headerTitle,
  headerSubtitle,
  colors,
  bodyHtml,
  footerHtml,
  lang = "en",
}) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
${renderBaseStyles(colors)}
</head>
<body>
  <div class="email-wrapper" style="width:100%;background-color:#F9F9F9;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div class="container" style="max-width:600px;margin:0 auto;background-color:${colors.accent};border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      <div class="header" style="background-color:${colors.headerBg};background:${colors.headerBg2 ? `linear-gradient(135deg, ${colors.headerBg} 0%, ${colors.headerBg2} 100%)` : colors.headerBg};padding:32px 40px;text-align:center;">
        <h1 style="margin:0;color:#FFFFFF;font-size:28px;font-weight:600;letter-spacing:-0.5px;">${headerTitle}</h1>
        ${headerSubtitle ? `<p style="margin:8px 0 0;color:#FFFFFF;opacity:0.9;font-size:14px;">${headerSubtitle}</p>` : ""}
      </div>
      <div class="content" style="padding:32px 40px;color:${colors.textPrimary};">
        ${bodyHtml}
      </div>
      ${footerHtml}
    </div>
  </div>
</body>
</html>`;
}

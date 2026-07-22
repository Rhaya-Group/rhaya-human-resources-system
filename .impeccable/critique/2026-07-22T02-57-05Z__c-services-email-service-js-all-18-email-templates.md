---
target: backend/src/services/email.service.js (all 18 email templates, post extract/harden/colorize/polish)
total_score: 23
p0_count: 1
p1_count: 2
timestamp: 2026-07-22T02-57-05Z
slug: c-services-email-service-js-all-18-email-templates
---
Method: dual-agent (A: ae1811704450538eb · B: a6ff9095885d74599)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Badge + subject + header title triple-confirm outcome |
| 2 | Match System / Real World | 3 | Natural business language, correct bilingual use |
| 3 | User Control and Freedom | 2 | No escalation path beyond generic "contact HR" prose |
| 4 | Consistency and Standards | 3 | Shared components used correctly; semantic color drifts (below) |
| 5 | Error Prevention | 1 | No visible HTML-escaping on interpolated user content (P0) |
| 6 | Recognition Rather Than Recall | 3 | Every email fully self-contained |
| 7 | Flexibility and Efficiency | 2 | No .ics attachment on deadline/expiry emails, no power-user path |
| 8 | Aesthetic and Minimalist Design | 2 | Payslip/reminder emails stack 4+ competing blocks for one action |
| 9 | Error Recovery | 3 | Rejection emails show reason + next-steps — genuinely good |
| 10 | Help and Documentation | 1 | Footer never gives an actual HR contact (email/phone/link) |
| **Total** | | **23/40** | **Acceptable — real, functioning system, meaningful gaps remain** |

## Anti-Patterns Verdict

Borderline yes on AI slop. Engineering (templates/email/) is solid; visual language is the default gradient-header/pill-badge/gray-card/callout-box/rounded-button shape applied identically regardless of severity.

Deterministic scan: 142 findings (color 87, font-size 37, radius 18) across 6 sampled files, exit code 2. All flagged as likely false positives — .impeccable/design.json documents the in-app Tailwind/oklch dashboard system with zero email-specific tokens; email HTML cannot use CSS variables/Tailwind classes. Detector also showed cwd-dependent behavior (0 findings outside project root, 142 inside) on identical target — a tool reliability issue, not a template issue.

Visual overlays: unavailable (file:// navigation failed in Browser pane); Assessment B used a local static server workaround and got real screenshots for all 6 samples.

## Overall Impression

The refactor accomplished what it set out to do — one shared, Outlook-safe component system instead of 18 copy-pasted templates. What it didn't touch: emotional register. Good news, routine news, and bad news mostly wear the same navy-gradient header; only red is reserved for rejection/expiry.

## What's Working

1. Component extraction (renderInfoCard, renderCalloutBox, renderButton) gives all 18 functions one visual language and one place to fix cross-client bugs.
2. Rejection-email content shape — reason + explicit next-steps list.
3. Password reset email is the standout for reassurance (explicit "ignore if not you," expiry stated, HR escalation path).

## Priority Issues

**[P0] No visible HTML-escaping on interpolated user content**
Why it matters: user.name, employee.name, rejectionReason, supervisorComment, task descriptions drop straight into template literals (email.service.js:281, 352, 1214, 2351 and others). Free-text fields can inject raw markup into a real inbox.
Fix: add escapeHtml() to backend/src/templates/email/, route all interpolated user-supplied strings through it.
Suggested command: /impeccable harden

**[P1] Semantic color has no "good news" signal**
Why it matters: Approved/welcome/payslip-ready/reminder all share the identical navy gradient header. Red is correctly reserved for rejection/expiry, but there's no positive-outcome distinction.
Fix: reserve one consistent on-brand accent for positive-outcome headers/badges only.
Suggested command: /impeccable colorize

**[P1] Payslip and reminder emails violate one-thing-at-a-time**
Why it matters: sendPayslipNotificationEmail stacks CTA button + 4-step numbered list re-explaining the same action + security callout + duplicate raw URL (email.service.js:1714-1739).
Fix: pick one — button OR steps OR link.
Suggested command: /impeccable distill

**[P2] Contract-expiry template structurally inconsistent with siblings**
Why it matters: confirmed via browser evidence — only sampled template with a flat (non-gradient) header and plain-text CTA instead of a button.
Fix: align to gradient-header + button treatment, or make "flat header" a deliberate distinct severity signal used consistently elsewhere too.
Suggested command: /impeccable polish

**[P2] Checkmark/warning icon mismatch in overtime reminder**
Why it matters: confirmed via browser evidence — green checkmarks introduce warning statements ("HARUS," "tidak akan masuk payroll") in sendOvertimeReminderEmail, undercutting the deadline warning.
Fix: swap to neutral/warning-colored marker, or add a tone param to renderChecklist.
Suggested command: /impeccable colorize

## Persona Red Flags

**Jordan (First-Timer, sendWelcomeEmail)**: temp password sits in the same card styling as routine info rows — nothing elevates its sensitivity. No stated validity window. CTA button doesn't confirm which domain is being trusted.

**Sam (Accessibility-Dependent)**: red "NOT APPROVED" badge (#DC3545 on white) sits at 4.53:1 — barely over AA threshold, zero margin for drift. .detail-label { width: 40% } has no word-break handling; long values under 200% zoom collide rather than reflow.

## Minor Observations

- Three different reds hand-picked across rejection/expiry emails (#DC3545, #DC2626, #C82333) instead of one shared danger token.
- renderInfoCard has no row-count guard; contract-expiry's 5-row card already exceeds the system's own ≤4 chunking guideline.
- html lang="id" hardcoded in the shared shell even for English-language templates.
- Password-reset email states expiry time twice in adjacent blocks.
- Footer never includes an actual HR contact — dead end exactly where a rejection or expiry reader needs recourse.

## Questions to Consider

- If approved, welcome, payslip-ready, and routine-reminder all share the same header, what is header color actually communicating — brand, or status?
- Is the payslip email's button+steps+security-note+duplicate-URL stack serving the reader, or padding to scroll past?
- Is contract-expiry's flat header/no-button an accident of an earlier era, or worth keeping as a deliberate "administrative FYI" register?

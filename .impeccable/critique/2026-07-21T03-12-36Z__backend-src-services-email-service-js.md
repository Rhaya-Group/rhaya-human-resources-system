---
target: backend/src/services/email.service.js (all 18 email templates)
total_score: 13
p0_count: 1
p1_count: 2
timestamp: 2026-07-21T03-12-36Z
slug: backend-src-services-email-service-js
---
Method: dual-agent (A: a0fb3cef5928a3ae9 · B: ac4ec76acd762e93a)

## Design Health Score (adapted for email — no interactive UI)

Four of Nielsen's ten heuristics don't meaningfully apply to a one-shot transactional email (no session to escape, no repeated-use efficiency, no in-context error prevention or help system). Scored the six that do:

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Outcome (approved/rejected) is stated in text + a badge, but the header banner color is the first, loudest signal and doesn't itself say what happened until you reach the badge |
| 2 | Match System / Real World | 3 | Plain, direct copy throughout; one template (`sendOvertimeReminderEmail`) mixes in Indonesian, a language jolt against 17 English-only siblings |
| 3 | User Control and Freedom | n/a | Not applicable — one-shot email, no session to exit |
| 4 | Consistency and Standards | 1 | Three distinct markup "eras" coexist with no shared base template, plus a real factual inconsistency (footer legal-entity name, see below) |
| 5 | Error Prevention | n/a | Not applicable to a sent artifact |
| 6 | Recognition Rather Than Recall | 2 | Status badge always present, but the visual grammar for "this is bad news" vs "this is routine" isn't consistent, so recipients re-learn per template |
| 7 | Flexibility and Efficiency | n/a | Not applicable |
| 8 | Aesthetic and Minimalist Design | 2 | Heavy nesting of colored callout/alert/reason boxes in the older templates creates real visual noise |
| 9 | Error Recovery | 3 | Rejection/revision emails consistently include a "what to do next" checklist and CTA — a genuinely good, repeated pattern |
| 10 | Help and Documentation | n/a | Not applicable |
| **Total (applicable only)** | | **13/24** | **Acceptable, trending toward Poor on consistency specifically** |

## Anti-Patterns Verdict

**LLM assessment**: These don't read as AI-generated slop in the landing-page sense (no gradient text, no hero-metric cliché) — they read as **hand-written template-generator output accumulated over three different eras**, never unified. Gradient headers, pill status badges, and left-border-accent callout boxes are the load-bearing visual vocabulary throughout — functional, not distinctive.

**Deterministic scan** (`detect.mjs`, exit code 2, 262 findings against the 18 extracted templates): 244 of 262 are low-signal by design — `design-system-color`/`font-size`/`radius` advisories fire because isolated email HTML has no DESIGN.md token system to match against, which is expected and not actionable. The 13 `side-tab` warnings (`border-left: 4px solid <color>` accent bars) are a borderline false-positive in this context: left-border callout boxes are a legitimate, common transactional-email pattern, not the "decorative stripe on a web card" anti-pattern the rule is really hunting for — though a genuine redesign should still reconsider them. `single-font` (4 hits) and the one `flat-type-hierarchy` hit (`sendContractExpiryReminderEmail`, 1.7:1 ratio) are real but minor.

**Visual evidence**: I extracted all 18 templates to standalone HTML and had one agent visually inspect 5 representative ones (desktop + 375px mobile) via browser screenshot. Two apparent visual bugs the agent flagged — a white-on-white unreadable password-reset header, and stray `Sample Value`/brace text in the contract-expiry template — turned out to be **artifacts of my own extraction script**, not real defects: my placeholder-substitution regex matched `color`/`Color` but missed the all-caps `BRAND_COLORS.primary`/`.secondary` tokens those two templates use, so the extracted copies got literal broken text where real interpolated hex values belong in production. I verified this directly against `email.service.js` — the real templates use resolved brand colors and render correctly. Flagging this so it isn't chased as a real bug. Everything else in Assessment B's evidence (narrow-viewport reflow held up fine on the two templates tested, container widths correctly ~600px) is trustworthy as reported.

## Overall Impression

Functionally solid, visually fragmented. The single biggest opportunity is consolidation: 18 templates, 3 unrelated markup systems, and at least one genuine factual bug (two different company names in the footer) is what happens when templates get copy-pasted and modified in isolation over many months rather than built from one shared base partial. Nothing here is broken for a modern webmail client, but the `display: flex`/`display: grid` usage will genuinely misrender in Outlook desktop — verified directly in source, not an extraction artifact — which matters a lot for an internal HR tool where recipients are disproportionately likely to be on corporate Outlook.

## What's Working

- Rejection and revision emails consistently pair the bad news with a concrete "what to do next" checklist and a CTA button — this is genuinely good error-recovery UX, not something to lose in a redesign.
- Fixed ~600px container width is correct and consistent across all 18 templates; the two tested for mobile reflow held up cleanly at 375px with no horizontal overflow.
- Quoted human input (rejection reasons, comments) is visually distinguished from system copy (italic, tinted box) in every template that has it — a small but real clarity win.

## Priority Issues

**[P0] `display: flex`/`display: grid` used for core content layout in 13 of 18 templates** — verified directly in `email.service.js` (lines 347, 578, 977, 1005, 1334, 1649, 1939, 2268, 2566, 2884, 3964, 4288, 4541, 4681 for flex; line 3602 for grid in `sendPayslipNotificationEmail`). Outlook desktop's Word rendering engine does not support flexbox or grid at all. Every `.detail-row`/`.info-row` label/value pair and the payslip's two-column info grid will misrender for any recipient on Outlook desktop — likely collapsing to unstyled stacked text with no defined column split. This is the highest-impact, most concretely verifiable issue in the file.
**Fix**: Replace `.detail-row`/`.info-grid` with table-based layout (`<table><tr><td>`) — the only layout method with universal email-client support.
**Suggested command**: `/impeccable harden` (production-readiness fix, not a style opinion)

**[P1] Two different legal entity names in the footer across templates** — "PT Rhayakan Film Indonesia" appears 5+ times (`sendOvertimeApprovedEmail` and others around lines 1160/1200/1477/1513/1785/1822/2112/2152/2417/2449), while `sendWelcomeEmail` (line 4466) says "PT Rhaya Flicks Indonesia." This is a factual inconsistency in a real business document going out under the company's name, not a style nitpick.
**Fix**: Pick the correct legal entity name and standardize it across all 18 templates, ideally by extracting the footer into one shared partial so this can't drift again.
**Suggested command**: `/impeccable harden`

**[P1] Color carries inconsistent severity meaning across templates** — green (`#10B981`/`#059669`-family) means "approved" in `sendLeaveApprovedEmail`/`sendOvertimeApprovedEmail` but also colors the routine, neutral `sendPayslipNotificationEmail`. Red/rejection-red colors the two actual rejection emails but also `sendOvertimeReminderEmail`, which is just a deadline reminder, not bad news. A recipient skimming by header color alone will misjudge urgency or outcome.
**Fix**: Reserve the approval-green and rejection-red exclusively for actual approve/reject outcomes; give neutral/informational and reminder templates their own distinct color (e.g. the existing brand blue).
**Suggested command**: `/impeccable colorize`

**[P2] Three unrelated markup systems coexist with no shared base template** — a verbose "card + detail-row" era (13 templates), a compact "emoji-header + box" era (`sendOvertimeActualizationNeededEmail`, `sendOvertimePlanApprovedEmail`), and a minimal bare-inline era (`sendContractExpiryReminderEmail`, notably the most recently added). Each edit to "the email design" only touches whichever era the editor happened to be in, guaranteeing further drift.
**Fix**: Extract one shared header/footer/button partial (a small template-string helper function) that all 18 call into, so a single visual update propagates everywhere.
**Suggested command**: `/impeccable extract`

**[P3] `sendContractExpiryReminderEmail` has no footer/legal-notice line at all**, unlike every sibling template — verified directly in source (function ends at the closing `</html>` with no footer block). Minor, but it's the one template most likely to go out at scale (daily cron) without the same "why am I getting this" context the others provide.
**Fix**: Add the standard footer line once the shared-partial fix (P2) lands, for free.
**Suggested command**: `/impeccable harden`

## Persona Red Flags

**Riley (Deliberate Stress Tester), adapted for email**: Would immediately notice the footer company-name mismatch across a batch of emails and flag it as "which one is real?" — a document methodically checked at scale surfaces this instantly, and it undermines trust in the sender. Would also open a rejection/reminder email side-by-side and notice the red-reminder-vs-red-rejection collision immediately.

**Sam (Accessibility-Dependent User), adapted for email**: Color contrast on badges is generally fine per source review (white text on saturated `#28A745`/`#DC3545`/`#7C3AED` backgrounds passes AA at the sizes used). No `<img>` elements anywhere, so no missing alt-text risk. The real risk for Sam is the same one facing every recipient: outcome is always also stated in text (not color-only), which is correct — but a screen-reader user relying on a linearized reading order will hit the flex-layout label/value rows in whatever DOM order they're written, which may not match the visual left-to-right pairing once flex support (already broken in Outlook) is also absent for assistive rendering in some clients.

## Minor Observations

- `single-font` detector hits (Roboto-only, 4 templates) are normal for email and not worth fixing on their own.
- `flat-type-hierarchy` in `sendContractExpiryReminderEmail` (13/14/15/22px, 1.7:1 ratio) is a real but low-stakes finding — this template's minimalism is otherwise a strength, just under-differentiated by size alone.
- Button hover states (`transition`, `box-shadow` on `:hover`) are silently ignored by every email client but are harmless dead code, not worth spending effort removing.

## Questions to Consider

- If 13 of 18 templates are one markup era, is a full redesign actually necessary, or would extracting that era's pattern into a shared partial (and migrating the 5 outliers to match) get 90% of the consistency win for a fraction of the effort?
- Is the red/amber/green semantic-color set intentional company brand, or just "whatever felt right at the time" — worth locking down as a real rule before it drifts further?
- Given HR recipients are disproportionately likely to be on corporate Outlook, is there a case for testing actual rendering in Outlook (not just browser preview) before the flex/grid fix ships?

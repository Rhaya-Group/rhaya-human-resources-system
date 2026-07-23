---
name: Rhaya People Management Center
description: Internal multi-entity HR operations system — leave, overtime, payslips, contracts, recruitment
colors:
  primary: "#2563eb"
  primary-hover: "#1d4ed8"
  primary-tint: "#eff6ff"
  primary-tint-strong: "#dbeafe"
  neutral-bg: "#f9fafb"
  neutral-surface: "#ffffff"
  neutral-border: "#d1d5db"
  ink: "#111827"
  ink-muted: "#6b7280"
  success: "#10b981"
  success-tint: "#d1fae5"
  success-ink: "#065f46"
  warning: "#f59e0b"
  warning-tint: "#fef3c7"
  warning-ink: "#92400e"
  danger: "#ef4444"
  danger-tint: "#fee2e2"
  danger-ink: "#991b1b"
typography:
  heading:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  section-heading:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.05em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  input-field:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "24px"
  badge-success:
    backgroundColor: "{colors.success-tint}"
    textColor: "{colors.success-ink}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: Rhaya People Management Center

## 1. Overview

**Creative North Star: "The Ledger"**

Every screen in this system exists because a number, a date, or an approval needs to be accountable to someone. The Ledger names that: precision over persuasion, traceability over decoration. A leave balance, an overtime total, a contract end date — each one should read as a fact with a visible source, not a styled statistic. This is the direct visual expression of PRODUCT.md's "show your work" principle: the interface's job is to make the correct state legible at a glance, for two very different readers — HR staff who live in this tool daily and need density and speed, and employees who drop in rarely and need everything spelled out without a manual.

The system currently runs on a single, consistent primary blue (`#2563eb`) across buttons, active nav states, links, and the occasional badge — used more heavily than a strict Restrained strategy would prescribe (Tailwind's default blue, applied directly rather than through the unused `primary`/`success`/`warning`/`danger` tokens already sitting dormant in `tailwind.config.js`), but applied consistently enough that it reads as intentional rather than accidental. It explicitly rejects ornamentation for its own sake: no gradient text, no glassmorphism, no decorative motion. Where it currently falls short of Restrained is coverage, not chaos — the same blue carries primary actions, secondary emphasis, and navigation state alike, with no cooler/lower-emphasis tier separating "the one action that matters" from "everything else that's just blue." A `colorize` pass is the identified next step to correct that coverage, not the palette's hue itself.

**Key Characteristics:**
- One accent color (blue), applied to buttons, active states, links, and a handful of badges
- Two coexisting card idioms: a flat `rounded-lg` / `shadow` idiom used across most of the app, and a newer, quieter `rounded-3xl` / near-invisible-shadow idiom introduced on the Profile page
- Dense, form-heavy, table-heavy — built for repeated daily use, not first impressions
- No custom typeface — the system sans (`ui-sans-serif` / `system-ui`) carries every weight and size in the app
- Status conveyed almost entirely through pill-shaped, two-tone badges (`{color}-100` background, `{color}-800` text) — the system's single most consistent visual pattern

## 2. Colors

Restrained in intent, Committed in practice: one blue carries nearly every interactive and status cue in the app.

### Primary
- **Ledger Blue** (`#2563eb`): every primary button, active navigation item, primary link, and the default badge tint. Used on hover as **Ledger Blue Deep** (`#1d4ed8`).
- **Ledger Blue Tint** (`#eff6ff`) / **Ledger Blue Tint Strong** (`#dbeafe`): hover backgrounds on nav items and light-emphasis badges/panels.

### Neutral
- **Paper** (`#f9fafb`): the page background behind every screen (`body { @apply bg-gray-50 }`).
- **Surface White** (`#ffffff`): every card, table, modal, and input background.
- **Hairline** (`#d1d5db`): borders on inputs, dividers, table rules.
- **Ink** (`#111827`): body text, headings.
- **Ink Muted** (`#6b7280`): secondary labels, timestamps, helper text.

### Named Rules
**The One Blue Rule.** There is exactly one accent hue in the system. It does not compete with itself — don't introduce a second "brand" blue or purple for variety. If a screen needs a second signal color, it comes from the semantic set below, never from a new arbitrary hue.

## 3. Typography

**Body/UI Font:** `ui-sans-serif, system-ui, -apple-system, sans-serif` (no custom typeface loaded anywhere in the codebase)

**Character:** A single system sans carries every role — headings, buttons, labels, dense table data. This is the correct choice for the register: users need to read fast, not admire the type. No display font, no serif, no second family anywhere in the app.

### Hierarchy
- **Heading** (700, 1.5rem / 24px, 1.3 line-height): page titles ("User Management", "Leave History").
- **Section Heading** (600, 1.125rem / 18px, 1.4 line-height): card and panel titles within a page.
- **Body** (400, 0.875rem / 14px, 1.5 line-height): the default size for almost everything — table cells, form labels, buttons, paragraph text. Prose blocks (help text, descriptions) still respect 65–75ch.
- **Label** (500, 0.75rem / 12px, 0.05em tracking): uppercase-style field labels and metadata, though most labels in the codebase are NOT uppercased — check the specific component before assuming.

### Named Rules
**The One Family Rule.** Every size and weight in this system comes from the same sans stack. A second typeface anywhere (a serif for "important" numbers, a mono for IDs) is an unforced addition; don't make it without a reason tied to data legibility, not decoration.

## 4. Elevation

Two elevation idioms currently coexist, and DESIGN.md documents both rather than picking a winner prematurely.

**The legacy idiom** (majority of the app — UserManagement, FilesTab, most list/table pages): flat `shadow` or `shadow-sm`/`shadow-md` on white cards over the gray-50 page background, with `rounded-lg` (8px) corners. Depth is minimal and structural — cards separate from the page, nothing more.

**The newer idiom** (introduced on the Profile page's SectionCard pattern): `rounded-3xl` (24px) corners, a barely-visible custom shadow (`0 8px 30px rgb(0 0 0 / 0.04)`), and a hairline border (`border border-gray-100`) instead of relying on shadow alone for definition. Softer, quieter, more "designed."

### Shadow Vocabulary
- **Card (legacy)** (`box-shadow` via Tailwind `shadow` / `shadow-sm`): default card separation across most pages.
- **Card (quiet)** (`box-shadow: 0 8px 30px rgb(0 0 0 / 0.04)`): the Profile-page SectionCard treatment. Pairs with `rounded-3xl` and a `border-gray-100` hairline, not with a stronger shadow.
- **Modal** (`shadow-lg` / `shadow-xl` / `shadow-2xl`): upload/edit/confirm dialogs, consistently above page-level cards.
- **Mobile drawer** (`shadow-2xl`): the slide-in sidebar on small screens.

### Named Rules
**The Pick-One Rule.** New pages should adopt the quiet SectionCard idiom (`rounded-3xl`, hairline border, near-invisible shadow) going forward rather than the legacy flat-shadow card — it's the more deliberate of the two and should become the system's single answer, not a second option. Don't introduce a third.

## 5. Components

### Buttons
- **Shape:** `rounded-lg` (8px), consistently across the entire app — no button anywhere uses a different radius.
- **Primary:** `bg-blue-600` background, white text, `hover:bg-blue-700`, `px-4 py-2` padding, `font-medium`.
- **Secondary / Ghost:** white background, `border border-gray-300`, `text-gray-700`, `hover:bg-gray-50`. Used for "Cancel" in every modal.
- **Destructive:** `text-red-600` on transparent/white, no filled red button pattern currently in use — destructive actions are icon buttons (trash icon) in table rows, confirmed via a native `confirm()` dialog rather than a styled destructive button.

### Badges (the system's signature component)
- **Style:** `px-2 py-1 text-xs font-medium rounded-full`, background `{color}-100`, text `{color}-800`. Used for document types, request statuses, employee status, access levels — this exact class combination appears dozens of times across the codebase and is the single most consistent pattern in the system.
- **Color assignment:** each domain (document type, leave status, employee status) keeps its own color map, but all maps share the same 100/800 tint-and-ink structure. New status/type badges must follow this exact structure, choosing an unused hue from the existing set before introducing one that isn't already in the palette.

### Cards / Containers
- **Corner Style:** `rounded-lg` (legacy) or `rounded-3xl` (quiet, preferred going forward — see Elevation).
- **Background:** white on gray-50 page background, always.
- **Border:** none on legacy cards (shadow does the separation); `border-gray-100` hairline on quiet cards.
- **Internal Padding:** `p-6` (24px) is the standard card padding throughout.

### Inputs / Fields
- **Style:** `w-full px-3 py-2 border border-gray-300 rounded-lg` — this exact class list appears 190+ times across the codebase, effectively the system's only text input style.
- **Focus:** `focus:ring-2 focus:ring-blue-500` on the few components that define focus state explicitly; many raw `<input>` elements in older code rely on browser default focus only — worth standardizing during a future `harden` pass.
- **Date fields:** `react-datepicker`, restyled to match (gray-200 border, blue-600 selected day, green weekend labels).

### Navigation
- **Style:** fixed white sidebar (`lg:flex`) with a mobile slide-in drawer variant (`shadow-2xl`) below `lg` breakpoint. Active item: `bg-blue-50 text-blue-600`. Hover on inactive items: same tint at lower opacity or `hover:bg-gray-50` depending on the specific nav level.
- **Logo mark:** a solid `bg-blue-600` rounded-lg square as the app's icon-shaped identity element, repeated at the top of both desktop sidebar and mobile header.

### Login Screen (the one branded surface)
- The single screen in the app that departs from the flat gray-50 canvas: `bg-gradient-to-br from-blue-50 to-indigo-100`, a white `rounded-xl shadow-lg` card centered on it. This is the only gradient anywhere in the codebase — confined to the pre-authentication screen, never bleeding into the authenticated app shell.

## 6. Do's and Don'ts

### Do:
- **Do** use the exact input class (`w-full px-3 py-2 border border-gray-300 rounded-lg`, with `focus:ring-2 focus:ring-blue-500` on focus) for every new text/select/date field — it's already the de facto standard.
- **Do** use the `{color}-100` bg / `{color}-800` text badge structure for any new status or type indicator.
- **Do** prefer the quiet SectionCard idiom (`rounded-3xl`, `border-gray-100`, `shadow: 0 8px 30px rgb(0 0 0 / 0.04)`) for new pages over the legacy flat-shadow card.
- **Do** keep confirmations as native `confirm()` or an explicit modal step before any destructive or high-stakes action (delete, balance adjustment, contract-date change) — per PRODUCT.md's "correctness over cleverness" principle.
- **Do** make entity/scope boundaries visible in the UI (which entities a Level-2 HR user can see), not just enforced silently server-side.

### Don't:
- **Don't** introduce a second accent hue for "variety." One blue, per the One Blue Rule.
- **Don't** add a display or serif font anywhere; the system sans carries every role, per the One Family Rule.
- **Don't** use `border-left`/`border-right` colored stripes as a status indicator — this system already has a working, consistent pattern (the pill badge); a stripe would be a second, competing vocabulary.
- **Don't** use gradient text or glassmorphism anywhere in the authenticated app shell — the login gradient is the one deliberate exception, and it stays confined to that single pre-auth screen.
- **Don't** add decorative motion. Every transition in this system should communicate a state change (loading, hover, reveal) — nothing runs "for delight."
- **Don't** silently pick between the two card idioms per-screen; default to the quiet SectionCard pattern unless there's a specific reason to match a legacy page's existing look.

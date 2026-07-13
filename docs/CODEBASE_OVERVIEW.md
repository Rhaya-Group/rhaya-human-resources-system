# Codebase Overview — HR Apps V2

> Last updated: 2026-07-13

---

## Architecture

Two frontends, one shared backend, one Neon Postgres DB.

| Layer | Folder | Port | Purpose |
|---|---|---|---|
| Backend API | `backend/` | 3000 | Express/ESM/Prisma — all business logic |
| HR App (HRIS) | `frontend/` | 5173 | React 18 SPA for HR staff + employees |
| Recruitment Site | `../RecruitmentWeb/` | 5176 | Standalone candidate-facing SPA |

---

## Tech Stack

| Concern | Tech |
|---|---|
| Runtime | Node.js ESM |
| Framework | Express |
| ORM | Prisma v5 |
| DB | PostgreSQL (Neon) |
| Frontend | React 18, Vite 5, Tailwind 3 |
| State/data | TanStack Query v5 |
| Routing | react-router-dom v6 |
| Auth | JWT (jsonwebtoken), bcryptjs (cost 10) |
| Files | Cloudflare R2 (S3-compatible, `@aws-sdk/client-s3` + presigner) |
| Email | `nodemailer` over SMTP — SMTP2GO host in prod, Ethereal/Gmail fallback in dev (NOT the REST API) |
| i18n | i18next + react-i18next — EN + ID (Bahasa Indonesia), lang in localStorage |
| PDF | puppeteer + pdfkit + html-pdf-node; payslips password-protected via node-qpdf (`utils/pdfEncryption.js`) |
| Excel | exceljs + xlsx (payslip bulk import/export) |
| Scheduling | node-cron via `scheduler.service.js` |
| Tests | none yet — no test suite in repo |

---

## Access Levels

| Level | Role |
|---|---|
| 1 | System Admin (all access) |
| 2 | Subsidiary HR (scoped to assigned entities) |
| 3 | Manager |
| 4 | Staff |
| 5 | Intern |

Level 2 HR is scoped to entities in `scopeEntityIds` / `scopeGroupIds`. All HR-facing list queries must call `applyScopeFilter(where, req.user)` from `src/utils/scopeHelper.js`.

---

## Auth — Two Separate Token Types

| Identity | Table | JWT payload | Middleware |
|---|---|---|---|
| HR / Employee | `User` | `{ userId }` | `authenticate`, `authorizeHR` |
| Candidate | `Applicant` | `{ applicantId }` | `applicantAuthenticate` |

A candidate token on an HR route returns 401. Cross-identity access is never allowed.

### Auth middleware (`backend/src/middleware/auth.js`)

| Middleware | Purpose |
|---|---|
| `authenticate` | Verify JWT, attach `req.user` |
| `authorizeAdmin` / `requireAdmin` | Level 1 only |
| `authorizeHR` | Level 1–2 |
| `requireRole([1,2,3])` | Whitelist specific levels |
| `requireMaxRoleLevel(n)` | Allow levels ≤ n |
| `requireActiveUser` | Block `employeeStatus === 'INACTIVE'` |
| `requireStaffOrAbove` | Level ≤ 4 (excludes interns) |

Inactive users can only access payslips and profile.

---

## Backend — Route Map

All routes mount under `/api/*` except `/internal/*`.

| Prefix | File | Auth | Notes |
|---|---|---|---|
| `/api/auth` | `auth.routes.js` | public | login, logout, me, change-password, forgot/reset-password |
| `/api/auth` | `welcomeEmail.routes.js` | Level 1–2 | welcome-stats, send-welcome-test, send-welcome-all |
| `/api/users` | `user.routes.js` | Level 1–2 | CRUD, deactivate, balance adjust, scope assign |
| `/api/roles` | `role.routes.js` | authenticated | role list |
| `/api/divisions` | `division.routes.js` | authenticated | division CRUD |
| `/api/leaves` | `leave.routes.js` | authenticated | see Leave module |
| `/api/overtime` | `overtime.routes.js` | authenticated | see Overtime module |
| `/api/overtime-recap` | `overtimeRecap.routes.js` | authenticated | monthly recap management |
| `/api/payslips` | `payslip.routes.js` | authenticated | payslip generation + employee view |
| `/api/plotting-companies` | `plottingCompany.routes.js` | authenticated | entity/company CRUD |
| `/api/users/:userId/documents` | `document.routes.js` | authenticated | employee document upload |
| `/api/offboarding` | `offboarding.routes.js` | authenticated | offboarding CRUD |
| `/api/entity-groups` | `entityGroup.routes.js` | Level 1 | multi-entity org structure |
| `/api/entity-subgroups` | `entitySubgroup.routes.js` | Level 1 | subgroup CRUD |
| `/api/policy-templates` | `policyTemplate.routes.js` | Level 1 | leave/overtime policy templates |
| `/api/work-status` | `workStatus.routes.js` | authenticated | daily attendance calendar |
| `/api/wfh` | `wfh.routes.js` | authenticated | WFH scheduling |
| `/api/recruitment/*` | various | see Recruitment | see Recruitment section |
| `/internal/*` | `internal.routes.js` | HMAC | internal service-to-service calls |

---

## Modules

### 1. Auth & User Management

**Status: Complete**

- Login via NIP or email + password
- JWT issued on login, verified on all protected routes
- Password reset via email link (see Email note below)
- Strong-password validation on change/reset (`utils/passwordValidator.js`)
- User CRUD: create, update, deactivate (soft), permanent delete
- Balance adjust (leave/overtime) by admin
- Level 2 scope assignment: assigns `scopeEntityIds` to sub-admin
- Inactive user restrictions (payslip + profile only)
- **Welcome emails**: HR can send onboarding welcome emails — test send, bulk send-all active employees, plus stats endpoint (`welcomeEmail.controller.js`, bulk script `sendBulkWelcomeEmails.js`)
- **Rate limiters** for login/forgot/reset exist in `rateLimiter.js` but are **currently commented out** in `auth.routes.js`; only the general limiter (100 req / 15 min) is active globally

**Key files:**
- `backend/src/controllers/auth.controller.js`
- `backend/src/controllers/user.controller.js`
- `backend/src/controllers/welcomeEmail.controller.js`
- `backend/src/middleware/auth.js`
- `backend/src/utils/passwordValidator.js`
- `frontend/src/pages/Login.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`
- `frontend/src/pages/UserManagement.jsx`, `UserDetail.jsx`, `UserProfile.jsx`

> **Note — two password-reset models exist:** `PasswordResetToken` and `PasswordReset`. This is a known duplication; confirm which is live before touching reset logic.

---

### 2. Leave Management

**Status: Complete**

**Leave types:** `ANNUAL_LEAVE`, `SICK_LEAVE`, `MATERNITY_LEAVE`, `PATERNITY_LEAVE`, `MENSTRUAL_LEAVE`, `BEREAVEMENT_LEAVE`, `UNPAID_LEAVE`

**Rules:**
- Annual leave: max 5 working days per request, max 5 working days per month
- Sick/menstrual/bereavement: 2-day backdating allowed
- Maternity: special logic, no 5-day limit
- Annual leave quota auto-calculated from `joinDate`
- Balance auto-restored on reject/cancel/delete

**Flows:**
- Employee: submit (with file attachment), view history, cancel pending
- Approver (level 1–4): see pending list, approve, reject
- Admin (level 1–2): view all requests, balance by year

**Email notifications:** request submitted, approved, rejected, cancelled — via SMTP2GO

**Key files:**
- `backend/src/services/leave.service.js` — quota calc, balance logic, approver resolution
- `backend/src/controllers/leave.controller.js`
- `frontend/src/pages/LeaveHistory.jsx`, `LeaveApproval.jsx`, `LeaveDetail.jsx`

---

### 3. Overtime Management

**Status: Complete**

Three overtime flows:
- **Flow 1 (post):** submit after overtime occurs with actual hours
- **Flow 2A (planned):** submit before the date → approve plan → actualize after date
- **Flow 2B (incidental):** marked incidental on submit

**Flow 2A lifecycle:** `PENDING_PLAN_APPROVAL` → `PLAN_APPROVED` → (date passes) → `PENDING_ACTUALIZATION` → `PENDING_APPROVAL` → `APPROVED` / `REJECTED`

**Features:**
- Monthly balance processing (converts approved overtime to balance)
- Time-off-in-lieu tracking
- Recap lock — prevents approval/reject during locked recap period
- Admin can override (admin-reject approved, admin-edit)
- Scheduler service auto-moves expired plans to actualization

**Key files:**
- `backend/src/controllers/overtime.controller.js`
- `backend/src/services/overtime.service.js`, `overtimeRevision.service.js`
- `backend/src/middleware/recapLock.middleware.js`
- `frontend/src/pages/OvertimeRequest.jsx`, `OvertimeApproval.jsx`, `OvertimeActualize.jsx`, `OvertimeRecapManagement.jsx`

---

### 4. Overtime Recap

**Status: Complete**

Monthly recap cycle per entity:
- HR creates recap for a date range
- All approved overtime in range is aggregated
- Recap can be locked (prevents further approve/reject in that period)
- PDF export: per-employee recap + combined PDF

**Key files:**
- `backend/src/controllers/overtimeRecap.controller.js`
- `backend/src/controllers/overtimeRecapPDF.controller.js`
- `backend/src/controllers/overtimeRecapCombinedPDF.controller.js`

---

### 5. Payslips

**Status: Complete**

- HR generates payslips (from Excel template or manual)
- Employee views own payslips (`/payslips/my-payslips`)
- Admin manages all payslips (`/payslips/manage`)
- `GenerateFromExcelModal` — bulk upload via Excel

**Key files:**
- `backend/src/controllers/payslip.controller.js`
- `backend/src/services/payslipGenerator.template.service.js`
- `frontend/src/pages/PayslipManagement.jsx`, `MyPayslips.jsx`

---

### 6. Work Status / Attendance Calendar

**Status: Complete**

Daily status calendar per employee:
- Statuses: `WFO`, `WFH`, `LEAVE`, `SICK`, `HOLIDAY`, etc.
- Each employee sets their own status per day
- Default status per employee (e.g. WFO)
- Indonesian public holidays auto-fetched via external API proxy
- Attendance view permissions: an employee can grant another user view access to their calendar
- Admin: grant/revoke view permissions across employees

**Key files:**
- `backend/src/controllers/workStatus.controller.js`
- `frontend/src/pages/WorkStatusDashboard.jsx`, `AttendancePermissions.jsx`

---

### 7. WFH Scheduler

**Status: Complete**

Per-entity WFH scheduling with quota and window enforcement:
- **Scope**: which entity groups / subgroups are WFH-eligible
- **Quota**: per-employee WFH day limit per week/period
- **Schedule**: employee submits WFH days for a week window
- **Window override**: admin can extend or close the submission window
- **Exclusions**: admin can exclude specific employees from WFH eligibility
- WFH schedules sync to work status calendar automatically

**Key files:**
- `backend/src/controllers/wfh.controller.js`
- `frontend/src/pages/WfhScheduler.jsx`, `WfhAdmin.jsx`

---

### 8. Entity / Organization Structure

**Status: Complete**

Multi-entity org structure for subsidiary HR scoping:

| Model | Purpose |
|---|---|
| `PlottingCompany` | Legal entity / company |
| `EntityGroup` | Grouping of entities (for scope assignment) |
| `EntitySubgroup` | Sub-grouping within an entity group |
| `PolicyTemplate` | Leave/overtime policy config per entity |
| `PolicyAssignment` | Maps policy template → entity |

**Key files:**
- `backend/src/controllers/entityGroup.controller.js`, `entitySubgroup.controller.js`, `entityPolicy.controller.js`
- `frontend/src/pages/EntityGroupManagement.jsx`, `EntitySubgroupManagement.jsx`, `EntityPolicyManagement.jsx`, `PolicyTemplateManagement.jsx`

---

### 9. Offboarding

**Status: Complete**

Tracks employee offboarding process:
- Offboarding record linked to user
- Status tracking: checklist items, completion

**Key files:**
- `backend/src/controllers/offboarding.controller.js`
- `frontend/src/components/OffboardingTab.jsx`

---

### 10. Employee Documents

**Status: Complete**

Per-employee document storage:
- Upload to Cloudflare R2 (PDF/DOCX/ZIP, max 30MB)
- Linked to user record (`EmployeeDocument` model)
- Displayed in user detail page documents tab

**Key files:**
- `backend/src/controllers/document.controller.js`
- `frontend/src/components/DocumentsList.jsx`, `FilesTab.jsx`

---

### 11. Recruitment Module

**Status: v0 done, v2 in progress** — see `docs/RECRUITMENT_PLAN.md` for full spec.

**Built (v0):**
- Public job board + job detail
- Candidate register / login
- Application submit
- Candidate application status tracking
- HR: job postings CRUD
- HR: pipeline kanban (12-stage)
- HR: question bank admin UI

**DB schema built (v2 — not all wired up):**
- `questions`, `position_questions` — question bank + assignment
- `answers`, `profile_answers` — per-application and per-candidate answers
- `position_overseers` — HR users with access to a position
- `recruitment_documents` — stage documents (inbound/outbound)
- `Applicant.parsedCv` — structured CV JSON (shape locked)

**Pending (v2):**
| ID | Feature |
|---|---|
| F3 | Candidate forgot-password flow |
| F4 | Reusable candidate profile (prefill on repeat apply) |
| F5 | Dynamic screening questions per position |
| F6 | Knockout auto-filter (hard reject / soft flag) |
| F7 | CV upload → R2 + `parsed_cv` structured form |
| F8 | Application submit confirmation email |
| F10 | Question bank admin (full CRUD wired) |
| F11 | Question assignment to positions |
| F13 | Email notifications on stage change |
| F14/F15 | Recruiter + overseer assignment |
| F16 | Stage document exchange |

**Key files:**
- `backend/src/controllers/jobPosting.controller.js`, `jobApplication.controller.js`
- `backend/src/controllers/question.controller.js`, `positionOverseer.controller.js`, `recruitmentDocument.controller.js`
- `backend/src/routes/publicJob.routes.js`, `applicantAuth.routes.js`, `applicantPortal.routes.js`
- `frontend/src/pages/recruitment/JobPostings.jsx`, `Pipeline.jsx`, `QuestionBank.jsx`
- `frontend/src/utils/stages.jsx` — pipeline stage config

---

## Services

| Service | Purpose |
|---|---|
| `email.service.js` | All outbound email via `nodemailer` (SMTP2GO SMTP in prod, Ethereal/Gmail fallback in dev) |
| `leave.service.js` | Leave quota calc, balance updates, approver resolution |
| `overtime.service.js` | Overtime business logic |
| `overtimeRevision.service.js` | Revision tracking |
| `leaveReminder.service.js` | Scheduled leave reminders |
| `scheduler.service.js` | Cron jobs (actualization check, reminders) |
| `r2.service.js` | Cloudflare R2 upload/download |
| `payslipGenerator.template.service.js` | Payslip PDF generation |
| `passwordResetToken.service.js` | Reset token create/verify/invalidate |

---

## Frontend Structure

```
frontend/src/
├── App.jsx              — router + protected route wrappers
├── api/client.js        — axios instance, token injection
├── hooks/
│   ├── useAuth.js       — current user + auth state
│   └── useInternalPolicyUrl.js
├── components/
│   ├── Layout.jsx       — nav + sidebar shell
│   └── ...              — shared tab components
├── pages/
│   ├── Dashboard.jsx
│   ├── Login/ForgotPassword/ResetPassword
│   ├── UserManagement.jsx, UserDetail.jsx, UserProfile.jsx
│   ├── Leave*.jsx
│   ├── Overtime*.jsx
│   ├── Payslip*.jsx
│   ├── WorkStatusDashboard.jsx, AttendancePermissions.jsx
│   ├── Wfh*.jsx
│   ├── EntityGroup*.jsx, EntitySubgroup*.jsx, EntityPolicy*.jsx
│   ├── PolicyTemplateManagement.jsx
│   └── recruitment/
│       ├── JobPostings.jsx
│       ├── Pipeline.jsx
│       ├── QuestionBank.jsx
│       ├── QuestionAssignment.jsx
│       ├── PositionOverseers.jsx
│       └── DocumentManagement.jsx
├── components/LanguageToggle.jsx  — EN/ID switch
├── i18n.js              — i18next config, EN + ID resource bundles
└── utils/stages.jsx     — recruitment pipeline stage definitions
```

> **Internationalization:** whole HR app is bilingual EN + ID via i18next. Translation keys live in `frontend/src/i18n.js` (single file, ~1500 lines, `en:` and `id:` resource trees). New user-facing strings must be added to **both** trees.

### Candidate SPA (`../RecruitmentWeb/`)

Standalone Vite React app, separate deploy/domain. Talks to the same backend under `/api/recruitment/*`.

```
RecruitmentWeb/src/
├── App.jsx                    — router
├── api/clients.js             — TWO axios instances: hrClient + applicantClient
├── auth.js                    — candidate token storage/helpers
├── stages.jsx                 — pipeline stage config (candidate view)
└── pages/
    ├── JobBoard.jsx           — public listings
    ├── JobDetail.jsx          — public detail
    ├── ApplyForm.jsx          — application submit
    ├── ApplicantRegister.jsx / ApplicantLogin.jsx
    ├── ApplicantDashboard.jsx — status tracking
    ├── ApplicantProfile.jsx   — candidate profile (F4 scaffolding)
    └── ApplicationDocuments.jsx — stage document exchange (F16 scaffolding)
```

> `ApplicantProfile.jsx` and `ApplicationDocuments.jsx` exist on the candidate side — F4/F16 are partially scaffolded, not just pending. Verify wiring before estimating those features.

---

## Database Models (42 total)

Full model list in `backend/prisma/schema.prisma` (single source of truth). 18 migration files under `backend/prisma/migrations/`.

| Domain | Models |
|---|---|
| **Users/org** | `User`, `Role`, `Division`, `PlottingCompany` |
| **Entity structure** | `EntityGroup`, `EntityGroupAudit`, `EntitySubgroup`, `PolicyTemplate`, `PolicyAssignment` |
| **Leave** | `LeaveBalance`, `LeaveRequest`, `BalanceAdjustmentLog` |
| **Overtime** | `OvertimeRequest`, `OvertimeEntry`, `OvertimeBalance`, `OvertimeRevision`, `OvertimeRecap`, `TimeOffInLieu`, `RecapDateAdjustment` |
| **Payslips** | `Payslip` |
| **Auth/system** | `PasswordResetToken`, `PasswordReset` (duplicate — see Auth note), `SystemSettings` |
| **Documents** | `EmployeeDocument`, `Offboarding` |
| **Attendance/WFH** | `WorkStatus`, `WorkStatusDefault`, `AttendanceViewPermission`, `WfhFeatureScope`, `WfhQuota`, `WfhSchedule`, `WfhWindowOverride`, `WfhExcludedEmployee` |
| **Recruitment** | `Applicant`, `JobPosting`, `JobApplication`, `ApplicationEvent`, `Question`, `PositionQuestion`, `Answer`, `ProfileAnswer`, `PositionOverseer`, `RecruitmentDocument` |

---

## Backend Utils & Scripts

**`backend/src/utils/`**
- `scopeHelper.js` — `applyScopeFilter(where, req.user)` for Level-2 entity scoping (use on every HR list query)
- `passwordValidator.js` — strong-password rules
- `payslipFilename.js` — payslip file naming
- `pdfEncryption.js` — password-protect payslip PDFs (node-qpdf)

**`backend/src/helpers/`**
- `policyResolver.js` — resolves effective leave/overtime policy per entity

**`backend/scripts/`** (one-off maintenance, run manually)
- `anonymize-dev-data.js` — scrub PII for dev DB (`npm run db:anonymize-dev`)
- `create-yearly-balances.js` — seed yearly leave balances
- `migrate-2026-balances.js` — one-time balance migration
- `../sendBulkWelcomeEmails.js` — bulk welcome email send

---

## DB Migration Workflow

- **Local:** `npx prisma migrate dev --name your_change` → generates migration file, commit it
- **Prod (Railway):** `prisma migrate deploy` runs automatically on deploy
- **Never** use `db push` in production

---

## Key Environment Variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `JWT_SECRET` | Token signing |
| `FRONTEND_URL` | HR app prod domain (CORS) |
| `RECRUITMENT_URL` | Recruitment site prod domain (CORS) |
| `ALLOWED_ORIGINS` | Comma-separated extra CORS origins (staging etc.) |
| `NODE_ENV` | `development` (localhost CORS on) / `production` (localhost off) |
| `SMTP2GO_HOST` / `SMTP2GO_PORT` / `SMTP2GO_USER` / `SMTP2GO_PASS` | SMTP creds — presence triggers prod email transport in `email.service.js` |
| `SMTP2GO_API_KEY` | Legacy — set but the REST path is commented out; SMTP creds above are what's used |
| `R2_*` | Cloudflare R2 credentials and bucket |

---

## Backend npm Scripts

| Script | Command |
|---|---|
| `npm run dev` | nodemon dev server |
| `npm start` | production server |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate:dev` | `prisma migrate dev` (local schema change) |
| `npm run db:migrate:deploy` | `prisma migrate deploy` (prod, auto on Railway) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:anonymize-dev` | scrub dev DB PII |

Frontend: `npm run dev` (Vite), `npm run build`, `npm run preview`.

---

## Reference Docs

| File | Purpose |
|---|---|
| `CLAUDE.md` | Project rules for Claude Code (auth, scope, migrations, files) |
| `README.md` | Project readme |
| `CONTRIBUTING.md` | Branch workflow + contribution rules |
| `docs/RECRUITMENT_PLAN.md` | Full recruitment v2 spec (data model, `parsed_cv` shape, feature list) |
| `docs/CODEBASE_OVERVIEW.md` | This file |

> **No automated tests** in the repo. To verify a change, run the app (`backend` on :3000, `frontend` on :5173) and exercise the flow manually.

---

## Branch Workflow

- `main` — production, protected, PR-only
- `development` — integration, unprotected, commit directly for routine changes
- `feat/` `fix/` `chore/` branches → PR into `development` when review needed
- Promote `development` → `main` via PR to release

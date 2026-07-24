# Recruitment Module — v2 Plan

> Last updated: 2026-07-08
> Status: v0 built (see §What's done). v2 in planning.

---

## Architecture

Two UIs, one backend, one DB.

| Layer | Location | Notes |
|---|---|---|
| **Candidate frontend** | `RecruitmentWeb/` (sibling folder) | Standalone Vite SPA, own domain |
| **HR admin UI** | `frontend/` (this repo) | New pages added to existing HRIS |
| **Backend API** | `backend/src/routes/recruitment*.js` | Mounted under `/api/recruitment/*` |
| **Database** | Neon Postgres (shared with HRIS) | Recruitment tables live alongside HR tables |

HR users log in with existing HRIS credentials. Candidates have separate accounts (`Applicant` table, distinct JWT payload `{ applicantId }`).

---

## Candidate auth

Email + password (bcrypt). Standard flow:
- **Register** — email + password → `Applicant` row created
- **Login** — email + password → JWT (`applicantToken` in localStorage)
- **Forgot password** — email reset link → new password

Token stored in `localStorage.applicantToken`. A candidate token is **rejected** on HR routes (middleware checks for `userId` vs `applicantId` in payload).

---

## Data model

Nine entities total. Six are new (v2). Three exist from v0.

### Existing (v0)
| Table | Key fields |
|---|---|
| `applicants` | `id`, `email`, `password`, `name`, `phone`, `resumeUrl` |
| `job_postings` | `id`, `title`, `description`, `department`, `location`, `employmentType`, `status`, `openings`, `closeDate`, `plottingCompanyId`, `createdById` |
| `job_applications` | `id`, `jobPostingId`, `applicantId`, `stage`, `coverLetter`, `resumeUrl`, `hrNotes`, `rejectedReason` |
| `application_events` | pipeline audit trail |

### New (v2 — to be added)
| Table | Purpose | Key fields |
|---|---|---|
| `questions` | Shared question bank | `text`, `type`, `is_knockout`, `knockout_rule (Json)`, `scope` |
| `position_questions` | Question ↔ position + order | `positionId`, `questionId`, `order` |
| `answers` | Per-application answers (position-scope questions) | `applicationId`, `questionId`, `value (Json)` |
| `profile_answers` | Common answers stored once per candidate | `candidateId`, `questionId`, `value (Json)` |
| `position_overseers` | HRIS users with access to a position's recruitment | `positionId`, `hrisUserId`, `access (view/manage)`, `addedBy` |
| `recruitment_documents` | Stage docs both directions | `applicationId?`, `positionId?`, `stage`, `direction`, `kind`, `fileUrl?`, `linkUrl?` |

### Existing models — fields to add (v2)
- `Applicant`: `parsed_cv Json?`, `email_verified Boolean @default(false)`
- `JobApplication` stages: add `case_study_1`, `case_study_2`, `final_interview`, `col_issued`, `background_check`, `withdrawn`

---

## `parsed_cv` JSON shape (locked)

```json
{
  "summary": "string (optional)",
  "work_history": [
    { "company": "", "title": "", "industry": "", "start": "YYYY-MM", "end": "YYYY-MM or null", "current": false, "description": "" }
  ],
  "education": [
    { "institution": "", "degree": "", "field_of_study": "", "start": "YYYY-MM", "end": "YYYY-MM or null", "graduated": true }
  ],
  "skills": [
    { "name": "", "level": "beginner | intermediate | advanced | expert" }
  ],
  "languages": [
    { "language": "", "proficiency": "basic | conversational | professional | native" }
  ],
  "links": {
    "linkedin": "url or null",
    "portfolio": "url or null",
    "github": "url or null"
  }
}
```

> **Certifications deferred** — will be populated by the CV parser in a future phase.
> Do not change this shape without a migration plan for existing `parsed_cv` rows.

---

## `JobPosting.requirements` JSON shape (locked)

```json
{
  "genderPreference": "any | male | female | empty string",
  "ageMin": "number or null",
  "ageMax": "number or null",
  "minEducation": "string",
  "minExperienceYears": "number or null",
  "requiredSkills": ["string"],
  "domisili": "string"
}
```

> Do not change this shape without a migration plan for existing `job_postings.requirements` rows.

---

## Reference enums

**Application stages (12):**
`applied` → `screening` → `case_study_1` → `interview` → `case_study_2` → `final_interview` → `col_issued` → `background_check` → `offer` → `hired` / `rejected` / `withdrawn`

**Question type:** `bool`, `single`, `multi`, `number`, `text`

**Question scope:** `common` (→ `profile_answers`, asked once per candidate) | `position` (→ `answers`, asked per application)

**Knockout rule:** `{ operator: "equals" | "min" | "max" | "includes", value: any, soft: boolean }`
- `soft: false` → hard reject (status set to `rejected` on submit)
- `soft: true` → flag for HR review only

**Overseer access:** `view` | `manage`

**Document direction:** `outbound` (HR → candidate) | `inbound` (candidate → HR)

**Document kind:** `file` (PDF/DOCX/ZIP stored in R2) | `link` (external URL)

---

## Infrastructure decisions (locked)

| Decision | Choice |
|---|---|
| File storage | Cloudflare R2 (S3-compatible). Accepted: PDF/DOCX/ZIP. Max: **30 MB**. |
| Email | SMTP2GO — reuse existing `email.service.js` + `SMTP2GO_API_KEY` |
| DB | Same Neon Postgres as HRIS — no cross-app sync needed |
| Candidate auth | Email + password (bcrypt, cost 10). JWT `{ applicantId }`. |
| HR auth | Unchanged — existing `User` table + JWT `{ userId }`. |
| Recruiter / overseer identity | HRIS `User` records (`hrisUserId` = `User.id`) |

---

## Feature list

| ID | Feature | Status |
|---|---|---|
| F1 | Job listings page | ✅ done |
| F2 | Job detail page | ✅ done |
| F3 | Candidate auth: register, login, forgot-password | ✅ register/login done. Forgot-password pending. |
| F4 | Reusable candidate profile (prefill on repeat apply) | ❌ pending |
| F5 | Dynamic screening questions (per-position, from bank) | ❌ pending |
| F6 | Knockout auto-filter (hard reject vs flag) | ❌ pending |
| F7 | CV upload (file → R2) + structured info form (`parsed_cv`) | ❌ pending |
| F8 | Application submit + confirmation email | ⚠️ submit done, email pending |
| F9 | Candidate status-tracking page | ✅ done |
| F10 | Admin: question bank management | ❌ pending |
| F11 | Admin: position management + question assignment | ⚠️ position CRUD done, question assignment pending |
| F12 | Admin: applicant pipeline (view, filter, move stage) | ✅ done |
| F13 | Email notifications on stage change | ❌ pending |
| F14 | Recruiter assignment to position | ❌ pending |
| F15 | Position overseers | ❌ pending |
| F16 | Stage document exchange (outbound brief, inbound submission) | ❌ pending |

---

## Task list — v2 build order

### Epic A — Foundations
| Task | Description | Depends on | Status |
|---|---|---|---|
| A1 | Scaffold RecruitmentWeb/ | — | ✅ done |
| A2 | Schema: add 6 new tables + extend Applicant + extend stages | — | ❌ |
| A3 | Recruitment API mounted in HR backend | — | ✅ done |
| A4 | Candidate forgot-password (reset link via SMTP2GO) | A3 | ❌ |
| A5 | R2 upload endpoint (multer → R2 SDK, 30MB, PDF/DOCX/ZIP) | A2 | ❌ |

### Epic B — Candidate-facing
| Task | Description | Depends on |
|---|---|---|
| B1 | Job listings page | ✅ done |
| B2 | Job detail page | ✅ done |
| B3 | Screening questions renderer (load ordered questions, render by `type`) | A2, C1 |
| B4 | Knockout evaluation on submit (server + client) | B3 |
| B5 | CV upload UI → A5 endpoint → save `cv_file_url` | A5 |
| B6 | Structured info form (`parsed_cv` shape — repeatable rows) | A2 |
| B7 | Application submit (create `application` + `answers` + link `profile_answers`) | B3, B4, B5, B6 |
| B8 | Confirmation email on submit | B7, A4 email infra |
| B9 | Repeat-apply prefill (common answers prefilled, CV not re-requested) | B7 |
| B10 | Status-tracking page | ✅ done |
| B11 | Candidate stage submission (view brief, upload or link) | A5, C9 |
| B12 | Candidate document view + return (download issued, submit signed) | B11 |

### Epic C — Admin / HR (inside existing HRIS)
| Task | Description | Depends on |
|---|---|---|
| C1 | Question bank CRUD (`QuestionBank.jsx` in HRIS) | A2 |
| C2 | Position CRUD | ✅ done |
| C3 | Question assignment + drag-reorder to position | C1, C2 |
| C4 | Pipeline view (scoped to overseer access) | A2 |
| C5 | Applicant detail (answers, CV, knockout flags, documents) | B7, C9 |
| C6 | Stage transition (+ email trigger) | ✅ done (email trigger pending D2) |
| C7 | Recruiter assignment to position | A2 |
| C8 | Position overseers (add HRIS users, view/manage access, scope pipeline) | A2 |
| C9 | Document management (attach outbound, receive inbound) | A5 |

### Epic D — Notifications
| Task | Description | Depends on |
|---|---|---|
| D1 | Email templates (confirmation, stage invites, rejection, reset, verification) | — |
| D2 | Trigger correct email on each stage change | D1, C6 |

---

## Access control — recruitment scope

An HR user may see a position's recruitment data if **any** of these are true:
1. `accessLevel === 1` (System Admin)
2. `jobPosting.createdById === req.user.id`
3. `jobPosting.recruiterId === req.user.id`
4. `position_overseers` has a row for `(positionId, req.user.id)`

Level-2 entity scope still applies on top (they can only see postings from their `scopeEntityIds`).

---

## Deferred (post-v1)

- CV parser: read `cv_file_url`, extract fields, populate `parsed_cv`
- PDF/DOCX text extraction pipeline
- Auto-suggest screening answers from parsed CV (candidate confirms)
- Certifications section in `parsed_cv`
- Profile merge for duplicate emails

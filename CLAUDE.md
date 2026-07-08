# CLAUDE.md — HR Apps V2

Project context for Claude Code. Read this before making any changes.

## What this is

Internal HRIS + standalone recruitment website. Two frontends, one shared Express/Prisma backend, one Neon Postgres DB.

- `backend/` — shared API (port 3000)
- `frontend/` — HR employee app (port 5173)
- `../RecruitmentWeb/` — candidate recruitment SPA (port 5176, sibling folder)

## Critical rules

**DB:** use `npx prisma db push` (NOT `prisma migrate dev` — migrations folder is stale).

**Auth — two separate token types, never mix:**
- HR users → `User` table, JWT payload `{ userId }`, middleware `authenticate` + `authorizeHR`
- Candidates → `Applicant` table, JWT payload `{ applicantId }`, middleware `applicantAuthenticate`
- Applicant token on HR route = 401 (by design). Never allow cross-identity access.

**Entity scope:** Level-2 HR sees only entities in `scopeEntityIds`/`scopeGroupIds`. Always apply `applyScopeFilter(where, req.user)` from `src/utils/scopeHelper.js` on any query that lists HR-owned resources.

**File uploads:** use multer (not `express.json` body parser). Max 30MB. Accepted: PDF/DOCX/ZIP. Target: Cloudflare R2 (S3-compatible, keys in `.env`).

**Email:** SMTP2GO via `src/services/email.service.js`. Respect `smtpProfile` per entity.

**No `prisma migrate dev`.** Schema changes go via `db push` only.

## Stack

| | Tech |
|---|---|
| Backend | Node.js ESM, Express, Prisma v5, PostgreSQL (Neon) |
| Frontend | React 18, Vite 5, Tailwind 3, TanStack Query v5, react-router-dom v6 |
| Auth | JWT (jsonwebtoken), bcrypt (cost 10) |
| Email | SMTP2GO REST API |
| Files | Cloudflare R2 (`@aws-sdk/client-s3`) |

## Key files

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Single source of truth for DB shape |
| `backend/src/index.js` | Route mounting + CORS config |
| `backend/src/middleware/auth.js` | HR auth middleware (`authenticate`, `authorizeHR`, `requireRole`) |
| `backend/src/middleware/applicantAuth.js` | Candidate auth middleware |
| `backend/src/utils/scopeHelper.js` | Entity scope filter helpers |
| `backend/src/services/email.service.js` | SMTP2GO email sender |
| `backend/src/config/storage.js` | File storage config |
| `frontend/src/App.jsx` | HR app routing |
| `../RecruitmentWeb/src/App.jsx` | Candidate SPA routing |
| `../RecruitmentWeb/src/api/clients.js` | Two axios instances (hrClient + applicantClient) |

## Access levels

1 = System Admin (all), 2 = Subsidiary HR (scoped), 3 = Manager, 4 = Staff, 5 = Intern

## Recruitment module

Full plan: `docs/RECRUITMENT_PLAN.md`

v0 built (job board, candidate auth, pipeline kanban, stage transitions).
v2 in progress (question bank, CV upload/R2, structured profile, document exchange, overseers, email notifications).

New recruitment tables: `questions`, `position_questions`, `answers`, `profile_answers`, `position_overseers`, `recruitment_documents`.

Recruitment pipeline stages (12): `applied → screening → case_study_1 → interview → case_study_2 → final_interview → col_issued → background_check → offer → hired / rejected / withdrawn`

`parsed_cv` JSON shape is locked — see `docs/RECRUITMENT_PLAN.md` §parsed_cv JSON shape. Do not change without migration plan.

## Branch workflow

`main` = production. Always branch: `feat/`, `fix/`, `chore/`. PR required to merge. See `CONTRIBUTING.md`.

# Rhaya Human Resources System

Internal HR platform + standalone recruitment website.

---

## Projects in this repo

| Project | Path | Port | Description |
|---|---|---|---|
| **HR Backend** | `backend/` | `3000` | Shared Express + Prisma API. Source of truth for all data. |
| **HR Frontend** | `frontend/` | `5173` | Internal HRIS — employee-facing (leave, overtime, payslips, etc). |
| **Recruitment Web** | `../RecruitmentWeb/` | `5176` | Standalone candidate-facing SPA. Separate folder, same backend. |

> `RecruitmentWeb/` lives at `App(s)/RecruitmentWeb/` (sibling of this repo). It is a separate deployable but shares the HR backend API.

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express, Prisma ORM, PostgreSQL (Neon) |
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query, react-router-dom v6 |
| Auth | JWT (bcrypt passwords). HR users → `User` table. Candidates → `Applicant` table. |
| Email | SMTP2GO |
| File storage | Cloudflare R2 (S3-compatible) |
| Deploy | Cloudflare Pages (frontend), Railway (backend) |

---

## Local setup

### Prerequisites
- Node.js 18+
- Access to `.env` files (get from team lead — never committed)

### Backend
```bash
cd backend
npm install
cp .env.example .env        # fill in values from team lead
npx prisma generate
npm run dev                  # starts on :3000
```

### HR Frontend
```bash
cd frontend
npm install
npm run dev                  # starts on :5173, proxies /api → :3000
```

### Recruitment Web (separate folder)
```bash
cd ../RecruitmentWeb
npm install
npm run dev                  # starts on :5176, proxies /api → :3000
```

---

## Branch workflow

```
main          → production (Railway auto-deploys on merge)
development   → integration (merge PRs here first)
feat/<name>   → new features
fix/<name>    → bug fixes
chore/<name>  → non-feature work (deps, docs, config)
```

**Steps:**
```bash
git checkout development && git pull origin development
git checkout -b feat/your-feature
# ... work, commit ...
git push origin feat/your-feature
gh pr create --base development
```

To release: PR `development → main`. PRs require at least one review. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Environment variables

See `backend/.env.example` for all required keys.

Key groups:
- `DATABASE_URL` — Neon Postgres connection string
- `JWT_SECRET` — signs HR user + candidate tokens (same secret, different payloads)
- `R2_*` — Cloudflare R2 file storage (CV uploads + stage documents)
- `SMTP2GO_*` — transactional email
- `FRONTEND_URL` / `RECRUITMENT_URL` — CORS allowed origins
- `HR_LEGAL_SECRET` / `HR_INVENTORY_SECRET` — HMAC keys for internal integrations

---

## Database

Schema managed via Prisma migrations.

```bash
cd backend
npx prisma migrate dev --name your_change   # generate + apply migration locally (commit the file)
npx prisma generate                          # regenerate client after schema edit
npx prisma studio                            # GUI to inspect data
```

**Prod/staging (Railway):** `prisma migrate deploy` runs automatically on every deploy — no manual action needed.

> Do NOT use `db push` for real changes — prod tracks migration files. `db push` is only for quick throwaway local experiments.

---

## Access levels

| Level | Role | Sees |
|---|---|---|
| 1 | System Admin | Everything |
| 2 | Subsidiary HR | Only scoped entities (`scopeEntityIds`) |
| 3 | Manager | Own division |
| 4 | Staff | Own data |
| 5 | Intern | Own data (limited) |

---

## Key API routes

| Prefix | Auth | Purpose |
|---|---|---|
| `/api/auth/*` | public | HR user login, password reset |
| `/api/users/*` | HR JWT | Employee management |
| `/api/leaves/*` | HR JWT | Leave requests + approvals |
| `/api/overtime/*` | HR JWT | Overtime requests + approvals |
| `/api/payslips/*` | HR JWT | Payslip upload + view |
| `/api/work-status/*` | HR JWT | Daily attendance status |
| `/api/recruitment/public/*` | public | Job board (candidates) |
| `/api/recruitment/applicant-auth/*` | public | Candidate register/login |
| `/api/recruitment/my/*` | Candidate JWT | Candidate's own applications |
| `/api/recruitment/jobs/*` | HR JWT (Level 1-2) | Job posting CRUD |
| `/api/recruitment/applications/*` | HR JWT (Level 1-2) | Pipeline management |

---

## Recruitment module

See [docs/RECRUITMENT_PLAN.md](docs/RECRUITMENT_PLAN.md) for full v2 plan + build order.

**v0 (built):** job board, candidate auth (email+password), basic pipeline kanban, stage transitions, event audit trail.

**v2 (in progress):** question bank, CV upload (R2), structured candidate profile, document exchange, overseer access, email notifications.

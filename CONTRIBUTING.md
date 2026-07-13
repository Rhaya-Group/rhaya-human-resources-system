# Contributing

## Setup

Follow [README.md](README.md) local setup. Get `.env` values from the team lead.

---

## Branch naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<short-description>` | `feat/recruitment-question-bank` |
| Bug fix | `fix/<short-description>` | `fix/leave-balance-reset` |
| Chore | `chore/<short-description>` | `chore/update-deps` |

Always branch off `development`:
```bash
git checkout development && git pull origin development
git checkout -b feat/your-feature
```

**Small/routine changes:** `development` is unprotected — committing and pushing directly to it is fine (`git push origin development`), no feature branch or PR needed. Reserve feat/fix/chore branches + PR for changes you want reviewed before they land.

---

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:   new feature
fix:    bug fix
chore:  deps, config, tooling
docs:   documentation only
refactor: no behavior change
```

Subject line ≤ 50 chars. Body explains the *why*, not the *what*.

---

## Pull requests

Workflow: `feat/* → development → main` (only two long-lived branches: `development` and `main`)

- Day-to-day: commit directly to `development`, or PR a feat/fix/chore branch → `development` if you want review first
- Release: PR `development` → `main` (protected, review required, triggers Railway prod deploy)

```bash
git push origin feat/your-feature
gh pr create --base development
```

1. Fill in the PR template
2. At least one review required before merge
3. Delete branch after merge

---

## Database changes

**Always use `prisma migrate dev` locally, never `db push`.**

```bash
# After editing backend/prisma/schema.prisma:
cd backend
npx prisma migrate dev --name describe_your_change
npx prisma generate
git add prisma/migrations          # commit the generated migration file
```

Prod (Railway) applies migrations automatically via `prisma migrate deploy` on every deploy.
Do NOT run `db push` — it bypasses migration tracking and will cause drift between environments.

---

## File storage (R2)

CV uploads and stage documents go to Cloudflare R2.
- Accepted types: PDF, DOCX, ZIP
- Max size: 30 MB
- Never store files locally in `uploads/` for production (`.gitignore` excludes them)

---

## Code style

- No comments explaining *what* the code does — only *why* (non-obvious constraints, workarounds)
- Controllers stay thin — business logic in services
- All HR routes use `authenticate` + `authorizeHR` middleware
- All candidate routes use `applicantAuthenticate` middleware
- Entity scope: always apply `applyScopeFilter(where, req.user)` for Level-2 HR queries

---

## Recruitment module

Admin UI (question bank, pipeline, overseers) lives in the **HR frontend** (`frontend/`).
Candidate UI lives in **RecruitmentWeb/** (sibling folder, separate deploy).
Both use the same backend at `/api/recruitment/*`.

See [docs/RECRUITMENT_PLAN.md](docs/RECRUITMENT_PLAN.md) for full feature plan + task list.

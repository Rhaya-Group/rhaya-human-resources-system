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

Always branch off `main`:
```bash
git checkout main && git pull origin main
git checkout -b feat/your-feature
```

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

1. Push branch → open PR against `main`
2. Fill in the PR template
3. At least one review required before merge
4. Delete branch after merge

```bash
git push origin feat/your-feature
gh pr create --base main
```

---

## Database changes

**Always use `db push`, not `prisma migrate dev`.**

```bash
# After editing backend/prisma/schema.prisma:
cd backend
npx prisma db push
npx prisma generate
```

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

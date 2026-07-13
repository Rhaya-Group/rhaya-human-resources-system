## What

<!-- One paragraph: what changed and why. -->

## Type

- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] chore — deps / config / tooling
- [ ] docs — documentation only
- [ ] refactor — no behavior change

## Related epic / task

<!-- e.g. Recruitment v2 — Epic A / A2 -->

## DB changes

- [ ] No schema changes
- [ ] Schema changed → ran `npx prisma migrate dev --name describe_change` + committed migration file

## Testing

<!-- How did you verify this works? What did you manually test? -->

## Checklist

- [ ] Branch off `development`, up to date with `development`
- [ ] No `.env` values committed
- [ ] HR routes use `authenticate` + `authorizeHR`
- [ ] Candidate routes use `applicantAuthenticate`
- [ ] Level-2 scope filter applied where needed (`applyScopeFilter`)
- [ ] No `console.log` left for debugging

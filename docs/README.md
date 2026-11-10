# Beavo docs

Long-lived project knowledge. `CLAUDE.md` (repo root) is the always-loaded summary; these files hold the detail so it doesn't bloat that one.

| File | Purpose | Update when |
|---|---|---|
| [ROADMAP.md](ROADMAP.md) | What is done, what is next | A task finishes or priorities change |
| [decisions/](decisions/) | ADRs: why we chose X over Y | A non-obvious technical choice is made |
| [CLINICAL.md](CLINICAL.md) | Coaching-copy rules and advisor-approved wording | Copy changes — advisor must review |
| [RUNBOOK.md](RUNBOOK.md) | Checks, builds, releases, common failures | A process changes or a failure recurs |

Rule for agents: if code and a doc disagree, don't silently pick one. Fix the stale one in the same change, or flag it.

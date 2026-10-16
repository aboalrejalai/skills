---
name: kickoff-using
description: The kickoff line's map of specialist skills — which one each station (plan, implement, review, ship, launch) calls, and when. Use when a kickoff station reaches a job a specialist owns, and when the user asks which skill fits a job (وش أستخدم).
---

# Kickoff Using

The line's stations stay small and stable; this map is the one place that names the specialists they call. Adding, swapping or dropping a specialist is an edit here, and the stations do not change.

```
kickoff-plan → kickoff-implement → kickoff-review → the owner says "اعتمد" → /kickoff-ship
```

**A specialist that is missing.** Tell the owner in one line which skill is not installed and that `/kickoff-setup` installs it, then carry on without it. Installing is `/kickoff-setup`'s job, done with the owner's yes.

**Outside Claude Code.** `/code-review` and `/security-review` are Claude Code built-ins, and the agents (`database-reviewer`, `silent-failure-hunter`) live in `~/.claude/agents/`. In Cursor or Codex, do that row's check yourself with the same focus.

## Plan (`kickoff-plan`)

| Specialist | Call it when |
|---|---|
| `graphify` (CLI) | Always. Read `graphify-out/GRAPH_REPORT.md`; when it is missing and the `graphify` command exists, build it first with `graphify update .` |
| `research` | The plan depends on a third-party API or library whose current behaviour must come from its own docs |
| `grilling` | The request is too vague to plan, or the owner asks to be grilled |
| `prototype` | A throwaway build would settle a design question faster than talk |
| `domain-modeling`, `codebase-design` | The plan names new domain terms or moves a module boundary |

## Implement (`kickoff-implement`)

| Specialist | Call it when |
|---|---|
| `tdd` | A task adds logic that its Agent check proves with a new test |
| `supabase`, `supabase-postgres-best-practices` | A task touches the database: a query, a migration, RLS, an Edge Function |
| The project's `verify-<app>` skill, on `e2e` | A task changes what a user sees or does. Prove it the way a user would, and keep the evidence it writes under `.e2e/` |
| `webapp-testing` | A UI task in a project that has no `verify-<app>` skill yet |
| `diagnosing-bugs` | A task's check stays red after the first fix attempt |

## Review (`kickoff-review`)

Call every row the review risk reaches, report-only.

| Reviewer | When |
|---|---|
| `code-review` (Claude Code built-in) | Always. Effort `low`, `medium` or `high` matching the risk; target the branch against `main` |
| `clean-code-guard` | Medium and high, on the changed non-test files |
| `test-guard` | When test files changed |
| `docs-guard` | When READMEs, docs or docstrings changed |
| `security-review` (Claude Code built-in) | High, and medium with any sensitive path |
| `security-audit` | High. Target the repo; focus its hunt on the changed files and the trust boundaries they cross; use its default output directory; carry over its MEDIUM and higher findings and link its `REPORT.md` |
| `database-reviewer` (agent) | Migrations, schema, RLS or SQL changed |
| `silent-failure-hunter` (agent) | The diff touches fallbacks, caught errors, demo mode or seed data |
| The project's `verify-<app>` skill, on `e2e` | The branch changes user-facing behaviour: run its proof again yourself |
| Second-model debate (`debate-review`) | Reserved; write "not active" until its `review-main` and `review-debate` lanes exist |

## Ship (`/kickoff-ship`)

| Specialist | Call it when |
|---|---|
| `e2e` in CI | The repo has e2e tests: they run on the pull request through its GitHub Actions workflow |
| `babysit-pr` | Bots or reviewers left comments on the open PR |

## Before a launch

Once, before real users first arrive, and before each major release: `production-audit`, then `security-audit` two or three times on the whole repo (each run finds about half of what several find, and later runs skip what earlier ones found).

## Anything else

For a job no row covers, read the catalog at `~/.agents/skills/kickoff-setup/references/catalog.md`; if nothing fits there either, `find-skills` searches the wider ecosystem. Tell the owner before installing anything new.

## Core set

What `/kickoff-setup` installs once per machine (user scope, every project). Skills install with `npx skills@latest add <source> -s <skill> -g -y`; agents with `bash ~/.agents/skills/kickoff-setup/scripts/agents.sh add affaan-m/ECC agents/<name>.md --global`.

| Source | Skills or agents |
|---|---|
| `mattpocock/skills` | `research`, `grilling`, `prototype`, `domain-modeling`, `codebase-design`, `tdd`, `diagnosing-bugs` |
| `supabase/agent-skills` | `supabase`, `supabase-postgres-best-practices` |
| `tester-army/e2e` | `e2e`, `create-verification-skill` |
| `anthropics/skills` | `webapp-testing` |
| `amElnagdy/guard-skills` | `clean-code-guard`, `test-guard`, `docs-guard` |
| `cloudflare/security-audit-skill` | `security-audit` |
| `amElnagdy/review-skills` | `debate-review`, `babysit-pr` |
| `affaan-m/ECC` | skill `production-audit`; agents `database-reviewer`, `silent-failure-hunter` |
| `graphify` CLI | `uv tool install graphifyy` |

# Kickoff Setup catalog

`kickoff-setup` installs only the core set named in the `kickoff-using` skill. This catalog is the wider shelf: an agent reads it when a job comes up that `kickoff-using` does not cover, and tells the owner before installing anything from it.

Every entry lives in its own upstream repo and installs from there at its latest version. This file holds only the pointer, the signal that makes an entry worth recommending, and what it overlaps with. Entries were checked to exist on 2026-10-07; if an install reports a missing skill or file, list the repo (`npx skills@latest add <source> --list`) and correct the entry.

## Contents

- [Install methods](#install-methods)
- [Skills](#skills)
  - [e2e notes](#e2e-notes)
- [Agents](#agents)
- [Hooks](#hooks)
- [Other systems](#other-systems)
- [Overlaps](#overlaps)

## Install methods

| Kind | Command | Updates with |
|---|---|---|
| skill | `npx skills@latest add <source> -s <skill> -y` (add `-g` for every project) | `npx skills@latest update -y` |
| agent | `bash <this-skill-dir>/scripts/agents.sh add <source> <path>` (add `--global` for every project) | `agents.sh check`, then `agents.sh apply` |
| hook | The entry's own method, in its row | Re-run the entry's method |

Agents install into `.claude/agents/`, which only Claude Code reads. Skills install for every agent the skills CLI detects.

## Skills

**Manual** in the last column means the upstream skill sets `disable-model-invocation: true`: only the user typing `/<name>` can run it, so list it for the user by name in the final report.

### Always worth having

| Skill | Source | Does | Manual |
|---|---|---|---|
| `kickoff-plan`, `kickoff-implement`, `kickoff-review`, `kickoff-ship` | the user's own (symlinked from his `kickoff` repo, not npx) | The kickoff line: plan with risk ratings, implement on a feature branch, review by risk, ship through a PR | `kickoff-ship` |
| `clean-code-guard`, `test-guard`, `docs-guard` | `amElnagdy/guard-skills` | Review written code, tests, and docs before they ship | |
| `security-audit` | `cloudflare/security-audit-skill` | Find exploitable security bugs; `kickoff-review` runs it on high-risk branches. One run finds roughly half of what several runs find, so run it two or three times on the whole repo before a launch | |
| `debate-review`, `babysit-pr` | `amElnagdy/review-skills` | Two-model review before a merge (needs `review-main` and `review-debate` lanes from `delegate-setup`); driving a PR through bot review rounds | |
| `diagnosing-bugs` | `mattpocock/skills` | A disciplined loop for hard bugs | |
| `grilling` | `mattpocock/skills` | Question a vague request until it is clear | |

### Recommend on a signal

| Skill | Source | Recommend when | Manual |
|---|---|---|---|
| `tdd` | `mattpocock/skills` | The project has tests or should | |
| `to-spec`, `to-tickets`, `implement`, `triage` | `mattpocock/skills` | Work is tracked as issues or tickets | yes |
| `wayfinder` | `mattpocock/skills` | Work spans many sessions | yes |
| `domain-modeling`, `codebase-design`, `improve-codebase-architecture` | `mattpocock/skills` | A large codebase with unclear naming or module boundaries | last one |
| `handoff` | `mattpocock/skills` | Work moves between agents or sessions | yes |
| `wizard` | `mattpocock/skills` | The user must do dashboard or credential steps by hand | |
| `research` | `mattpocock/skills` | Decisions depend on facts from primary docs | |
| `prototype` | `mattpocock/skills` | A throwaway build answers a design question faster than talk | |
| `subagent-driven-development` | `obra/superpowers` | The user wants a plan executed task by task without stopping, each task by a fresh implementer and a fresh reviewer. It names companions `finishing-a-development-branch`, `requesting-code-review`, `test-driven-development`, `using-git-worktrees`, `verification-before-completion`; install those with it | |
| `verification-before-completion`, `systematic-debugging` | `obra/superpowers` | Agents have claimed work was done when it was not | |
| `verification-loop` | `affaan-m/ECC` | Any project with a build: one pass/fail report over build, types, lint, tests, security grep, diff | |
| `production-audit` | `affaan-m/ECC` | The project will launch to real users | |
| `click-path-audit` | `affaan-m/ECC` | A UI with many buttons and state | |
| `e2e-testing`, `browser-qa` | `affaan-m/ECC` | A web UI; Playwright is or will be used | |
| `webapp-testing` | `anthropics/skills` | A web UI checked by driving a browser | |
| `e2e` | `tester-army/e2e` | A web or mobile app where the user wants tests written as plain-language goals an agent drives in a real browser, and wants to read what is tested without reading code. See [e2e notes](#e2e-notes) | |
| `react-testing` | `affaan-m/ECC` | dep: react | |
| `frontend-design` | `anthropics/skills` | New UI is being designed | |
| `supabase`, `supabase-postgres-best-practices` | `supabase/agent-skills` | dep: @supabase/supabase-js or a `supabase/` dir | |
| `postgres-patterns`, `database-migrations` | `affaan-m/ECC` | SQL migrations exist | |
| `error-handling` | `affaan-m/ECC` | Code calls networks, files, or databases and failures matter | |
| `ai-regression-testing` | `affaan-m/ECC` | AI agents both write and review the code | |
| `cost-aware-llm-pipeline` | `affaan-m/ECC` | The product itself calls an LLM API | |
| `canary-watch` | `affaan-m/ECC` | A deployed URL exists | |
| `context-budget` | `affaan-m/ECC` | More than about 40 skills are installed, or sessions fill up fast | |
| `mcp-builder` | `anthropics/skills` | The project builds an MCP server | |
| `skill-creator`, `find-skills` | `anthropics/skills`, `vercel-labs/skills` | The user writes or hunts for skills | |

ECC ships more stack skills under one naming scheme: `<stack>-patterns`, `<stack>-testing`, `<stack>-security`, `<stack>-tdd` for Django, Laravel, Spring Boot, Quarkus, NestJS, FastAPI, Rails, Go, Rust, Kotlin, Swift, Python, Perl, .NET, Flutter, React Native, Nuxt, Vue, Angular. When the project's stack is one of these, list ECC (`npx skills@latest add affaan-m/ECC --list`) and recommend the matching ones.

### e2e notes

`e2e` is a test framework (npm package `e2e`, Apache-2.0) with a companion skill of the same name. Installing the skill gives the agent the framework's instructions; the framework itself goes into the project with `npx e2e init`, which asks for an engine (web or mobile) and a model provider and writes `e2e.config.ts` plus an example test. Docs: <https://e2e.tester.army/docs>, also shipped offline in `node_modules/e2e/docs`.

Tell the user these facts before installing, since each one shapes a decision:

- **Model access.** Agent steps need a model with tool calls and images. Claude subscriptions are not supported; a ChatGPT Plus or Pro, GitHub Copilot, OpenCode, or SuperGrok subscription works through `npx e2e login <provider>`, as does any API key the AI SDK supports.
- **Cost.** A verified agent step is recorded and replayed with no model calls until the page changes, so repeat runs are cheap.
- **Maturity.** Pre-1.0 (0.18.0 on 2026-10-07); its APIs and config can change between minor releases. Read its changelog on update.
- **Telemetry.** On by default, anonymous; turn off with `npx e2e telemetry disable`.
- **Scope.** It proves the flows written for it work. It is separate from security testing: access-control and row-level-security checks still need their own tests.

Start with the ten or so journeys the product cannot ship without, pair each agent goal with an exact assertion, and wire it into CI only after a week of stable local runs.

## Agents

All from `affaan-m/ECC`, path `agents/<name>.md`.

| Agent | Recommend when |
|---|---|
| `silent-failure-hunter` | Code has fallbacks, caught errors, or seed-data defaults that could hide real failures |
| `security-reviewer` | The app has logins, user data, or secrets |
| `database-reviewer` | SQL, migrations, or row-level security exist. Pairs with `postgres-patterns`, `database-migrations` |
| `e2e-runner` | A web UI should be tested as a user would use it. Pairs with `e2e-testing` |
| `build-error-resolver` | Builds or type checks break often |
| `code-reviewer` | No other code reviewer is installed |
| `pr-test-analyzer` | Changes land through pull requests with tests |
| `refactor-cleaner` | Dead code and duplication have piled up |
| `doc-updater` | Docs must track the code |
| `performance-optimizer` | Users report slowness |
| `comment-analyzer`, `type-design-analyzer`, `code-simplifier` | A human developer will read this code later |

Stack-specific agents follow two naming schemes; recommend the pair that matches the detected stack:

- `<stack>-reviewer`: react, typescript, python, go, rust, java, kotlin, swift, php, csharp, fsharp, cpp, vue, django, fastapi, flutter
- `<stack>-build-resolver`: react, go, rust, java, kotlin, swift, cpp, dart, django, pytorch

## Hooks

Hooks are programs the harness runs on its own, so they execute code on the user's machine. Each one needs its own yes, separate from skills and agents.

| Hook set | Source and method | Does | Recommend when |
|---|---|---|---|
| Pre-commit checks | `mattpocock/skills`, skill `setup-pre-commit`: install it, then run it | Husky runs formatting, type check, and tests before every commit. Lives in the repo, so it guards every agent and every human | A Node project with no `.husky/` |
| Git guardrails | `mattpocock/skills`, skill `git-guardrails-claude-code`: install it, then run it | Blocks destructive git commands in Claude Code. Its default list includes `git push`; take `push` off the list when running it, because `/kickoff-ship` pushes the feature branch, and `kickoff-implement` already blocks every push to `main` with its own hook | The user worries about an agent destroying work |
| ECC hook runtime | Clone `affaan-m/ECC` to a temp dir, then `bash install.sh --target claude-project --modules hooks-runtime --enable-hooks --dry-run`; show the file count, then repeat without `--dry-run` | Type check and format after each edit, a quality gate before each commit, console.log warnings, session summaries. Copies ECC's whole script runtime (hundreds of files) into `.claude/`. Tune with `ECC_HOOK_PROFILE=minimal` and `ECC_DISABLED_HOOKS` | The user wants automatic checks after every edit and accepts the weight |

## Other systems

Install each per its own README, and only when its row says so.

| System | Link | Use it when |
|---|---|---|
| Spec Kit | [github/spec-kit](https://github.com/github/spec-kit) | Only when the owner names it ("Spec Kit", "سبيكت", "speckit"); the size of a task never selects it, and neither does a general "go ahead". Installs per project after asking: `uv tool install specify-cli`, then `specify init . --integration claude` (`cursor-agent` for Cursor, `codex` for Codex). Run its commands in its own order (constitution, specify, clarify, plan, tasks, implement) and keep the chain whole; `kickoff-review` and `/kickoff-ship` still close the work. Helpers: `wayfinder` when the work outlasts one session, `grilling` when requirements are too vague to specify |
| Superpowers | [obra/superpowers](https://github.com/obra/superpowers) | The owner explicitly wants its workflow |
| Agent Reach | [Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach) | Reading or searching social platforms and the web |
| graphify | [safishamsi/graphify](https://github.com/safishamsi/graphify) | Questions about a large codebase's structure; `kickoff-plan` reads its `graphify-out/GRAPH_REPORT.md` |

Spec Kit and Superpowers each bring their own router. While one is driving a task, let it drive and keep the kickoff line to review and ship only, because two routers steering one task is how the flow falls apart.

## Overlaps

Recommend one from each row; when one is already installed, skip the others.

| Job | Candidates |
|---|---|
| Code quality review | `clean-code-guard`, agent `code-reviewer` |
| Security review | `security-audit`, agent `security-reviewer`, ECC `security-review` |
| Test-first workflow | `tdd` (Matt), `test-driven-development` (Superpowers), ECC `tdd-workflow` |
| Debugging | `diagnosing-bugs` (Matt), `systematic-debugging` (Superpowers) |
| Planning | `kickoff-plan` owns this; skip `writing-plans` (Superpowers), ECC `blueprint`, agent `planner` |
| Routing | The kickoff line in the `AGENTS.md` block owns this; skip `using-superpowers` and the ECC `orch-*` family |
| Browser UI checks | `webapp-testing`, `browser-qa`, `e2e-testing`; `e2e` (tester-army) is a different job, a kept test suite, and can sit beside one of them |
| Postgres guidance | `supabase-postgres-best-practices`, `postgres-patterns` |

Matt's `code-review` shares its name with Claude Code's built-in `/code-review`. Leave it out for Claude Code; it is safe to install for Cursor or Codex only (`-a cursor`).

---
name: kickoff-plan
description: "The user's planning method and the first station of the kickoff line. Use at the start of any coding task, whenever the user asks to plan a project, break down work, map out a new feature, or architect a solution, even without the word 'plan', and when he says kickoff / ابدأ. It decomposes work into atomic, risk-rated tasks that each carry a check the agent can run, and saves the plan to .cursor/plans/NNN-name.plan.md, linked into .agents/plans/ and .claude/plans/. That file is the contract kickoff-implement, kickoff-review and kickoff-ship read."
---
# Planning and Task Breakdown

## 🌟 GOLDEN RULE: Output and Persistence
Your absolute **first priority** for this skill is to save the generated plan in the `.cursor/plans` directory. 
- **Do NOT overwrite old plans.**
- **Automated Setup Script:**
  - Before writing the plan, you **MUST** run the setup script bundled with this skill. Do NOT guess or manually construct the plan path.
      `bash "<this-skill-dir>/scripts/new-plan.sh" "<feature-name>"`
    *(It creates the next numbered plan as a single file, `.cursor/plans/NNN-feature-name.plan.md`, pre-filled with `assets/plan-template.md`, and symlinks it into `.agents/plans/` and `.claude/plans/`, so every agent reads the same file. The `.plan.md` suffix is Cursor's plan format.)*
  - Parse the returned JSON to find the absolute path (`NEW_PLAN_PATH`) and write your plan strictly to that file.

## The plan is the contract
This skill is the first station of the kickoff line:

```
kickoff-plan → kickoff-implement → kickoff-review → the owner says "اعتمد" → /kickoff-ship
```

The plan file is the one record every later stage reads and writes: `kickoff-implement` ticks each `- [ ] TASK-NNN` line and appends evidence to the Implementation Log, `kickoff-review` writes the Review section, the owner's approval is recorded under Approval, and `kickoff-ship` fills Ship. So keep the template's section headings and the task line format exactly as given, because the scripts of those skills find tasks and sections by them. The owner does not read code and is learning English: the whole plan is in English, and every field meant for him (the owner summary, Owner check, Approval) uses short sentences and everyday words. Talk to him in chat in the language he writes in.

## Overview
Decompose work into small, verifiable tasks with explicit acceptance criteria. Good task breakdown is the difference between an agent that completes work reliably and one that produces a tangled mess. Every task should be small enough to implement, test, and verify in a single focused session.

## Planning Doctrine
- **Think broadly, implement narrowly.** Analyze the surrounding system before deciding where the change belongs.
- **Every change has system implications.** Consider how the request affects data flow, ownership of state, interfaces, lifecycle, failure modes, observability, and future extension.
- **Prefer authoritative, derivable designs.** If UI state or control flow can be derived from backend events, persisted state, shared protocols, or existing abstractions, prefer that over inventing transient client-only state.
- **Choose the smallest coherent solution.** Do not default to the smallest local patch if it distorts the architecture or adds hidden follow-on complexity.
- **Expand scope only when it simplifies the system.** Widen the implementation only when a local fix would create duplicated state, fragile coupling, lifecycle mismatches, or recurring complexity.
- **Do not gold-plate.** Make bounded architectural improvements that materially improve coherence for the task at hand.
- **Never trust stale API knowledge.** When integrating with 3rd-party services (e.g., Stripe, Supabase), APIs change frequently. Your plan MUST mandate that the implementation phase verifies current API signatures by searching the web or reading official docs. Prefer flexible abstraction (e.g., passing configuration objects rather than strict positional arguments) to reduce breakage surface.
- **Learn from the latest plan:** To save tokens, do NOT read old plans. Instead, locate only the single latest completed plan in `.cursor/plans/` (the file with the highest sequence number). Read ONLY its `Risks and Assumptions` and `Rollback Plan` sections to understand immediate context and lessons learned, then stop. Do not scan or read any other plans.
- **Platform Native Minimalism:** Prefer the standard library or native platform features (e.g., native HTML `<input type="date">`) over external dependencies. If a requirement can be fulfilled in one line, plan it as a one-liner.
- **Consult Native Platforms:** Before suggesting any external library or package, you MUST read `references/platform-native.md` to check if HTML, CSS, JavaScript, or the backend standard library natively supports the requirement.
- **Deletion over addition:** Actively plan to remove dead code instead of just adding new code.

## The Planning Process

### Step 1: Understand Architecture via Graphify
If the project's `AGENTS.md` has no `<!-- KICKOFF START -->` block, the line's rules are not set up there yet: tell the owner once to run `/kickoff-setup`, then continue.

To save tokens and instantly understand the project's structure, you must rely on the project's graph report. Look for `graphify-out/GRAPH_REPORT.md`:
- **If it exists:** Read it immediately. It contains a complete map of the project's architecture, dependencies, and components. Use this to understand the system instead of manually scanning all project files.
- **If it DOES NOT exist:** when the `graphify` command is available, build the graph with `graphify update .` and read the report it writes. Otherwise do not block or ask the user to run `/graphify`: analyze the available files in the workspace (or discuss requirements directly if it is a new/empty project) to understand the structure.

Specialists for planning (`research` for third-party APIs, `grilling` for a vague request, `prototype`, `domain-modeling`, `codebase-design`) are listed with their triggers in the `kickoff-using` skill under Plan; call one when its trigger appears.

### Step 2: New Feature Research (Phase 0)
Determine the size of the request:
- **Small Tasks (XS, S)**: If the user wants a simple change (e.g., changing a color, fixing a typo, updating a single component), **SKIP exploration** and proceed immediately to writing the plan.
- **Large/Complex Tasks (M, L, XL)**: If the task requires architectural changes, new workflows, or complex logic, enter a brief **Explore Mode**. Act as a thinking partner. Discuss the options, draw ASCII diagrams, and agree on an approach before writing the plan. Do NOT re-explore the project's architecture if `GRAPH_REPORT.md` is available.

If introducing new external libraries or architectural patterns, document the decision in the plan's Research section.

### Step 3: Clarify Requirements
Before documenting the plan, identify potential pitfalls, edge cases, or ambiguous requirements. Stop and ask the user clarifying questions if needed. Prioritize questions about:
1. Goals, scope, and non-goals
2. Core workflows and tech constraints
3. Edge cases and error handling

### Step 4: Identify the Dependency Graph
Map what depends on what:
```
Database schema
    │
    ├── API models/types
    │       │
    │       ├── API endpoints
    │       │       │
    │       │       └── Frontend API client
    │       │               │
    │       │               └── UI components
    │       │
    │       └── Validation logic
    │
    └── Seed data / migrations
```
Implementation order follows the dependency graph bottom-up: build foundations first.

### Step 5: Slice Vertically
Instead of building all the database, then all the API, then all the UI — build one complete feature path at a time:

**Bad (horizontal slicing):**
```
Task 1: Build entire database schema
Task 2: Build all API endpoints
Task 3: Build all UI components
Task 4: Connect everything
```

**Good (vertical slicing):**
```
Task 1: User can create an account (schema + API + UI for registration)
Task 2: User can log in (auth schema + API + UI for login)
Task 3: User can create a task (task schema + API + UI for creation)
Task 4: User can view task list (query + API + UI for list view)
```

Each vertical slice delivers working, testable functionality.

### Step 6: Write Tasks
Use formal identifiers for all tasks (e.g., `TASK-001`). Each task must be atomic, committable, and independently testable.

**Task Naming Format (REQUIRED):**
`- [ ] TASK-001 (medium) [P] [US1]: Description`
- `(risk)`: always present, one of `(low)`, `(medium)`, `(high)`.
- `[P]` marker: Include ONLY if the task is parallelizable (no dependencies on incomplete tasks).
- `[Story]` label: Include if the task is tied to a specific User Story (e.g., `[US1]`, `[US2]`).

**Bad Task Example:** "Implement Google OAuth"
**Good Task Example:**
- `TASK-001 (high) [US1]`: "Add Google OAuth config to env variables"
- `TASK-002 (medium) [P] [US1]`: "Install passport-google-oauth20 package"
- `TASK-003 (high) [US1]`: "Create OAuth callback route in src/routes/auth.ts"
- `TASK-004 (low) [P] [US1]`: "Add Google sign-in button to login UI"

Each task's detailed definition must follow the exact structure defined in the `assets/task-template.md` file. You MUST read `assets/task-template.md` and use it as the literal format for every task you define. Do NOT invent your own format.

Each task is one commit, and carries three fields the later stages depend on:
- **Risk**: low, medium or high, from the [Risk](#risk) table. It sets how deep review goes and who merges.
- **Agent check**: the exact command or browser check the agent runs itself to prove the task works (`npm test -- cart`, `npm run build`, "open /cart on localhost and screenshot the total"). A check the agent cannot run is a wish, so if a task has none, add a test or a script to the task until it does.
- **Owner check**: one or two short, plain-English lines saying what the owner looks at on localhost to confirm the behaviour is the one he wanted. He judges behaviour, never code.

### Step 7: Order and Checkpoint
Arrange tasks so that:
1. Dependencies are satisfied (build foundation first)
2. **Safe Refactoring Sequence**: When modifying existing code, prefer: Contracts/Types first -> Implementations -> Callers -> Tests -> Cleanup.
3. Each task leaves the system in a working state
4. Verification checkpoints occur after every 2-3 tasks
5. High-risk tasks are early (fail fast)

Add explicit checkpoints:

```markdown
## Checkpoint: After Tasks 1-3
- [ ] All tests pass
- [ ] Application builds without errors
- [ ] Core user flow works end-to-end
- [ ] (high risk only) Review with human before proceeding
```

### Step 8: Rate the plan and decide where to stop
The plan's risk is its highest task risk; write it in the frontmatter `risk:` field. Then:
- **Stop for approval** when the plan is high risk, when the harness is in plan mode, or when the user asked only for a plan. Summarise the plan for the owner in a few lines, in his language, and wait for his "اعتمد".
- **Hand straight to `kickoff-implement`** in the same turn when the plan is low or medium and the user asked for the change itself.

## Risk
Rate by blast radius (what breaks, and for whom, if this task is wrong), not by size. A one-line change can be high.

| Risk | Touches | Examples |
|------|---------|----------|
| **low** | Presentation only; nothing stored, nothing secured | Copy, colour, spacing, an icon, a docs page |
| **medium** | Behaviour inside the app, reversible by a revert | A new page or component, client-side logic, a form, a non-major dependency bump |
| **high** | Data, money, identity, or many places at once | Database schema or migration, RLS or roles, auth or sessions, payments, secrets, Edge Functions, a major-version dependency upgrade, a change spanning more than ~10 files |

## Task Sizing Guidelines
| Size | Files | Scope | Example |
|------|-------|-------|---------|
| **XS** | 1 | Single function or config change | Add a validation rule |
| **S** | 1-2 | One component or endpoint | Add a new API endpoint |
| **M** | 3-5 | One feature slice | User registration flow |
| **L** | 5-8 | Multi-component feature | Search with filtering and pagination |
| **XL** | 8+ | **Too large — break it down further** | — |

If a task is L or larger, it should be broken into smaller tasks. An agent performs best on S and M tasks.

## Plan Document Template
The full template for the implementation plan is stored externally to save tokens.
You MUST read the `assets/plan-template.md` file and copy its structure exactly. Do NOT delete or skip any sections from the template when generating your output.

## Parallelization Opportunities
When multiple agents or sessions are available:
- **Safe to parallelize:** Independent feature slices, tests for already-implemented features, documentation
- **Must be sequential:** Database migrations, shared state changes, dependency chains

## Verification
Before starting implementation, confirm:
- [ ] Every task has acceptance criteria
- [ ] Every task has a Risk, an Agent check the agent can run, and a plain-English Owner check
- [ ] Task dependencies are identified and ordered correctly
- [ ] No task touches more than ~5 files
- [ ] Checkpoints exist between major phases
- [ ] The plan's `risk:` is set, and a high-risk plan has the owner's approval

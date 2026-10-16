---
name: kickoff-implement
description: Execute a kickoff-plan file task by task on a feature branch, running each task's Agent check and logging the evidence in the plan. Use when kickoff-plan hands off a low or medium plan, when the user says implement / execute / نفّذ الخطة / كمّل التنفيذ, when a plan in .cursor/plans has unticked tasks, or when kickoff-review sent back blockers to fix.
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: 'for d in "${CLAUDE_PROJECT_DIR:-.}/.claude/skills" "$HOME/.claude/skills" "$HOME/.agents/skills"; do f="$d/kickoff-implement/scripts/block-main-push.sh"; if [ -f "$f" ]; then exec bash "$f"; fi; done; exit 0'
---

# Kickoff Implement

Turn a plan into commits the owner can trust without reading code. The plan file (`.cursor/plans/NNN-name.plan.md`, written by `kickoff-plan`) is the contract: you work only its tasks, tick them there, and leave evidence there, so anyone opening the file sees what happened. Work happens on a feature branch, because `main` deploys to production; a hook bundled with this skill blocks any push to `main` for the rest of the session. Shipping is a separate, human-started step (`/kickoff-ship`).

Write code, commits and the plan in English; talk to the owner in chat in the language he writes in, in short sentences.

Commits stay on this machine. A commit is a local save point that takes a moment and sends nothing anywhere; nothing is pushed until `/kickoff-ship` pushes the whole branch once.

## 1. Load the plan

```bash
bash "<this-skill-dir>/scripts/next-task.sh" [plan-file]
```

With no argument it picks the highest-numbered plan in `.cursor/plans/`. It prints JSON: `plan`, `status`, `risk`, `branch`, `done`, `total`, `next`, `next_line`.

- If `risk` is `high`, the plan itself needs the owner's approval before any code: a `- Plan: approved (YYYY-MM-DD)` line under `## 11. Approval`. When the owner said "اعتمد" (or approved) this plan in the conversation, write that line yourself. Otherwise summarise the plan for him, ask for approval, and stop.
- If `## 10. Review` lists open blockers, you are in **fix mode**: the blockers are your tasks (step 4), before any unticked plan task.
- Read the plan's sections 1–3, 2.1 (No-Touch Zones), and the section 5 definition of each task as you reach it.

Done when you know the plan path, its risk, and the first task to do.

## 2. Get on the branch

- If the plan's `branch:` is set, switch to it (resume).
- Otherwise create `feat/<NNN-slug>` from the plan file name, starting from an up-to-date `main` (`git switch main && git pull --ff-only`, then `git switch -c feat/<NNN-slug>`), and write that name into the plan's `branch:` field.
- Uncommitted changes that belong to no task stay untouched and out of your commits.

Done when `git rev-parse --abbrev-ref HEAD` prints the feature branch.

## 3. Work each task in order

For the task in `next`:

1. **Build** exactly what its acceptance criteria ask, inside its files. A file outside the task, or a No-Touch Zone, is a deviation: record why in the log, and stop to ask if it changes the plan's intent. Where the task adds logic that its Agent check proves with a new test, write the failing test first and then the code (the red-before-green loop of the `tdd` skill). The `kickoff-using` skill, under Implement, names the specialist for each kind of task (database work, user-facing proof with the project's `verify-<app>` skill, a check that stays red); call the one the task needs.
2. **Check**: run every Agent check line yourself and read the output. For a browser check, use a browser tool you have (the in-app browser, Chrome, or Playwright) against the dev server and save the screenshot under `.cursor/plans/evidence/NNN/`. With no browser tool, write "browser check left for owner" — never a claimed pass.
3. **Red?** Fix the code and run the check again. A test that fails stays a test that fails: change an existing test's expected value only when an acceptance criterion changes that behaviour, and say so in the log. After three failed attempts, write `BLOCKED` with the error in the log, tell the owner in Arabic what is stuck, and stop.
4. **Log**: tick the line in section 4 (`- [x] TASK-NNN`) and append to `## 9. Implementation Log`:

   ```markdown
   ### TASK-NNN: <title>
   - Checks: `<command>` → <pass/fail, last meaningful output line>
   - Evidence: <screenshot path, if any>
   - Deviations: <none, or what and why>
   ```

5. **Commit** the task's files named explicitly plus the plan file (`git add <paths> <plan>`), with the message `TASK-NNN: <title>`. That message is what links the log entry to its commit, so each task is one commit holding both the code and its evidence.

Run `next-task.sh` again and repeat until `next` is empty. At each Checkpoint in the plan, run the full test suite and the build too.

Done when every task line is `[x]` with a log entry, or a task is `BLOCKED`.

## 4. Fix mode

Each open blocker from `## 10. Review` gets the same build, check, log and commit loop, with message `FIX: <blocker ID> <summary>` and a log entry under `### FIX <blocker ID>`. Mark the blocker `fixed` in the Review section; `kickoff-review` decides whether it holds.

## 5. Hand over

Run the full test suite and the build once more, set the plan's `status:` to `In review`, commit, and tell the owner, in his language:

- how many tasks are done, and their commits (`git log --oneline main..HEAD`)
- any deviation from the plan, or a `BLOCKED` task
- the next step: `/kickoff-review`

Leave the branch unpushed; `/kickoff-ship` pushes it once review and approval are in.

Done when the owner has that summary and the working tree has no uncommitted task changes.

## Subagents

Work the tasks yourself in this session, in order. Each task builds on the code the last one left, and a single context keeps that thread. Delegate only a self-contained side job whose output would flood the context (a broad search, a long log), and only one at a time.

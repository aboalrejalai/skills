---
name: kickoff-setup
description: Install the kickoff foundation once per machine and set a project up for the kickoff line (AGENTS.md rules, graphify map, e2e proof), after the user approves.
disable-model-invocation: true
---

# Kickoff Setup

Two jobs. The **foundation** is the kickoff line plus the core set of specialists named in the `kickoff-using` skill: installed once per machine at user scope, so every project and every agent has it. The **project** gets the line's rules in its `AGENTS.md`, a graphify map, and e2e proof. Nothing outside the core set is offered here: the rest of the catalog stays quiet until a job needs it, and `kickoff-using` points there. Run this once when a project starts, and again whenever the user asks to update.

The user often cannot read code. Speak to them in the language they write in, name each item by what it does for them, and keep every message short.

Arguments: a path to a brief file, a description of the project, or `update`. With `update`, go to [Update](#update).

## Steps

### 1. Read the project

Run the detector from the project root:

```bash
bash <this-skill-dir>/scripts/detect.sh
```

Then read what describes the project's purpose, in this order, stopping when the purpose, the users, and the launch plans are clear: the brief the user passed, `BRIEF.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`.

If those leave gaps, or the folder is empty, ask the user, one message, only the questions still open:

1. What are you building, and who will use it?
2. Will it hold personal data, logins, or payments?
3. Will real users depend on it, or is it a prototype?
4. Which coding agents do you use here (Claude Code, Cursor, Codex)?

Done when you can state the project's stack and its risk level (prototype, or real users with sensitive data).

### 2. Check the foundation

Read the "Core set" table in the `kickoff-using` skill (`~/.agents/skills/kickoff-using/SKILL.md`) and check each item:

```bash
bash <this-skill-dir>/scripts/check-installed.sh kickoff-plan kickoff-implement kickoff-review kickoff-ship kickoff-using <every core skill>
```

The detector from step 1 already shows the core agents in `~/.claude/agents/` and whether the `graphify` command exists.

Done when you know which foundation items are installed and which are missing.

### 3. Propose, in one short message

In the user's language, in this shape:

```
Foundation: <n>/<total> installed ✓   [missing: <names>]
This project: <stack in plain words>, <risk level>
  - AGENTS.md: kickoff block <to add | to refresh>
  - graphify: <map and commit hook to add | ready>
  - e2e: <to set up | ready | not a web or mobile app>
  - Old rules that conflict with the line: <n>, shown next
Install the missing foundation and set up this project?
```

Offer nothing beyond this: no optional list. Use the question tool when the harness has one.

Done when the user has answered.

### 4. Install the missing foundation

Install each missing core item with the command the `kickoff-using` Core set gives (skills with `-g`, agents with `--global`), one at a time, at user scope. After each one, confirm it landed with `check-installed.sh`. When an install fails, record the error and continue with the next item.

Done when every missing item is either confirmed on disk or recorded as failed.

### 5. Set up the project

**Rules.** Write [`assets/agents-block.md`](assets/agents-block.md) into `AGENTS.md`, with today's date, creating the file if absent. The block carries the kickoff line's rules (feature branch, `main` only through `/kickoff-ship`, Spec Kit by name only, subagent use, English in files) that every coding agent reading `AGENTS.md` follows, so Cursor and Codex work the same way as Claude Code. Replace an existing `KICKOFF START`/`KICKOFF END` block, or an older `KICKOFF-SETUP START`/`KICKOFF-SETUP END` block, in place; leave the rest of the file untouched.

If `CLAUDE.md` exists and has no `@AGENTS.md` line, add one near the top so Claude Code reads the same block. The detector's `## Agent rules` section lists every rule file and each line that sends work straight to `main`; read those files for any other rule the block contradicts. Show the user each contradiction with its file and line, and ask which one stands. Change a project rule file only for the ones the user answers.

**Graphify.** When `graphify-out/` is missing, build the map with `graphify update .`. When `graphify hook status` shows no hooks, run `graphify hook install` so every commit keeps the map current.

**e2e.** For a web or mobile app with no `e2e.config.*`: e2e needs the owner's choice of model, because its agent needs a model that reads screenshots, and a Claude subscription has no sign-in for it (an API key works, including one paid from Claude Max API credits, as do ChatGPT, Copilot, OpenCode or SuperGrok sign-ins). Hand him two commands to run himself: `npx e2e init` (it asks for the engine and the model), then `/create-verification-skill`, which builds this project's `verify-<app>` skill. When `e2e.config.*` exists but no `verify-*` skill does, hand him only the second.

**Land the setup.** These edits change the project's rules, so they follow the line too: commit them on a branch `chore/kickoff-setup`, never on `main`. Ask the owner whether to push it and open the pull request (`git push -u origin chore/kickoff-setup`, then `gh pr create`); he merges it himself.

Done when `AGENTS.md` holds exactly one kickoff block, every conflict has the user's answer, the graphify map exists, e2e is ready or handed to the owner, and the setup edits sit committed on `chore/kickoff-setup`.

### 6. Report

Tell the user, briefly:

- the foundation: installed, already there, or failed with its error
- the project: what was set up, and each old rule with the answer he gave
- what he runs himself, by name (`npx e2e init`, `/create-verification-skill`)
- how to start: describe the first task, and `kickoff-plan` takes it from there
- that `/kickoff-setup update` pulls the latest versions

## Update

1. Skills: run `npx skills@latest update -y` and report which ones changed.
2. Agents: run `bash <this-skill-dir>/scripts/agents.sh check` (add `--global` for user-level installs). For each changed agent, tell the user in one line what changed, then run `agents.sh apply` after they agree.
3. Hooks: tell the user which hook sets are installed and that re-running each set's method updates it; re-run only the ones they name.
4. graphify: `uv tool upgrade graphifyy`.
5. Refresh the date in the `AGENTS.md` block.

Done when the user has seen what changed and every agreed update is applied.

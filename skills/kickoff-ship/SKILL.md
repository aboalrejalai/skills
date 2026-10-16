---
name: kickoff-ship
description: Push a reviewed kickoff branch, open its PR, wait for CI, file issues for the review's should-fix notes, and merge after the owner's "اعتمد".
disable-model-invocation: true
---

# Kickoff Ship

The last gate before production. Merging into `main` deploys to production (on UEP, Hostinger redeploys `main` on every push), so this skill runs only when the owner types `/kickoff-ship`, and it merges only with his recorded approval. Each run is safe to repeat: it picks up wherever the branch stands (pushed or not, PR open or not, approved or not).

Write the PR, issues, commits, the changes-log entry and the plan in English, so the agents and reviewers reading GitHub take them in directly. Talk to the owner in chat in the language he writes in.

## 1. Preflight

```bash
bash "<this-skill-dir>/scripts/preflight.sh" [plan-file]
```

It prints JSON with `ok`, `problems`, `risk`, `verdict`, `review_fresh`, `scope_dropped`, `ship_approved` and the open `pr`, if any.

- **On `main`?** Switch to the work's feature branch (the `branch:` of the newest plan, or the only `feat/*` branch) and run preflight again.
- **`ok` is false**: tell the owner each problem with the command that fixes it (`/kickoff-review`, finish the tasks with `kickoff-implement`), and stop. A non-empty `scope_dropped` means the branch's plan lost tasks or requirements that the plan on `main` has: the owner decides whether they come back or are dropped on purpose, and a dropped one needs his words in the plan's Approval section before shipping.
- **Approval**: if the owner said "اعتمد" (or approved shipping) in this conversation, after the latest review, record `- Ship: approved (YYYY-MM-DD)` under the plan's `## 11. Approval`, commit the plan, and treat `ship_approved` as true.

Done when preflight is `ok`.

## 2. Last local run

Run the project's test suite and its build (or typecheck) from `package.json` scripts, the same commands CI runs. Red means stop: report the failure to the owner and send him back to `kickoff-implement`.

## 3. Push, open the PR, file the issues

1. `git push -u origin <branch>`: the one push of the whole branch.
2. With no open PR: `gh pr create --base main --head <branch> --title "<plan goal>" --body-file <file>`, where the body is [`assets/pr-body.md`](assets/pr-body.md) filled from the plan. With an open PR, refresh its body (`gh pr edit --body-file`) so the evidence matches the branch.
3. For each `Should fix` row in the plan's `## 10. Review` table, open an issue so the note outlives the PR: `gh issue create --title "<finding, short>" --body "<file, finding, source reviewer, PR link, plan path>"`. Skip a row whose issue link is already in the plan.
4. When the repo has `docs/changes-log.md`, add this PR's entry at the top of today's date, in English, keeping the file's heading layout, keyed by the PR number (`### PR #<N>: <title>`), with what changed and how to revert ("ask Claude to revert PR #<N>"). Under the plan's `## 12. Ship`, list the PR link, the issue links and the CI status. Commit both (`docs: changes-log for PR #<N>`) and push.

Done when the PR exists, every `Should fix` row has an issue, and the PR body, the plan and the changes-log name the same PR.

The `kickoff-using` skill, under Ship, names the specialists for this stage (e2e tests in CI, `babysit-pr` when the PR collects comments).

## 4. Wait for CI

`gh pr checks <N> --watch`. A failing check stops the run: show the owner the failing job's name and the last lines of its log (`gh run view <run-id> --log-failed`), and send him back to `kickoff-implement`. If the repo runs no checks on pull requests, say so; the local run in step 2 is then the only gate.

## 5. Merge, or hand the PR to the owner

- **Without `ship_approved`**: stop here. Give the owner the PR link, his Owner checks from the plan, and tell him to type "اعتمد" and run `/kickoff-ship` again once it looks right.
- **With `ship_approved` and green CI**: `gh pr merge <N> --squash --delete-branch`. One PR becomes one commit on `main`, so one revert undoes it. Then `git switch main && git pull --ff-only` and `git branch -D <branch>`.

Tell the owner: merged, the commit on `main`, that production redeploys from `main` within minutes, the issues opened for later, and how to undo it ("revert PR #<N>").

Done when the PR is merged and local `main` matches `origin/main`, or the owner holds the PR link waiting for his "اعتمد".

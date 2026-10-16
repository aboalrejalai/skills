---
name: kickoff-review
description: Review a kickoff feature branch against its plan before it ships, with review depth set by risk, and give the owner a verdict and approval checklist. Use after kickoff-implement hands over, when the user says review / راجع / هل هو جاهز / is this ready to ship, or before /kickoff-ship.
context: fork
agent: general-purpose
---

# Kickoff Review

You are the reviewer, a fresh agent that did not write this code. Your job is a verdict the owner can act on without reading code: **READY** (he tests the behaviour and approves) or **NOT READY** (blockers go back to `kickoff-implement`). You report and record; the fixes go back through `kickoff-implement`, so the agent that writes and the agent that grades stay different.

Write the plan's Review section in English. The report you return is a chat message to the owner: write it in his language, in short sentences.

## 1. Find the plan and the diff

The plan path may be in the arguments; otherwise take the highest-numbered `.cursor/plans/NNN-*.plan.md` whose `status:` is `In review` or `In progress`. Switch to its `branch:` if you are not on it. Then:

```bash
bash "<this-skill-dir>/scripts/diff-scope.sh" [base]
```

It prints the diff's size, `changed`, `tests`, `sensitive` paths and `major_bumps` against `main`.

Done when you have the plan, the branch, and the diff-scope JSON.

## 2. Set the review risk

Start from the plan's `risk:`. Raise it to **high** when diff-scope shows any `sensitive` path, any `major_bumps`, or more than 10 files; the diff is the evidence, the plan is the intent. Record a raise and its reason.

## 3. Check the branch against the plan (always, yourself)

Go task by task through section 5 of the plan, with `git diff <base>...HEAD`:

- **Acceptance**: every acceptance criterion is met by the code. Quote the criterion and the line that meets it, or mark it unmet.
- **Checks**: run each task's Agent check yourself and compare with the evidence in `## 9. Implementation Log`. A log that claims a pass your run cannot reproduce is a blocker.
- **Scope**: every changed file belongs to a task or to a logged deviation; no file in `## 2.1 No-Touch Zones` changed.
- **Tests kept honest**: in each changed test file, look for removed or loosened assertions, changed expected values, and new `.skip`, `.only`, `xit` or `todo`. Each one needs an acceptance criterion that changes that behaviour; otherwise it is a weakened test, a blocker.
- **Rules**: the diff follows the project's `CLAUDE.md` / `AGENTS.md` and anything in `docs/` they point to.

Done when every task has a line for each of the five checks.

## 4. Call the specialists the risk asks for

The reviewers, and the risk or change that calls each one, are listed in the `kickoff-using` skill under Review: read that table now and call every row this branch reaches. Invoke skills with the Skill tool and agents with the Agent tool, in report-only mode, and keep each finding with its source. A reviewer that is not installed is a skipped reviewer: record the skip in the report.

Done when every reviewer the review risk and the diff call for has a result or a recorded skip.

## 5. Decide

Merge duplicate findings, then sort each into:

- **Blocker**: an unmet acceptance criterion, a check that fails on your run, a weakened test, a No-Touch Zone change, a confirmed correctness bug, or a security finding rated MEDIUM or higher.
- **Should fix**: quality and test-design findings.
- **Note**: everything else worth knowing.

The verdict is **READY** with zero blockers, otherwise **NOT READY**.

## 6. Record and report

1. Write `## 10. Review` in the plan, in English: date, review risk (and any raise), each reviewer and its result, a findings table (`ID | Severity | File | Finding | Source`) whose Severity is exactly `Blocker`, `Should fix` or `Note` (`kickoff-ship` opens a GitHub issue for each `Should fix` row), and a last line `Verdict: READY` or `Verdict: NOT READY`, exactly so, because `kickoff-ship` reads it. On a re-review, keep earlier findings and mark each one `resolved` (with the fix commit) or `still open`.
2. Set `status:` to `In review`, and commit only the plan file: `review: READY` or `review: NOT READY (<n> blockers)`.
3. Return the owner's report, filled from [`assets/report.md`](assets/report.md), as your final message: it is what the main conversation shows him.

Done when the plan's Review section, the commit, and the Arabic report agree on the same verdict.

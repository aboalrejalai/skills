#!/usr/bin/env bash
# Check that a kickoff branch is ready to push and open as a PR.
# Usage: preflight.sh [plan-file] [base]
# Prints JSON: ok, problems[], branch, base, plan, risk, open_tasks, verdict, review_fresh, scope_dropped, ship_approved, ahead, pr

set -uo pipefail

base="${2:-}"
if [ -z "$base" ]; then
  if git rev-parse --verify -q main >/dev/null; then base=main; else base=master; fi
fi
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
plan="${1:-$(ls "$root"/.cursor/plans/[0-9][0-9][0-9]-*.plan.md 2>/dev/null | sort | tail -1)}"
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
problems=()

esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
section() { awk -v h="$1" 'index($0, "## ") == 1 { on = (index($0, h) > 0); next } on' "$plan"; }

case "$branch" in main|master|HEAD|"") problems+=("on $branch: switch to the feature branch (git branch --list 'feat/*')") ;; esac
git diff --quiet && git diff --cached --quiet || problems+=("uncommitted changes to tracked files")

risk=""; open_tasks=0; verdict="none"; review_fresh=false; ship_approved=false; scope_dropped=""
if [ -z "$plan" ] || [ ! -f "$plan" ]; then
  problems+=("no plan file found")
else
  risk="$(awk 'NR==1&&/^---/{f=1;next} f&&/^---/{exit} f&&/^risk:/{sub(/^risk:[ \t]*/,"");print;exit}' "$plan")"
  open_tasks="$(grep -cE '^- \[ \] TASK-[0-9]+' "$plan" || true)"
  [ "${open_tasks:-0}" -gt 0 ] && problems+=("$open_tasks task(s) not done")
  last="$(section '10. Review' | grep -E '^Verdict:' | tail -1)"
  case "$last" in
    "Verdict: READY"*) verdict=READY ;;
    "Verdict: NOT READY"*) verdict="NOT READY"; problems+=("review verdict is NOT READY") ;;
    *) problems+=("no review yet: run /kickoff-review") ;;
  esac
  # The review is fresh when no code changed after the last review commit.
  rsha="$(git log --format=%H --grep='^review: ' -n 1 2>/dev/null)"
  if [ -n "$rsha" ]; then
    rel_plan="${plan#"$root"/}"
    stale="$(git diff --name-only "$rsha"..HEAD | grep -vxF "$rel_plan" | grep -v '^docs/changes-log.md$' || true)"
    if [ -z "$stale" ]; then review_fresh=true; else problems+=("code changed after the last review: run /kickoff-review again"); fi
  fi
  section '11. Approval' | grep -qiE '^- Ship: (approved|اعتمد)' && ship_approved=true
  # Scope check: task and requirement IDs that the plan on the base branch has and this branch's plan lost.
  rel_plan="${plan#"$root"/}"
  base_plan="$(git show "$base:$rel_plan" 2>/dev/null || true)"
  if [ -n "$base_plan" ]; then
    ids() { grep -oE '\b(TASK|REQ)-[0-9]+\b' | sort -u; }
    scope_dropped="$(comm -23 <(printf '%s\n' "$base_plan" | ids) <(ids < "$plan") | tr '\n' ' ' | sed 's/ $//')"
    [ -n "$scope_dropped" ] && problems+=("plan lost scope that main's plan has: $scope_dropped")
  fi
fi

git remote get-url origin >/dev/null 2>&1 || problems+=("no origin remote")
gh auth status >/dev/null 2>&1 || problems+=("gh is not logged in")
ahead="$(git rev-list --count "$base..HEAD" 2>/dev/null || echo 0)"
pr="$(gh pr view --json url -q .url 2>/dev/null || true)"

ok=true; [ ${#problems[@]} -gt 0 ] && ok=false
printf '{"ok":%s,"problems":[' "$ok"
for i in "${!problems[@]}"; do [ "$i" -gt 0 ] && printf ','; printf '"%s"' "$(esc "${problems[$i]}")"; done
printf '],"branch":"%s","base":"%s","plan":"%s","risk":"%s","open_tasks":%s,"verdict":"%s","review_fresh":%s,"scope_dropped":"%s","ship_approved":%s,"ahead":%s,"pr":"%s"}\n' \
  "$(esc "$branch")" "$base" "$(esc "$plan")" "$(esc "$risk")" "${open_tasks:-0}" "$verdict" "$review_fresh" "$(esc "$scope_dropped")" "$ship_approved" "$ahead" "$(esc "$pr")"

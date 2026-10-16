#!/usr/bin/env bash
# Report a kickoff plan's state and its next unticked task.
# Usage: next-task.sh [plan-file]   (default: highest-numbered .cursor/plans/NNN-*.plan.md)
# Prints: {"plan":..,"status":..,"risk":..,"branch":..,"done":N,"total":N,"next":"TASK-NNN","next_line":".."}

set -euo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
plan="${1:-}"
if [ -z "$plan" ]; then
  plan="$(ls "$root"/.cursor/plans/[0-9][0-9][0-9]-*.plan.md 2>/dev/null | sort | tail -1 || true)"
fi
if [ -z "$plan" ] || [ ! -f "$plan" ]; then
  echo '{"error":"no plan file found in .cursor/plans"}'
  exit 1
fi

# Value of a frontmatter key, with surrounding quotes stripped.
fm() {
  awk -v k="$1" '
    NR == 1 && /^---/ { f = 1; next }
    f && /^---/ { exit }
    f && index($0, k ":") == 1 { sub("^" k ":[ \t]*", ""); gsub(/^["\x27]|["\x27]$/, ""); print; exit }
  ' "$plan"
}
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

total="$(grep -cE '^- \[[ xX]\] TASK-[0-9]+' "$plan" || true)"
done_n="$(grep -cE '^- \[[xX]\] TASK-[0-9]+' "$plan" || true)"
line="$(grep -m1 -E '^- \[ \] TASK-[0-9]+' "$plan" || true)"
next="$(printf '%s' "$line" | grep -oE 'TASK-[0-9]+' | head -1 || true)"

printf '{"plan":"%s","status":"%s","risk":"%s","branch":"%s","done":%s,"total":%s,"next":"%s","next_line":"%s"}\n' \
  "$(esc "$plan")" "$(esc "$(fm status)")" "$(esc "$(fm risk)")" "$(esc "$(fm branch)")" \
  "${done_n:-0}" "${total:-0}" "$next" "$(esc "$line")"

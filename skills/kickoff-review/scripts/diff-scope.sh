#!/usr/bin/env bash
# Measure a branch's diff against its base so review depth can follow evidence, not just the plan.
# Usage: diff-scope.sh [base]   (default: main, or master if main does not exist)
# Prints JSON: base, branch, commits, files, added, removed, changed[], tests[], sensitive[], major_bumps[]

set -euo pipefail

base="${1:-}"
if [ -z "$base" ]; then
  if git rev-parse --verify -q main >/dev/null; then base=main; else base=master; fi
fi
branch="$(git rev-parse --abbrev-ref HEAD)"
range="$base...HEAD"

esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
arr() { local first=1; printf '['; while IFS= read -r x; do [ -z "$x" ] && continue; [ $first = 1 ] || printf ','; printf '"%s"' "$(esc "$x")"; first=0; done; printf ']'; }

changed="$(git diff --name-only "$range")"
tests="$(printf '%s\n' "$changed" | grep -E '(^|/)(tests?|__tests__|spec)/|\.(test|spec)\.[a-z]+$|_test\.[a-z]+$' || true)"
# Paths whose mistakes reach data, money, identity, or deployment.
sensitive="$(printf '%s\n' "$changed" | grep -iE 'migration|supabase/|(^|/)\.env|auth|session|login|passw|token|secret|polic|rls|role|permission|admin|payment|checkout|billing|stripe|webhook|middleware|\.github/workflows|dockerfile|package(-lock)?\.json$' || true)"
read -r added removed < <(git diff --numstat "$range" | awk '{a += ($1 == "-" ? 0 : $1); r += ($2 == "-" ? 0 : $2)} END {print a + 0, r + 0}')
commits="$(git rev-list --count "$base..HEAD")"

# Dependencies whose major version went up in package.json.
majors="$(git diff "$range" -- package.json 2>/dev/null | awk '
  /^[-+][[:space:]]+"[^"]+":[[:space:]]*"[~^]?[0-9]+/ {
    sign = substr($0, 1, 1); line = substr($0, 2)
    match(line, /"[^"]+"/); name = substr(line, RSTART + 1, RLENGTH - 2)
    rest = substr(line, RSTART + RLENGTH); match(rest, /[0-9]+/); major = substr(rest, RSTART, RLENGTH) + 0
    if (sign == "-") old[name] = major; else neu[name] = major
  }
  END { for (n in neu) if ((n in old) && neu[n] > old[n]) printf "%s %d->%d\n", n, old[n], neu[n] }
')"

printf '{"base":"%s","branch":"%s","commits":%s,"files":%s,"added":%s,"removed":%s,"changed":%s,"tests":%s,"sensitive":%s,"major_bumps":%s}\n' \
  "$(esc "$base")" "$(esc "$branch")" "$commits" "$(printf '%s\n' "$changed" | grep -c . || true)" "$added" "$removed" \
  "$(printf '%s\n' "$changed" | arr)" "$(printf '%s\n' "$tests" | arr)" "$(printf '%s\n' "$sensitive" | arr)" "$(printf '%s\n' "$majors" | arr)"

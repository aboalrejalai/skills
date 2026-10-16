#!/usr/bin/env bash
# Report which of the given skills are installed at user or project scope.
# Usage: check-installed.sh <skill> [<skill> ...]

set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $(basename "$0") <skill> [<skill> ...]" >&2
  exit 2
fi

roots=(
  "$HOME/.agents/skills"
  "$HOME/.claude/skills"
  "$HOME/.cursor/skills"
  "$HOME/.codex/skills"
  "$PWD/.agents/skills"
  "$PWD/.claude/skills"
  "$PWD/.cursor/skills"
)

for skill in "$@"; do
  found=""
  for root in "${roots[@]}"; do
    if [ -f "$root/$skill/SKILL.md" ]; then
      found="$root/$skill"
      break
    fi
  done
  if [ -n "$found" ]; then
    printf 'installed  %s  (%s)\n' "$skill" "$found"
  else
    printf 'missing    %s\n' "$skill"
  fi
done

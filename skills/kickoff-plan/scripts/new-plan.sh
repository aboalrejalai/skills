#!/usr/bin/env bash
# Create the next numbered plan as .cursor/plans/NNN-<name>.plan.md (Cursor's
# plan format) and symlink it into .agents/plans/ and .claude/plans/ so every
# agent sees the same file.
# Usage: new-plan.sh <feature-name>
# Prints: {"NEW_PLAN_PATH":"<absolute path of the plan file>"}

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/../assets/plan-template.md"

name="${1:-}"
if [ -z "$name" ]; then
  echo "usage: $(basename "$0") <feature-name>" >&2
  exit 2
fi

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
plans="$root/.cursor/plans"
mkdir -p "$plans"

# Lowercase ASCII, turn spaces and path-unsafe characters into hyphens; keep
# non-ASCII letters so Arabic feature names stay readable.
slug="$(printf '%s' "$name" | tr 'A-Z' 'a-z' | sed -E 's#[[:space:]/\\:*?"<>|_.]+#-#g; s/^-+//; s/-+$//')"
[ -n "$slug" ] || slug="plan"

last=0
for entry in "$plans"/[0-9][0-9][0-9]-*; do
  [ -e "$entry" ] || continue
  n=$((10#$(basename "$entry" | cut -c1-3)))
  [ "$n" -gt "$last" ] && last=$n
done
file="$(printf '%03d-%s.plan.md' $((last + 1)) "$slug")"
plan_file="$plans/$file"

if [ -f "$TEMPLATE" ]; then
  cp "$TEMPLATE" "$plan_file"
else
  : > "$plan_file"
fi

for agent_dir in .agents .claude; do
  mkdir -p "$root/$agent_dir/plans"
  ln -sfn "../../.cursor/plans/$file" "$root/$agent_dir/plans/$file"
done

printf '{"NEW_PLAN_PATH":"%s"}\n' "$plan_file"

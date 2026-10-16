#!/usr/bin/env bash
# PreToolUse hook for the Bash tool: deny any git push that would update main or master.
# main deploys to production, so work reaches it only through a merged PR (/kickoff-ship).
# Reads the hook JSON on stdin; prints a deny decision, or nothing to let the call through.

input="$(cat)"
cmd="$(printf '%s' "$input" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))
except Exception: pass' 2>/dev/null)"

# Only commands that run git push.
printf '%s' "$cmd" | grep -qE '(^|[;&|(]|[[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push([[:space:]]|$)' || exit 0

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' \
    "kickoff: $1 main deploys to production. Push the feature branch instead, then open the PR with /kickoff-ship."
  exit 0
}

push_part="$(printf '%s' "$cmd" | sed -E 's/.*git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push//')"

# Pushing everything, or naming main/master as a destination (main, HEAD:main, refs/heads/main, +main).
printf '%s' "$push_part" | grep -qE '(^|[[:space:]])--(all|mirror)([[:space:]]|$)' && deny "Pushing all branches is blocked."
printf '%s' "$push_part" | grep -qE '(^|[[:space:]:+]|refs/heads/)(main|master)([[:space:];&|)]|$)' && deny "Pushing to main is blocked."

# A bare push (no refspec after the remote) pushes the current branch.
args="$(printf '%s' "$push_part" | sed -E 's/[;&|].*//' | tr -s '[:space:]' '\n' | grep -vE '^-' | grep -v '^$' || true)"
if [ "$(printf '%s\n' "$args" | grep -c . || true)" -le 1 ]; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  case "$branch" in main|master) deny "You are on $branch, so this push would update it." ;; esac
fi
exit 0

#!/usr/bin/env bash
# Install or update subagent files straight from their upstream GitHub repo.
#
#   agents.sh add <owner/repo> <path/in/repo.md> [--global]
#       Download the file at the repo's default branch into .claude/agents/
#       (or ~/.claude/agents/ with --global) and record it in the lock file.
#       Refuses to overwrite a different local file of the same name.
#   agents.sh check [--global]
#       For every agent in the lock, show a diff between the local file and
#       upstream. Writes nothing.
#   agents.sh apply [--global]
#       Overwrite every locked agent with upstream. Run `check` first.
#
# Lock file: <agents-dir>/../kickoff-setup.lock, tab-separated:
#   agent <name> <owner/repo> <path> <installed-date>

set -euo pipefail

cmd="${1:-}"; shift || true
scope_dir="$PWD/.claude"
args=()
for a in "$@"; do
  if [ "$a" = "--global" ]; then scope_dir="$HOME/.claude"; else args+=("$a"); fi
done
agents_dir="$scope_dir/agents"
lock="$scope_dir/kickoff-setup.lock"

fetch() { curl -fsSL "https://raw.githubusercontent.com/$1/HEAD/$2"; }

case "$cmd" in
  add)
    repo="${args[0]:?owner/repo required}"; path="${args[1]:?path required}"
    name="$(basename "$path")"
    tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
    fetch "$repo" "$path" > "$tmp" || { echo "failed: could not download $repo/$path" >&2; exit 1; }
    head -1 "$tmp" | grep -q '^---' || { echo "failed: $path is not an agent file (no frontmatter)" >&2; exit 1; }
    mkdir -p "$agents_dir"
    if [ -f "$agents_dir/$name" ] && ! grep -q "	$name	" "$lock" 2>/dev/null; then
      echo "skipped: $agents_dir/$name already exists and was not installed by kickoff-setup" >&2; exit 3
    fi
    cp "$tmp" "$agents_dir/$name"
    touch "$lock"
    grep -v "^agent	$name	" "$lock" > "$lock.tmp" || true; mv "$lock.tmp" "$lock"
    printf 'agent\t%s\t%s\t%s\t%s\n' "$name" "$repo" "$path" "$(date +%Y-%m-%d)" >> "$lock"
    echo "installed  $name  ($agents_dir/$name from $repo)"
    ;;
  check|apply)
    [ -f "$lock" ] || { echo "no lock file at $lock; nothing installed by kickoff-setup"; exit 0; }
    while IFS=$'\t' read -r kind name repo path _date; do
      [ "$kind" = "agent" ] || continue
      tmp="$(mktemp)"
      if ! fetch "$repo" "$path" > "$tmp"; then echo "failed     $name  (upstream missing: $repo/$path)"; rm -f "$tmp"; continue; fi
      if diff -q "$agents_dir/$name" "$tmp" >/dev/null 2>&1; then
        echo "current    $name"
      elif [ "$cmd" = "check" ]; then
        echo "changed    $name"; diff -u "$agents_dir/$name" "$tmp" | head -60 || true
      else
        cp "$tmp" "$agents_dir/$name"; echo "updated    $name"
      fi
      rm -f "$tmp"
    done < "$lock"
    ;;
  *)
    sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac

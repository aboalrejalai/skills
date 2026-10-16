#!/usr/bin/env bash
# Print the facts kickoff-setup needs about the current project: stack signals,
# and which skills, agents, and hooks are already in place.
# Usage: detect.sh   (run from the project root)

set -uo pipefail

has() { [ -e "$1" ] && echo "yes" || echo "no"; }
dep() { [ -f package.json ] && grep -q "\"$1\"" package.json && echo "yes" || echo "no"; }

echo "## Project"
echo "root: $PWD"
echo "git: $(git rev-parse --is-inside-work-tree 2>/dev/null || echo no)"
echo "files: $(git ls-files 2>/dev/null | wc -l | tr -d ' ')"
for f in BRIEF.md README.md CLAUDE.md AGENTS.md CONTEXT.md; do echo "$f: $(has "$f")"; done

echo
echo "## Stack signals"
echo "package.json: $(has package.json)"
for d in react vue next nuxt svelte @angular/core typescript vite tailwindcss \
         @supabase/supabase-js prisma drizzle-orm express @nestjs/core \
         vitest jest @playwright/test cypress husky electron @capacitor/core react-native; do
  [ "$(dep "$d")" = "yes" ] && echo "dep: $d"
done
for f in pyproject.toml requirements.txt go.mod Cargo.toml pom.xml build.gradle build.gradle.kts \
         composer.json Gemfile Package.swift pubspec.yaml; do
  [ -e "$f" ] && echo "manifest: $f"
done
ls ./*.csproj ./*.sln >/dev/null 2>&1 && echo "manifest: dotnet"
echo "supabase dir: $(has supabase)"
echo "sql migrations: $(find . -path ./node_modules -prune -o -name '*.sql' -print 2>/dev/null | head -200 | wc -l | tr -d ' ')"
echo "ci workflows: $(ls .github/workflows 2>/dev/null | tr '\n' ' ')"
echo "test files: $(git ls-files 2>/dev/null | grep -cE '\.(test|spec)\.' || true)"
echo "llm api calls: $(grep -rlE 'chat/completions|api\.anthropic\.com|generativelanguage|openrouter' \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.py' . 2>/dev/null | grep -v node_modules | head -50 | wc -l | tr -d ' ')"

echo
echo "## Already installed"
for root in "$PWD/.agents/skills" "$PWD/.claude/skills" "$PWD/.cursor/skills" \
            "$HOME/.agents/skills" "$HOME/.claude/skills"; do
  [ -d "$root" ] && echo "skills in $root: $(ls "$root" | tr '\n' ' ')"
done
for root in "$PWD/.claude/agents" "$HOME/.claude/agents"; do
  [ -d "$root" ] && echo "agents in $root: $(ls "$root" | tr '\n' ' ')"
done
for f in "$PWD/.claude/settings.json" "$PWD/.claude/settings.local.json" "$HOME/.claude/settings.json"; do
  [ -f "$f" ] && echo "hooks in $f: $(grep -c '"hooks"' "$f")"
done
echo "husky: $(has .husky)"
echo "kickoff marker in AGENTS.md: $(grep -c "KICKOFF START" AGENTS.md 2>/dev/null || true)"
echo "kickoff-setup lock: $(has .claude/kickoff-setup.lock)"
for a in database-reviewer silent-failure-hunter; do echo "core agent $a: $(has "$HOME/.claude/agents/$a.md")"; done
echo "graphify command: $(command -v graphify >/dev/null 2>&1 && echo yes || echo no)"
echo "graphify map: $(has graphify-out/GRAPH_REPORT.md)"
echo "graphify hooks: $(graphify hook status 2>/dev/null | head -1 || echo unknown)"
echo "e2e config: $(ls e2e.config.* 2>/dev/null | head -1 || true)"
echo "verify skills: $(ls -d .agents/skills/verify-* .claude/skills/verify-* 2>/dev/null | tr '\n' ' ')"

echo
echo "## Agent rules"
# Rule files every coding agent reads, and lines that send work straight to main (the kickoff line forbids that).
rules="$(ls AGENTS.md CLAUDE.md GEMINI.md .cursorrules .windsurfrules .github/copilot-instructions.md \
  .cursor/rules/*.mdc .cursor/rules/*.md 2>/dev/null)"
echo "rule files: $(printf '%s\n' "$rules" | tr '\n' ' ')"
[ -n "$rules" ] && printf '%s\n' "$rules" | xargs grep -n -i -E \
  'push[^.]{0,40}(origin )?(main|master)|HEAD:main|(merge|land)[^.]{0,30}(into )?`?main|commit[^.]{0,20}(directly )?(on|to) `?main' \
  2>/dev/null | sed 's/^/pushes to main: /' | cut -c1-220

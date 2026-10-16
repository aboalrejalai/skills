# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A catalog of ~3,050 agent skills (`SKILL.md` files with YAML frontmatter), plus tooling that indexes them and two web frontends that search the index. The skills themselves are the main payload; the code exists to validate, index, and browse them. Installation for end users goes through the Vercel Skills CLI (`npx skills add aboalrejal-ai/skills [--skill <id>] [--list]`).

## Commands

```bash
npm run dev            # Next.js dev server (current frontend, src/)
npm run build          # next build
npm run lint           # next lint
npm run sync:all       # validate -> index -> readme (run after adding/editing/removing any skill)
npm run app:setup      # copy skills_index.json -> apps/web-app/public/skills.json (legacy static site)
```

The `sync:all` chain, step by step (all Python, launched through `tools/scripts/run-python.js`, which picks `$ANTIGRAVITY_PYTHON` / `python3` / `python`; needs `pyyaml`):

- `npm run validate` → `plugin_compatibility.py`: **writes** `data/plugin-compatibility.json`. For a read-only check run `python3 tools/scripts/plugin_compatibility.py --check`.
- `npm run index` → `generate_index.py`: walks `skills/`, writes `skills_index.json` and mirrors it byte-for-byte to `data/skills_index.json`. Fails on duplicate skill ids.
- `npm run readme` → `update_readme.py`: rewrites skill-count/version strings in `README.md` by regex.

Tests exist only for the skill-creator scripts (stdlib `unittest`, run from that directory so the sibling imports resolve):

```bash
cd tools/skill-creator/scripts && python3 -m unittest test_quick_validate   # single module
cd tools/skill-creator/scripts && python3 -m unittest discover -p 'test_*.py'
```

Validate one skill against the external skill specs: `tools/validate-skill.sh <skill-dir>`.

## Skill layout and indexing

- Skills live at `skills/<category>/<skill-dir>/SKILL.md` (10 canonical categories such as `ai-and-agents`, `frontend-development`), except the 5 curated "guard" skills which sit directly under `skills/` (`clean-code-guard`, `test-guard`, `docs-guard`, `wp-guard`, `woo-guard`; grouped for skills.sh in `skills.sh.json`).
- Index `id` is the path relative to `skills/` (e.g. `ai-and-agents/agent-orchestrator`), so ids are unique across categories. `category` defaults to the parent dir name but frontmatter `category:` overrides it (lowercased). Missing `description` falls back to the first paragraph of the body.
- Frontmatter parsing in `generate_index.py` is deliberately lenient (quotes values containing `@`, regex fallback on YAML errors) because many imported skills have malformed YAML. Don't tighten it without re-running the index over the whole tree.
- `plugins/aboalrejal-skills/skills/` is a full copy of `skills/` (Codex plugin, see `.codex-plugin/plugin.json`). No script in the repo syncs it, so changes to `skills/` must be copied there by hand if the plugin should match.
- `tools/classify_skills.py` and `tools/merge_upstream_skills.py` are one-off bulk tools (categorize flat skills, merge from upstream) that move directories and rewrite relative markdown links across the tree; they are not part of the normal workflow.

## Web frontends (two of them)

1. **Next.js app (current)**, `src/`, App Router, path alias `@/*` → `src/*`. `src/app/page.tsx` is a client component that debounces the query and calls one of two route handlers depending on the source dropdown:
   - `src/app/api/skills/local/route.ts`: reads `skills_index.json` from `process.cwd()` and filters by name/description/category (first 50 when the query is empty).
   - `src/app/api/skills/search/route.ts`: proxies `https://skills.sh/api/v1/skills/search`, authenticating with a Vercel OIDC token (`@vercel/oidc`, falling back to `VERCEL_OIDC_TOKEN`).
   Both normalize results to the `Skill` shape exported from `src/components/SkillsGrid.tsx`; keep the two normalizers in sync.
2. **Legacy static site**, `apps/web-app/index.html` (single self-contained HTML), which loads `skills.json` and calls the Vercel serverless functions in `api/*.js` (`/api/search`, `/api/stats`, `/api/skill-details`). `npm run deploy` (`tools/scripts/deploy.js`) force-pushes `apps/web-app/` to the `gh-pages` branch.

`cli/` is a separate zero-dependency ESM CLI (`aboalrejal-skills`) that browses and installs skills from a local or GitHub-hosted registry.

## Known broken references (check before relying on them)

- `apps/web-app` has no `package.json`, so `npm run app:dev` / `app:build` fail; `START_APP.bat` serves it with `npx vite` instead.
- CI (`.github/workflows/ci.yml`) runs `npm run bundles:sync`, which is not defined in `package.json`.
- `Dockerfile` copies `public/` and `.next/standalone`, but there is no `public/` dir and `next.config.mjs` doesn't set `output: 'standalone'`.
- `AGENTS.md` points at a Windows path for the Spec Kit plan; the file is `specs/001-skills-fix/plan.md`. Spec Kit (`.specify/`, `.agents/skills/speckit-*`) is installed but `.specify/memory/constitution.md` is still the unfilled template.

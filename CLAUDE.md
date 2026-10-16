# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Mohammed Abo Alrejal's curated catalog of agent skills (tags: `made`, `use`, `recommend`, `favorite`), built as a static Astro site and served by Cloudflare Workers Static Assets (`wrangler.jsonc`, assets dir `./dist`). There is no server code.

Two kinds of skills:

- **Local**: his own skills with no repo of their own, in `skills/<name>/SKILL.md`. They are auto-discovered; the `local:` list in `catalog.yaml` only overrides category, tags and note. These are also what `npx skills add aboalrejalai/skills` installs. A `skills:` entry pointing at `aboalrejalai/skills` itself is skipped.
- **Referenced**: everything else (his other repos and third-party skills), listed in `catalog.yaml` and fetched at build time with `git clone --depth 1`. Third-party skill files are never committed here.

The old 3,050-skill hub (Next.js, Python indexers) was deleted; it is preserved at git tag `archive/v1-hub`. Ignore any mention of `sync:all`, `skills_index.json` or `apps/web-app` you find in old commits.

## Commands

- `npm run dev` works before any data exists: the site falls back to the fixture.
- `npm run build` runs `catalog` → `zips` → `astro build`. The catalog step clones upstream repos into `.cache/repos`, so it needs network access; `node scripts/build-catalog.mjs --offline` reuses those clones. Broken entries are skipped with a warning, not fatal; add `--strict` to fail on them.
- `npm run preview` is `wrangler dev` over `dist/`; build first.
- For a UI-only check without the data scripts: `npx astro check` and `npx astro build --outDir .cache/build-check`.
- `npm run add -- owner/repo@skill --tag use` adds a catalog entry; `npm run import:lock` adds every skill from `~/.agents/.skill-lock.json` the catalog is missing (`-- --dry-run` to preview). Full guide: `docs/adding-skills.md`.
- Deploy: `docs/deploy.md`.

## Data flow

```
catalog.yaml + skills/*/SKILL.md
  └─ scripts/build-catalog.mjs ──► src/data/generated/catalog.json        (Catalog)
                                ├► src/data/generated/skills/<id>.json    (SkillDetail)
                                └► .cache/skills/<id>/…                   (full skill folder copy)
  └─ scripts/build-zips.mjs    ──► public/dl/<id>.zip   (folder <name>/ inside)
  └─ astro build               ──► dist/  ──► Cloudflare Workers assets
```

`src/data/generated/`, `public/dl/` and `.cache/` are build outputs and gitignored.

## Data contract

- `src/lib/types.ts` is the contract between `scripts/build-catalog.mjs` (producer) and the site (consumer). Change it only together with both sides.
- The site reads data only through `src/lib/catalog.ts` (`getCatalog`, `getSkillDetail`). It uses `src/data/generated/` when present and `src/data/fixture/` otherwise. Pages never import the JSON directly. Keep the fixture valid against `types.ts` when the contract changes.
- `SkillDetail.body` is raw markdown from upstream repos and is not sanitized. Render it only through `src/lib/markdown.ts` (marked + sanitize-html).
- `own` is true when the source owner is `aboalrejalai` or `aboalrejal-ai` (the old name redirects).

## i18n

- Arabic is the default locale at `/` (`dir="rtl"`); English lives under `/en/`. Every page exists in both.
- Build links with `localePath` / `alternatePath` from `src/i18n/index.ts`. Tag and category labels are `TAG_LABELS` / `CATEGORY_LABELS` there.
- UI strings live per area in `src/i18n/strings/<area>.ts` as `{ ar: {...}, en: {...} }`. Add a string to both languages in the same edit.
- Skill names and descriptions stay in their original language; only `note` is bilingual.

## Design: Saudi Soft

- Colours, radii and fonts come only from the tokens in `src/styles/global.css` (primary `#1B8354`, IBM Plex Sans Arabic, radius 10px controls / 12px cards, light and dark via `.dark` on `<html>`).
- The block between `/* # saudi-soft-theme:start */` and `/* # saudi-soft-theme:end */` is copied verbatim from aboalrejalai/saudi-soft. Leave it untouched; site CSS goes below the end marker.
- Use logical properties only (`ms-/me-/ps-/pe-/start-/end-`, `text-start`), so one layout serves RTL and LTR. Directional icons get `rtl:rotate-180`.
- Icons come from `@lucide/astro`.
- Recipes: `~/Desktop/Project/saudi-soft/skills/saudi-soft/references/recipes.md` and `identity.md`.

## The `skills/` folder and the Vercel skills CLI

The skills CLI scans this repo for every `SKILL.md` and publishes what it finds, both for `npx skills add aboalrejalai/skills` and on skills.sh.

- Keep `skills/` flat: `skills/<name>/SKILL.md`, folder name == frontmatter `name`, kebab-case, `name` and `description` required.
- `skills/` is the only place a `SKILL.md` may exist. Agent-local copies (`.agents/skills/`, `.claude/skills/`) or test fixtures with a `SKILL.md` would be published as part of this repo.
- When you add a local skill, also add it to a group in `skills.sh.json`.

## No runtime API

All data is resolved at build time. The skills.sh API needs a Vercel OIDC token, so it is not called at all; skills.sh links are built from the URL pattern `https://skills.sh/<owner>/<repo>/<slug>`.

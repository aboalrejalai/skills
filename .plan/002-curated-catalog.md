# 002 — Curated skills catalog (rebuild)

Branch: `rebuild/curated-catalog`. The old 3,050-skill hub is preserved at tag `archive/v1-hub`.

## Goal

A personal, curated catalog of agent skills by Mohammed Abo Alrejal: skills he **made**, **uses**, **recommends**, and **favorites**, so he never forgets them and others can install them.
Static site (Astro, `output: 'static'`) served by **Cloudflare Workers Static Assets** (`wrangler.jsonc`, assets dir `./dist`). No server code, no runtime API calls.

Every skill gets: a card, its own page `/skills/<id>/` (and `/en/skills/<id>/`), rendered SKILL.md, file list, install command (`npx skills add <owner>/<repo> --skill <name>`, with agent `-a` and `-g` options), a ZIP download (`/dl/<id>.zip`, built at build time), a GitHub link and a skills.sh link.

## Decisions (already made by the user — do not revisit)

- Third-party skills are **not copied** into this repo. They are referenced in `catalog.yaml` and fetched at build time (`git clone --depth 1`) only to render pages and build ZIPs.
- The user's own skills that have no repo live in `skills/<name>/SKILL.md` here (flat; folder name == frontmatter `name`). Own skills that have their own repo stay there and are referenced in `catalog.yaml`.
- Arabic first (`/`, `dir="rtl"`), English under `/en/`. Skill descriptions stay in their original language.
- Design: **Saudi Soft** (aboalrejalai/saudi-soft). Tokens are in `src/styles/global.css` (verbatim theme bridge, Tailwind v4). Primary `#1B8354`, IBM Plex Sans Arabic, lucide icons (`@lucide/astro`), radius 10px controls / 12px cards, light + dark (`.dark` on `<html>`), logical CSS properties only (`ms/me/ps/pe/start/end`, never left/right), directional icons get `rtl:rotate-180`. Recipes: `~/Desktop/Project/saudi-soft/skills/saudi-soft/references/recipes.md` and `identity.md`.
- GitHub owner of this repo: `aboalrejalai` (the `aboalrejal-ai` name redirects to it).
- skills.sh skill URL: `https://skills.sh/<owner>/<repo>/<slug>` where slug = frontmatter name lowercased, spaces/underscores → `-`, other chars removed. The skills.sh API needs a Vercel OIDC token, so it is **not used**.

## Data flow

```
catalog.yaml + skills/*/SKILL.md
  └─ scripts/build-catalog.mjs ──► src/data/generated/catalog.json        (Catalog)
                                ├► src/data/generated/skills/<id>.json    (SkillDetail)
                                └► .cache/skills/<id>/…                   (full skill folder copy)
  └─ scripts/build-zips.mjs    ──► public/dl/<id>.zip   (zip of .cache/skills/<id>/ under folder <name>/)
  └─ astro build               ──► dist/
```

The contract is `src/lib/types.ts`. The site reads data only through `src/lib/catalog.ts`, which falls back to `src/data/fixture/` when nothing is generated yet. Do not edit `types.ts`, `catalog.ts`, `i18n/index.ts` or the fixture; if the contract is missing something, say so in your final report instead.

## File ownership (parallel agents: touch ONLY your files)

| Agent | Owns |
|---|---|
| A1 catalog-data | `catalog.yaml` |
| A2 build-catalog | `scripts/build-catalog.mjs`, `scripts/lib/*` |
| A3 build-zips | `scripts/build-zips.mjs` |
| A4 add/import CLI | `scripts/add-skill.mjs`, `scripts/import-lock.mjs` |
| A5 own-skills | `skills/**` |
| A6 layout | `src/layouts/BaseLayout.astro`, `src/components/layout/**`, `src/i18n/strings/layout.ts` |
| A7 home | `src/components/home/**`, `src/i18n/strings/home.ts`, `src/scripts/home-*.ts` |
| A8 skill page | `src/components/skill/**`, `src/lib/markdown.ts`, `src/i18n/strings/skill.ts`, `src/scripts/skill-*.ts` |
| A9 seo | `src/components/Seo.astro`, `src/pages/404.astro`, `src/pages/en/404.astro`, `public/robots.txt`, `src/i18n/strings/seo.ts` |
| A10 deploy | `wrangler.jsonc`, `public/_headers`, `public/_redirects`, `.assetsignore`, `.github/workflows/**`, `docs/deploy.md` |
| A11 docs | `README.md`, `CLAUDE.md`, `AGENTS.md`, `SECURITY.md`, `skills.sh.json`, `docs/adding-skills.md` |
| A12 brand | `src/components/Logo.astro`, `public/favicon.svg`, `public/apple-touch-icon.png`, `public/og.png`, `src/assets/brand/**` |

Shared, owned by the orchestrator: `package.json` (all deps are installed — do **not** run `npm install`; if you truly need a package, report it), `astro.config.mjs`, `tsconfig.json`, `src/styles/global.css`, `src/lib/*`, `src/i18n/index.ts`, `src/pages/**` except 404 pages.

Verification for UI agents: `npx astro check` and `npx astro build --outDir .cache/build-<agent>` are fine (they don't collide). Do not run `npm run build` (it runs the data scripts). Do not commit.

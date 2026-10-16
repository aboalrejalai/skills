# AGENTS.md

Mohammed Abo Alrejal's curated catalog of agent skills: a static Astro site on Cloudflare Workers Static Assets. Read `CLAUDE.md` for the data flow, commands and conventions; it applies to every agent.

Five rules that matter most:

1. `skills/` holds only his own skills, flat: `skills/<name>/SKILL.md` with folder name == frontmatter `name`. Keep every other `SKILL.md` out of the repo (including `.agents/skills/` and `.claude/skills/`): the Vercel skills CLI publishes any `SKILL.md` it finds.
2. Third-party skills are referenced in `catalog.yaml` and fetched at build time. Their files are never committed.
3. `src/lib/types.ts` is the data contract. The site reads data only through `src/lib/catalog.ts`, which falls back to `src/data/fixture/` when `src/data/generated/` is absent.
4. Arabic is the default at `/`, English under `/en/`. Every UI string goes in `src/i18n/strings/<area>.ts` in both languages.
5. Saudi Soft design: tokens from `src/styles/global.css` only, logical CSS properties only, `@lucide/astro` icons. Leave the block between the `saudi-soft-theme:start` / `:end` markers untouched.

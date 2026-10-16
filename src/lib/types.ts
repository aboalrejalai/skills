// Shared data contract between scripts/build-catalog.mjs (producer) and the Astro site (consumer).
// Change this file only together with both sides.

export type Lang = 'ar' | 'en';

/** made = I wrote it · use = installed in my daily setup · recommend = worth knowing · favorite = pinned to the top */
export type Tag = 'made' | 'use' | 'recommend' | 'favorite';

export const CATEGORIES = [
  'code-quality',
  'planning-workflow',
  'agents-delegation',
  'frontend-design',
  'video-media',
  'seo-marketing',
  'ecommerce-salla',
  'documents',
  'memory-knowledge',
  'research-tools',
  'testing',
  'security',
  'backend-data',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Localized {
  ar: string;
  en: string;
}

export interface SkillSource {
  owner: string; // GitHub owner, e.g. "aboalrejalai"
  repo: string; // GitHub repo, e.g. "saudi-soft"
  ref: string; // branch or tag used for links, e.g. "main"
  path: string; // folder holding SKILL.md inside the repo, "" when SKILL.md is at the root
}

export interface SkillFile {
  path: string; // relative to the skill folder, POSIX separators, e.g. "references/recipes.md"
  size: number; // bytes
  binary: boolean;
}

export interface SkillEntry {
  id: string; // URL slug, unique across the catalog: /skills/<id>/
  name: string; // frontmatter `name` (the value for `npx skills add ... --skill <name>`)
  description: string; // frontmatter `description`
  category: Category;
  tags: Tag[];
  own: boolean; // source owner is aboalrejalai / aboalrejal-ai
  local: boolean; // lives in ./skills of this repo
  note?: Localized; // my own words on why it's here
  source: SkillSource;
  githubUrl: string; // https://github.com/<owner>/<repo>/tree/<ref>/<path>
  skillsShUrl: string; // https://skills.sh/<owner>/<repo>/<slug>
  zipUrl: string; // /dl/<id>.zip
  install: string; // npx skills add <owner>/<repo> --skill <name>   (UI appends -a / -g flags)
  files: SkillFile[];
  totalBytes: number;
  updatedAt?: string; // ISO date of the last commit touching the skill folder, when known
}

/** A whole repo shown as one card, for large packs such as marketing-skills (975 skills). */
export interface CollectionEntry {
  id: string;
  title: Localized;
  description: Localized;
  category: Category;
  tags: Tag[];
  own: boolean;
  source: Omit<SkillSource, 'path'>;
  skillCount: number;
  githubUrl: string;
  skillsShUrl: string; // https://skills.sh/<owner>/<repo>
  install: string; // npx skills add <owner>/<repo> --list
}

export interface Catalog {
  generatedAt: string; // ISO timestamp
  skills: SkillEntry[];
  collections: CollectionEntry[];
}

export interface SkillDetail extends SkillEntry {
  frontmatter: Record<string, unknown>;
  body: string; // SKILL.md markdown without the frontmatter block (raw, NOT sanitized)
  texts: Record<string, string>; // contents of small text files (<= 200 KB), keyed by SkillFile.path; includes "SKILL.md"
}

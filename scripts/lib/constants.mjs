// Values shared by the catalog build scripts.
// CATEGORIES and TAGS duplicate src/lib/types.ts (CATEGORIES and the Tag union) so plain Node can
// read them without a TypeScript loader. Keep both files in sync.

export const CATEGORIES = Object.freeze([
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
]);

export const TAGS = Object.freeze(['made', 'use', 'recommend', 'favorite']);

/** GitHub owners whose skills count as "own" (aboalrejal-ai redirects to aboalrejalai). */
export const OWN_OWNERS = Object.freeze(['aboalrejalai', 'aboalrejal-ai']);

/** Where ./skills/<name> of this repository is published. */
export const LOCAL_SOURCE = Object.freeze({ owner: 'aboalrejalai', repo: 'skills', ref: 'main', dir: 'skills' });

export const LOCAL_DEFAULTS = Object.freeze({ category: 'other', tags: ['made', 'use'] });

export const SOURCE_PATTERN = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

/** Text files up to this size are embedded in SkillDetail.texts. */
export const MAX_TEXT_BYTES = 200 * 1024;

/** Bytes inspected for a NUL byte when deciding whether a file is binary. */
export const BINARY_SNIFF_BYTES = 8 * 1024;

export const SKIPPED_NAMES = Object.freeze(new Set(['.git', 'node_modules', '.DS_Store']));

export const CLONE_CONCURRENCY = 6;

// Formatting and data shaping for the skill page. OWNER: skill-page agent (A8).
import type { Lang, SkillFile } from '../../lib/types';

const LOCALE: Record<Lang, string> = { ar: 'ar-u-nu-latn', en: 'en' };

export function formatBytes(bytes: number, lang: Lang): string {
  const [value, unit] =
    bytes >= 1024 * 1024 ? [bytes / (1024 * 1024), 'megabyte'] : bytes >= 1024 ? [bytes / 1024, 'kilobyte'] : [bytes, 'byte'];
  return new Intl.NumberFormat(LOCALE[lang], {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: value >= 10 || unit === 'byte' ? 0 : 1,
  }).format(value);
}

export function formatDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en', { dateStyle: 'long', timeZone: 'UTC' }).format(d);
}

export interface TreeFile {
  kind: 'file';
  name: string;
  file: SkillFile;
}
export interface TreeFolder {
  kind: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
  count: number; // files below this folder, recursively
}
export type TreeNode = TreeFile | TreeFolder;

/** Nest flat skill file paths into folders; SKILL.md leads, then folders, then files, each alphabetical. */
export function buildFileTree(files: SkillFile[]): TreeNode[] {
  const root: TreeFolder = { kind: 'folder', name: '', path: '', children: [], count: 0 };
  for (const file of files) {
    const parts = file.path.split('/');
    let dir = root;
    parts.slice(0, -1).forEach((name, i) => {
      let next = dir.children.find((c): c is TreeFolder => c.kind === 'folder' && c.name === name);
      if (!next) {
        next = { kind: 'folder', name, path: parts.slice(0, i + 1).join('/'), children: [], count: 0 };
        dir.children.push(next);
      }
      dir = next;
    });
    dir.children.push({ kind: 'file', name: parts[parts.length - 1], file });
  }
  const finish = (folder: TreeFolder): number => {
    folder.children.sort((a, b) => {
      if (a.name === 'SKILL.md' || b.name === 'SKILL.md') return a.name === 'SKILL.md' ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'en');
    });
    folder.count = folder.children.reduce((n, c) => n + (c.kind === 'folder' ? finish(c) : 1), 0);
    return folder.count;
  };
  finish(root);
  return root.children;
}

/** Stable DOM id for a file's viewer: "references/recipes.md" -> "sk-file-references-recipes-md". */
export const fileDomId = (path: string) => `sk-file-${path.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}`;

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

export type FileView = 'highlight' | 'plain' | 'link';

/** Keep pages light: inline at most ~128 KB of file text (smallest first) and syntax-highlight
 *  at most ~16 KB of code; prose files are never highlighted. Everything else links to GitHub. */
export function planFileViews(
  files: SkillFile[],
  texts: Record<string, string>,
  isCode: (path: string) => boolean,
  { inlineBudget = 128 * 1024, highlightBudget = 16 * 1024, highlightMax = 8 * 1024 } = {},
): Map<string, FileView> {
  const views = new Map<string, FileView>();
  let inlined = 0;
  let highlighted = 0;
  const candidates = files.filter((f) => !f.binary && texts[f.path] !== undefined).sort((a, b) => a.size - b.size);
  for (const f of candidates) {
    const size = texts[f.path].length;
    if (inlined + size > inlineBudget) {
      views.set(f.path, 'link');
      continue;
    }
    inlined += size;
    if (isCode(f.path) && size <= highlightMax && highlighted + size <= highlightBudget) {
      highlighted += size;
      views.set(f.path, 'highlight');
    } else views.set(f.path, 'plain');
  }
  return views;
}

// Shared helpers for scripts/add-skill.mjs and scripts/import-lock.mjs:
// GitHub lookups through the `gh` CLI, SKILL.md resolution, category guessing,
// and comment-preserving edits of catalog.yaml through yaml's Document API.

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import YAML from 'yaml';
import { CATEGORIES, LOCAL_SOURCE, OWN_OWNERS, TAGS } from './constants.mjs';

const execFileAsync = promisify(execFile);

// Shared with the build (scripts/lib/constants.mjs mirrors src/lib/types.ts).
export { CATEGORIES, TAGS, OWN_OWNERS } from './constants.mjs';
/** This repo: skills that live here belong in `local:`, not `skills:`. */
export const THIS_REPO = `${LOCAL_SOURCE.owner}/${LOCAL_SOURCE.repo}`;

export class CliError extends Error {}

export const isOwnOwner = (owner) => OWN_OWNERS.includes(String(owner).toLowerCase());

/** Same identity for a source, treating the two spellings of the user's account as one. */
export function sourceKey(source) {
  const [owner = '', repo = ''] = String(source).toLowerCase().split('/');
  return `${isOwnOwner(owner) ? OWN_OWNERS[0] : owner}/${repo}`;
}

/** skills.sh slug: lowercase, spaces/underscores to "-", other characters dropped. */
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// ---------------------------------------------------------------- GitHub (gh)

/** Runs `gh` with an argument array (no shell). Throws CliError with a readable message. */
export async function gh(args) {
  try {
    const { stdout } = await execFileAsync('gh', args, { maxBuffer: 256 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new CliError('GitHub CLI `gh` was not found. Install it and run `gh auth login`.');
    }
    const stderr = String(err.stderr || '').trim();
    const e = new CliError(stderr || err.message);
    e.status = Number((stderr.match(/HTTP (\d{3})/) || [])[1]) || undefined;
    throw e;
  }
}

async function ghJson(path) {
  return JSON.parse(await gh(['api', path]));
}

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

const repoCache = new Map();
/** Canonical repo info (follows renames/transfers). Returns null when the repo does not exist. */
export async function getRepo(source) {
  const key = source.toLowerCase();
  if (!repoCache.has(key)) {
    repoCache.set(
      key,
      ghJson(`repos/${source}`)
        .then((r) => ({ fullName: r.full_name, defaultBranch: r.default_branch, private: r.private }))
        .catch((err) => {
          if (err.status === 404) return null;
          throw err;
        }),
    );
  }
  return repoCache.get(key);
}

/** True when `ref` names an existing commit-ish in the repo. */
export async function refExists(fullName, ref) {
  try {
    await gh(['api', `repos/${fullName}/commits/${encodePath(ref)}`, '--jq', '.sha']);
    return true;
  } catch (err) {
    if (err.status === 404 || err.status === 422) return false;
    throw err;
  }
}

const treeCache = new Map();
/** Paths of every SKILL.md in the repo at `ref` ("" for the root one) plus the truncated flag. */
export async function listSkillFolders(fullName, ref) {
  const key = `${fullName}@${ref}`.toLowerCase();
  if (!treeCache.has(key)) {
    treeCache.set(
      key,
      (async () => {
        let treeish = ref;
        if (ref.includes('/')) {
          treeish = (await gh(['api', `repos/${fullName}/commits/${encodePath(ref)}`, '--jq', '.sha'])).trim();
        }
        const tree = await ghJson(`repos/${fullName}/git/trees/${encodeURIComponent(treeish)}?recursive=1`);
        const folders = tree.tree
          .filter((n) => n.type === 'blob' && (n.path === 'SKILL.md' || n.path.endsWith('/SKILL.md')))
          .map((n) => (n.path === 'SKILL.md' ? '' : n.path.slice(0, -'/SKILL.md'.length)));
        return { folders, truncated: Boolean(tree.truncated) };
      })(),
    );
  }
  return treeCache.get(key);
}

/** Raw SKILL.md text at `folder`, or null when it does not exist. */
export async function fetchSkillMd(fullName, ref, folder) {
  const file = folder ? `${folder}/SKILL.md` : 'SKILL.md';
  try {
    return await gh([
      'api',
      '-H',
      'Accept: application/vnd.github.raw+json',
      `repos/${fullName}/contents/${encodePath(file)}?ref=${encodeURIComponent(ref)}`,
    ]);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/** Parses the YAML frontmatter of a SKILL.md. Returns {} when there is none. */
export function parseFrontmatter(md) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(md);
  if (!m) return {};
  try {
    const data = YAML.parse(m[1]);
    return data && typeof data === 'object' ? data : {};
  } catch {
    // Loose fallback for frontmatter that is not strict YAML (e.g. unquoted colons).
    const pick = (k) => (new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(m[1]) || [])[1]?.trim().replace(/^["']|["']$/g, '');
    return { name: pick('name'), description: pick('description') };
  }
}

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

const folderName = (folder, repo) => (folder ? folder.split('/').pop() : repo);

/** Order candidates: conventional locations first, then shorter paths. */
function rankFolders(folders) {
  const score = (f) => (/^skills\//.test(f) ? 0 : /^\.(agents|claude)\/skills\//.test(f) ? 1 : 2);
  return [...folders].sort((a, b) => score(a) - score(b) || a.length - b.length || a.localeCompare(b));
}

/**
 * Finds the folder of a skill in a repo.
 * - With `path` (may be ""): checks that SKILL.md exists there.
 * - With `skill`: matches folder names first, then frontmatter names (exact or by slug).
 * - With neither: the only SKILL.md in the repo.
 * Returns { path, name, description, frontmatter, warnings }.
 */
export async function resolveSkill({ fullName, ref, path, skill }) {
  const repoName = fullName.split('/')[1];
  const warnings = [];
  const load = async (folder) => {
    const md = await fetchSkillMd(fullName, ref, folder);
    if (md == null) return null;
    const fm = parseFrontmatter(md);
    return { path: folder, frontmatter: fm, name: fm.name ? String(fm.name) : '', description: fm.description ? String(fm.description) : '' };
  };
  const finish = (hit) => {
    if (!hit.name) {
      hit.name = folderName(hit.path, repoName);
      warnings.push(`SKILL.md at "${hit.path || '(root)'}" has no frontmatter name; using the folder name "${hit.name}".`);
    }
    if (skill && hit.name !== skill && slugify(hit.name) !== slugify(skill) && folderName(hit.path, repoName) !== skill) {
      warnings.push(`Asked for "${skill}" but the SKILL.md name is "${hit.name}".`);
    }
    return { ...hit, warnings };
  };

  if (path != null) {
    const clean = path.replace(/^\/+|\/+$/g, '').replace(/\/?SKILL\.md$/i, '');
    const hit = await load(clean);
    if (hit) return finish(hit);
    if (!skill) {
      let hint = '';
      const leaf = clean.split('/').pop();
      if (leaf) {
        const { folders } = await listSkillFolders(fullName, ref);
        const near = folders.filter((f) => f.split('/').pop() === leaf || slugify(f.split('/').pop()) === slugify(leaf));
        if (near.length) hint = `\n  Found it at: ${near.map((f) => `${fullName}/${f}`).join(', ')}`;
      }
      throw new CliError(`No SKILL.md at ${fullName}@${ref}:${clean ? `${clean}/` : ''}SKILL.md${hint}`);
    }
    warnings.push(`No SKILL.md at "${clean}"; searching the repo for "${skill}" instead.`);
  }

  const { folders, truncated } = await listSkillFolders(fullName, ref);
  if (truncated) warnings.push('GitHub truncated the repo tree; the search may miss skills in very large repos.');

  if (!skill) {
    if (folders.length === 1) return finish(await load(folders[0]));
    if (folders.length === 0) throw new CliError(`${fullName}@${ref} has no SKILL.md.`);
    const names = [...new Set(folders.map((f) => folderName(f, repoName)))].sort();
    throw new CliError(
      `${fullName} has ${folders.length} skills; say which one with owner/repo@<skill> or --skill <skill>.\n  ` +
        names.slice(0, 40).join(', ') +
        (names.length > 40 ? `, … (${names.length - 40} more)` : ''),
    );
  }

  const want = slugify(skill);
  const byFolder = rankFolders(folders.filter((f) => folderName(f, repoName) === skill || slugify(folderName(f, repoName)) === want));
  for (const f of byFolder) {
    const hit = await load(f);
    if (hit && (!hit.name || hit.name === skill || slugify(hit.name) === want)) {
      if (byFolder.length > 1) warnings.push(`Several folders match "${skill}": ${byFolder.join(', ')}. Using "${f}".`);
      return finish(hit);
    }
  }

  // No folder match: read every frontmatter and compare names.
  const others = folders.filter((f) => !byFolder.includes(f));
  if (others.length > 300) {
    throw new CliError(`No folder named "${skill}" in ${fullName}, and the repo has too many skills (${others.length}) to scan by frontmatter. Pass the folder path instead: ${fullName}/<path>.`);
  }
  const loaded = (await mapLimit(others, 8, load)).filter(Boolean);
  const matches = rankFolders(loaded.filter((h) => h.name === skill || slugify(h.name) === want).map((h) => h.path));
  if (matches.length) {
    if (matches.length > 1) warnings.push(`Several SKILL.md files are named "${skill}": ${matches.join(', ')}. Using "${matches[0]}".`);
    return finish(loaded.find((h) => h.path === matches[0]));
  }
  if (byFolder.length) {
    // Folder matched but its frontmatter name differs; accept it with a warning.
    return finish(await load(byFolder[0]));
  }
  const names = [...new Set(loaded.map((h) => h.name).filter(Boolean))].sort();
  const near = names.filter((n) => n.includes(want) || want.includes(slugify(n)));
  throw new CliError(
    `No skill "${skill}" in ${fullName}@${ref}.` +
      (near.length ? ` Did you mean: ${near.join(', ')}?` : names.length ? `\n  Available: ${names.slice(0, 40).join(', ')}${names.length > 40 ? ', …' : ''}` : ' The repo has no SKILL.md files.'),
  );
}

// ---------------------------------------------------------------- category guess

// [category, keyword regexes]. Hits in the name count double.
const KEYWORDS = [
  ['ecommerce-salla', [/\bsalla\b/, /سلة/, /e-?commerce/, /\bshopify\b/, /\bstorefront\b/, /\bmerchants?\b/, /\bcheckout\b/, /\bwoocommerce\b/]],
  ['seo-marketing', [/\bseo\b/, /\bkeywords?\b/, /\bbacklinks?\b/, /\bserp\b/, /\bmarketing\b/, /\bcopywriting\b/, /\bcampaigns?\b/, /\blink[- ]building\b/, /\blink[- ]prospecting\b/, /\bcompetitors?\b/, /\bsocial media\b/, /\bads\b/, /\bgoogle search console\b/]],
  ['video-media', [/\bvideos?\b/, /\bhyperframes\b/, /\bremotion\b/, /\banimations?\b/, /\bmotion\b/, /\bcaptions?\b/, /\bsubtitles?\b/, /\baudio\b/, /\bmusic\b/, /\bfootage\b/, /\bpodcasts?\b/, /\bimages?\b/, /\bscreenshots?\b/]],
  ['frontend-design', [/\bfrontend\b/, /\bfront-end\b/, /\bui\b/, /\bux\b/, /\bdesign system\b/, /\breact\b/, /\btailwind\b/, /\bcss\b/, /\bshadcn\b/, /\bcomponents?\b/, /\bfigma\b/, /\blanding pages?\b/, /\btypography\b/, /\bbrand(ing)?\b/, /\bprototypes?\b/]],
  ['testing', [/\btests?\b/, /\btesting\b/, /\be2e\b/, /\bend-to-end\b/, /\bplaywright\b/, /\bjest\b/, /\bvitest\b/, /\bpytest\b/, /\bqa\b/, /\btdd\b/, /\bverification\b/]],
  ['security', [/\bsecurity\b/, /\bvulnerabilit(y|ies)\b/, /\bpen-?test/, /\bexploit/, /\bowasp\b/, /\bsecrets?\b/, /\bthreat/]],
  ['code-quality', [/\bcode review\b/, /\breview\b/, /\brefactor/, /\bclean code\b/, /\blint/, /\bcode quality\b/, /\bpull requests?\b/, /\bsolid\b/, /\bdry\b/, /\barchitecture\b/, /\bmodules?\b/, /\bdeep modules?\b/, /\bcodebase\b/, /\binterfaces?\b/, /\bdomain model/, /\badrs?\b/, /\bproduction readiness\b/, /\baudit/, /\bbugs?\b/, /\bdebug/]],
  ['planning-workflow', [/\bplan(s|ning)?\b/, /\bspecs?\b/, /\btickets?\b/, /\broadmap\b/, /\bworkflow\b/, /\bkickoff\b/, /\btriage\b/, /\bprd\b/, /\bgrill/, /\bbreak down\b/, /\bimplement/]],
  ['agents-delegation', [/\bdelegat/, /\bsubagents?\b/, /\bcodex\b/, /\bcursor\b/, /\bantigravity\b/, /\bopencode\b/, /\borchestrat/, /\bmcp\b/, /\bagents?\b/, /\bclaude code\b/, /\bskills?\b/]],
  ['documents', [/\bpdf\b/, /\bdocx\b/, /\bword documents?\b/, /\bpptx\b/, /\bslides?\b/, /\bxlsx\b/, /\bspreadsheets?\b/, /\binvoices?\b/, /\bcontracts?\b/, /\bletters?\b/, /\bdocuments?\b/, /\bquotes?\b/, /\bdocumentation\b/, /\breadme\b/]],
  ['memory-knowledge', [/\bmemory\b/, /\bknowledge\b/, /\bsecond brain\b/, /\bnotes\b/, /\bvault\b/, /\bobsidian\b/, /\bknowledge graph\b/, /\brecall\b/, /\bdossiers?\b/]],
  ['research-tools', [/\bresearch\b/, /\bweb search\b/, /\bsearch\b/, /\bscrap(e|ing)\b/, /\bcrawl/, /\bbrows(e|er|ing)\b/, /\binvestigat/, /\bopen[- ]source\b/, /\bgithub\b/]],
  ['backend-data', [/\bdatabases?\b/, /\bsql\b/, /\bpostgres(ql)?\b/, /\bsupabase\b/, /\bapis?\b/, /\bbackend\b/, /\bservers?\b/, /\bmigrations?\b/, /\bschemas?\b/, /\bcloudflare\b/, /\bworkers?\b/, /\bwebhooks?\b/, /\boauth\b/]],
];
// Generic words that only break ties; they never win on their own against a specific hit.
const WEAK = new Set(['\\bagents?\\b', '\\bskills?\\b', '\\bimages?\\b', '\\bmodules?\\b', '\\bcomponents?\\b', '\\bgithub\\b', '\\bsearch\\b', '\\bworkers?\\b', '\\bservers?\\b', '\\bapis?\\b']);

/** Best category for a skill from keywords in its name and description; "other" when nothing matches. */
export function guessCategory(name = '', description = '') {
  const n = String(name).toLowerCase().replace(/[-_]/g, ' ');
  const d = String(description).toLowerCase();
  let best = 'other';
  let bestScore = 0;
  for (const [cat, regexes] of KEYWORDS) {
    let score = 0;
    for (const re of regexes) {
      const w = WEAK.has(re.source) ? 0.5 : 1;
      if (re.test(n)) score += 3 * w;
      if (re.test(d)) score += w;
    }
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return bestScore >= 1 ? best : 'other';
}

// ---------------------------------------------------------------- catalog.yaml
//
// Edits go through the Document API (nodes are inserted into / updated in the parsed
// Document). When the file is written, the changed entries are spliced into the original
// text at the positions the Document gives them, so every untouched line (comments, blank
// lines, quoting, spacing) stays byte-for-byte identical. Structural cases the splice cannot
// express (no `skills:` list yet, an empty or flow-style list) fall back to doc.toString().

/** Loads catalog.yaml as a YAML Document (comments kept). */
export async function loadCatalog(file) {
  if (!existsSync(file)) throw new CliError(`Catalog not found: ${file} (use --catalog <path>).`);
  const text = await readFile(file, 'utf8');
  const doc = YAML.parseDocument(text);
  if (doc.errors.length) throw new CliError(`${file} is not valid YAML:\n  ${doc.errors.map((e) => e.message).join('\n  ')}`);
  let fallback = false;
  if (doc.contents == null) {
    doc.contents = doc.createNode({});
    fallback = true;
  }
  if (!YAML.isMap(doc.contents)) throw new CliError(`${file}: the top level must be a mapping with a "skills" list.`);
  let skills = doc.get('skills', true);
  if (skills == null || (YAML.isScalar(skills) && skills.value == null)) {
    skills = doc.createNode([]);
    doc.delete('skills');
    const pair = doc.createPair('skills', skills);
    const first = doc.contents.items[0]?.key;
    if (first?.commentBefore) {
      // Keep a file-header comment at the top of the file.
      pair.key.commentBefore = first.commentBefore;
      first.commentBefore = undefined;
    }
    doc.contents.items.unshift(pair); // `skills:` first, like the template
    fallback = true;
  } else if (!YAML.isSeq(skills)) {
    throw new CliError(`${file}: "skills" must be a list.`);
  }
  if (skills.flow || skills.items.length === 0) fallback = true;
  if (skills.items.length === 0) skills.flow = false; // `skills: []` becomes a block list once it has entries
  return {
    doc,
    file,
    text,
    fallback,
    updated: new Set(),
    // House style for flow collections, detected separately for "[use]" and "{ ar: … }".
    seqPadding: /:[ \t]+\[ \S/.test(text),
    mapPadding: /:[ \t]+\{ \S/.test(text) || !/:[ \t]+\{\S/.test(text),
  };
}

/** Renders a map node as block lines (without its leading comment / blank line). */
function renderMap(cat, node) {
  const copy = node.clone();
  copy.commentBefore = undefined;
  copy.spaceBefore = false;
  const d = new YAML.Document();
  d.contents = copy;
  let out = d.toString({ lineWidth: 0, flowCollectionPadding: cat.seqPadding }).replace(/\n+$/, '');
  if (cat.mapPadding !== cat.seqPadding) {
    // Only flow maps on their own `key: {…}` line; strings are quoted so inner braces are safe.
    out = out.replace(/^(\s*[\w-]+:[ \t]+)\{(.*)\}([ \t]*(#.*)?)$/gm, (_, head, body, tail) =>
      cat.mapPadding ? `${head}{ ${body.trim()} }${tail}` : `${head}{${body.trim()}}${tail}`,
    );
  }
  return out;
}

/** Item prefix ("  - ") and continuation indent for entries of the skills list. */
function itemLayout(cat, seq) {
  const ref = seq.items.find((n) => n.range);
  if (!ref) return null;
  const lineStart = cat.text.lastIndexOf('\n', ref.range[0] - 1) + 1;
  const prefix = cat.text.slice(lineStart, ref.range[0]);
  if (!/^[ \t]*-[ \t]+$/.test(prefix)) return null;
  return { prefix, indent: ' '.repeat(prefix.length) };
}

function indentBlock(layout, block) {
  return block
    .split('\n')
    .map((line, i) => (i === 0 ? layout.prefix + line : line ? layout.indent + line : line))
    .join('\n');
}

export function renderCatalog(cat) {
  const seq = cat.doc.get('skills', true);
  const layout = !cat.fallback && itemLayout(cat, seq);
  if (!layout) {
    return cat.doc.toString({ lineWidth: 0, flowCollectionPadding: cat.seqPadding });
  }
  const edits = []; // { start, end, text }
  // Updated entries: replace the item text in place ("- " prefix and leading comments stay).
  for (const node of cat.updated) {
    if (!node.range) continue;
    let end = node.range[2];
    const trailingNl = cat.text[end - 1] === '\n';
    edits.push({ start: node.range[0], end, text: renderMap(cat, node).split('\n').map((l, i) => (i && l ? layout.indent + l : l)).join('\n') + (trailingNl ? '\n' : '') });
  }
  // New entries: each goes right after the nearest original entry before it in list order.
  let anchor = null;
  const groups = new Map(); // offset -> text
  for (const node of seq.items) {
    if (node.range) {
      anchor = node;
      continue;
    }
    if (!anchor) return cat.doc.toString({ lineWidth: 0, flowCollectionPadding: cat.seqPadding });
    const offset = anchor.range[2];
    let text = groups.get(offset) ?? (cat.text[offset - 1] === '\n' ? '' : '\n');
    const dashIndent = layout.prefix.match(/^[ \t]*/)[0];
    const comment = node.commentBefore ? node.commentBefore.split('\n').map((l) => `${dashIndent}#${l}\n`).join('') : '';
    text += (node.spaceBefore ? '\n' : '') + comment + indentBlock(layout, renderMap(cat, node)) + '\n';
    groups.set(offset, text);
  }
  for (const [offset, text] of groups) edits.push({ start: offset, end: offset, text });
  // Apply back to front; at an equal offset, the replacement (end > start) goes first.
  edits.sort((a, b) => b.start - a.start || a.end - a.start - (b.end - b.start));
  let out = cat.text;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  // Paranoia: the spliced text must parse to the same data as the edited Document.
  const check = YAML.parseDocument(out);
  if (check.errors.length || JSON.stringify(check.toJSON()) !== JSON.stringify(cat.doc.toJSON())) {
    return cat.doc.toString({ lineWidth: 0, flowCollectionPadding: cat.seqPadding });
  }
  return out;
}

export async function saveCatalog(cat) {
  await writeFile(cat.file, renderCatalog(cat), 'utf8');
}

const plain = (node) => (node == null ? undefined : YAML.isNode(node) ? node.toJSON() : node);

/** Skill entries in `skills:` as { node, index, source, name, path, category }. */
export function listEntries(cat) {
  const seq = cat.doc.get('skills', true);
  return seq.items.map((node, index) => {
    const get = (k) => (YAML.isMap(node) ? plain(node.get(k, true)) : undefined);
    return { node, index, source: String(get('source') ?? ''), name: String(get('name') ?? ''), path: String(get('path') ?? ''), category: get('category') };
  });
}

/** Names listed under `local:` (strings or { name } maps). */
export function localNames(cat) {
  const local = plain(cat.doc.get('local', true));
  if (!Array.isArray(local)) return [];
  return local.map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? x.name : null)).filter(Boolean).map(String);
}

/** Sources listed under `collections:`. */
export function collectionSources(cat) {
  const cols = plain(cat.doc.get('collections', true));
  if (!Array.isArray(cols)) return [];
  return cols.map((c) => (c && typeof c === 'object' ? c.source : null)).filter(Boolean).map(String);
}

/** The existing entry for source+name, or for source+path (same folder under another name). */
export function findDuplicate(cat, { source, name, path }) {
  const key = sourceKey(source);
  const entries = listEntries(cat).filter((e) => sourceKey(e.source) === key);
  return entries.find((e) => e.name === name) || entries.find((e) => e.path.replace(/\/+$/, '') === path) || null;
}

/**
 * The `ref` to write for an entry, or undefined to leave it out. Written when it is not the
 * default branch, when the default branch is not "main" (the catalog spells those out), or when
 * other entries of the same repo already carry it (so the build clones the repo once).
 */
export function chooseRef(cat, source, ref, defaultBranch) {
  const key = sourceKey(source);
  const siblings = listEntries(cat).filter((e) => sourceKey(e.source) === key);
  const siblingRef = siblings.map((e) => plain(e.node.get('ref', true))).find(Boolean);
  if (ref !== defaultBranch || defaultBranch !== 'main' || siblingRef === ref) return ref;
  return undefined;
}

/** Builds a YAML node for an entry with the catalog's house style. */
function buildEntryNode(cat, entry) {
  const ordered = { source: entry.source, path: entry.path };
  if (entry.ref) ordered.ref = entry.ref;
  ordered.name = entry.name;
  ordered.category = entry.category;
  ordered.tags = entry.tags;
  if (entry.note) ordered.note = { ar: entry.note.ar ?? '', en: entry.note.en ?? '' };
  const node = cat.doc.createNode(ordered);
  node.get('tags', true).flow = true;
  const note = node.get('note', true);
  if (note) {
    note.flow = true;
    for (const pair of note.items) pair.value.type = 'QUOTE_DOUBLE';
  }
  const path = node.get('path', true);
  if (path.value === '') path.type = 'QUOTE_DOUBLE';
  return node;
}

/**
 * Inserts an entry into `skills:` after the last entry of the same category (else at the end).
 * Returns the inserted node.
 */
export function insertEntry(cat, entry) {
  const seq = cat.doc.get('skills', true);
  const node = buildEntryNode(cat, entry);
  const entries = listEntries(cat);
  const group = entries.filter((e) => e.category === entry.category);
  const last = group.pop();
  const at = last ? last.index + 1 : seq.items.length;
  if (last && group.length) {
    // Inside a group: copy the spacing between the group's own entries.
    node.spaceBefore = Boolean(last.node.spaceBefore);
  } else {
    // Blank lines between plain entries (those without a comment above them)?
    const plainItems = seq.items.slice(1).filter((n) => !n.commentBefore);
    node.spaceBefore = plainItems.length > 0 && plainItems.filter((n) => n.spaceBefore).length * 2 > plainItems.length;
  }
  if (!last) {
    // New category at the end: add a header comment when the file uses "# ─── <category> ───" headers.
    const header = seq.items.map((n) => n.commentBefore).find((c) => c && /^ ?─+ [\w-]+ ─+$/.test(c.split('\n').pop()));
    if (header) {
      const sample = header.split('\n').pop();
      const lead = sample.match(/^ ?─+ /)[0];
      const width = sample.length;
      const title = `${lead}${entry.category} `;
      node.commentBefore = title + '─'.repeat(Math.max(3, width - title.length));
      node.spaceBefore = true;
    }
  }
  seq.items.splice(at, 0, node);
  return node;
}

/** Updates an existing entry node in place (keeps its position and comments). */
export function updateEntry(cat, existing, entry, { keep = [] } = {}) {
  const node = existing.node;
  const fresh = buildEntryNode(cat, entry);
  for (const key of ['source', 'path', 'ref', 'name', 'category', 'tags', 'note']) {
    if (keep.includes(key) && node.has(key)) continue;
    const value = fresh.get(key, true);
    if (value === undefined) {
      if (!keep.includes(key)) node.delete(key);
      continue;
    }
    const current = node.get(key, true);
    if (JSON.stringify(plain(current)) === JSON.stringify(plain(value))) continue;
    // Keep a trailing comment that sat on the replaced value (e.g. `tags: [use]  # daily`).
    if (current && YAML.isNode(current) && current.comment) value.comment = current.comment;
    node.set(key, value);
  }
  cat.updated.add(node);
  return node;
}

/** One entry as YAML text for printing. */
export function entryToString(cat, node) {
  return renderMap(cat, node);
}

// ---------------------------------------------------------------- CLI helpers

/** Minimal argv parser: --flag value, --flag=value, boolean flags, positionals. */
export function parseArgs(argv, { booleans = [], strings = [], aliases = {} }) {
  const opts = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    if (aliases[arg]) arg = aliases[arg];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    let [key, value] = arg.slice(2).split(/=(.*)/s);
    if (booleans.includes(key)) {
      opts[key] = value === undefined ? true : value !== 'false';
    } else if (strings.includes(key)) {
      if (value === undefined) {
        value = argv[++i];
        if (value === undefined) throw new CliError(`--${key} needs a value.`);
      }
      opts[key] = value;
    } else {
      throw new CliError(`Unknown option --${key}. Run with --help for usage.`);
    }
  }
  return { opts, positionals };
}

export function parseTags(value) {
  const tags = [...new Set(String(value).split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))];
  const bad = tags.filter((t) => !TAGS.includes(t));
  if (bad.length) throw new CliError(`Unknown tag(s): ${bad.join(', ')}. Allowed: ${TAGS.join(', ')}.`);
  if (!tags.length) throw new CliError(`--tag needs at least one of: ${TAGS.join(', ')}.`);
  return TAGS.filter((t) => tags.includes(t));
}

export function checkCategory(value) {
  const c = String(value).trim().toLowerCase();
  if (!CATEGORIES.includes(c)) throw new CliError(`Unknown category "${value}". Allowed: ${CATEGORIES.join(', ')}.`);
  return c;
}

/** Fixed-width text table. */
export function table(rows, headers) {
  const all = [headers, ...rows].map((r) => r.map((c) => String(c ?? '')));
  const widths = headers.map((_, i) => Math.max(...all.map((r) => r[i].length)));
  const line = (r) => r.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  return [line(all[0]), widths.map((w) => '-'.repeat(w)).join('  '), ...all.slice(1).map(line)].join('\n');
}

export async function runCli(main) {
  try {
    await main();
  } catch (err) {
    if (err instanceof CliError) {
      console.error(`error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

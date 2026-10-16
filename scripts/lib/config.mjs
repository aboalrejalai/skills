// Reads catalog.yaml and validates it into plain entries. Invalid entries are returned as
// problems (with a label) instead of throwing, so one bad line never stops the build.
import { parse } from 'yaml';
import { CATEGORIES, LOCAL_DEFAULTS, SOURCE_PATTERN, TAGS } from './constants.mjs';

/**
 * Parse catalog.yaml text.
 * Returns { skills, local, collections, problems } where
 *   skills:      { label, owner, repo, ref?, path, name, category, tags, note? }
 *   local:       Map name → { category, tags, note? }
 *   collections: { label, owner, repo, ref?, category, tags, title, description }
 *   problems:    { label, reason } for entries that were rejected
 * Throws only when the YAML itself does not parse.
 */
export function parseCatalogConfig(text) {
  const doc = parse(text) ?? {};
  if (typeof doc !== 'object' || Array.isArray(doc)) throw new Error('catalog.yaml must be a mapping');

  const problems = [];
  const skills = [];
  const collections = [];
  const local = new Map();

  for (const [index, raw] of asList(doc.skills, 'skills', problems).entries()) {
    const label = `skills[${index}] ${describe(raw)}`;
    const result = validateSkill(raw);
    if (result.error) problems.push({ label, reason: result.error });
    else skills.push({ label, ...result.value });
  }

  for (const [index, raw] of asList(doc.local, 'local', problems).entries()) {
    const label = `local[${index}] ${raw?.name ?? '?'}`;
    const result = validateLocal(raw);
    if (result.error) problems.push({ label, reason: result.error });
    else if (local.has(result.value.name)) problems.push({ label, reason: 'duplicate local override' });
    else local.set(result.value.name, result.value);
  }

  for (const [index, raw] of asList(doc.collections, 'collections', problems).entries()) {
    const label = `collections[${index}] ${raw?.source ?? '?'}`;
    const result = validateCollection(raw);
    if (result.error) problems.push({ label, reason: result.error });
    else collections.push({ label, ...result.value });
  }

  return { skills, local, collections, problems };
}

function asList(value, key, problems) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  problems.push({ label: key, reason: `"${key}" must be a list` });
  return [];
}

function describe(raw) {
  if (!raw || typeof raw !== 'object') return '?';
  return `${raw.source ?? '?'}${raw.path ? `/${raw.path}` : ''}`;
}

function validateSkill(raw) {
  if (!isObject(raw)) return { error: 'entry is not a mapping' };
  const source = parseSource(raw.source);
  if (source.error) return source;
  const repoPath = parsePath(raw.path);
  if (repoPath.error) return repoPath;
  const ref = parseRef(raw.ref);
  if (ref.error) return ref;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return { error: '"name" is required' };
  const meta = parseMeta(raw, { required: true });
  if (meta.error) return meta;
  return {
    value: { ...source.value, ref: ref.value, path: repoPath.value, name: raw.name.trim(), ...meta.value },
  };
}

function validateLocal(raw) {
  if (!isObject(raw)) return { error: 'entry is not a mapping' };
  if (typeof raw.name !== 'string' || !raw.name.trim()) return { error: '"name" is required' };
  const meta = parseMeta(raw, { required: false });
  if (meta.error) return meta;
  return { value: { name: raw.name.trim(), ...meta.value } };
}

function validateCollection(raw) {
  if (!isObject(raw)) return { error: 'entry is not a mapping' };
  const source = parseSource(raw.source);
  if (source.error) return source;
  const ref = parseRef(raw.ref);
  if (ref.error) return ref;
  const meta = parseMeta(raw, { required: true });
  if (meta.error) return meta;
  const title = parseLocalized(raw.title, 'title');
  if (title.error) return title;
  const description = parseLocalized(raw.description, 'description');
  if (description.error) return description;
  delete meta.value.note;
  return {
    value: { ...source.value, ref: ref.value, ...meta.value, title: title.value, description: description.value },
  };
}

function parseSource(value) {
  if (typeof value !== 'string' || !SOURCE_PATTERN.test(value)) {
    return { error: `"source" must look like owner/repo (got ${JSON.stringify(value)})` };
  }
  const [owner, repo] = value.split('/');
  if (repo === '.' || repo === '..') return { error: `invalid repo name "${repo}"` };
  return { value: { owner, repo: repo.replace(/\.git$/, '') } };
}

function parsePath(value) {
  if (value === undefined || value === null) return { error: '"path" is required ("" for the repo root)' };
  if (typeof value !== 'string') return { error: '"path" must be a string' };
  const clean = value.trim().replace(/^\/+|\/+$/g, '');
  const segments = clean ? clean.split('/') : [];
  if (value.includes('\\') || value.includes('\0')) return { error: `"path" must use "/" separators` };
  if (segments.some((segment) => segment === '..' || segment === '.' || segment === '')) {
    return { error: `"path" must not contain "..", "." or empty segments (got ${JSON.stringify(value)})` };
  }
  if (value.includes('..')) return { error: `"path" must not contain ".."` };
  if (segments.some((segment) => segment.startsWith('-'))) return { error: '"path" segments must not start with "-"' };
  return { value: clean };
}

function parseRef(value) {
  if (value === undefined || value === null || value === '') return { value: undefined };
  if (typeof value !== 'string' || !/^[A-Za-z0-9._\/-]+$/.test(value) || value.startsWith('-') || value.includes('..')) {
    return { error: `invalid "ref" ${JSON.stringify(value)}` };
  }
  return { value };
}

function parseMeta(raw, { required }) {
  const value = {};

  if (raw.category === undefined && !required) value.category = LOCAL_DEFAULTS.category;
  else if (!CATEGORIES.includes(raw.category)) {
    return { error: `unknown category ${JSON.stringify(raw.category)} (one of: ${CATEGORIES.join(', ')})` };
  } else value.category = raw.category;

  if (raw.tags === undefined && !required) value.tags = [...LOCAL_DEFAULTS.tags];
  else {
    if (!Array.isArray(raw.tags) || raw.tags.length === 0) return { error: '"tags" must be a non-empty list' };
    const unknown = raw.tags.filter((tag) => !TAGS.includes(tag));
    if (unknown.length) return { error: `unknown tag(s) ${unknown.join(', ')} (one of: ${TAGS.join(', ')})` };
    value.tags = TAGS.filter((tag) => raw.tags.includes(tag));
  }

  if (raw.note !== undefined && raw.note !== null) {
    const note = parseLocalized(raw.note, 'note');
    if (note.error) return note;
    value.note = note.value;
  }
  return { value };
}

function parseLocalized(value, key) {
  if (!isObject(value) || typeof value.ar !== 'string' || typeof value.en !== 'string') {
    return { error: `"${key}" must be { ar: string, en: string }` };
  }
  return { value: { ar: value.ar.trim(), en: value.en.trim() } };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

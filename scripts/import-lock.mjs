#!/usr/bin/env node
// Adds every skill from the skills CLI lock file (~/.agents/.skill-lock.json) that is not in catalog.yaml yet.
// Usage: npm run import:lock [-- --lock <path>] [--dry-run] [--catalog <path>]

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, posix } from 'node:path';
import {
  CliError,
  THIS_REPO,
  chooseRef,
  findDuplicate,
  getRepo,
  guessCategory,
  insertEntry,
  isOwnOwner,
  listEntries,
  loadCatalog,
  localNames,
  mapLimit,
  parseArgs,
  parseFrontmatter,
  resolveSkill,
  runCli,
  saveCatalog,
  sourceKey,
  table,
} from './lib/catalog-yaml.mjs';

const HELP = `Import skills from the skills CLI lock file into catalog.yaml.

Usage:
  npm run import:lock [-- options]

Options:
  --lock <path>      lock file (default: ~/.agents/.skill-lock.json)
  --catalog <path>   catalog file (default: ./catalog.yaml)
  --dry-run          show what would change, do not write
  --help, -h         this help

New entries get tags [use] ([made, use] for your own repos) and a category guessed
from the description. Edit them afterwards with: npm run add -- <spec> --update ...`;

const OWNER_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Folder of SKILL.md from a lock skillPath ("skills/x/SKILL.md" -> "skills/x", "SKILL.md" -> ""). */
function folderOf(skillPath) {
  const dir = posix.dirname(String(skillPath).replace(/\\/g, '/'));
  return dir === '.' || dir === '/' ? '' : dir.replace(/^\/+/, '');
}

/** Frontmatter of the installed copy, when the skill is installed locally. */
async function localFrontmatter(name) {
  for (const base of [join(homedir(), '.agents', 'skills'), join(homedir(), '.claude', 'skills')]) {
    const file = join(base, name, 'SKILL.md');
    if (existsSync(file)) return parseFrontmatter(await readFile(file, 'utf8'));
  }
  return null;
}

async function main() {
  const { opts, positionals } = parseArgs(process.argv.slice(2), {
    booleans: ['dry-run', 'help'],
    strings: ['lock', 'catalog'],
    aliases: { '-h': '--help', '-n': '--dry-run' },
  });
  if (opts.help) return console.log(HELP);
  if (positionals.length) throw new CliError(`Unexpected argument: ${positionals[0]}. Run with --help for usage.`);

  const lockPath = opts.lock ?? join(homedir(), '.agents', '.skill-lock.json');
  if (!existsSync(lockPath)) throw new CliError(`Lock file not found: ${lockPath}`);
  let lock;
  try {
    lock = JSON.parse(await readFile(lockPath, 'utf8'));
  } catch (err) {
    throw new CliError(`${lockPath} is not valid JSON: ${err.message}`);
  }
  if (!lock || typeof lock.skills !== 'object' || Array.isArray(lock.skills)) {
    throw new CliError(`${lockPath} has no "skills" map.`);
  }

  const cat = await loadCatalog(opts.catalog ?? 'catalog.yaml');
  const locals = new Set(localNames(cat));
  const rows = { added: [], present: [], skipped: [] };
  const ownerOf = (source) => sourceKey(source).split('/')[0];
  /** An entry with this name from the same GitHub owner (covers skills moved to another repo). */
  const sameOwnerName = (source, name) =>
    listEntries(cat).find((e) => e.name === name && ownerOf(e.source) === ownerOf(source));

  // Phase 1 (parallel, read-only): resolve every lock entry against GitHub.
  const resolved = await mapLimit(Object.entries(lock.skills), 6, async ([lockName, info]) => {
    const src = String(info?.source ?? '');
    const r = { lockName, src };
    if (info?.sourceType && info.sourceType !== 'github') return { ...r, skip: `source type "${info.sourceType}" is not GitHub` };
    if (!OWNER_REPO.test(src)) return { ...r, skip: 'source is not owner/repo' };
    if (!info.skillPath) return { ...r, skip: 'no skillPath in the lock entry' };
    r.lockFolder = folderOf(info.skillPath);
    // Cheap check before any network call: already listed under the lock's (possibly stale) source.
    const early = findDuplicate(cat, { source: src, name: lockName, path: r.lockFolder }) || sameOwnerName(src, lockName);
    if (early) return { ...r, present: early };
    if (locals.has(lockName)) return { ...r, local: true, localSource: src };
    try {
      const repo = await getRepo(src);
      if (!repo) return { ...r, skip: 'repo not found on GitHub' };
      r.repo = repo;
      if (sourceKey(repo.fullName) === sourceKey(THIS_REPO)) return { ...r, local: true };
      // The folder may have moved (renamed repo, restructured layout): verify it, else search by name.
      r.hit = await resolveSkill({ fullName: repo.fullName, ref: repo.defaultBranch, path: r.lockFolder, skill: lockName });
    } catch (err) {
      if (!(err instanceof CliError)) throw err;
      return { ...r, skip: err.message.split('\n')[0] };
    }
    if (!r.hit.description) r.hit.description = String((await localFrontmatter(lockName))?.description ?? '');
    return r;
  });

  // Phase 2 (sequential, in lock order): decide and insert.
  for (const r of resolved) {
    if (r.skip) {
      rows.skipped.push([r.lockName, r.src || '-', r.skip]);
      continue;
    }
    if (r.present) {
      rows.present.push([r.present.name, r.present.source, r.present.path || '(root)']);
      continue;
    }
    if (r.local) {
      rows.present.push([r.lockName, `${r.repo?.fullName ?? r.localSource} (listed under local:)`, r.lockFolder || '(root)']);
      continue;
    }
    const { fullName } = r.repo;
    const name = r.hit.name || r.lockName;
    // Also catches two lock names pointing at the same folder, once the first is inserted.
    const dup = findDuplicate(cat, { source: fullName, name, path: r.hit.path }) || sameOwnerName(fullName, name);
    if (dup) {
      rows.present.push([name === r.lockName ? name : `${name} (lock: ${r.lockName})`, dup.source, dup.path || '(root)']);
      continue;
    }
    const own = isOwnOwner(fullName.split('/')[0]);
    const entry = {
      source: fullName,
      path: r.hit.path,
      ref: chooseRef(cat, fullName, r.repo.defaultBranch, r.repo.defaultBranch),
      name,
      category: guessCategory(name, r.hit.description),
      tags: own ? ['made', 'use'] : ['use'],
    };
    insertEntry(cat, entry);
    const notes = [];
    if (fullName.toLowerCase() !== r.src.toLowerCase()) notes.push(`was ${r.src}`);
    if (r.hit.path !== r.lockFolder) notes.push(`moved from ${r.lockFolder || '(root)'}`);
    if (name !== r.lockName) notes.push(`lock name ${r.lockName}`);
    rows.added.push([name, fullName, r.hit.path || '(root)', entry.category, entry.tags.join(','), notes.join('; ')]);
  }

  const section = (title, list, headers) => {
    console.log(`\n${title} (${list.length})`);
    if (list.length) console.log(table(list, headers));
  };
  section(opts['dry-run'] ? 'Would add' : 'Added', rows.added, ['name', 'source', 'path', 'category', 'tags', 'note']);
  section('Already present', rows.present, ['name', 'source', 'path']);
  section('Skipped', rows.skipped, ['name', 'source', 'reason']);

  if (!rows.added.length) {
    console.log('\nNothing to add.');
  } else if (opts['dry-run']) {
    console.log(`\nDry run: ${cat.file} not changed.`);
  } else {
    await saveCatalog(cat);
    console.log(`\nWrote ${rows.added.length} new entr${rows.added.length === 1 ? 'y' : 'ies'} to ${cat.file}. Review categories, then run \`npm run catalog\` to rebuild.`);
  }
}

runCli(main);

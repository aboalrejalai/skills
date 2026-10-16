#!/usr/bin/env node
// Builds the site data from catalog.yaml + ./skills/*/SKILL.md:
//   src/data/generated/catalog.json        (Catalog)
//   src/data/generated/skills/<id>.json    (SkillDetail)
//   .cache/skills/<id>/…                   (full copy of each skill folder, zipped by build-zips.mjs)
// Third-party repos are shallow-cloned into .cache/repos/. Nothing from a clone is ever executed.
// Usage: node scripts/build-catalog.mjs [--catalog <path>] [--skills-dir <path>] [--offline] [--strict]
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseCatalogConfig } from './lib/config.mjs';
import { CLONE_CONCURRENCY, LOCAL_DEFAULTS, LOCAL_SOURCE } from './lib/constants.mjs';
import { copySkillFiles, isInside } from './lib/files.mjs';
import { lastCommitDate, listTrackedFiles, syncRepo } from './lib/git.mjs';
import { mapLimit } from './lib/pool.mjs';
import { createReport } from './lib/report.mjs';
import { loadSkill, toEntry, withId } from './lib/skill.mjs';
import { createIdAllocator, installCollection, isOwnOwner, repoUrl, skillsShRepoUrl } from './lib/urls.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GENERATED_DIR = path.join(ROOT, 'src/data/generated');
const CACHE_DIR = path.join(ROOT, '.cache');
const REPOS_DIR = path.join(CACHE_DIR, 'repos');
const SKILL_COPIES_DIR = path.join(CACHE_DIR, 'skills');

const USAGE = `Usage: node scripts/build-catalog.mjs [options]
  --catalog <path>     catalog file (default: ./catalog.yaml)
  --skills-dir <path>  folder of this repo's own skills (default: ./skills)
  --offline            reuse cached clones in .cache/repos without fetching
  --strict             exit 1 when any entry is skipped
  -h, --help           show this help`;

async function main() {
  const startedAt = Date.now();
  const options = readOptions();
  const report = createReport();

  const config = await readConfig(options.catalog, options.catalogGiven);
  for (const problem of config.problems) report.skip('config', problem.label, problem.reason);

  await rm(GENERATED_DIR, { recursive: true, force: true });
  await rm(SKILL_COPIES_DIR, { recursive: true, force: true });

  const remoteSpecs = dropUnusable(config.skills, report);
  const repos = await syncRepos([...remoteSpecs, ...config.collections], remoteSpecs, options.offline);

  const loaded = [
    ...(await loadLocalSkills(options.skillsDir, config.local, report)),
    ...(await loadRemoteSkills(remoteSpecs, repos, report)),
  ];

  const allocateId = createIdAllocator();
  const details = loaded.map(({ result }) => withId(result.skill, allocateId(result.skill.name, result.skill.source.owner)));
  loaded.forEach(({ kind, label, result }, index) => report.ok(kind, label, details[index].id, result.warnings));

  const collections = await buildCollections(config.collections, repos, report);

  const order = details.map((detail, index) => ({ detail, files: loaded[index].result.files }));
  order.sort((a, b) => compareSkills(a.detail, b.detail));
  await writeOutputs(order, collections);

  report.print({
    elapsedMs: Date.now() - startedAt,
    totals: {
      skills: details.length,
      local: details.filter((detail) => detail.local).length,
      collections: collections.length,
      files: details.reduce((sum, detail) => sum + detail.files.length, 0),
      bytes: details.reduce((sum, detail) => sum + detail.totalBytes, 0),
    },
  });
  console.log(`wrote ${path.relative(ROOT, GENERATED_DIR)}/ and ${path.relative(ROOT, SKILL_COPIES_DIR)}/`);

  if (options.strict && report.skipped > 0) {
    console.error(`--strict: ${report.skipped} entr${report.skipped === 1 ? 'y was' : 'ies were'} skipped`);
    process.exitCode = 1;
  }
}

function readOptions() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        catalog: { type: 'string' },
        'skills-dir': { type: 'string' },
        offline: { type: 'boolean', default: false },
        strict: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    }).values;
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (parsed.help) {
    console.log(USAGE);
    process.exit(0);
  }
  return {
    catalog: path.resolve(parsed.catalog ?? path.join(ROOT, 'catalog.yaml')),
    catalogGiven: parsed.catalog !== undefined,
    skillsDir: path.resolve(parsed['skills-dir'] ?? path.join(ROOT, 'skills')),
    offline: parsed.offline,
    strict: parsed.strict,
  };
}

/** A missing default catalog.yaml means "local skills only"; a missing --catalog file is an error. */
async function readConfig(file, explicit) {
  if (!existsSync(file)) {
    if (explicit) throw new Error(`catalog file not found: ${file}`);
    console.warn(`warn  ${path.relative(ROOT, file)} not found; building local skills only`);
    return parseCatalogConfig('');
  }
  return parseCatalogConfig(await readFile(file, 'utf8'));
}

/** Drop duplicate entries and entries pointing at this repo (those belong in `local:`). */
function dropUnusable(specs, report) {
  const seen = new Set();
  return specs.filter((spec) => {
    const key = `${spec.owner}/${spec.repo}/${spec.path}`.toLowerCase();
    if (isThisRepo(spec)) {
      report.skip('skill', spec.label, `${spec.owner}/${spec.repo} is this repository; use the "local:" section`);
      return false;
    }
    if (seen.has(key)) {
      report.skip('skill', spec.label, 'duplicate of an earlier entry');
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isThisRepo({ owner, repo }) {
  return isOwnOwner(owner) && repo.toLowerCase() === LOCAL_SOURCE.repo;
}

function repoKey({ owner, repo, ref }) {
  return `${owner}/${repo}@${ref ?? ''}`.toLowerCase();
}

/**
 * Clone or refresh every repo named by skill entries and collections, CLONE_CONCURRENCY at a time.
 * Returns Map repoKey → { dir, ref } | { error }.
 */
async function syncRepos(entries, skillSpecs, offline) {
  const plans = new Map();
  for (const entry of entries) {
    const key = repoKey(entry);
    if (!plans.has(key)) {
      const dirName = `${entry.owner}__${entry.repo}${entry.ref ? `@${entry.ref.replace(/[^A-Za-z0-9._-]/g, '_')}` : ''}`;
      plans.set(key, { key, owner: entry.owner, repo: entry.repo, ref: entry.ref, dirName, paths: [] });
    }
  }
  for (const spec of skillSpecs) {
    const plan = plans.get(repoKey(spec));
    if (spec.path === '') plan.paths = null;
    else if (plan.paths) plan.paths.push(spec.path);
  }

  const list = [...plans.values()];
  console.log(`syncing ${list.length} repositor${list.length === 1 ? 'y' : 'ies'}${offline ? ' (offline)' : ''}…`);
  const results = await mapLimit(list, CLONE_CONCURRENCY, async (plan) => {
    const started = Date.now();
    try {
      const synced = await syncRepo({ reposDir: REPOS_DIR, offline, ...plan });
      console.log(`  ok    ${plan.owner}/${plan.repo}@${synced.ref} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
      return synced;
    } catch (error) {
      console.warn(`  fail  ${plan.owner}/${plan.repo}: ${error.message}`);
      return { error: error.message };
    }
  });
  return new Map(list.map((plan, index) => [plan.key, results[index]]));
}

async function loadRemoteSkills(specs, repos, report) {
  const results = await mapLimit(specs, 8, async (spec) => {
    const repo = repos.get(repoKey(spec));
    if (repo.error) return { spec, result: { error: `repository unavailable: ${repo.error}` } };
    const source = { owner: spec.owner, repo: spec.repo, ref: repo.ref, path: spec.path };
    const result = await loadSkill({
      folder: path.join(repo.dir, ...(spec.path ? spec.path.split('/') : [])),
      root: repo.dir,
      source,
      name: spec.name,
      category: spec.category,
      tags: spec.tags,
      note: spec.note,
      local: false,
      updatedAt: await lastCommitDate(repo.dir, spec.path),
    });
    return { spec, result };
  });
  return keepLoaded(results, 'skill', report);
}

/** Every <skillsDir>/<name>/SKILL.md, merged with its optional `local:` override. */
async function loadLocalSkills(skillsDir, overrides, report) {
  const names = existsSync(skillsDir)
    ? (await readdir(skillsDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort()
    : [];
  for (const name of overrides.keys()) {
    if (!names.includes(name)) report.skip('local', `local ${name}`, `no folder ${path.join(path.relative(ROOT, skillsDir), name)}`);
  }

  const results = await mapLimit(names, 8, async (name) => {
    const override = overrides.get(name) ?? {};
    const folder = path.join(skillsDir, name);
    const relToRoot = path.relative(ROOT, folder).split(path.sep).join('/');
    const result = await loadSkill({
      folder,
      root: skillsDir,
      source: { owner: LOCAL_SOURCE.owner, repo: LOCAL_SOURCE.repo, ref: LOCAL_SOURCE.ref, path: `${LOCAL_SOURCE.dir}/${name}` },
      name,
      category: override.category ?? LOCAL_DEFAULTS.category,
      tags: override.tags ?? [...LOCAL_DEFAULTS.tags],
      note: override.note,
      local: true,
      updatedAt: isInside(ROOT, folder) ? await lastCommitDate(ROOT, relToRoot) : undefined,
    });
    return { spec: { label: `local ${name}` }, result };
  });
  return keepLoaded(results, 'local', report);
}

function keepLoaded(results, kind, report) {
  const loaded = [];
  for (const { spec, result } of results) {
    if (result.error) report.skip(kind, spec.label, result.error);
    else loaded.push({ kind, label: spec.label, result });
  }
  return loaded;
}

async function buildCollections(specs, repos, report) {
  const allocateId = createIdAllocator();
  const collections = [];
  for (const spec of specs) {
    const repo = repos.get(repoKey(spec));
    if (repo.error) {
      report.skip('collection', spec.label, `repository unavailable: ${repo.error}`);
      continue;
    }
    let skillCount;
    try {
      skillCount = (await listTrackedFiles(repo.dir)).filter(isSkillFile).length;
    } catch (error) {
      report.skip('collection', spec.label, error.message);
      continue;
    }
    if (skillCount === 0) {
      report.skip('collection', spec.label, 'repository has no SKILL.md files');
      continue;
    }
    const source = { owner: spec.owner, repo: spec.repo, ref: repo.ref };
    const id = allocateId(spec.repo, spec.owner);
    collections.push({
      id,
      title: spec.title,
      description: spec.description,
      category: spec.category,
      tags: spec.tags,
      own: isOwnOwner(spec.owner),
      source,
      skillCount,
      githubUrl: repoUrl(source),
      skillsShUrl: skillsShRepoUrl(source),
      install: installCollection(source),
    });
    report.ok('collection', spec.label, `${id} (${skillCount} skills)`);
  }
  return collections;
}

function isSkillFile(file) {
  const segments = file.split('/');
  return segments.at(-1) === 'SKILL.md' && !segments.some((segment) => segment === 'node_modules' || segment === '.git');
}

/** favorite first, then made, then by name. */
function compareSkills(a, b) {
  const rank = (skill) => (skill.tags.includes('favorite') ? 0 : 2) + (skill.tags.includes('made') ? 0 : 1);
  return rank(a) - rank(b) || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en');
}

async function writeOutputs(order, collections) {
  const skillsDir = path.join(GENERATED_DIR, 'skills');
  await mkdir(skillsDir, { recursive: true });
  await mkdir(SKILL_COPIES_DIR, { recursive: true });

  for (const { detail, files } of order) {
    await writeJson(path.join(skillsDir, `${detail.id}.json`), detail);
    await copySkillFiles(files, path.join(SKILL_COPIES_DIR, detail.id));
  }
  const catalog = {
    generatedAt: new Date().toISOString(),
    skills: order.map(({ detail }) => toEntry(detail)),
    collections,
  };
  await writeJson(path.join(GENERATED_DIR, 'catalog.json'), catalog);
}

function writeJson(file, value) {
  return writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`build-catalog failed: ${error.stack ?? error.message}`);
  process.exit(1);
});

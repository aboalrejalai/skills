#!/usr/bin/env node
// Adds one GitHub-hosted skill to catalog.yaml without hand-editing YAML.
// Usage: npm run add -- <spec> [options]   (run with --help for details)

import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import {
  CATEGORIES,
  CliError,
  TAGS,
  THIS_REPO,
  checkCategory,
  chooseRef,
  collectionSources,
  entryToString,
  findDuplicate,
  getRepo,
  guessCategory,
  insertEntry,
  isOwnOwner,
  loadCatalog,
  localNames,
  parseArgs,
  parseTags,
  refExists,
  resolveSkill,
  runCli,
  saveCatalog,
  sourceKey,
  updateEntry,
} from './lib/catalog-yaml.mjs';

const HELP = `Add a skill to catalog.yaml.

Usage:
  npm run add -- <spec> [options]

<spec> is any of:
  owner/repo@skill
  owner/repo --skill skill
  owner/repo                         (repo with a single SKILL.md)
  owner/repo/path/to/skill
  https://github.com/owner/repo/tree/<ref>/<path>
  https://skills.sh/owner/repo/skill

Options:
  --skill <name>       skill name (with owner/repo)
  --ref <ref>          branch or tag (default: the repo's default branch)
  --tag <list>         comma list of ${TAGS.join(', ')} (default: use; made for own repos)
  --category <c>       one of ${CATEGORIES.join(', ')}
                       (default: guessed from the description)
  --note-ar <text>     why it is here, in Arabic
  --note-en <text>     why it is here, in English
  --update             replace an existing entry for the same skill instead of refusing
  --dry-run            print the entry, do not write
  --yes, -y            never ask; use defaults for anything not given
  --catalog <path>     catalog file (default: ./catalog.yaml)
  --help, -h           this help

With no --tag/--category and an interactive terminal, you are asked for them.`;

/** Parses a spec into { owner, repo, ref?, refPath?, path?, skill? }. refPath = "<ref>/<path>" still to split. */
export function parseSpec(spec) {
  const s = String(spec).trim();
  const bad = () =>
    new CliError(`Cannot read "${spec}". Use owner/repo@skill, owner/repo/path, a github.com tree URL, or a skills.sh URL.`);
  const seg = /^[A-Za-z0-9_.-]+$/;
  const repoName = (r) => r.replace(/\.git$/, '');

  let m = /^(?:https?:\/\/)?(?:www\.)?skills\.sh\/([^/?#]+)\/([^/?#]+)(?:\/([^/?#]+))?\/?(?:[?#].*)?$/i.exec(s);
  if (m) return { owner: m[1], repo: repoName(m[2]), skill: m[3] ? decodeURIComponent(m[3]) : undefined };

  m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)(?:\/(tree|blob)\/([^?#]+))?\/?(?:[?#].*)?$/i.exec(s);
  if (m) {
    const out = { owner: m[1], repo: repoName(m[2]) };
    if (m[4]) out.refPath = decodeURIComponent(m[4]).replace(/\/+$/, '').replace(/\/SKILL\.md$/i, '');
    if (!seg.test(out.owner) || !seg.test(out.repo)) throw bad();
    return out;
  }
  if (/^[a-z]+:\/\//i.test(s)) throw bad();

  m = /^([^/@\s]+)\/([^/@\s]+)@([^/@\s]+)$/.exec(s);
  if (m) {
    if (!seg.test(m[1]) || !seg.test(m[2])) throw bad();
    return { owner: m[1], repo: repoName(m[2]), skill: m[3] };
  }

  const parts = s.replace(/\/+$/, '').split('/');
  if (parts.length < 2 || parts.some((p) => !p) || !seg.test(parts[0]) || !seg.test(parts[1])) throw bad();
  const out = { owner: parts[0], repo: repoName(parts[1]) };
  if (parts.length > 2) out.path = parts.slice(2).join('/').replace(/\/?SKILL\.md$/i, '');
  return out;
}

/** Splits "<ref>/<path>" from a tree URL, trying the shortest ref that exists (refs may contain "/"). */
async function splitRefPath(fullName, refPath, defaultBranch) {
  const parts = refPath.split('/');
  for (let k = 1; k <= parts.length; k++) {
    const ref = parts.slice(0, k).join('/');
    if (await refExists(fullName, ref)) return { ref, path: parts.slice(k).join('/') };
  }
  throw new CliError(`No branch or tag at the start of "${refPath}" in ${fullName} (its default branch is "${defaultBranch}").`);
}

async function askTagsAndCategory({ needTags, needCategory, defaultTags, guessed }) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    let tags;
    let category;
    if (needTags) {
      console.log('\nTags:');
      TAGS.forEach((t, i) => console.log(`  ${i + 1}) ${t}`));
      for (;;) {
        const raw = (await rl.question(`Pick one or more (numbers or names, comma separated) [${defaultTags.join(',')}]: `)).trim();
        if (!raw) {
          tags = defaultTags;
          break;
        }
        try {
          tags = parseTags(raw.split(/[,\s]+/).map((x) => (/^\d+$/.test(x) ? TAGS[Number(x) - 1] ?? x : x)).join(','));
          break;
        } catch (err) {
          console.log(`  ${err.message}`);
        }
      }
    }
    if (needCategory) {
      console.log('\nCategory:');
      CATEGORIES.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}) ${c}${c === guessed ? '   (guess)' : ''}`));
      for (;;) {
        const raw = (await rl.question(`Pick one (number or name) [${guessed}]: `)).trim();
        if (!raw) {
          category = guessed;
          break;
        }
        try {
          category = checkCategory(/^\d+$/.test(raw) ? CATEGORIES[Number(raw) - 1] ?? raw : raw);
          break;
        } catch (err) {
          console.log(`  ${err.message}`);
        }
      }
    }
    console.log('');
    return { tags, category };
  } finally {
    rl.close();
  }
}

async function main() {
  const { opts, positionals } = parseArgs(process.argv.slice(2), {
    booleans: ['dry-run', 'update', 'yes', 'help'],
    strings: ['skill', 'ref', 'tag', 'tags', 'category', 'note-ar', 'note-en', 'catalog'],
    aliases: { '-h': '--help', '-y': '--yes', '-n': '--dry-run' },
  });
  if (opts.help) return console.log(HELP);
  if (positionals.length !== 1) {
    throw new CliError(positionals.length ? `Expected one spec, got ${positionals.length}: ${positionals.join(' ')}` : `Missing <spec>.\n\n${HELP}`);
  }
  const tagOpt = opts.tag ?? opts.tags;
  const tagsGiven = tagOpt !== undefined ? parseTags(tagOpt) : undefined;
  const categoryGiven = opts.category !== undefined ? checkCategory(opts.category) : undefined;

  const cat = await loadCatalog(opts.catalog ?? 'catalog.yaml');

  const spec = parseSpec(positionals[0]);
  if (opts.skill) {
    if (spec.skill && spec.skill !== opts.skill) throw new CliError(`The spec names "${spec.skill}" but --skill says "${opts.skill}".`);
    spec.skill = opts.skill;
  }

  const repo = await getRepo(`${spec.owner}/${spec.repo}`);
  if (!repo) throw new CliError(`GitHub repo ${spec.owner}/${spec.repo} not found (or not visible to your gh login).`);
  const { fullName, defaultBranch } = repo;
  if (fullName.toLowerCase() !== `${spec.owner}/${spec.repo}`.toLowerCase()) {
    console.log(`note: ${spec.owner}/${spec.repo} is now ${fullName}; using that.`);
  }
  if (sourceKey(fullName) === sourceKey(THIS_REPO)) {
    throw new CliError(`${fullName} is this repo. Skills that live here go in skills/<name>/SKILL.md and are listed under "local:", not added with this command.`);
  }
  if (repo.private) console.warn(`warning: ${fullName} is private; the public site build will not be able to fetch it.`);

  let ref = opts.ref ?? spec.ref;
  let path = spec.path;
  if (spec.refPath) {
    if (opts.ref) throw new CliError('Do not combine --ref with a github.com tree URL; the URL already names the ref.');
    ({ ref, path } = await splitRefPath(fullName, spec.refPath, defaultBranch));
  }
  ref ??= defaultBranch;
  if (opts.ref && !(await refExists(fullName, ref))) {
    throw new CliError(`${fullName} has no branch or tag "${ref}" (its default branch is "${defaultBranch}").`);
  }

  const hit = await resolveSkill({ fullName, ref, path, skill: spec.skill });
  for (const w of hit.warnings) console.warn(`warning: ${w}`);

  const owner = fullName.split('/')[0];
  const own = isOwnOwner(owner);
  const guessed = guessCategory(hit.name, hit.description);
  const note = opts['note-ar'] !== undefined || opts['note-en'] !== undefined ? { ar: opts['note-ar'] ?? '', en: opts['note-en'] ?? '' } : undefined;

  const existing = findDuplicate(cat, { source: fullName, name: hit.name, path: hit.path });
  if (existing && !opts.update) {
    throw new CliError(
      `Already in ${cat.file}: ${existing.source} ${existing.name} (path "${existing.path}", category ${existing.category}). Use --update to replace it.`,
    );
  }
  if (localNames(cat).includes(hit.name)) console.warn(`warning: a local skill named "${hit.name}" is already listed under "local:".`);
  if (collectionSources(cat).some((s) => sourceKey(s) === sourceKey(fullName))) {
    console.warn(`warning: ${fullName} is also listed as a collection.`);
  }
  const sameName = !existing && cat.doc.get('skills').items.find((n) => n.get?.('name') === hit.name);
  if (sameName) console.warn(`warning: another entry is already named "${hit.name}" (${sameName.get('source')}); the build will give them different ids.`);

  let tags = tagsGiven;
  let category = categoryGiven;
  const defaultTags = own ? ['made'] : ['use'];
  if (!existing && stdin.isTTY && stdout.isTTY && !opts.yes && (!tags || !category)) {
    const desc = hit.description.length > 240 ? `${hit.description.slice(0, 239)}…` : hit.description;
    console.log(`${fullName} @ ${ref} : ${hit.path || '(repo root)'}\n${hit.name}: ${desc || '(no description)'}`);
    const answers = await askTagsAndCategory({ needTags: !tags, needCategory: !category, defaultTags, guessed });
    tags ??= answers.tags;
    category ??= answers.category;
  }

  const entry = {
    source: fullName,
    path: hit.path,
    ref: chooseRef(cat, fullName, ref, defaultBranch),
    name: hit.name,
    category: category ?? guessed,
    tags: tags ?? defaultTags,
    note,
  };

  let node;
  if (existing) {
    const keep = [];
    if (!categoryGiven) keep.push('category');
    if (!tagsGiven) keep.push('tags');
    if (!note) keep.push('note');
    node = updateEntry(cat, existing, entry, { keep });
  } else {
    node = insertEntry(cat, entry);
  }

  const verb = existing ? 'Updated' : 'Added';
  const where = opts['dry-run'] ? `(dry run, ${cat.file} not changed)` : `in ${cat.file}`;
  console.log(`${verb} ${where}:\n`);
  console.log(entryToString(cat, node).replace(/^/gm, '  '));
  if (!category && !existing && !categoryGiven) console.log(`\n  category guessed from the description: ${guessed}`);
  if (!opts['dry-run']) {
    await saveCatalog(cat);
    console.log('\nNext: run `npm run catalog` to rebuild.');
  }
}

runCli(main);

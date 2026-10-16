#!/usr/bin/env node
// Zips every catalog skill folder (.cache/skills/<id>/, written by build-catalog.mjs)
// into public/dl/<id>.zip, with all files under a top-level "<name>/" folder so the
// archive unpacks straight into ~/.claude/skills/ or .agents/skills/.
// Also writes public/dl/index.json: { "<id>": { "bytes": n, "sha256": "hex" } }.
//
// Usage: node scripts/build-zips.mjs [--cache <dir>] [--out <dir>] [--catalog <file>]

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { zipSync } from 'fflate';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MiB = 1024 * 1024;
const WARN_BYTES = 10 * MiB;
const MAX_BYTES = 25 * MiB; // Cloudflare Workers Static Assets per-file limit
const SKIP_NAMES = new Set(['.git', '.DS_Store', 'node_modules']);
// Formats that are already compressed: deflating them again wastes time for no gain.
const STORED_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico',
  '.mp3', '.mp4', '.m4a', '.mov', '.webm', '.ogg',
  '.zip', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.br', '.zst',
  '.woff', '.woff2', '.pdf', '.docx', '.xlsx', '.pptx', '.jar',
]);
// Fixed DOS timestamp (local time, as the zip format stores it) for reproducible output.
const MTIME = new Date(1980, 0, 1, 0, 0, 0);
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const { values: args } = parseArgs({
  options: {
    cache: { type: 'string', default: path.join(ROOT, '.cache/skills') },
    out: { type: 'string', default: path.join(ROOT, 'public/dl') },
    catalog: { type: 'string' },
  },
});
const cacheDir = path.resolve(args.cache);
const outDir = path.resolve(args.out);

function loadCatalog() {
  const candidates = args.catalog
    ? [path.resolve(args.catalog)]
    : [path.join(ROOT, 'src/data/generated/catalog.json'), path.join(ROOT, 'src/data/fixture/catalog.json')];
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) throw new Error(`No catalog found (looked in: ${candidates.join(', ')})`);
  console.log(`build-zips: catalog ${path.relative(ROOT, file) || file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Collects { rel, abs, mode } for every regular file under skillDir, sorted, symlinks confined to skillDir. */
function collectFiles(skillDir, warn) {
  const root = fs.realpathSync(skillDir);
  const files = [];
  const visitedDirs = new Set([root]);

  const walk = (dir, relDir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (SKIP_NAMES.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      let real = abs;
      if (entry.isSymbolicLink()) {
        try {
          real = fs.realpathSync(abs);
        } catch {
          warn(`broken symlink skipped: ${rel}`);
          continue;
        }
        if (!isInside(root, real)) {
          warn(`symlink pointing outside the skill skipped: ${rel}`);
          continue;
        }
      }
      const stat = fs.statSync(real);
      if (stat.isDirectory()) {
        if (visitedDirs.has(real)) {
          warn(`symlink loop skipped: ${rel}`);
          continue;
        }
        visitedDirs.add(real);
        walk(real, rel);
      } else if (stat.isFile()) {
        files.push({ rel, abs: real, mode: stat.mode });
      }
    }
  };

  walk(root, '');
  return files;
}

function buildZip(skill, skillDir, warn) {
  const entries = {};
  for (const file of collectFiles(skillDir, warn)) {
    const level = STORED_EXT.has(path.extname(file.rel).toLowerCase()) ? 0 : 9;
    const perms = file.mode & 0o111 ? 0o755 : 0o644; // normalized: only the executable bit survives
    entries[`${skill.name}/${file.rel}`] = [
      new Uint8Array(fs.readFileSync(file.abs)),
      { level, mtime: MTIME, os: 3, attrs: (0o100000 | perms) << 16 },
    ];
  }
  if (!entries[`${skill.name}/SKILL.md`]) warn('no SKILL.md at the folder root');
  return { zip: zipSync(entries), count: Object.keys(entries).length };
}

function main() {
  const catalog = loadCatalog();
  const skills = catalog.skills ?? [];

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const index = {};
  const built = [];
  const seen = new Set();
  let skipped = 0;
  let oversized = 0;

  for (const skill of skills) {
    const warn = (msg) => console.warn(`  warn [${skill.id}] ${msg}`);
    if (!SAFE_SEGMENT.test(skill.id ?? '') || !SAFE_SEGMENT.test(skill.name ?? '')) {
      warn(`unsafe id or name (${JSON.stringify(skill.id)} / ${JSON.stringify(skill.name)}), skipped`);
      skipped++;
      continue;
    }
    if (seen.has(skill.id)) {
      warn('duplicate id, skipped');
      skipped++;
      continue;
    }
    seen.add(skill.id);

    const skillDir = path.join(cacheDir, skill.id);
    if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
      warn(`cache folder missing (${skillDir}), skipped`);
      skipped++;
      continue;
    }

    const { zip, count } = buildZip(skill, skillDir, warn);
    if (count === 0) {
      warn('folder is empty, skipped');
      skipped++;
      continue;
    }
    if (zip.length > MAX_BYTES) {
      console.error(`  error [${skill.id}] zip is ${(zip.length / MiB).toFixed(1)} MiB, over the 25 MiB Cloudflare limit; not written`);
      oversized++;
      continue;
    }
    if (zip.length > WARN_BYTES) warn(`zip is ${(zip.length / MiB).toFixed(1)} MiB (over 10 MiB)`);

    fs.writeFileSync(path.join(outDir, `${skill.id}.zip`), zip);
    index[skill.id] = { bytes: zip.length, sha256: createHash('sha256').update(zip).digest('hex') };
    built.push({ id: skill.id, bytes: zip.length, files: count });
  }

  const sortedIndex = Object.fromEntries(Object.keys(index).sort().map((id) => [id, index[id]]));
  fs.writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(sortedIndex, null, 2)}\n`);

  const total = built.reduce((sum, b) => sum + b.bytes, 0);
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log(`build-zips: ${built.length} zip(s), ${kb(total)} total, ${skipped} skipped -> ${path.relative(ROOT, outDir) || outDir}`);
  for (const b of [...built].sort((a, b) => b.bytes - a.bytes).slice(0, 3)) {
    console.log(`  ${b.id}.zip  ${kb(b.bytes)}  (${b.files} files)`);
  }
  if (oversized) {
    console.error(`build-zips: ${oversized} zip(s) over 25 MiB`);
    process.exit(1);
  }
}

main();

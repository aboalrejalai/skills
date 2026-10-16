import { copyFile, lstat, mkdir, open, readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { BINARY_SNIFF_BYTES, MAX_TEXT_BYTES, SKIPPED_NAMES } from './constants.mjs';

/**
 * File names an untrusted repo may use for tricks, each skipped with a warning:
 * backslashes (a path separator for Windows unzip tools, so a file named `..\..\x` is a zip-slip there),
 * control characters, bidi controls that make "a\u202Etxt.sh" display as "ahs.txt" in the file tree,
 * and "__proto__", which cannot survive as a key of SkillDetail.texts.
 */
const UNSAFE_NAME = /[\\\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
export function isUnsafeName(name) {
  return UNSAFE_NAME.test(name) || name === '__proto__';
}

/**
 * List every file of a skill folder, recursively.
 * Symlinks are followed when their target stays inside the folder and skipped (with a warning)
 * otherwise. Returns { files, warnings }; each file is { path, abs, size, binary, text? } where
 * `path` is POSIX and relative to the folder, `abs` is the real file to read or copy, and `text`
 * is the UTF-8 content of non-binary files up to MAX_TEXT_BYTES.
 */
export async function readSkillFolder(folder) {
  const root = await realpath(folder);
  const files = [];
  const warnings = [];
  const visitedDirs = new Set([root]);

  async function walk(realDir, relDir) {
    const entries = await readdir(realDir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIPPED_NAMES.has(entry.name)) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (isUnsafeName(entry.name)) {
        warnings.push(`skipped ${JSON.stringify(rel)}: unsafe file name`);
        continue;
      }
      let abs = path.join(realDir, entry.name);
      let info = await lstat(abs);

      if (info.isSymbolicLink()) {
        const target = await realpath(abs).catch(() => null);
        if (!target) {
          warnings.push(`skipped broken symlink ${rel}`);
          continue;
        }
        if (!isInside(root, target)) {
          warnings.push(`skipped symlink ${rel} pointing outside the skill folder`);
          continue;
        }
        abs = target;
        info = await stat(target);
      }

      if (info.isDirectory()) {
        if (visitedDirs.has(abs)) continue; // symlink loop or a second link to the same folder
        visitedDirs.add(abs);
        await walk(abs, rel);
      } else if (info.isFile()) {
        files.push({ path: rel, abs, ...(await inspectFile(abs, info.size)) });
      }
    }
  }

  await walk(root, '');
  files.sort((a, b) => compareKeys(a.path, b.path));
  return { files, warnings };
}

async function inspectFile(abs, size) {
  if (size <= MAX_TEXT_BYTES) {
    const buffer = await readFile(abs);
    const binary = hasNul(buffer.subarray(0, BINARY_SNIFF_BYTES));
    return binary ? { size, binary } : { size, binary, text: buffer.toString('utf8') };
  }
  const handle = await open(abs, 'r');
  try {
    const head = Buffer.alloc(Math.min(BINARY_SNIFF_BYTES, size));
    await handle.read(head, 0, head.length, 0);
    return { size, binary: hasNul(head) };
  } finally {
    await handle.close();
  }
}

/** Read a file listed by readSkillFolder that was too large to embed. */
export function readText(file) {
  return readFile(file.abs, 'utf8');
}

/** Copy the listed files into `dest`, preserving relative paths (symlinks are already resolved). */
export async function copySkillFiles(files, dest) {
  for (const file of files) {
    const target = path.join(dest, ...file.path.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(file.abs, target);
  }
}

function hasNul(buffer) {
  return buffer.includes(0);
}

/** True when `target` is `root` or below it (both already resolved with realpath). */
export function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/** Case-insensitive path order (matches the fixture: "scripts/x" before "SKILL.md"). */
function compareKeys(a, b) {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la !== lb) return la < lb ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

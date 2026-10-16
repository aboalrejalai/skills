// Git access for the catalog build. Every command is spawned with an argument array (no shell),
// with prompts and repository hooks disabled, so nothing from a cloned repository ever runs.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const SAFE_CONFIG = [
  '-c', 'core.hooksPath=/dev/null',
  '-c', 'core.fsmonitor=false',
  '-c', 'protocol.file.allow=never',
  '-c', 'submodule.recurse=false',
  '-c', 'advice.detachedHead=false',
];

const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_ASKPASS: '',
  SSH_ASKPASS: '',
  GIT_LFS_SKIP_SMUDGE: '1',
  GIT_CONFIG_NOSYSTEM: '1',
};

const TIMEOUT_MS = 5 * 60 * 1000;

/** Run git with `args` in `cwd`; resolves to trimmed stdout, rejects with git's stderr as message. */
export async function git(args, cwd) {
  try {
    const { stdout } = await run('git', [...SAFE_CONFIG, ...args], {
      cwd,
      env: GIT_ENV,
      timeout: TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    const detail = String(error.stderr || error.message).trim().split('\n').filter(Boolean).pop();
    throw new Error(`git ${args[0]} failed: ${detail || 'unknown error'}`);
  }
}

/**
 * Make `<reposDir>/<dirName>` hold `ref` (or the remote default branch) with only `paths` checked
 * out: null = the whole tree, [] = top-level files only (enough for ls-tree). An existing clone is
 * refreshed with fetch + reset; if that fails it is cloned again. `offline` reuses clones as they are.
 * Returns { dir, ref } where ref is the requested ref or the resolved default branch.
 */
export async function syncRepo({ reposDir, dirName, owner, repo, ref, paths, offline }) {
  const dir = path.join(reposDir, dirName);
  const hasClone = existsSync(path.join(dir, '.git'));

  if (offline) {
    if (!hasClone) throw new Error('no cached clone (offline mode)');
  } else if (hasClone) {
    await refresh(dir, ref).catch(() => freshClone(dir, owner, repo, ref));
  } else {
    await freshClone(dir, owner, repo, ref);
  }

  if (paths === null) await git(['sparse-checkout', 'disable'], dir);
  else await git(['sparse-checkout', 'set', '--cone', '--', ...paths], dir);
  await git(['reset', '-q', '--hard', 'HEAD'], dir);
  await git(['clean', '-ffdxq'], dir);

  const resolved = ref ?? (await git(['rev-parse', '--abbrev-ref', 'HEAD'], dir));
  return { dir, ref: resolved };
}

async function freshClone(dir, owner, repo, ref) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.dirname(dir), { recursive: true });
  const url = `https://github.com/${owner}/${repo}.git`;
  const branch = ref ? ['--branch', ref] : [];
  await git(['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--no-checkout', ...branch, '--', url, dir]);
}

async function refresh(dir, ref) {
  const target = ref ?? (await git(['rev-parse', '--abbrev-ref', 'HEAD'], dir));
  await git(['fetch', '--quiet', '--depth', '1', '--filter=blob:none', 'origin', target], dir);
  await git(['reset', '-q', '--hard', 'FETCH_HEAD'], dir);
}

/** ISO date of the last commit touching `relPath` ("" = whole repo), or undefined when unknown. */
export async function lastCommitDate(dir, relPath) {
  try {
    const out = await git(['log', '-1', '--format=%cI', ...(relPath ? ['--', relPath] : [])], dir);
    return out || undefined;
  } catch {
    return undefined;
  }
}

/** Every tracked file path at HEAD (works on a partial clone without fetching blobs). */
export async function listTrackedFiles(dir) {
  const out = await git(['ls-tree', '-r', '-z', '--name-only', 'HEAD'], dir);
  return out.split('\0').filter(Boolean);
}

// Derived identifiers, links and install commands. Formats are fixed by src/lib/types.ts.
import { OWN_OWNERS } from './constants.mjs';

/** URL-safe id: lowercase [a-z0-9-], runs of other characters become one "-". */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** skills.sh slug: lowercase, spaces/underscores → "-", every other non [a-z0-9-] char removed. */
export function skillsShSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/[\s_]/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function isOwnOwner(owner) {
  return OWN_OWNERS.includes(owner.toLowerCase());
}

export function repoUrl({ owner, repo }) {
  return `https://github.com/${owner}/${repo}`;
}

export function treeUrl({ owner, repo, ref, path }) {
  const encodedRef = ref.split('/').map(encodeURIComponent).join('/');
  const base = `${repoUrl({ owner, repo })}/tree/${encodedRef}`;
  return path ? `${base}/${path.split('/').map(encodeURIComponent).join('/')}` : base;
}

export function skillsShSkillUrl({ owner, repo }, name) {
  return `https://skills.sh/${owner}/${repo}/${skillsShSlug(name)}`;
}

export function skillsShRepoUrl({ owner, repo }) {
  return `https://skills.sh/${owner}/${repo}`;
}

/**
 * The copyable install command. `name` comes from an untrusted SKILL.md frontmatter and users paste
 * the command into bash, zsh, PowerShell or cmd.exe, which share no quoting rule (POSIX '\'' breaks
 * out in PowerShell; '…' does nothing in cmd). So the name is used bare when it is plainly safe,
 * in double quotes when it only adds spaces (inert in all four shells), and otherwise left out
 * in favour of the interactive picker, so no untrusted text ever reaches a shell.
 */
export function installSkill({ owner, repo }, name) {
  const word = shellWord(name);
  return word === undefined ? installCollection({ owner, repo }) : `npx skills add ${owner}/${repo} --skill ${word}`;
}

export function installCollection({ owner, repo }) {
  return `npx skills add ${owner}/${repo} --list`;
}

/** `value` as one shell word that is safe in POSIX shells, PowerShell and cmd.exe, or undefined. */
export function shellWord(value) {
  const text = String(value);
  // A leading "-" would read as an option, a leading "@" as PowerShell splatting.
  if (!/^[A-Za-z0-9._]/.test(text)) return undefined;
  if (/^[A-Za-z0-9._@+=-]+$/.test(text)) return text;
  if (/^[A-Za-z0-9._@+= -]+$/.test(text) && text === text.trim()) return `"${text}"`;
  return undefined;
}

/** Hands out unique ids: the slug itself, then `<slug>-<owner>`, then numbered suffixes. */
export function createIdAllocator() {
  const taken = new Set();
  return function allocate(name, owner) {
    const base = slugify(name) || 'skill';
    const candidates = [base, `${base}-${slugify(owner)}`];
    let id = candidates.find((candidate) => !taken.has(candidate));
    for (let n = 2; !id; n++) if (!taken.has(`${base}-${n}`)) id = `${base}-${n}`;
    taken.add(id);
    return id;
  };
}

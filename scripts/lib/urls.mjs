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

export function installSkill({ owner, repo }, name) {
  return `npx skills add ${owner}/${repo} --skill ${shellWord(name)}`;
}

export function installCollection({ owner, repo }) {
  return `npx skills add ${owner}/${repo} --list`;
}

/** Quote a value for POSIX shells unless it is made only of plainly safe characters. */
function shellWord(value) {
  return /^[A-Za-z0-9._@:+=-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
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

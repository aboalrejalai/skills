// Turns one skill folder on disk into a SkillDetail (see src/lib/types.ts).
import { existsSync, realpathSync, statSync } from 'node:fs';
import { readFrontmatter } from './frontmatter.mjs';
import { isInside, readSkillFolder, readText } from './files.mjs';
import { installSkill, isOwnOwner, shellWord, skillsShSkillUrl, treeUrl } from './urls.mjs';

/**
 * @param {object} spec  { folder, root, source: {owner, repo, ref, path}, name, category, tags, note?, local, updatedAt? }
 *   `folder` is the skill folder on disk; it must resolve inside `root` (the clone or ./skills).
 * @returns {Promise<{ error: string } | { skill: object, files: object[], warnings: string[] }>}
 *   `skill` is a SkillDetail without `id`/`zipUrl` (assigned once ids are known);
 *   `files` keep their `abs` paths for copying.
 */
export async function loadSkill(spec) {
  const { folder, source } = spec;
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    return { error: `path "${source.path || '.'}" not found in ${source.owner}/${source.repo}@${source.ref}` };
  }
  if (!isInside(realpathSync(spec.root), realpathSync(folder))) {
    return { error: `path "${source.path}" is a symlink pointing outside the repository` };
  }
  const { files, warnings } = await readSkillFolder(folder);
  const skillFile = files.find((file) => file.path === 'SKILL.md');
  if (!skillFile) return { error: `no SKILL.md in ${source.owner}/${source.repo}/${source.path}` };

  const markdown = skillFile.text ?? (await readText(skillFile));
  const { data: frontmatter, body, warning } = readFrontmatter(markdown);
  if (warning) warnings.push(warning);

  let name = spec.name;
  if (typeof frontmatter.name === 'string' && frontmatter.name.trim()) {
    const declared = frontmatter.name.trim();
    if (declared !== spec.name) {
      warnings.push(`frontmatter name "${declared}" differs from catalog name "${spec.name}"; using "${declared}"`);
      name = declared;
    }
  } else {
    warnings.push(`frontmatter has no name; using catalog name "${spec.name}"`);
  }

  if (shellWord(name) === undefined) {
    warnings.push(`name ${JSON.stringify(name)} is not shell-safe; the install command falls back to --list`);
  }

  let description = '';
  if (typeof frontmatter.description === 'string') description = frontmatter.description.trim();
  else warnings.push('frontmatter has no description');

  const texts = {};
  for (const file of files) if (file.text !== undefined) texts[file.path] = file.text;
  texts['SKILL.md'] = markdown; // always present, even when larger than the embed limit

  const skill = {
    name,
    description,
    category: spec.category,
    tags: spec.tags,
    own: isOwnOwner(source.owner),
    local: spec.local,
    ...(spec.note ? { note: spec.note } : {}),
    source: { owner: source.owner, repo: source.repo, ref: source.ref, path: source.path },
    githubUrl: treeUrl(source),
    skillsShUrl: skillsShSkillUrl(source, name),
    install: installSkill(source, name),
    files: files.map(({ path: filePath, size, binary }) => ({ path: filePath, size, binary })),
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    ...(spec.updatedAt ? { updatedAt: spec.updatedAt } : {}),
    frontmatter,
    body,
    texts,
  };
  return { skill, files, warnings };
}

/** The public SkillDetail with `id` and `zipUrl` placed in contract order. */
export function withId(skill, id) {
  const { githubUrl, skillsShUrl, ...rest } = skill;
  const ordered = { id };
  for (const [key, value] of Object.entries(rest)) {
    ordered[key] = value;
    if (key === 'source') Object.assign(ordered, { githubUrl, skillsShUrl, zipUrl: `/dl/${id}.zip` });
  }
  return ordered;
}

/** Split a SkillDetail into the SkillEntry stored in catalog.json. */
export function toEntry({ frontmatter, body, texts, ...entry }) {
  return entry;
}

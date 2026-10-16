import { parse } from 'yaml';

const FRONTMATTER = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Split SKILL.md into its frontmatter and body.
 * Returns { data, body, warning? }: `data` is {} when there is no frontmatter; when the YAML does
 * not parse, `name` and `description` are recovered with a line regex and `warning` says why.
 */
export function readFrontmatter(markdown) {
  const match = FRONTMATTER.exec(markdown);
  if (!match) {
    return { data: {}, body: markdown.replace(/^﻿/, ''), warning: 'SKILL.md has no frontmatter block' };
  }
  const body = markdown.slice(match[0].length).replace(/^(?:[ \t]*\r?\n)+/, '');
  try {
    const data = parse(match[1]);
    if (data === null || data === undefined) return { data: {}, body, warning: 'frontmatter is empty' };
    if (typeof data !== 'object' || Array.isArray(data)) {
      return { data: fallback(match[1]), body, warning: 'frontmatter is not a YAML mapping' };
    }
    return { data, body };
  } catch (error) {
    return { data: fallback(match[1]), body, warning: `frontmatter YAML did not parse (${firstLine(error.message)})` };
  }
}

function fallback(yamlText) {
  const data = {};
  for (const key of ['name', 'description']) {
    const line = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(yamlText);
    if (!line) continue;
    const value = line[1].trim();
    data[key] = /^[>|][-+]?$/.test(value) ? blockScalar(yamlText.slice(line.index + line[0].length)) : unquote(value);
  }
  return data;
}

/** The indented lines that follow a `key: >` or `key: |` line, joined with spaces. */
function blockScalar(rest) {
  const lines = [];
  for (const line of rest.replace(/^\r?\n/, '').split(/\r?\n/)) {
    if (line.trim() !== '' && !/^[ \t]/.test(line)) break;
    lines.push(line.trim());
  }
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

function unquote(value) {
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
  return quoted ? quoted[2] : value;
}

function firstLine(text) {
  return String(text).split('\n')[0];
}

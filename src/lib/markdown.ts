// Build-time Markdown rendering for SKILL.md and skill files. OWNER: skill-page agent (A8).
//
// SKILL.md comes from third-party repos, so it is untrusted: marked renders it (GFM), sanitize-html
// strips everything outside a strict allowlist, and only then are the shiki code blocks (our own,
// trusted output) spliced back in at random, unguessable placeholders.
import { Marked, type Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { createHighlighterCoreSync, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import githubLight from 'shiki/themes/github-light.mjs';
import githubDark from 'shiki/themes/github-dark.mjs';
import bash from 'shiki/langs/bash.mjs';
import css from 'shiki/langs/css.mjs';
import diff from 'shiki/langs/diff.mjs';
import go from 'shiki/langs/go.mjs';
import html from 'shiki/langs/html.mjs';
import ini from 'shiki/langs/ini.mjs';
import javascript from 'shiki/langs/javascript.mjs';
import json from 'shiki/langs/json.mjs';
import jsonc from 'shiki/langs/jsonc.mjs';
import jsx from 'shiki/langs/jsx.mjs';
import markdown from 'shiki/langs/markdown.mjs';
import php from 'shiki/langs/php.mjs';
import powershell from 'shiki/langs/powershell.mjs';
import python from 'shiki/langs/python.mjs';
import rust from 'shiki/langs/rust.mjs';
import sql from 'shiki/langs/sql.mjs';
import toml from 'shiki/langs/toml.mjs';
import tsx from 'shiki/langs/tsx.mjs';
import typescript from 'shiki/langs/typescript.mjs';
import xml from 'shiki/langs/xml.mjs';
import yaml from 'shiki/langs/yaml.mjs';
import type { SkillSource } from './types';

export interface Heading {
  depth: number; // Markdown depth (1–6), before the on-page level shift
  text: string;
  slug: string;
}

export interface RenderContext {
  /** Where the markdown lives, for rewriting relative links (GitHub blob) and images (raw). */
  source?: SkillSource;
  /** Accessible label for the per-block copy button; no button when omitted. */
  copyLabel?: string;
}

// ---------- shiki ----------

let highlighter: HighlighterCore | undefined;
function getHighlighter(): HighlighterCore {
  highlighter ??= createHighlighterCoreSync({
    themes: [githubLight, githubDark],
    langs: [bash, css, diff, go, html, ini, javascript, json, jsonc, jsx, markdown, php, powershell, python, rust, sql, toml, tsx, typescript, xml, yaml],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighter;
}

const LANG_ALIASES: Record<string, string> = {
  sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', shellscript: 'bash',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', mts: 'typescript',
  yml: 'yaml', md: 'markdown', py: 'python', ps1: 'powershell', svg: 'xml', htm: 'html',
};

function resolveLang(lang: string | undefined): string {
  const name = (lang ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const id = LANG_ALIASES[name] ?? name;
  return id && getHighlighter().getLoadedLanguages().includes(id) ? id : 'text';
}

const EXT_LANG: Record<string, string> = {
  sh: 'bash', bash: 'bash', zsh: 'bash', css: 'css', diff: 'diff', patch: 'diff', go: 'go',
  html: 'html', htm: 'html', ini: 'ini', cfg: 'ini', js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonc: 'jsonc', jsx: 'jsx', md: 'markdown', mdx: 'markdown', php: 'php', ps1: 'powershell',
  py: 'python', rs: 'rust', sql: 'sql', toml: 'toml', tsx: 'tsx', ts: 'typescript', mts: 'typescript',
  xml: 'xml', svg: 'xml', yaml: 'yaml', yml: 'yaml',
};

/** shiki language id for a file path, or 'text'. */
export function langFromPath(path: string): string {
  const ext = path.split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';
  return EXT_LANG[ext] ?? 'text';
}

/**
 * Highlight code with the light+dark GitHub themes as CSS variables (`--shiki-light`, `--shiki-dark`).
 * shiki escapes the code itself, so the result is safe to inject.
 */
export function highlightCode(code: string, lang?: string): string {
  return getHighlighter().codeToHtml(code.replace(/\n$/, ''), {
    lang: resolveLang(lang),
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
}

// ---------- slugs ----------

/** Ids the site shell may use; a heading with this text gets a "-1" suffix instead. */
const RESERVED_IDS = ['main', 'main-content', 'content', 'top', 'header', 'footer', 'skip'];

/** GitHub-style slug that keeps Arabic and other scripts: "Mode A — New" -> "mode-a--new". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function createSlugger() {
  const seen = new Map<string, number>(RESERVED_IDS.map((id) => [id, 0]));
  return (text: string): string => {
    const base = slugify(text) || 'section';
    let slug = base;
    let n = seen.get(base);
    if (n !== undefined) {
      do slug = `${base}-${++n}`;
      while (seen.has(slug));
      seen.set(base, n);
    }
    seen.set(slug, 0);
    return slug;
  };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'", nbsp: ' ' };
const plainText = (htmlText: string) =>
  htmlText
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (_, e: string) => ENTITIES[e] ?? '')
    .trim();

// ---------- URLs ----------

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** POSIX-join `rel` onto `base` inside the repo; undefined when it climbs above the repo root. */
function joinRepoPath(base: string, rel: string): string | undefined {
  const parts = rel.startsWith('/') ? [] : base.split('/').filter(Boolean);
  for (const seg of rel.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (!parts.length) return undefined;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join('/');
}

type UrlKind = 'link' | 'image';

/**
 * Rewrite a URL found in skill markdown. Returns the new URL and whether it leaves the site,
 * or undefined to drop the attribute. Anything not https/mailto ends up dropped by sanitize-html.
 */
function rewriteUrl(raw: string, kind: UrlKind, source?: SkillSource): { url: string; external: boolean } | undefined {
  const url = raw.trim();
  if (!url) return undefined;
  if (url.startsWith('#')) return kind === 'link' ? { url, external: false } : undefined;
  if (url.startsWith('//')) return undefined;
  if (SCHEME.test(url)) {
    const upgraded = url.replace(/^http:\/\//i, 'https://');
    return { url: upgraded, external: /^https:/i.test(upgraded) };
  }
  if (!source) return undefined;
  const [pathAndQuery, hash = ''] = url.split('#', 2);
  const relPath = safeDecode(pathAndQuery.split('?')[0]);
  const repoPath = joinRepoPath(source.path, relPath);
  if (repoPath === undefined) return undefined;
  const { owner, repo, ref } = source;
  const target =
    kind === 'image'
      ? `https://raw.githubusercontent.com/${owner}/${repo}/${encodePath(ref)}/${encodePath(repoPath)}`
      : `https://github.com/${owner}/${repo}/${repoPath ? 'blob' : 'tree'}/${encodePath(ref)}/${encodePath(repoPath)}${hash ? `#${hash}` : ''}`;
  return { url: target, external: true };
}

// ---------- sanitize ----------

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

function sanitize(dirty: string, allowedIds: Set<string>, source?: SkillSource): string {
  const keepHeadingId: sanitizeHtml.Transformer = (tagName, attribs) => {
    const out: sanitizeHtml.Attributes = {};
    if (attribs.id && allowedIds.has(attribs.id)) out.id = attribs.id;
    return { tagName, attribs: out };
  };
  return sanitizeHtml(dirty, {
    allowedTags: [
      ...HEADINGS, 'p', 'br', 'hr', 'a', 'img', 'strong', 'b', 'em', 'i', 'del', 's', 'u', 'mark', 'small',
      'sub', 'sup', 'kbd', 'abbr', 'code', 'pre', 'span', 'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'details', 'summary', 'div', 'input',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      code: ['class'],
      span: ['class'],
      div: ['class'],
      th: ['align'],
      td: ['align'],
      ol: ['start'],
      abbr: ['title'],
      details: ['open'],
      input: ['type', 'checked', 'disabled'],
      ...Object.fromEntries(HEADINGS.map((h) => [h, ['id']])),
    },
    // Untrusted class names could pull in site utilities (e.g. "fixed inset-0"), so classes are pinned.
    allowedClasses: { code: ['language-*'], span: [], div: ['code-slot'] },
    allowedSchemes: ['https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      ...Object.fromEntries(HEADINGS.map((h) => [h, keepHeadingId])),
      a: (tagName, attribs) => {
        const { href, title } = attribs;
        const out: Record<string, string> = {};
        if (title) out.title = title;
        const r = href === undefined ? undefined : rewriteUrl(href, 'link', source);
        if (r) {
          out.href = r.url;
          if (r.external) Object.assign(out, { rel: 'noopener noreferrer nofollow', target: '_blank' });
        }
        return { tagName, attribs: out };
      },
      img: (tagName, attribs) => {
        const { src, alt = '', title, width, height } = attribs;
        const out: Record<string, string> = { alt, loading: 'lazy', decoding: 'async' };
        const r = src === undefined ? undefined : rewriteUrl(src, 'image', source);
        if (r) out.src = r.url;
        if (title) out.title = title;
        if (width && /^\d{1,4}$/.test(width)) out.width = width;
        if (height && /^\d{1,4}$/.test(height)) out.height = height;
        return { tagName, attribs: out };
      },
      // Only read-only GFM task-list checkboxes survive.
      input: (_tagName, attribs) =>
        attribs.type === 'checkbox'
          ? { tagName: 'input', attribs: { type: 'checkbox', disabled: '', ...('checked' in attribs ? { checked: '' } : {}) } }
          : { tagName: 'span', attribs: {} },
    },
  });
}

// ---------- render ----------

const COPY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function codeBlock(text: string, lang: string | undefined, copyLabel?: string): string {
  const id = resolveLang(lang);
  const label = id === 'text' ? '' : id;
  const head =
    label || copyLabel
      ? `<div class="code-head"><span class="code-lang">${escapeAttr(label)}</span>${
          copyLabel
            ? `<button type="button" class="code-copy" data-copy-code aria-label="${escapeAttr(copyLabel)}" hidden>${COPY_ICON}</button>`
            : ''
        }</div>`
      : '';
  return `<div class="code-block" dir="ltr">${head}${highlightCode(text, lang)}</div>`;
}

/**
 * Render untrusted Markdown to safe HTML plus its heading outline.
 * Headings render one level lower than written (# -> h2) because the page owns the h1;
 * `headings[].depth` keeps the Markdown depth.
 */
export function renderMarkdown(md: string, ctx: RenderContext = {}): { html: string; headings: Heading[] } {
  const slug = createSlugger();
  const headings: Heading[] = [];
  const codes: { text: string; lang?: string }[] = [];
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const marker = (i: number) => `SKCODE${nonce}X${i}X`;

  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(this: { parser: { parseInline(tokens: Tokens.Heading['tokens']): string } }, { tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        const text = plainText(inner);
        const id = slug(text);
        headings.push({ depth, text, slug: id });
        const level = Math.min(depth + 1, 6);
        return `<h${level} id="${id}">${inner}</h${level}>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        codes.push({ text, lang });
        return `<div class="code-slot">${marker(codes.length - 1)}</div>\n`;
      },
    },
  });

  const dirty = marked.parse(md, { async: false });
  let clean = sanitize(dirty, new Set(headings.map((h) => h.slug)), ctx.source);

  clean = clean.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  codes.forEach((c, i) => {
    const block = codeBlock(c.text, c.lang, ctx.copyLabel);
    const slot = `<div class="code-slot">${marker(i)}</div>`;
    clean = clean.includes(slot) ? clean.replace(slot, () => block) : clean.replace(marker(i), () => block);
  });

  return { html: clean, headings };
}

// Home catalog behaviour. All cards are server-rendered; this only toggles `hidden` on [data-item]
// from the search query + pill filters, keeps the state in ?q=&tag=&cat=&src=, and wires copy buttons.
// No innerHTML anywhere: text goes in through textContent only.
import { normalizeSearch } from './home-normalize';

type Group = 'tag' | 'cat' | 'src';
type State = { q: string } & Record<Group, string>;

const GROUPS: Group[] = ['tag', 'cat', 'src'];
const DEBOUNCE_MS = 120;

interface Item {
  el: HTMLElement;
  text: string;
  tags: string[];
  cat: string;
  src: string;
}

function fill(template: string, values: Record<string, number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or document not focused: try the legacy path below.
    }
  }
  // select() moves focus into the textarea; give it back afterwards so keyboard users stay on the button.
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  previous?.focus({ preventScroll: true });
  return ok;
}

function init(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>('[data-search-input]');
  const status = root.querySelector<HTMLElement>('[data-results-count]');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  const favorites = root.querySelector<HTMLElement>('[data-favorites]');
  const inlineReset = root.querySelector<HTMLElement>('[data-reset-inline]');
  const toast = root.querySelector<HTMLElement>('[data-toast]');
  const pills = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  const msg = {
    results: root.dataset.msgResults ?? '{shown} / {total}',
    copied: root.dataset.msgCopied ?? 'Copied',
    copyFailed: root.dataset.msgCopyFailed ?? 'Copy failed',
  };

  const items: Item[] = Array.from(root.querySelectorAll<HTMLElement>('[data-item]')).map((el) => ({
    el,
    text: el.dataset.search ?? '',
    tags: (el.dataset.tags ?? '').split(' ').filter(Boolean),
    cat: el.dataset.cat ?? '',
    src: el.dataset.src ?? '',
  }));

  // Only values that have a pill are accepted from the URL, so a stale link cannot hide everything silently.
  const allowed: Record<Group, Set<string>> = { tag: new Set(), cat: new Set(), src: new Set() };
  for (const pill of pills) {
    const group = pill.dataset.filter as Group;
    if (allowed[group] && pill.dataset.value) allowed[group].add(pill.dataset.value);
  }

  const state: State = { q: '', tag: '', cat: '', src: '' };
  const params = new URLSearchParams(location.search);
  state.q = params.get('q') ?? '';
  for (const group of GROUPS) {
    const value = params.get(group) ?? '';
    state[group] = allowed[group].has(value) ? value : '';
  }
  if (input) input.value = state.q;

  function matches(item: Item, tokens: string[]): boolean {
    if (state.tag && !item.tags.includes(state.tag)) return false;
    if (state.cat && item.cat !== state.cat) return false;
    if (state.src && item.src !== state.src) return false;
    return tokens.every((token) => item.text.includes(token));
  }

  function syncUrl(): void {
    const next = new URLSearchParams();
    const q = state.q.trim();
    if (q) next.set('q', q);
    for (const group of GROUPS) if (state[group]) next.set(group, state[group]);
    const query = next.toString();
    const url = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', url);
  }

  function apply(): void {
    const tokens = normalizeSearch(state.q).split(' ').filter(Boolean);
    let shown = 0;
    for (const item of items) {
      const visible = matches(item, tokens);
      if (item.el.hidden === visible) item.el.hidden = !visible;
      if (visible) shown += 1;
    }

    const active = tokens.length > 0 || GROUPS.some((group) => state[group]);
    if (favorites) favorites.hidden = active;
    if (inlineReset) inlineReset.hidden = !active;
    if (empty) empty.hidden = shown > 0;
    if (status) {
      const text = fill(msg.results, { shown, total: items.length });
      if (status.textContent?.trim() !== text) status.textContent = text;
    }
    for (const pill of pills) {
      const group = pill.dataset.filter as Group;
      pill.setAttribute('aria-pressed', String(state[group] === (pill.dataset.value ?? '')));
    }
    syncUrl();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  input?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = input.value;
      apply();
    }, DEBOUNCE_MS);
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (input.value) {
      event.preventDefault();
      clearTimeout(timer);
      input.value = '';
      state.q = '';
      apply();
    } else {
      input.blur();
    }
  });

  function reset(): void {
    clearTimeout(timer);
    state.q = '';
    for (const group of GROUPS) state[group] = '';
    if (input) input.value = '';
    apply();
    input?.focus();
  }

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const pill = target?.closest<HTMLButtonElement>('[data-filter]');
    if (pill) {
      const group = pill.dataset.filter as Group;
      const value = pill.dataset.value ?? '';
      clearTimeout(timer);
      if (input) state.q = input.value;
      // Clicking the active pill again returns the group to "all".
      state[group] = state[group] === value ? '' : value;
      apply();
      return;
    }
    if (target?.closest('[data-reset]')) {
      reset();
      return;
    }
    const copy = target?.closest<HTMLElement>('[data-copy]');
    if (copy) void handleCopy(copy);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditable(event.target) || !input) return;
    event.preventDefault();
    input.focus();
    input.select();
  });

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function showToast(text: string): void {
    if (!toast) return;
    clearTimeout(toastTimer);
    // Clear first so the same message is announced again on a second copy.
    toast.textContent = '';
    setTimeout(() => {
      toast.textContent = text;
      toast.dataset.show = '';
    }, 30);
    toastTimer = setTimeout(() => delete toast.dataset.show, 2000);
  }

  async function handleCopy(button: HTMLElement): Promise<void> {
    const text = button.dataset.copy ?? '';
    const ok = text ? await copyText(text) : false;
    showToast(ok ? msg.copied : msg.copyFailed);
    if (!ok) return;
    button.dataset.copied = '';
    setTimeout(() => delete button.dataset.copied, 1600);
  }

  apply();
}

const root = document.querySelector<HTMLElement>('[data-home]');
if (root) init(root);

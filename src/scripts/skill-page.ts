// Skill page enhancements: tabs, install command builder, copy buttons, TOC highlight.
// Everything here is progressive: without JS the page shows all panels stacked and the plain command.
// OWNER: skill-page agent (A8).

const live = document.querySelector<HTMLElement>('[data-live]');

function announce(message: string) {
  if (!live) return;
  live.textContent = '';
  window.setTimeout(() => (live.textContent = message), 30);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
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
    return ok;
  }
}

const resetTimers = new WeakMap<HTMLElement, number>();

function showCopied(button: HTMLElement, ok: boolean) {
  const copied = live?.dataset.copied ?? 'Copied';
  const failed = live?.dataset.failed ?? 'Copy failed';
  announce(ok ? copied : failed);
  if (!ok) return;
  const label = button.querySelector<HTMLElement>('[data-copy-text]');
  const idle = button.querySelector<SVGElement>('[data-icon="idle"]');
  const done = button.querySelector<SVGElement>('[data-icon="done"]');
  button.dataset.state = 'copied';
  if (label && button.dataset.copiedLabel) label.textContent = button.dataset.copiedLabel;
  idle?.classList.add('hidden');
  done?.classList.remove('hidden');
  window.clearTimeout(resetTimers.get(button));
  resetTimers.set(
    button,
    window.setTimeout(() => {
      delete button.dataset.state;
      if (label && button.dataset.label) label.textContent = button.dataset.label;
      idle?.classList.remove('hidden');
      done?.classList.add('hidden');
    }, 2000),
  );
}

function textFor(button: HTMLElement): string | undefined {
  if (button.dataset.copyTarget) return document.getElementById(button.dataset.copyTarget)?.textContent ?? undefined;
  if (button.dataset.copySource) {
    const raw = document.getElementById(button.dataset.copySource)?.textContent;
    try {
      return raw ? (JSON.parse(raw) as string) : undefined;
    } catch {
      return undefined;
    }
  }
  if ('copyCode' in button.dataset) {
    return button.closest('.code-block')?.querySelector('pre')?.textContent ?? undefined;
  }
  return undefined;
}

function initCopy() {
  document.querySelectorAll<HTMLElement>('[data-copy], [data-copy-code]').forEach((b) => b.removeAttribute('hidden'));
  document.addEventListener('click', async (event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-copy], [data-copy-code]');
    if (!button) return;
    const text = textFor(button);
    if (text === undefined) return;
    showCopied(button, await copyText(text));
  });
}

function initInstall() {
  const root = document.querySelector<HTMLElement>('[data-install]');
  if (!root) return;
  const base = root.dataset.base ?? '';
  const agent = root.querySelector<HTMLSelectElement>('[data-install-agent]');
  const global = root.querySelector<HTMLInputElement>('[data-install-global]');
  const output = root.querySelector<HTMLElement>('[data-install-output]');
  root.querySelector<HTMLElement>('[data-install-controls]')?.removeAttribute('hidden');
  const update = () => {
    if (!output) return;
    const parts = [base];
    if (agent?.value) parts.push('-a', agent.value);
    if (global?.checked) parts.push('-g');
    output.textContent = parts.join(' ');
  };
  agent?.addEventListener('change', update);
  global?.addEventListener('change', update);
  update(); // restores state the browser kept on back/forward navigation
}

function initTabs() {
  const root = document.querySelector<HTMLElement>('[data-tabs]');
  const list = root?.querySelector<HTMLElement>('[data-tablist]');
  if (!root || !list) return;
  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = new Map<string, HTMLElement>();
  tabs.forEach((tab) => {
    const panel = root.querySelector<HTMLElement>(`[data-panel="${tab.dataset.tab}"]`);
    if (!panel) return;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    panels.set(tab.dataset.tab ?? '', panel);
  });

  const select = (tab: HTMLButtonElement, focus = false) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panels.get(t.dataset.tab ?? '')?.toggleAttribute('hidden', !on);
    });
    if (focus) tab.focus();
  };

  list.addEventListener('click', (event) => {
    const tab = (event.target as Element | null)?.closest<HTMLButtonElement>('[role="tab"]');
    if (tab) select(tab);
  });
  list.addEventListener('keydown', (event) => {
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const rtl = getComputedStyle(list).direction === 'rtl';
    const step: Record<string, number> = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 };
    let next: number | undefined;
    if (event.key in step) next = (i + step[event.key] + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    select(tabs[next], true);
  });

  // Reveal the panel that holds the URL hash target (TOC links, #sk-file-… links, #sk-panel-files).
  const revealHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    const panel = target.closest<HTMLElement>('[data-panel]');
    const tab = tabs.find((t) => t.dataset.tab === panel?.dataset.panel);
    if (!tab || tab.getAttribute('aria-selected') === 'true') return;
    select(tab);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.scrollIntoView();
  };

  list.removeAttribute('hidden');
  root.dataset.tabs = 'ready';
  select(tabs[0]);
  revealHash();
  window.addEventListener('hashchange', revealHash);
}

function initTocHighlight() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc] [data-toc-link]'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const visible = new Set<string>();
  const order = Array.from(byId.keys());
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
      const current = order.find((id) => visible.has(id));
      if (!current) return;
      links.forEach((a) => a.toggleAttribute('aria-current', false));
      byId.get(current)?.setAttribute('aria-current', 'true');
    },
    { rootMargin: '-80px 0px -60% 0px' },
  );
  order.forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

initCopy();
initInstall();
initTabs();
initTocHighlight();

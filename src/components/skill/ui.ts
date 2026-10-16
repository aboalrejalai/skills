// Shared Tailwind class strings for the skill page (Saudi Soft: 10px controls, 12px cards, 44px targets).
export const card = 'rounded-xl border border-border bg-card text-card-foreground shadow-e1';
const btnBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50';
export const btnPrimary = `${btnBase} bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active`;
export const btnOutline = `${btnBase} border border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5`;
export const iconBtn =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground data-[state=copied]:text-primary';
export const chip = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium';
export const sectionTitle = 'flex items-center gap-2 text-base font-semibold';

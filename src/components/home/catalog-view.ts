// Build-time helpers for the home catalog: icons per category, ordering, counts and search text.
import {
  BadgeCheck,
  Bot,
  Brain,
  Clapperboard,
  Database,
  FileText,
  FlaskConical,
  ListChecks,
  Megaphone,
  Palette,
  Puzzle,
  ShieldCheck,
  ShoppingBag,
  Telescope,
} from '@lucide/astro';
import type { AstroComponent } from '@lucide/astro';
import { CATEGORY_LABELS, TAG_LABELS } from '../../i18n';
import { normalizeSearch } from '../../scripts/home-normalize';
import type { Catalog, Category, CollectionEntry, SkillEntry, Tag } from '../../lib/types';

export const CATEGORY_ICONS: Record<Category, AstroComponent> = {
  'code-quality': BadgeCheck,
  'planning-workflow': ListChecks,
  'agents-delegation': Bot,
  'frontend-design': Palette,
  'video-media': Clapperboard,
  'seo-marketing': Megaphone,
  'ecommerce-salla': ShoppingBag,
  documents: FileText,
  'memory-knowledge': Brain,
  'research-tools': Telescope,
  testing: FlaskConical,
  security: ShieldCheck,
  'backend-data': Database,
  other: Puzzle,
};

export const TAG_ORDER: Tag[] = ['made', 'use', 'recommend', 'favorite'];

export type CatalogItem =
  | { kind: 'skill'; entry: SkillEntry }
  | { kind: 'collection'; entry: CollectionEntry };

/** Skills then collections, favorites first; otherwise catalog order is kept (Array.sort is stable). */
export function orderedItems(catalog: Catalog): CatalogItem[] {
  const items: CatalogItem[] = [
    ...catalog.skills.map((entry) => ({ kind: 'skill' as const, entry })),
    ...catalog.collections.map((entry) => ({ kind: 'collection' as const, entry })),
  ];
  const fav = (item: CatalogItem) => (item.entry.tags.includes('favorite') ? 0 : 1);
  return items.sort((a, b) => fav(a) - fav(b));
}

export function countByTag(items: CatalogItem[]): Record<Tag, number> {
  const counts: Record<Tag, number> = { made: 0, use: 0, recommend: 0, favorite: 0 };
  for (const item of items) for (const tag of item.entry.tags) counts[tag] += 1;
  return counts;
}

/** Item count per category; categories without items are absent. */
export function countByCategory(items: CatalogItem[]): Map<Category, number> {
  const counts = new Map<Category, number>();
  for (const item of items) counts.set(item.entry.category, (counts.get(item.entry.category) ?? 0) + 1);
  return counts;
}

/** Normalized text the browser matches the query against: both languages, so either works. */
export function searchText(item: CatalogItem): string {
  const { entry } = item;
  const parts: string[] = [
    entry.category,
    CATEGORY_LABELS[entry.category].ar,
    CATEGORY_LABELS[entry.category].en,
    `${entry.source.owner}/${entry.source.repo}`,
    ...entry.tags.flatMap((tag) => [tag, TAG_LABELS[tag].ar, TAG_LABELS[tag].en]),
  ];
  if (item.kind === 'skill') {
    const skill = item.entry;
    parts.push(skill.name, skill.id, skill.description);
    if (skill.note) parts.push(skill.note.ar, skill.note.en);
  } else {
    const collection = item.entry;
    parts.push(collection.id, collection.title.ar, collection.title.en, collection.description.ar, collection.description.en);
  }
  return normalizeSearch(parts.join(' '));
}

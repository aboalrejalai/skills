// i18n helpers. Arabic is the default locale at "/", English lives under "/en/".
// Each UI area keeps its own strings in src/i18n/strings/<area>.ts as { ar: {...}, en: {...} }.
import type { Category, Lang, Tag } from '../lib/types';

export const LANGS: Lang[] = ['ar', 'en'];
export const DEFAULT_LANG: Lang = 'ar';

export const dir = (lang: Lang) => (lang === 'ar' ? 'rtl' : 'ltr');

/** Prefix a site path with the locale: localePath('en', '/skills/x/') -> '/en/skills/x/' */
export function localePath(lang: Lang, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return lang === DEFAULT_LANG ? clean : `/${lang}${clean}`;
}

/** The same page in the other language. */
export function alternatePath(lang: Lang, path: string): string {
  const other: Lang = lang === 'ar' ? 'en' : 'ar';
  const base = lang === 'en' ? path.replace(/^\/en(?=\/|$)/, '') || '/' : path;
  return localePath(other, base);
}

export const TAG_LABELS: Record<Tag, Record<Lang, string>> = {
  made: { ar: 'من صنعي', en: 'Made by me' },
  use: { ar: 'أستخدمها', en: 'I use it' },
  recommend: { ar: 'أنصح بها', en: 'Recommended' },
  favorite: { ar: 'المفضلة', en: 'Favorite' },
};

export const CATEGORY_LABELS: Record<Category, Record<Lang, string>> = {
  'code-quality': { ar: 'جودة الكود', en: 'Code quality' },
  'planning-workflow': { ar: 'التخطيط وسير العمل', en: 'Planning & workflow' },
  'agents-delegation': { ar: 'الوكلاء والتفويض', en: 'Agents & delegation' },
  'frontend-design': { ar: 'الواجهات والتصميم', en: 'Frontend & design' },
  'video-media': { ar: 'الفيديو والوسائط', en: 'Video & media' },
  'seo-marketing': { ar: 'السيو والتسويق', en: 'SEO & marketing' },
  'ecommerce-salla': { ar: 'التجارة وسلة', en: 'E-commerce & Salla' },
  documents: { ar: 'المستندات', en: 'Documents' },
  'memory-knowledge': { ar: 'الذاكرة والمعرفة', en: 'Memory & knowledge' },
  'research-tools': { ar: 'البحث والأدوات', en: 'Research & tools' },
  testing: { ar: 'الاختبارات', en: 'Testing' },
  security: { ar: 'الأمان', en: 'Security' },
  'backend-data': { ar: 'الخلفية والبيانات', en: 'Backend & data' },
  other: { ar: 'أخرى', en: 'Other' },
};

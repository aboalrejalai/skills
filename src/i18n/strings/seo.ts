// SEO strings: site name, default meta descriptions and the 404 page copy.
// Shape follows the i18n convention: { ar: {...}, en: {...} }.
import type { Lang } from '../../lib/types';

export const SITE_AUTHOR = 'Mohammed Abo Alrejal';

export const seo = {
  ar: {
    siteName: 'مهارات أبوالرجال',
    description:
      'دليل منتقى لمهارات الوكلاء التي صنعها محمد أبوالرجال ويستخدمها وينصح بها، لـ Claude Code وCursor وCodex وغيرها، وتثبيت كل مهارة بأمر واحد.',
    ogImageAlt: 'مهارات أبوالرجال: دليل منتقى لمهارات الوكلاء',
    notFound: {
      title: 'الصفحة غير موجودة',
      description: 'الصفحة التي تبحث عنها غير موجودة أو نُقلت إلى رابط آخر.',
      heading: 'لم نجد هذه الصفحة',
      body: 'ربما تغيّر الرابط أو حُذفت المهارة من الدليل. ارجع إلى الصفحة الرئيسية وابحث عمّا تريد.',
      home: 'العودة إلى الرئيسية',
      otherLang: 'English version',
    },
  },
  en: {
    siteName: 'Abo Alrejal Skills',
    description:
      'A curated catalog of agent skills Mohammed Abo Alrejal built, uses and recommends, for Claude Code, Cursor, Codex and more, each installed with one command.',
    ogImageAlt: 'Abo Alrejal Skills: a curated catalog of agent skills',
    notFound: {
      title: 'Page not found',
      description: 'The page you are looking for does not exist or has moved.',
      heading: 'We could not find this page',
      body: 'The link may have changed, or the skill was removed from the catalog. Head back home and search for what you need.',
      home: 'Back to home',
      otherLang: 'النسخة العربية',
    },
  },
} satisfies Record<Lang, unknown>;

/** Open Graph locale codes per site language. */
export const OG_LOCALE: Record<Lang, string> = { ar: 'ar_SA', en: 'en_US' };

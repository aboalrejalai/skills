// Home page (catalog) strings. Templates use {name} placeholders, filled by fill() at build time
// or by src/scripts/home-search.ts in the browser.
export const homeStrings = {
  ar: {
    metaTitle: 'مهارات أبوالرجال: ما صنعته وأستخدمه وأنصح به',
    metaDescription:
      'قائمتي الشخصية لمهارات وكلاء الذكاء الاصطناعي (Agent Skills): مهارات صنعتها، وأخرى أستخدمها يوميًا أو أنصح بها، ولكل واحدة أمر تثبيت جاهز وملف ZIP.',
    title: 'مهارات أبوالرجال',
    intro: 'قائمتي الشخصية لمهارات الوكلاء حتى لا أنساها: ما صنعته، وما أستخدمه يوميًا، وما أنصح به. لكل مهارة أمر تثبيت جاهز وملف ZIP.',

    searchLabel: 'ابحث في المهارات',
    searchPlaceholder: 'ابحث بالاسم أو الوصف أو التصنيف…',
    searchShortcut: 'اضغط / للبحث',

    kpiTotal: 'كل العناصر',
    kpiTotalCaption: 'والمجموعات بداخلها {skills} مهارة',
    kpiMade: 'من صنعي',
    kpiUse: 'أستخدمها',
    kpiRecommend: 'أنصح بها',
    kpiCaptionOf: 'من {total}',

    filtersLabel: 'تصفية القائمة',
    filterTag: 'الوسم',
    filterCategory: 'التصنيف',
    filterSource: 'المصدر',
    all: 'الكل',
    allCategories: 'كل التصنيفات',
    sourceMine: 'مني',
    sourceOthers: 'من غيري',

    favoritesTitle: 'المفضلة',
    favoritesIntro: 'أكثر ما أرجع إليه، في متناول اليد.',
    gridTitle: 'كل المهارات',
    results: 'النتائج: {shown} من {total}',
    resetFilters: 'إعادة ضبط الفلاتر',

    emptyTitle: 'لا توجد نتائج',
    emptyText: 'جرّب كلمة أخرى أو امسح الفلاتر لعرض القائمة كاملة.',

    copyInstall: 'نسخ أمر التثبيت',
    copyList: 'نسخ أمر عرض مهارات المجموعة',
    copied: 'تم النسخ',
    copyFailed: 'تعذّر النسخ، انسخ الأمر يدويًا',
    downloadZip: 'تنزيل {name} بصيغة ZIP',
    sourceLabel: 'المصدر',
    tagsLabel: 'الوسوم',

    collection: 'مجموعة',
    collectionCount: '{count} مهارة',
    browseCollection: 'تصفح المجموعة',
    opensInNewTab: '(يفتح في تبويب جديد)',
  },
  en: {
    metaTitle: 'Abo Alrejal Skills: what I made, use and recommend',
    metaDescription:
      'My personal list of AI agent skills: the ones I made, the ones I use every day, and the ones I recommend, each with a ready install command and a ZIP download.',
    title: 'Abo Alrejal Skills',
    intro: "My personal list of agent skills so I never forget them: what I made, what I use every day, and what I recommend. Each one has a ready install command and a ZIP.",

    searchLabel: 'Search skills',
    searchPlaceholder: 'Search by name, description or category…',
    searchShortcut: 'Press / to search',

    kpiTotal: 'All entries',
    kpiTotalCaption: 'Collections inside hold {skills} skills',
    kpiMade: 'Made by me',
    kpiUse: 'I use',
    kpiRecommend: 'Recommended',
    kpiCaptionOf: 'of {total}',

    filtersLabel: 'Filter the list',
    filterTag: 'Tag',
    filterCategory: 'Category',
    filterSource: 'Source',
    all: 'All',
    allCategories: 'All categories',
    sourceMine: 'Mine',
    sourceOthers: 'Others',

    favoritesTitle: 'Favorites',
    favoritesIntro: 'The ones I reach for most, one click away.',
    gridTitle: 'All skills',
    results: 'Results: {shown} of {total}',
    resetFilters: 'Reset filters',

    emptyTitle: 'No results',
    emptyText: 'Try another word or clear the filters to see the whole list.',

    copyInstall: 'Copy install command',
    copyList: 'Copy the command that lists the collection',
    copied: 'Copied',
    copyFailed: 'Could not copy, copy the command manually',
    downloadZip: 'Download {name} as ZIP',
    sourceLabel: 'Source',
    tagsLabel: 'Tags',

    collection: 'Collection',
    collectionCount: '{count} skills',
    browseCollection: 'Browse collection',
    opensInNewTab: '(opens in a new tab)',
  },
} as const;

export type HomeStrings = (typeof homeStrings)['ar' | 'en'];

/** Fill {placeholders}; numbers are printed with Latin digits. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    if (value === undefined) return match;
    return typeof value === 'number' ? value.toLocaleString('en-US') : value;
  });
}

// Search normalization shared by the build (data-search attributes) and the browser (the query),
// so both sides compare the same form of the text.

// Tashkeel (harakat, tanween, shadda, sukun, superscript alef, Quranic marks) and tatweel.
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/g;
const ALEF_VARIANTS = /[آأإٱ]/g; // آ أ إ ٱ

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFKC')
    .replace(DIACRITICS, '')
    .replace(ALEF_VARIANTS, 'ا') // ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ة/g, 'ه') // ة → ه
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

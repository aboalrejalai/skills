// Language of upstream text the site does not translate (skill names, descriptions, SKILL.md bodies),
// for the `lang` attribute: screen readers switch voice on it, `dir="auto"` alone does not.
// Mostly Arabic letters -> 'ar'; anything else is treated as English, which covers this catalog.
const LETTER = /\p{L}/gu;
const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/gu;

export function contentLang(text: string): 'ar' | 'en' {
  const letters = text.match(LETTER)?.length ?? 0;
  const arabic = text.match(ARABIC_LETTER)?.length ?? 0;
  return letters > 0 && arabic / letters >= 0.3 ? 'ar' : 'en';
}

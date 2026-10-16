# Deck structure

The deck follows Tawa Najd's guidelines (`~/Desktop/Project/tawa-najd/brand/guidelines/guidelines.html`), which took its order from the GreatOne brand guidelines (27 landscape pages, 1440x810). Every slide is 1440x810, Arabic right-to-left, framed, with the footer label and the page number at the bottom. Slides whose data is absent are skipped and the remaining pages are numbered in order, so a full deck has 28 pages and a deck without letterhead or Najdi motif has fewer. The mock-up slides are opt-in: a brand with `mockups` gets one or two more pages before the banners, and the numbers below shift by as many.

The id in the first column is what `"skip": [...]` in brand.json takes to drop a slide on purpose.

| # | id | Slide | What it says, and why it is there | Fields | Skipped when |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `cover` | Cover | «الدليل الإرشادي للهوية البصرية», the stacked logo on the dark gradient, `BRAND GUIDELINES · year`, a giant faint mark, crenellated band. Names the document and the brand. | `cover.*`, `year`, `logos.stacked.onDark` | never |
| 2 | `intro` | «هويتنا أكثر من شعار» | The identity is a whole system, and this deck is the reference every design follows. The mark on a gradient card. | `intro.title`, `intro.paragraphs` | never |
| 3 | `traits` | Brand traits | Three or four traits in green circles, one line each: the personality every design must express. | `traits.items` | never |
| 4 | `logos` | Logo versions | Full (stacked), horizontal, and the mark alone, with captions. Which version to use where. | `logos.*`, `logoSlide.*` | never |
| 5 | `construction` | Construction | The mark on its grid; the unit X (stroke thickness) outlined in the highlight colour; two paragraphs on its geometry and what it reads as. Lets anyone redraw it at any size. | `construction.*` (grid computed by `markgeo.py` unless set) | listed in `skip`, which the build asks for when `markgeo.py` finds no grid (curves, no horizontal and vertical edges, off-grid edges, no fully inked cell) |
| 6 | `palette` | Colour palette | The primary with HEX and RGB, ink and white, the ten-step scale with labels, and the 60/30/10 usage bar. Exact values, no guessing. | `colors.scale`, `palette.*` | never |
| 7 | `font-arabic` | Arabic typeface | Font name in Arabic and Latin, source and licence, the alphabet, a note on where it is used; a giant glyph on the green panel. | `font.*`, `typeface.arabicLabel`, `letters`, `note`, `glyph` | never |
| 8 | `font-family` | Type family | A sample word in every weight, and which weight serves which role. | `typeface.familySample`, `weights`, `familyLead`, `familyRoles` | never |
| 9 | `font-latin` | Latin typeface | The Latin face (the same family unless `latinFont` is set), a paragraph, sample lines, the alphabet; giant «Aa» on the panel. | `typeface.latinText`, `latinSample`, `latinName`, `alphabet` | never |
| 10 | `type-scale` | Type scale | Sizes 68/42/26/16 px stepped by the golden ratio, with a body-text sample. Consistent hierarchy. | `typeScale.*` | never |
| 11 | `misuse-mark` | Wrong uses of the mark | Cropped, rotated, recoloured, effects; each crossed out. | `misuse.markTitle`, `markItems` | never |
| 12 | `misuse-logo` | Wrong uses of the logo | Stretched, rotated, recoloured, effects. | `misuse.logoTitle`, `logoItems` | never |
| 13 | `clear-space` | Clear space | 2X around the logo, X being the stroke thickness; minimum print and screen widths. | `clearSpace.*` | never |
| 14 | `placement` | Logo placement | The mark in any corner; the horizontal logo top right (Arabic reading starts there); centred for covers, bottom left for sign-offs. | `placement.*` | never |
| 15–16 | `patterns` | Logo patterns (two slides) | Six textures built from the mark: outline, diagonal, dense, Najdi crenels, triangles, light outline. Each mark sits inset in its tile by `patterns.gap`, so marks stay apart and outlines whole. With `"motif": "none"` the crenel and triangle swatches become mark patterns. | `patterns.title`, `patterns.gap` | never |
| 17 | `najdi` | Najdi patterns | The letterhead band with the white logo, and the four triangle SVGs (teeth down, teeth up, texture on green, texture on white) with their file names; recoloured to the brand's scale. | `najdi.label`, `najdi.dir`, `najdi.items` | `"motif": "none"` |
| 18 | `elements` | Graphic elements | Three or four elements, each a drawing, a name and a line: `teeth` (crenellations), `chamfer` (45° corners), `gradient`, `triangles` (texture), `pattern` (mark texture). | `elements.items` | never |
| 19 | `icons` | Icon style | Fifteen Lucide line icons in tiles, with the style caption. | `iconStyle.names`, `caption` | never |
| 20 | `letterhead` | Letterhead | A picture of the official paper, tilted, with a heading and two paragraphs. | `letterhead.*` | no `letterhead.image`, or the file does not exist yet |
| 21 | `card` | Business card | Front (stacked logo on the gradient) and back (name, role, mark, up to five contact rows). | `card.*` | never |
| 22 | `app-icon` | App and browser icon | The mark on a 3D app tile and at 180/64/32/16 px. | `appIcon.*` | never |
| 23–24 | `mockups` | Mock-ups (opt-in) | Up to three square social posts (dark gradient, light mark pattern, primary with a faint mark) with avatar, name and action icons; with `mockups.store`, a second slide: the storefront on a phone (logo bar, hero with button, service cards, tab bar) beside a desktop browser showing the same hero at desktop width. Shows the identity applied where customers meet it. | `mockups.*`, `colors.accent` | no `mockups` (the default), or listed in `skip`; the store slide only without `mockups.store` |
| 23–27 | `banners` | Banners 01–05 | One slide per banner, numbered: `hero` (headline, line, CTA), `tiles` (four icon tiles plus headline), `phone` (phone mock-up plus kicker and headline), `values` (light, headline and four diamonds standing on the band), `contact` (headline plus contact rows). The copy of hero, tiles and phone banners ends 30 px above the crenellated band, so the call-to-action keeps one distance from the teeth on every banner. Ready examples of layout and copy tone. | `banners.items` | no banners, or listed in `skip` |
| 28 | `closing` | Closing | Thanks, the horizontal logo, where the identity files live, the copyright line. | `closing.*` | never |

## How the slides map to the GreatOne original

Same order and roles. Tawa Najd's departures, kept by this engine: every text is set in the brand font (the logo's own typeface for Tawa and for Mohammed Abo Alrejal), presented in Arabic and Latin; a Najdi patterns slide shows the triangles of the document letterhead; the graphic-elements slide replaces GreatOne's illustration style, since these brands have no illustrations; icons are Lucide line icons (the icon set of the owner's site), inlined at build time from `assets/lucide-0.469.0.json` (Lucide 0.469.0, ISC licence; see `assets/lucide-NOTICE.txt`); the applications are the real letterhead, a business card and the app icon.

## Regression

`assets/brand.example.json` rebuilds Tawa Najd's original deck. Checked on 2026-10-15 with `kickoff-line-workspace/kickoff-guidelines/regress.py` (shots of both decks, per-slide pixel diff, side-by-side sheets in `kickoff-line-workspace/kickoff-guidelines/tawa-rebuild/compare/`): 28 slides each, and before the fixes below, 0.000% of pixels differed on every slide (channel-sum threshold 48; at threshold 3 only slide 05 differed, 0.2%, sub-pixel antialiasing of the grid lines from rounded coordinates).

Intentional differences from the original, all engine fixes every brand gets:

- **Slides 07 and 09, footer over the green panel.** The original prints the page number (07) and the footer label and mark (09) in grey and green on the green panel, almost invisible. The engine lightens the part of the footer that sits on the panel.
- **Slide 28, copyright line.** The original sets the whole line as a left-to-right run, so an Arabic reader meets the website first and the year last. The engine sets it right-to-left: «© 2026 name · website» reads from the right.
- **Slides 23–25, banner copy anchored above the band.** The original sets each banner's copy from the top (130, 150, 130 px), so its call-to-action lands wherever the copy ends: 1 px into the teeth on slide 23 (the button covers them), 28 px above them on 24, 48 px on 25. The engine ends the copy of hero, tiles and phone banners 30 px above the band, and the build refuses copy within 24 px of it. Slide 23's copy moves up 31 px, 24's 2 px, 25's down 18 px; nothing else on those slides changes. Measured on 2026-10-15: 4.8%, 0.9% and 3.2% of pixels differ.
- **Unchanged by later engine fixes (0.000%).** Pattern tiles take an inset (`patterns.gap`, default 0.12), and `brand.example.json` sets it to 0, which draws Tawa Najd's interlocking patterns exactly. The diamonds of the values banner now stand at a fixed place on the band (46 px from the banner's bottom, where the original's flow put them), so slide 26 is identical.
- **Opt-in fields leave the deck unchanged (2026-10-16).** `font.files`, `colors.accent` and `mockups` are absent from `brand.example.json`; rebuilt after adding them, its 28 shots are byte-identical to the build before (0.000% at threshold 0). The phone banner now draws its phone with the helper the storefront mock-up shares, with no pixel change.
- **Self-contained output.** The original loads Lucide from unpkg and the font, logos and patterns from relative paths; the rebuild embeds all of them, a Google Fonts family included (downloaded at build time). Pixels are the same.

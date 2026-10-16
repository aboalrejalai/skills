# brand.json

`build.py` merges brand.json over `assets/defaults.json`: objects merge key by key, lists replace whole. Fields marked **required** have no default; the rest default to Tawa Najd's generic Arabic labels and can be overridden. A field required by one slide is needed only while that slide is built: listing the slide in `skip` drops its fields with it. Paths are relative to brand.json (absolute and `~` paths work too). A new brand starts from `assets/brand.skeleton.json`; `assets/brand.example.json` fills every brand-specific field for Tawa Najd and serves as the model for tone. The build refuses Tawa Najd's own facts (name, logos, font file, card holder, construction text, copyright…) left in another brand's file, and lists in a note any other text equal to the example's.

Text fields marked *HTML* accept inline markup: `<b>` prints bold in the 700 step of the scale (the brand's emphasis), `<strong>` prints bold in the surrounding colour, `<span class="num">…</span>` isolates a number or Latin run left to right inside Arabic, `<br>` breaks a line. Tokens `{year}`, `{name}`, `{nameLatin}`, `{font}`, `{fontAr}`, `{cells}`, `{minPrint}`, `{minScreen}` are replaced in those fields.

Empty strings and placeholders (`⟨…⟩`, TODO, TBD, lorem ipsum) are refused everywhere except the label of a usage-bar segment.

## Identity

| Field | Type | Default | Use |
| :--- | :--- | :--- | :--- |
| `name` | text | **required** | Brand name as written in Arabic text |
| `nameLatin` | text | **required** | Latin name |
| `title` | text | «الدليل الإرشادي — {name}» | HTML `<title>` |
| `footerLabel` | text | **required** | Printed at the bottom of every slide but the cover, e.g. «الدليل الإرشادي للهوية — طوع نجد القابضة» |
| `year` | text | **required** | Cover tag and `{year}` |
| `lang` | text | `ar` | `<html lang>`; the layout is right-to-left either way |
| `motif` | `najdi` \| `none` | `najdi` | Crenellations under titles and on bands, the Najdi slide, Najdi swatches; `none` swaps them for a short bar, plain bands and mark patterns |
| `skip` | list of slide ids | `[]` | Drop slides on purpose, with the fields only they need; ids in `structure.md` |

## Logos and mark

| Field | Default | Use |
| :--- | :--- | :--- |
| `logos.stacked.onLight` / `.onDark` | **required** | Full logo (mark above name); dark version for green backgrounds |
| `logos.horizontal.onLight` / `.onDark` | **required** | Horizontal logo |
| `logos.mark` | **required** | The mark alone, one colour, plain paths (no transforms, text or images). Its paths are inlined and recoloured; its viewBox frames it |
| `markViewBox` | the mark file's viewBox | Override the frame when the file's padding looks wrong |

Logos are embedded as data URIs exactly as given. Crop Canva-style exports (a square canvas with a background shape) with `scripts/prep_logos.py`; logos exported tight from Illustrator or Figma go in as they are.

## Colours

| Field | Default | Use |
| :--- | :--- | :--- |
| `colors.scale` | **required** | Object with keys `50` … `900`, each `#RRGGBB`. `600` is the primary (logo colour, buttons); `900`–`700` the dark gradients; `50` the page; `100`–`300` light accents |
| `colors.ink` | `#0D121C` | Body text and the 10% of the usage bar |
| `colors.ink2` / `muted` / `line` | `#384250` / `#4D5761` / `#E5E7EB` | Secondary text, captions, borders |
| `colors.highlight` | `#FFDE59` | The X cell on the construction slide |
| `colors.danger` | `#D92D20` | The crosses on the wrong-use slides |
| `colors.canvas` | `#d9dfdb` | Screen background between slides (not printed) |
| `colors.accent` | — | Optional `#RRGGBB` for calls to action: banner and storefront buttons take it as background with `colors.ink` text. Absent: white buttons with the 800 step as text |

The Najdi SVGs are drawn in the Saudi green scale and recoloured step by step to `colors.scale`.

## Font

| Field | Default | Use |
| :--- | :--- | :--- |
| `font.family` | **required** | CSS family name, e.g. `Kufam`. Every Arabic line is set in it, so it must have Arabic letters; the build refuses a family without them, or one missing a letter the deck's text uses |
| `font.nameAr` | **required** | The name in Arabic, e.g. «كوفام» |
| `font.file` | — | Local font file to embed (ttf, otf, ttc, woff); preferred for a variable font, or a family with one weight |
| `font.files` | — | A static family, one file per weight: a list of paths (each file's weight read from its OS/2 table), or an object `{"400": path, "700": path}` that sets each weight by hand. Use the object when two files report the same weight (common in fonts from download sites: the build refuses the clash and names the files) or a weight is wrong; a note lists every weight set by hand. Italic files are ignored with a note; variable files are refused (use `file`). The family has exactly the weights listed; coverage is the union of the files. Give `file` or `files`, not both |
| `font.googleFamily` | — | Google Fonts family, used when there is no file: the build downloads one TTF per weight (cached in `~/.cache/kickoff-guidelines/fonts/`) and embeds it, so the deck stays self-contained. One of `file` and `googleFamily` is required |
| `font.weightRange` | read from the file | CSS weight range of a local file; the build reads it from the font (variable `wght` axis, or the static file's weight) |
| `font.source` / `font.license` | **required** with the Arabic font slide | Printed on slide 07; take them from `scripts/fonts.py` (step 2) or from the owner. There is no default, so an unchecked licence is never printed |
| `latinFont` | — | `{family, file?, files?, googleFamily?}` when Latin text uses another family; checked like `font` (a file, files or a Google family, and A–Z, a–z, 0–9) |

## Slides

| Field | Default | Use |
| :--- | :--- | :--- |
| `cover.kicker` / `cover.tag` | «الدليل الإرشادي للهوية البصرية» / `BRAND GUIDELINES · {year}` | Cover lines |
| `intro.title` | «هويتنا أكثر من شعار» | Slide 2 title (a person: «هويتي أكثر من شعار») |
| `intro.paragraphs` | **required**, HTML | Two paragraphs: what the identity is, and that this deck is the reference |
| `traits.title` | «سمات العلامة التجارية» | |
| `traits.items` | **required** | 3 or 4 `{name, text}`; `name` fits a circle in two short lines, `text` one sentence |
| `logoSlide.*` | Arabic captions | `title`, `stacked`, `horizontal`, `mark` |
| `construction.paragraphs` | **required** unless skipped, HTML | Grid and reading of the mark, from `markgeo.py`. When `markgeo.py` finds no grid, add `"construction"` to `skip`; the build refuses the slide otherwise |
| `construction.cols` / `rows` / `unit` / `origin` / `highlight` | computed by `markgeo.py` | Grid cells, unit X in the mark's coordinates, grid origin `[x, y]`, the outlined cell `[col, row]` |
| `construction.title` / `label` | «هيكلة الشعار» / `X` | |
| `palette.primaryName` | **required** | e.g. «اللون الأساسي — أخضر طوع نجد» |
| `palette.primaryCode` | **required** | Latin name after the RGB, e.g. `Saudi Green 600` |
| `palette.scaleLabel` / `scalePrefix` | «التدرج اللوني (من نفس اللون)» / empty | Scale heading; prefix before each step number (`SA-`) |
| `palette.usage` | white 60, primary 30, ink 10 | `[{label, pct, color}]`; `color` is `white`, `ink` or a scale step |
| `palette.title` / `inkLabel` / `whiteLabel` / `usageLabel` | Arabic labels | |
| `typeface.glyph` | **required** | Two letters drawn huge on slide 7, usually the first letters of the name («طع», «مح») |
| `typeface.note` | **required**, HTML | Where the font is used; claim only real uses |
| `typeface.familySample` | **required** | Word set in every weight; keep it to about nine letters |
| `typeface.latinText` | **required**, HTML | Paragraph on the Latin face |
| `typeface.latinSample` | **required** | Lines; the first prints bold (e.g. the name in capitals, then a tagline) |
| `typeface.weights` | six weights 400–900 | `[[weight, "Name"], …]`; only weights the font has (the build checks) |
| `typeface.familyLead` / `familyRoles` | generated / Bold, SemiBold, Regular roles | HTML; every weight name in the roles must be one of `typeface.weights` |
| `typeface.latinName` / `latinGlyph` / `alphabet` / `letters` / labels | family in capitals, «Aa», A–Z 0–9, Arabic letters | |
| `typeScale.bodySample` | **required** | The 16 px sample line, «نص الموضوع: …» |
| `typeScale.steps` / `ratio*` / `title` | 68, 42, 26 px; golden-ratio text | |
| `misuse.*` | Arabic titles and four labels each | |
| `clearSpace.*` | three paragraphs, `35mm`, `140px` | `minPrint` / `minScreen` fill the third paragraph |
| `placement.*` | three paragraphs | |
| `patterns.title` | «أنماط الشعار» | |
| `patterns.gap` | `0.12` | Space around the mark in each pattern tile, as a share of the tile per side (0 to 0.3). It keeps marks apart and their outlines whole; `0` lets marks touch, which suits only a mark with open space around its silhouette (Tawa Najd's example uses 0) |
| `najdi.label` | **required** with `najdi` motif | Folder line under the slide, e.g. `SVG: tawa-najd/brand/patterns/najdi-triangles/` |
| `najdi.dir` | the skill's `assets/najdi/` | Folder holding header-band, teeth-down, teeth-up, texture-on-green, texture-on-white SVGs |
| `najdi.items` / `title` | four swatches | `{label, file, bg, fit}` |
| `elements.items` | **required** | 3 or 4 `{kind, title, text}`; `kind` is `teeth`, `chamfer`, `gradient`, `triangles` or `pattern`; `teeth` and `triangles` need the `najdi` motif. Claim a source («مأخوذة من العلامة») only when the mark has it |
| `iconStyle.names` | Tawa Najd's fifteen | Lucide 0.469.0 names (kebab case); unknown names are refused with suggestions |
| `iconStyle.title` / `caption` | Arabic title, Lucide caption | |
| `letterhead.image` | — | Picture of the letterhead (PNG/JPG); missing file: slide skipped with a note |
| `letterhead.heading` / `paragraphs` | **required** with an image, HTML | Describe only what the picture shows |
| `card.name` / `role` | **required** | Back of the business card |
| `card.rows` | **required** | Up to 5 `{icon, text}`; text prints left to right, so put Arabic addresses last |
| `appIcon.*` | Arabic labels, sizes 180/64/32/16 | |
| `banners.items` | `[]` | Up to 9 banners, one slide each, fields below; none skips the banner slides |
| `banners.title` | «تصميمات البنرات» | |
| `mockups` | — | Optional mock-up slides, fields below; absent: no mock-up slides |
| `closing.text` | **required**, HTML | Where the identity files live |
| `closing.copyright` | **required** | e.g. «© 2026 شركة طوع نجد القابضة · tawanajd.sa» |
| `closing.thanks` | «شكرًا لوصولك إلى النهاية» | |

## Banners

Every banner has `type`, `headline` (text, or a list of lines) and `text`. Copy states only facts from the owner's sources.

| type | Extra fields | Layout |
| :--- | :--- | :--- |
| `hero` | `cta` | Faint giant mark on the left; headline 64 px, line, white chamfered button |
| `tiles` | `tiles` (exactly 4 `{icon, label}`), `cta` | Four icon tiles on the left; headline 58 px on the right |
| `phone` | `kicker`, `cta` | Phone mock-up on the left (the mark and generic bars, not a screenshot); kicker, headline 66 px |
| `values` | `values` (4 short words) | Light background, green logo; centred headline 60 px and a line, four diamonds standing on the band. The headline is a slogan, not the name the logo beside it already shows |
| `contact` | `rows` (up to 5 `{icon, text}`) | Headline on the right, contact rows on the left; more than 3 rows switch to a compact size |

## Mock-ups

Opt-in: without `mockups` (or with `"mockups"` in `skip`) the deck has no mock-up slides. They sit after the app icon and before the banners, under the kicker «التطبيقات». Copy states only facts from the owner's sources, like banner copy.

| Field | Default | Use |
| :--- | :--- | :--- |
| `mockups.social` | **required** with `mockups` | 1 to 3 posts `{headline, text?, icon?, size?}`, shown as square Instagram posts with the brand's avatar (mark on the primary), name and action icons. Looks cycle: dark gradient with a faint mark, light with a mark pattern, primary with a big faint mark. `headline` is text or a list of lines (bold, 36 px; `size` changes it); `text` one short line; `icon` a Lucide name |
| `mockups.store` | — | `{headline, text?, items, cta?}`: a second slide, the storefront on a phone and in a desktop browser. `headline` text or lines; `items` 3 or 4 service cards `{icon, label}` (also the desktop menu); `cta` the hero button, in `colors.accent` when set |
| `mockups.title` / `storeTitle` / `kicker` | «منشورات التواصل الاجتماعي» / «واجهة المتجر» / «التطبيقات» | Slide titles and kicker |

The build refuses copy that overflows a post, a hero or a service card, naming the box.

## Layout knobs for overflow

Use these when a look at the shots shows text spilling, before shortening true copy further.

| Field | Default | Effect |
| :--- | :--- | :--- |
| `banners.items[].size` | 64 / 58 / 66 / 60 / 62 by type | Headline font size in px |
| `banners.items[].width` | 560 / 480 / 520 by type | Width of the text block on the right; keep clear of the tiles or phone |
| `banners.items[].top` | hero, tiles, phone: none; values 120; contact 130 (105 with more than 3 rows) | The banner is 1000x470; its band starts at 444 with the Najdi motif (460 without). Without `top`, the copy of a hero, tiles or phone banner ends 30 px above the band, so every call-to-action keeps the same distance from the teeth; `top` pins the copy from the top instead. The build refuses copy within 24 px of the band or 16 px of the logo |
| `banners.items[].tileWidth` / `tileSize` | 170 / 22 | Tile width and label size of a `tiles` banner |
| `banners.items[].valueSize` | 150 | Side of a `values` diamond in px (labels and gaps scale with it); smaller diamonds leave room for a two-line headline |
| `mockups.social[].size` | 36 | Headline font size of a post in px |
| `card.roleSize` | 19 | Role font size on the business card; a role too long for one line wraps onto two balanced lines |

---
name: kickoff-guidelines
description: Builds a brand guidelines deck (brand book, identity guidelines, «دليل الهوية», «الدليل الإرشادي», «جايدلاينز») for any project, company or person from its identity (logo files, colour scale, font, traits, contacts, banner copy), in the 28-slide layout of Tawa Najd's guidelines, as one self-contained HTML plus a 1440x810 PDF. Use whenever the owner asks for guidelines or a brand book, or hands over logos and wants the identity documented.
---

# Brand guidelines deck

One engine draws every deck: `assets/deck.html`, Tawa Najd's guidelines generalised. A brand is data, a `brand.json` merged over `assets/defaults.json`, and `scripts/build.py` turns it into one self-contained HTML (logos, mark, fonts and icons embedded; nothing fetched when it renders) and a PDF. Every brand gets the same slides, proportions and Najdi details, so change data, never the HTML of one deck.

- `assets/brand.skeleton.json` is where a new brand starts: every field the owner must answer, as a `⟨…⟩` placeholder the build refuses.
- `assets/brand.example.json` is Tawa Najd's deck as data: the model for tone and length, never a starting file.
- `references/brand-json.md` lists every field, its default, and the layout knobs for fixing overflow.
- `references/structure.md` says what each slide shows, which fields feed it, and when it is skipped.

## Ask first, build once

The owner's rule: **no brand.json, HTML or PDF exists while an input is missing.** No placeholder text, no guessed contact, no invented trait. One round of questions up front costs him less than a round of corrections.

Inputs the deck needs (each feeds the brand.json fields in brackets):

| Input | Notes |
| :--- | :--- |
| Name, Arabic and Latin | As written in text; the logo artwork keeps its own spelling (`name`, `nameLatin`, `footerLabel`) |
| Logos | Stacked, horizontal and mark, as SVG, for light and dark backgrounds (`logos`) |
| Colour scale | Ten steps, 50 to 900, primary (the logo colour) at 600 (`colors.scale`) |
| Primary colour's name | Arabic name and a Latin code, e.g. «الأخضر السعودي» / `Saudi Green 600` (`palette.primaryName`, `primaryCode`) |
| Font | One family that has **Arabic letters** and carries the whole deck; a local TTF/OTF (a static family as one file per weight in `files`), or a Google Fonts family (downloaded and embedded at build). A Latin-only family can only be a second, Latin face (`font`, `latinFont`) |
| Font licence | Where the font comes from and its licence, from step 2 (`font.source`, `font.license`) |
| Intro and four traits | Each claim traceable to a source the owner gave: site, profile, README (`intro`, `traits`) |
| Graphic elements | Three or four of teeth, chamfer, gradient, triangles, mark pattern, each with a one-line claim that is true of this brand (`elements.items`) |
| Business card | Whose card (a person's name and role) and its contact rows (`card`) |
| Contacts | For the card and the contact banner |
| Banner copy | Up to five banners (`hero`, `tiles`, `phone`, `values`, `contact`), facts from the same sources; none at all is fine (`banners.items`) |
| Mock-ups | Optional: up to three social posts and a storefront hero with 3 or 4 services, copy from the same sources; and an accent colour for buttons (`mockups`, `colors.accent`) |
| Motif | Najdi crenellations on or off (`motif`) |
| Letterhead image | Optional; without it the letterhead slide is skipped (`letterhead`) |
| Identity files and copyright | Where the identity files live, and the copyright line, both on the closing slide (`closing.text`, `closing.copyright`) |
| Output folder, footer label, year | Where the deck lives and the line printed on every slide (`year`) |

## Workflow

1. **Collect inputs.** Read what the owner gave and everything you can look up: the project folder, its brand folder, any PROFILE or COMPANY file, the website's content. Check the table above and send every missing item in **one message**, numbered, in the owner's language (Arabic when he writes Arabic), each with why it is needed and a default he can accept with «موافق» where one is sensible (year, motif, a scale derived from one primary, shown as hex). Names, contacts and claims about the brand are never defaulted. Wait for the answers.
   Done when every input has a value from the owner or a source you can name, and nothing is guessed.

2. **Check the font.** Run `python3 <this-skill-dir>/scripts/fonts.py "Family Name"` (or the path of a local font file). It reads the licence from the family's `METADATA.pb` in the google/fonts repository (OFL, Apache 2.0 or Ubuntu Font Licence), the weights Google serves, and whether the font has Arabic letters. Set `font.source` and `font.license` from it. When it says the family is not in the repository, ask the owner which licence covers the font and whether it may be embedded in files he sends out. When it reports no Arabic letters, the family cannot be `font`: ask for an Arabic family, and keep the Latin one as `latinFont`.
   Done when `font.source` and `font.license` hold the licence the report or the owner gave, and the font for Arabic text has all its letters.

3. **Prep logos.** For Canva-style exports (square canvas with a background shape), run `python3 <this-skill-dir>/scripts/prep_logos.py <source-dir> <brand>/logo/transparent --png-dir <brand>/logo/png`. It writes tight transparent SVGs, a white variant of each, and PNGs; it never redraws a logo, and neither do you. Logos exported tight from Illustrator or Figma are used as they are. Render the results on white and on the primary green and look at them.
   Done when stacked, horizontal and mark each exist for light and dark backgrounds, cropped to the ink, and you have seen each one on its background.

4. **Read the mark.** Run `python3 <this-skill-dir>/scripts/markgeo.py <mark.svg>`: it reports the construction grid (cells, unit X = stroke thickness), every edge angle, and how well the mark matches itself rotated or mirrored. Write `construction.paragraphs` from that report and from looking at the mark: claim 45° chamfers only when the angles are 0, 45 and 90; claim rotation only when its score is at least 0.99; name letters only after seeing them. When the report says `"grid": null` (its `gridless` line says why), add `"construction"` to `skip` and write no construction text.
   Done when every sentence of the construction text is backed by the report or by what you saw, or the slide is skipped because the mark has no grid.

5. **Write brand.json** in the folder the deck belongs in: copy `assets/brand.skeleton.json` there and replace every `⟨…⟩` with the owner's answer; delete an optional block he has no answer for (letterhead, a fourth trait, banners). Read `assets/brand.example.json` for tone and length only. Paths are relative to brand.json.
   Done when no `⟨` is left, and `grep -inE "tawa|طوع|qassim|القصيم|0555193348|اسم الموظف|مساعد المعلم" brand.json` prints nothing.

6. **Build.** `python3 <this-skill-dir>/scripts/build.py brand.json --pdf <name>.pdf`. It lists every problem in one round: empty or placeholder values, missing fields of the slides being built, a mark it cannot inline or grid, a font without Arabic letters or without the weights slide 08 shows, and the example brand's facts left in. Ask the owner, never pad. After writing the HTML it renders it and refuses when a brand font did not load, or a banner's copy comes within 24 px of its crenellated band, 16 px of its logo, or runs into its tiles, phone or diamonds. It prints the grid it used, every skipped slide with its reason, a note naming any text equal to the example brand's (confirm each is true of this brand too), the slide count, and the PDF's page count.
   Done when the build exits 0 and prints `pdf: … (N pages)` with N equal to the slide count.

7. **Look at every page.** `python3 <this-skill-dir>/scripts/shoot.py guidelines.html <scratch>/shots --sheet <scratch>/sheet.png`, then open the sheet and each `slide-NN.png` with Read. Hunt for: text spilling out of a card, labels wrapping to three lines, mark patterns where the marks merge into one carpet (raise `patterns.gap`), a logo variant that vanishes on its background, faint text, the brand's name repeated beside the logo that already shows it, and Latin or number runs out of order in an Arabic line. Fix with shorter copy or the layout knobs in `references/brand-json.md`, rebuild, and look again.
   Done when every slide of the last build has been opened at full size and none shows a defect.

8. **Report** in the owner's language: the HTML and PDF paths, the slide count, each skipped slide and why, the source of every claim (traits, banners, construction), and what is left for him, such as a letterhead image to add before a rebuild.
   Done when the owner can check every fact in the deck against a source named in the report.

## Changing the engine

`assets/deck.html` is shared by every brand. Edit it only for a change all decks should get, then rebuild `assets/brand.example.json` and compare it with Tawa Najd's original deck (`~/Desktop/Project/tawa-najd/brand/guidelines/guidelines.html`) using `~/Desktop/Project/kickoff/kickoff-line-workspace/kickoff-guidelines/regress.py`. Any difference not listed under «Regression» in `references/structure.md` is a regression to fix or to add there with its reason.

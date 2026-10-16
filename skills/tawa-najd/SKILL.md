---
name: tawa-najd
description: 'Produces Tawa Najd Holding''s (شركة طوع نجد القابضة) official printable A4 documents — quotes (عرض سعر), contracts and agreements (عقد، اتفاقية), invoices (فاتورة), official letters (خطاب رسمي), meeting minutes (محضر اجتماع), and technical & financial proposals for its software products (العرض الفني والمالي: features per user, architecture, strengths and gaps, delivery plan, pricing plans) — as one self-contained HTML file (plus PDF) on the company''s Saudi-green letterhead with its logo, Najdi bands, page numbers and contact footer. Use it whenever the user wants anything "بهوية طوع نجد", "على ورق طوع نجد", "باسم الشركة", a quote/contract/invoice/letter/minutes for Tawa Najd, a «تقرير تقني» or proposal about one of the company''s technical projects or SaaS products to send to a client, or hands over a document (PDF, photo, Word, pasted text) to be re-issued on the company''s paper — even if they never name this skill. Not for Atlalat Najd (أطلالة نجد) documents, which use the maroon atala-docs skill.'
---

# Tawa Najd

Every official paper Tawa Najd sends goes through this skill, so the company looks the same on all of them. The design lives in `assets/template.html` and is shared by all six kinds of document; you supply data as JSON and `scripts/build.py` produces the page. Don't restyle or hand-write HTML: a document that looks slightly different from the others is exactly what this skill exists to prevent.

Project home: `~/Desktop/Project/tawa-najd/`. `brand/` holds every logo version and `colors.css`, `documents/` holds the documents, and this skill sits in `skills/tawa-najd/` (linked user-wide into `~/.claude/skills`, `~/.agents/skills`, `~/.cursor/skills`).

## Ask first, write once

This is the owner's most important rule. **Never create a document file — not the JSON, not the HTML, not the PDF — while any piece of information it needs is missing.** No yellow «يُضاف» markers, no empty «مقدَّم إلى», no guessed prices, names, or dates to "fix later". Every round of corrections after the fact costs the owner more time than one clear question up front.

So before writing anything:

1. Read what the owner gave you and everything you can look up yourself: the source document, the project folder, `~/Desktop/Project/tawa-najd/COMPANY.md`, earlier documents in `documents/`, the next free number, today's date.
2. Check the result against the checklist for the kind (below) and list every item still missing or unclear.
3. **Ask for all of them in one message**, in Arabic, as a numbered list. For each item say briefly why it's needed, and where a sensible default exists, offer it so the owner can answer «موافق» (for example: «صلاحية العرض: 30 يومًا؟»). Prices, client names, ID numbers, and payment terms are never defaulted; the owner must state them.
4. Wait for the answers. Then write the file once, build it, and check it.

Only skip a question when the answer is already in what you read. If the owner says to go ahead without some detail, leave that element out of the document entirely (drop the field or the section) rather than printing a placeholder.

`build.py` enforces this: every placeholder in the starters is wrapped in `⟨…⟩`, and the build refuses to run while any value is empty or still carries `⟨`, listing each one. Don't work around it; ask.

**What each kind needs before writing:**

| Kind | Must have |
| :--- | :--- |
| عرض سعر | client name and identifier (CR or ID), city; scope items; prices and whether they include VAT; payment schedule; duration; validity |
| عقد / اتفاقية | the source text or every term to include; each party's full name and ID/CR; date; who signs |
| فاتورة | buyer name and details; line items with quantities and prices; reference (quote/contract); VAT registration status; issue and due dates |
| خطاب رسمي | recipient's name and title; subject; the points the letter must make; signer and role |
| محضر اجتماع | date, time, place; attendees and absentees; agenda; each decision with owner and deadline; next meeting |
| العرض الفني والمالي | client name; the project folder or spec; prices or plans and one-time costs; delivery timeline if fixed; signer |

## The six kinds

| Kind | Starter | Number | File |
| :--- | :--- | :--- | :--- |
| عرض سعر | `assets/templates/quote.json` | `TN-Q-001` | `documents/quotes/quote-001.json` |
| عقد / اتفاقية | `assets/templates/contract.json` | `TN-C-001` | `documents/contracts/contract-<slug>.json` |
| فاتورة | `assets/templates/invoice.json` | `TN-INV-001` | `documents/invoices/invoice-001.json` |
| خطاب رسمي | `assets/templates/letter.json` | `TN-L-001` | `documents/letters/letter-001.json` |
| محضر اجتماع | `assets/templates/minutes.json` | `TN-M-001` | `documents/minutes/minutes-001.json` |
| العرض الفني والمالي | `assets/templates/proposal.json` | `TN-P-001` | `documents/proposals/proposal-001.json` |

**Proposals need more than the others:** before writing one, read `references/proposal.md`. It says where the facts come from (the project's README, PRD, and audit), the section order, and the honesty rules for strengths, gaps, and prices.

For the next number, list the kind's folder and add one. Filled examples of every kind are in `~/Desktop/Project/tawa-najd/documents/`; read the matching one before writing a new document of that kind, since it shows the tone and section order the owner has approved.

## Workflow

1. **Read the source** if the user gave one (PDF, image, Word, text). Read every page. PDFs here often extract one word per line in scrambled order; if a Markdown or Word original exists (contracts live in `~/Desktop/Project/العقود/`), compare against it and use the clean text.
2. **Ask for everything missing** in one message (see «Ask first, write once») and wait for the answers. No file exists before this step is done.
3. **Copy the starter** for the kind into `documents/<kind>s/` under the next number, and fill it completely.
4. **Build:**
   ```bash
   python3 <this-skill-dir>/scripts/build.py <file.json> --pdf
   ```
   It writes the HTML next to the JSON and a PDF with its page count.
5. **Look at it.** Screenshot the HTML with headless Chrome (`--screenshot`, `--window-size=850,2300`) and check: nothing cut off, no page holding only one table row or only the signatures when a small trim would avoid it, numbers and totals right.
6. **Report in Arabic:** link the HTML and PDF and list the data you used (parties, amounts, dates) so the owner can check it at a glance. There should be nothing guessed to list; if there is, step 2 was skipped.

## Rules

- **Source text is copied letter for letter.** Clauses, opening and closing paragraphs, and payment terms go in exactly as written, spelling included; a "corrected" word can change what a contract clause names. Only presentation changes (a date like `4/10/2026` may go in the date field as `2026/10/04`). If a sentence is too garbled to use, keep it and ask.
- **When there is no source** (the owner asks for a quote or letter from a short brief), write it yourself in formal Saudi business Arabic and keep claims modest and true; the facts it rests on (names, prices, dates, terms) still come from the owner, asked for up front. Never write «تجريبي» or «نموذج» on a document; the owner shows these to people.
- **Company facts** printed on every document live in the `COMPANY` constant in `assets/template.html`: unified number `7055301712`, head office القصيم, phone `0555193348`, website `tawanajd.sa`. Change a fact only there and only with a value from the owner. Atlalat Najd is a different company; never copy its numbers here.
- **Bank account and VAT number are never printed by default.** The owner removed them from the footer and from every document; they live only in `~/Desktop/Project/tawa-najd/COMPANY.md`. Add them only when the owner asks, and only to the document they name (typically a contract at signing, or an invoice's payment details): put a `kv` section «بيانات الدفع» in that document's JSON, or, when the owner wants them at the bottom of the page, `"footerRows"` (see «Data file»), and copy the values from `COMPANY.md` exactly. Don't put them back into the template unless the owner asks for that.
- **VAT.** No VAT number is on file yet, so the company may not be VAT-registered, and an unregistered company must not charge VAT or call a paper «فاتورة ضريبية». Before writing an invoice, ask whether the company is registered (as part of the one round of questions); if not, title it «فاتورة» and set `"vatRate": 0`. A printed invoice from this skill also doesn't replace a ZATCA e-invoicing (فاتورة) system; say so once when you make an invoice.
- **Logo, mark, stamp.** The header is green, so it uses the white transparent logo and mark from `brand/logo/transparent/`, already embedded. To replace one, or to add the company stamp when the owner sends it:
  ```bash
  python3 <this-skill-dir>/scripts/set_asset.py logo  ~/Desktop/Project/tawa-najd/brand/logo/transparent/logo-horizontal-white.svg
  python3 <this-skill-dir>/scripts/set_asset.py mark  ~/Desktop/Project/tawa-najd/brand/logo/transparent/mark-white.svg
  python3 <this-skill-dir>/scripts/set_asset.py stamp path/to/stamp.png
  ```
  The **watermark** is the full green logo (`logo-stacked-green.svg`), angled at −30° and faint (8.5% opacity) behind every page's content; the owner asked for it. Set `"watermark": false` in a document's JSON only if the owner wants one document without it; swap the image with `set_asset.py watermark <file>`.
  Never redraw or approximate a logo. `"stamp": true` on the company's signature prints the stamp once it exists; until then the slot stays empty.
- **Colors** are the Saudi green scale from the owner's site, primary `#1B8354` (also the logo color). Don't add colors outside `brand/colors.css`.
- **Font** is Kufam only (the logo's typeface, loaded from Google Fonts; files in `brand/fonts/kufam/`). The owner rejected every other font; don't add one.
- **The header shows the logo only.** Phone, website, unified number, and head office live in the last page's footer; the owner removed them from the header.
- **Dates and numbers inside Arabic text.** Write a range with words between its ends («من 2026/07/12 إلى 2026/10/12»), never as «2026/07/12 – 2026/10/12»: the browser joins a dash-linked pair into one left-to-right run, so an Arabic reader meets the end date first. The same goes for any two codes or numbers joined only by a dash or slash.
- **Images** go in through the data file (`image` section); `build.py` embeds them as base64 because the owner opens these files where side files don't load. Crop empty margins first.
- **Privacy.** Documents hold ID, passport, and residency numbers. Keep them in `documents/`, which `.gitignore` excludes, and don't copy them elsewhere.

## Data file

Top level: `title`, optional `cover` (a full green cover page: `{kind, title, subtitle, to, toLabel?, confidential?}`; with a cover the title strip is not repeated on page 1), optional `watermark` (default on), `numberLabel` and `number` (omit both for a document without a number, like the partners contract), `date` (`YYYY/MM/DD`), optional `parties` (cards right after the title), `sections`, optional `signatures`.

Two more options exist for special papers:

- `"blank": true` — blank official stationery: no title strip, no page number, and `sections` may be `[]`. The result is one letterhead page (header, frame, watermark, full footer) for the owner to send out or print and have filled in by hand. Keep `title` for the file's name.
- `"footerRows": [[label, value], …]` — extra rows in the last page's footer, below the phone and website, for example the bank details from `COMPANY.md` when the owner asks for them on that paper. Values without Arabic letters (IBAN, account number) print left to right.

**Word version.** When the owner wants a blank sheet as an editable `.docx` as well, build the HTML first, then:

```bash
python3 <this-skill-dir>/scripts/docx_from_page.py documents/letters/letterhead.html
```

It renders the page with headless Chrome at print quality and places it behind the text of the Word header, so every page of the file carries the letterhead while the body stays editable (right-to-left, Kufam 11 pt, body margins matching the template). Only the body text is editable in Word; the header and footer are one picture, so a change to them goes in the JSON, then rebuild both files. The script's margins default to a blank sheet with footer rows; pass `--top/--bottom/--side` (mm) for another layout.

**Sections**, rendered top to bottom in the source's own order:

| type | fields | use |
| :--- | :--- | :--- |
| `heading` | `text` | section title; never left alone at a page bottom |
| `paragraph` | `text` | body text |
| `note` | `text` | highlighted line: duration, validity, closing remark |
| `parties` | `parties` (same shape as top-level) | party cards placed mid-document, e.g. after a contract's opening line; up to 3 per row |
| `kv` | `rows`: `[[label, value], …]` | two-column facts box: company statement, invoice references, meeting details |
| `addressee` | `to`, `honorific` (default «المحترمين»), `subject`, `greeting` (false hides it) | letter opening |
| `items` | `items`, optional `label` | numbered clauses; an item may be `{text, sub: [...], after}` for (أ) (ب) sub-clauses and a closing line |
| `table` | `columns` of `{label, width?, align?}`, `rows`, `numbered` (default true) | cost breakdown, invoice lines, attendees, decisions |
| `totals` | `totalExclVat` or `totalInclVat`, `vatRate` (default 0.15), `words` | net, VAT, total, amount in words |
| `payments` | `rows` of `{name, pct, due}`, optional `total` | payment schedule computed from `totals` |
| `image` | `src` (relative to the JSON), `caption` | drawing or screenshot |
| `toc` | — | table of contents of every `heading` (skip one with `"toc": false`); page numbers fill in by themselves |
| `stats` | `items` of `{value, label}` (3–5) | number tiles; values must be real counts |
| `cards` | `cards` of `{title, text?, items?}`, `columns` (default 2) | features per user role, or any grouped list |
| `proscons` | `pros`, `cons`, optional `prosLabel`, `consLabel` | strengths and gaps side by side |
| `timeline` | `phases` of `{name, duration, items}` | delivery plan |
| `plans` | `plans` of `{name, price (number or text), period, note, features, highlight?, tag?}` | pricing tiers; one `highlight` |

**Signatures**: `{label, name, role?, seal?, stamp?}`. `seal: false` drops the stamp slot, which suits individuals. `stamp: true` goes on the company's entry only. One signer takes half the width; three sit in one row.

Totals: use `totalExclVat` when the price excludes VAT and `totalInclVat` when it includes it; if the source doesn't say, ask. Write `words` yourself and check it matches the grand total. `build.py` warns when payment percentages don't add up to 100; pass that on.

## Pages

The template splits content into A4 pages by itself, repeats the letterhead and «صفحة X من Y» on each, repeats a table's header row when the table continues on a new page, and shows the full company footer (name, unified number, head office, contacts) on the last page only. You can't force a break. If a page ends badly, shorten what's there: drop a paragraph that repeats the footer, merge small sections, or crop an image.

The owner prints from the HTML's button in Chrome with margins «بلا» and background graphics on. Text is editable in the page before printing, but those edits aren't saved; lasting changes go in the JSON, then rebuild.

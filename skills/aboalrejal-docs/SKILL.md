---
name: aboalrejal-docs
description: Produces official printable A4 documents (HTML + PDF) that Mohammed Abo Alrejal (محمد أبوالرجال) issues personally, as an individual or freelancer — quotes (عرض سعر), contracts and service agreements (عقد، اتفاقية تقديم خدمات، «عقد عمل حر»), invoices (فاتورة), official letters (خطاب رسمي), meeting minutes (محضر اجتماع), technical & financial proposals (العرض الفني والمالي), and technical reports (تقرير تقني). Use it whenever the user wants a document «باسمي», «بهويتي», «على ورقي», under his own name, or hands over a document (PDF, photo, Word, pasted text) to re-issue on his paper, even if they never name this skill. Not for Tawa Najd (طوع نجد) company papers, which use the tawa-najd skill, nor for Atlalat Najd (أطلالة نجد); when a request doesn't say whose paper, ask.
---

# Mohammed Abo Alrejal documents

Every paper Mohammed issues in his own name goes through this skill, so all of them look the same. The design lives in `assets/template.html` and is shared by all six kinds of document; you supply data as JSON and `scripts/build.py` produces the page. Fill data, never hand-write or restyle HTML: one document that drifts from the others is exactly what this skill exists to prevent.

Project home: `~/Desktop/Project/aboalrejal/identity/`.

- `PROFILE.md`: his printable facts and the private facts that are never printed by default. The single source of truth.
- `brand/`: logos (`logo/transparent/`), `colors.css`, Kufam font files, Najdi patterns.
- `documents/`: real documents, one folder per kind (`quotes/`, `contracts/`, `invoices/`, `letters/`, `minutes/`, `proposals/`, as in the table below), each created with its first document. Git-ignored, because contracts hold ID numbers.
- `samples/`: one filled example of each kind for a fictional client, plus the blank letterhead (`letterhead.html`, `.pdf`, `.docx`) and all of them merged in `aboalrejal-documents.pdf`.
- This skill sits in `skills/aboalrejal-docs/`, linked user-wide into `~/.claude/skills`, `~/.agents/skills`, and `~/.cursor/skills`.

## Ask first, write once

This is the owner's most important rule. **Create a document file (JSON, HTML, or PDF) only once every piece of information it needs is in hand.** No yellow «يُضاف» markers, no empty «مقدَّم إلى», no guessed prices, names, or dates to fix later: every round of corrections afterwards costs him more time than one clear question up front.

So before writing anything:

0. **Whose paper.** A request that could be for the company rather than for him (no «باسمي»، «بهويتي»، «على ورقي») gets that one question first; company papers belong to the tawa-najd skill.
1. Read what the owner gave you and everything you can look up yourself: the source document, the project folder, `PROFILE.md`, earlier documents in `documents/`, the matching example in `samples/`, the next free number, today's date.
2. Check it against the kind's checklist below and list every item still missing or unclear.
3. **Ask for all of them in one message**, in Arabic, as a numbered list. Say briefly why each is needed, and where a sensible default exists, offer it so he can answer «موافق» (for example «صلاحية العرض: 30 يومًا؟»). Prices, client names, ID numbers, and payment terms are never defaulted; he states them.
4. Wait for the answers. Then write the file once, build it, and check it.

Skip a question only when the answer is already in what you read. If he says to go ahead without some detail, leave that element out of the document entirely (drop the field or the section) rather than printing a placeholder.

`build.py` enforces this: every placeholder in the starters is wrapped in `⟨…⟩`, and the build refuses to run while any value is empty or still carries `⟨`, listing each one. The checklist below names every `⟨…⟩` in the starters; to be sure nothing is missed, run `build.py` on the untouched starter before asking: each path it lists is a value you either looked up or put in your one message.

| Kind | Must have before writing |
| :--- | :--- |
| عرض سعر | client name, CR or ID, city; scope (or a brief to write it from); the price of each cost line; each payment's share and when it falls due; duration; validity |
| عقد / اتفاقية | the source text or every term to include; the client's full name, CR or ID, city, and representative (name and capacity); **his national ID number for this contract**; date; who signs |
| فاتورة | client name, CR or ID, city; line items with quantities and prices; reference (quote or contract); issue, supply, and due dates; payment method; bank details only if he wants them printed |
| خطاب رسمي | recipient's name and title; subject; the points the letter must make |
| محضر اجتماع | meeting title, date, time, place, chair; each attendee's name, role, and attendance; agenda; each decision with owner and deadline; end time and next meeting |
| العرض الفني والمالي | client name; the project folder or spec; prices or plans with their billing period, and one-time costs; validity; delivery timeline if fixed |

## The six kinds

| Kind | Starter | First number | File |
| :--- | :--- | :--- | :--- |
| عرض سعر | `assets/templates/quote.json` | `MA-Q-001` | `documents/quotes/quote-001.json` |
| عقد / اتفاقية | `assets/templates/contract.json` | `MA-C-001` | `documents/contracts/contract-001.json` |
| فاتورة | `assets/templates/invoice.json` | `MA-INV-001` | `documents/invoices/invoice-001.json` |
| خطاب رسمي | `assets/templates/letter.json` | `MA-L-001` | `documents/letters/letter-001.json` |
| محضر اجتماع | `assets/templates/minutes.json` | `MA-M-001` | `documents/minutes/minutes-001.json` |
| العرض الفني والمالي | `assets/templates/proposal.json` | `MA-P-001` | `documents/proposals/proposal-001.json` |

For the next number, list the kind's folder in `documents/` and add one; a missing or empty folder means `001`. Read the matching file in `samples/` before writing a new document of that kind: it shows the tone and section order to follow. Its client («شركة المثال للحلول الرقمية») is fictional; never copy its names or numbers into a real document.

**Proposals need more than the others:** before writing one, read `references/proposal.md`. It says where the facts come from, the section order, and the honesty rules for strengths, gaps, prices, and claims about him.

**A «تقرير تقني»** that reports on an existing system (an audit, a status report) is built from the letter starter: retitle it «تقرير تقني» with numberLabel «رقم التقرير», keep the `addressee`, then `heading` sections carrying `paragraph`, `items`, `table`, and `proscons` for findings and recommendations; no plans or prices. One that pitches features, a plan, and prices to a client is a proposal (see `references/proposal.md`).

## Workflow

1. **Read the source** if the user gave one (PDF, image, Word, text), every page. PDFs often extract one word per line in scrambled order; if a Markdown or Word original exists, compare against it and use the clean text.
2. **Ask for everything missing** in one message (see «Ask first, write once») and wait for the answers. No file exists before this step is done.
3. **Copy the starter** for the kind into its folder from the table above (create the folder if missing) under the next number, and fill it completely.
4. **Build:**
   ```bash
   python3 <this-skill-dir>/scripts/build.py <file.json> --pdf
   ```
   It writes the HTML next to the JSON and a PDF, and prints the page count.
5. **Look at it.** Screenshot every page and view each image:
   ```bash
   python3 <this-skill-dir>/scripts/shot.py <file.html> -o <folder>
   ```
   It writes one whole page per PNG, last footer included (`--scale 3` for a close look). Done means each of these holds on every page: nothing cut off; no page holding a single table row or only the signatures when a small trim avoids it; totals, payments, and amount in words match; dates and number ranges read in the right order; the last page's footer shows his facts exactly.
6. **Report in Arabic:** link the HTML and PDF and list the data you used (parties, amounts, dates) so he can check it at a glance. The list holds nothing guessed; if it would, step 2 was skipped.

## Rules

- **Source text is copied letter for letter.** Clauses, opening and closing paragraphs, and payment terms go in exactly as written, spelling included: a "corrected" word can change what a clause names. Only presentation changes (a date like `4/10/2026` goes in the date field as `2026/10/04`). If a sentence is too garbled to use, keep it and ask.
- **Without a source** (a quote or letter from a short brief), write it yourself in formal Saudi business Arabic, first person singular («يسرني»، «أقترح»), with modest, true claims. Every claim about him (titles, awards, projects, numbers) comes from `PROFILE.md` or his site content at `~/Desktop/Project/aboalrejal/src/components/portfolio/portfolio-data.ts` (read only); anything else is left out. He shows these papers to real people, so they carry no «تجريبي» or «نموذج».
- **His public facts** live in the `PROFILE` constant in `assets/template.html` and print in the last page's footer: name and title, city الرياض, phone, website, email, LinkedIn, GitHub, X. They mirror `PROFILE.md`; when a fact changes, change `PROFILE.md` first, then the constant, with values from him only.
- **Private facts are printed only on request.** His national ID, bank account and IBAN, and any freelance-document number (وثيقة العمل الحر) are not on file. Ask for them each time a document needs them (his ID on a contract, the IBAN on an invoice he wants paid by transfer), print them on that document only (a party field, a `kv` section «بيانات الدفع», or `"footerRows"`), and keep them out of `PROFILE.md` and this skill unless he asks to store them.
- **VAT.** He is an individual and not VAT-registered, so a bill is titled «فاتورة», never «فاتورة ضريبية», and every `totals` section carries `"vatRate": 0` (`build.py` refuses any other rate); the totals box then prints one «الإجمالي» row and the amount in words, with no VAT lines. Keep the note that says so plainly: «لا تُضاف ضريبة القيمة المضافة إلى المبالغ؛ مقدّم الخدمة فرد غير مسجّل فيها». A printed invoice does not replace ZATCA e-invoicing (فاتورة), which applies once he registers; say so once when you make an invoice. If he says he has registered, update `PROFILE.md` and the check in `build.py` before any VAT document.
- **Amounts are plain numbers** (`45000`, not `"45,000"`) in `totalExclVat`, payment `pct`, and payment `total`; `build.py` refuses text there. Write `words` yourself and check it matches the total. `build.py` warns when payment percentages don't add up to 100; pass that on.
- **Logo, mark, watermark.** The header band is green, so it carries his white transparent horizontal logo, with the white mark large and faint behind it; the watermark is his stacked green logo, angled at −30° and faint behind every page. All three are already embedded. To replace one:
  ```bash
  S=~/Desktop/Project/aboalrejal/identity
  python3 <this-skill-dir>/scripts/set_asset.py logo $S/brand/logo/transparent/logo-horizontal-white.svg
  python3 <this-skill-dir>/scripts/set_asset.py mark $S/brand/logo/transparent/mark-white.svg
  python3 <this-skill-dir>/scripts/set_asset.py watermark $S/brand/logo/transparent/logo-stacked-green.svg
  ```
  Use the logo files as they are. The artwork reads «محمد ابوالرجال / MOHAMMED ABOALREJAL»; text on the page writes his name «محمد أبوالرجال». `"watermark": false` in a document's JSON drops the watermark for that one document.
- **No stamp.** He signs as an individual: his signature entries carry `"seal": false`, which leaves a signature box only. A client that is a company keeps its stamp box (omit `seal`).
- **Colors** are the Saudi green scale in `brand/colors.css`, primary `#1B8354` (the logo color). **Font** is Kufam only, embedded in the template (`set_asset.py font $S/brand/fonts/kufam/Kufam[wght].woff2`), so pages keep it offline and in print. **The header shows the logo only**; contacts live in the last page's footer.
- **Footer icons.** Phone, website, and email chips use the template's glyphs; LinkedIn, GitHub, and X carry each brand's own filled mark (Simple Icons, CC0), since Lucide has no X mark. This exception to the Lucide-line rule awaits his OK; if he declines it, switch LinkedIn and GitHub to Lucide and ask him what X should show.
- **Dates and numbers inside Arabic text.** Write a range with words between its ends («من 2026/07/12 إلى 2026/10/12»). A dash or slash between two dates or codes makes the browser join them into one left-to-right run, so an Arabic reader meets the end first.
- **Images** go in through the data file (`image` section); `build.py` embeds them as base64 because he opens these files where side files don't load. Crop empty margins first.

## Data file

Top level: `title`, optional `cover` (a full green cover page: `{kind, title, subtitle, to, toLabel?, confidential?}`; with a cover the title strip is not repeated on page 1), optional `watermark` (default on), `numberLabel` and `number` (omit both for a document without a number), `date` (`YYYY/MM/DD`), optional `parties` (cards right after the title), `sections`, optional `signatures`.

Two options for special papers:

- `"blank": true`: blank stationery with no title strip and no page number; `sections` may be `[]`. The result is one letterhead page (header, frame, watermark, full footer) to print and fill by hand. Keep `title` for the file's name. The built one is `samples/letterhead.html`.
- `"footerRows": [[label, value], …]`: extra rows in the last page's footer, such as the IBAN he gives for one invoice. Values without Arabic letters print left to right.

**Word version.** For an editable `.docx` of a blank sheet, build the HTML first, then:

```bash
python3 <this-skill-dir>/scripts/docx_from_page.py <letterhead.html>
```

It renders the page with headless Chrome at print quality and places it behind the text of the Word header, so every page carries the letterhead while the body stays editable (right to left, Kufam 11 pt). Header and footer are one picture: change them in the JSON and rebuild both files. Margins default to a blank sheet without footer rows; pass `--bottom 52` when the sheet has `footerRows`.

**Sections**, rendered top to bottom in the source's own order:

| type | fields | use |
| :--- | :--- | :--- |
| `heading` | `text` | section title; never left alone at a page bottom |
| `paragraph` | `text` | body text |
| `note` | `text` | highlighted line: duration, validity, VAT status |
| `parties` | `parties` (same shape as top-level) | party cards mid-document, e.g. after a contract's opening line; up to 3 per row |
| `kv` | `rows`: `[[label, value], …]` | two-column facts box: invoice references, meeting details |
| `addressee` | `to`, `honorific` (default «المحترمين»), `subject`, `greeting` (false hides it) | letter opening |
| `items` | `items`, optional `label` | numbered clauses; an item may be `{text, sub: [...], after}` for (أ) (ب) sub-clauses and a closing line |
| `table` | `columns` of `{label, width?, align?}`, `rows`, `numbered` (default true) | cost breakdown, invoice lines, attendees, decisions |
| `totals` | `totalExclVat`, `vatRate` (always 0 for him), `words` | total and amount in words |
| `payments` | `rows` of `{name, pct, due}`, optional `total` | payment schedule computed from `totals`, or from `total` when the document has no totals box |
| `image` | `src` (relative to the JSON), `caption` | drawing or screenshot |
| `toc` | none | table of contents of every `heading` (skip one with `"toc": false`); page numbers fill in by themselves |
| `stats` | `items` of `{value, label}` (3–5) | number tiles; values must be real counts |
| `cards` | `cards` of `{title, text?, items?}`, `columns` (default 2) | features per user role, or any grouped list |
| `proscons` | `pros`, `cons`, optional `prosLabel`, `consLabel` | strengths and gaps side by side |
| `timeline` | `phases` of `{name, duration, items}` | delivery plan |
| `plans` | `plans` of `{name, price (number or text), period, note, features, highlight?, tag?}` | pricing tiers; one `highlight` |

**Signatures**: `{label, name, role?, seal?}`. One signer takes half the width; three sit in one row.

## Pages

The template splits content into A4 pages by itself, repeats the letterhead and «صفحة X من Y» on each, repeats a table's header row when the table continues on a new page, and shows the full footer on the last page only. Breaks can't be forced: when a page ends badly, shorten what's there (merge two notes, tighten wording that wraps by a word, drop a section that repeats another) and rebuild.

He prints from the HTML's button in Chrome with margins «بلا» and background graphics on. Text is editable in the page before printing, but those edits aren't saved; lasting changes go in the JSON, then rebuild.

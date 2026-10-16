# Writing a Technical & Financial Proposal (العرض الفني والمالي)

The owner hands over a project — a folder, a spec, a few lines — and sends the result to a company or client. The proposal describes the product, what it does for each user, how it's built, its honest strengths and gaps, the delivery plan, and the price. This file says where the content comes from and in what order it goes; `assets/templates/proposal.json` is the starter, and `~/Desktop/Project/tawa-najd/documents/proposals/proposal-001.json` (منصة التعليم الموحد) is the approved example of layout and tone (it was a demo, so its cover carries no recipient; a real proposal always names one).

## Name it right

A proposal sent to win work is «العرض الفني والمالي». A «تقرير تقني» is a different document (an audit or a status report about an existing system). If the owner asks for a «تقرير تقني» but describes features, plan, and prices for a client, write a proposal and title it «العرض الفني والمالي»; say so in the report.

## Gather facts, then ask, then write

Follow the main skill's «Ask first, write once» rule: read the project first, then send the owner one list of everything the files don't answer (client, prices, timeline if fixed, signer), and write only after the answers come back.

When the owner points at a project folder, read, in this order, and take facts only from what you read:

1. `README.md` — product overview, capabilities, audited counts (pages, roles, functions), stack.
2. `docs/prd.md`, `docs/SRS.md`, `docs/USER_GUIDE.md` (or whatever the project has) — roles, features per role, subsystems.
3. Any audit or review (`docs/audit/…`) — real weaknesses and the roadmap. Use these for «نقاط التحسين» and «خطة التنفيذ».
4. `package.json` and the backend folder (`supabase/`, `server/`) — confirm the stack and the counts you print.

Numbers on the stats tiles must come from the repository (a README "audited snapshot", or count the files yourself). Never round up or estimate a count for effect.

## Section order

| # | Section | Section types | Content |
| :-- | :-- | :-- | :-- |
| — | Cover | top-level `cover` | `kind` «العرض الفني والمالي», product name as `title`, one-sentence `subtitle`, `to` = the client, always (ask for it) |
| 1 | الفهرس | `heading` (`"toc": false`) + `toc` | filled with page numbers automatically |
| 2 | الملخص التنفيذي | `paragraph` ×2 + `stats` (3–5 tiles) | what it is, its state today, what this proposal offers |
| 3 | المشكلة والحل | `paragraph` ×2 | the pain in the client's words, then the product's answer |
| 4 | مميزات المنصة لكل مستخدم | `cards` (2 columns) | one card per role, 4–7 concrete features each |
| 5 | الأنظمة الفرعية | `table` | module → what it delivers |
| 6 | البنية التقنية | `kv` | stack in plain words; no internal file paths |
| 7 | نقاط القوة ونقاط التحسين | `paragraph` + `proscons` | honest, from the audit; each gap should be answered by the plan |
| 8 | خطة التنفيذ | `timeline` | phases with durations and 2–3 deliverables each |
| 9 | الاستراتيجية ونموذج التشغيل | `items` | delivery model (SaaS, tenancy, rollout region, onboarding) |
| 10 | الباقات والأسعار | `plans` (+ `table` for one-time costs, + `note`) | prices, period, limits, features; mark one plan `highlight` |
| 11 | ما يشمله الاشتراك | `items` | hosting, updates, support, data ownership, privacy |
| 12 | الخطوات التالية | `paragraph` + company `signatures` | demo, choose plan, sign |

Drop a section the project has nothing true to say about; don't pad.

## Rules for proposals

- **Honesty over sales.** Weaknesses come from the project's own audit or from what you see in the code, written plainly. The owner asked for «المميزات والعيوب»; a proposal that hides known gaps fails the first technical review on the client side.
- **No claims you can't back.** Don't write that the product is integrated with, approved by, or certified by a government body unless a file says so. Say «مصممة لبيئة المدرسة السعودية», not «معتمدة من الوزارة».
- **Prices come from the owner.** If the owner didn't give prices, ask before writing. You may suggest a plan structure and prices in that question for the owner to approve or change, but nothing goes into the file until they answer. VAT follows the main skill's VAT rule.
- **Prior work.** The partners' contract says Mohammed's prior works are not named as company assets until an annex is signed. If the project predates Tawa Najd, remind the owner of that once before the proposal goes to an outside party.
- Write in formal Saudi business Arabic. Technical names (React, Supabase, OMR, SaaS) stay in Latin letters; explain each one in a few Arabic words the first time if the client is non-technical.

# Writing a Technical & Financial Proposal (العرض الفني والمالي)

Mohammed hands over a project (a folder, a spec, a few lines) and sends the result to a client under his own name. The proposal describes the product, what it does for each user, how it's built, its honest strengths and gaps, the delivery plan, and the price. This file says where the content comes from and in what order it goes; `assets/templates/proposal.json` is the starter, and `~/Desktop/Project/aboalrejal/identity/samples/proposal-001.json` (منصة مُجيب, for a fictional client) shows the approved layout and tone.

## Name it right

A proposal sent to win work is «العرض الفني والمالي». A «تقرير تقني» is a different document (an audit or a status report about an existing system). If he asks for a «تقرير تقني» but describes features, plan, and prices for a client, write a proposal and title it «العرض الفني والمالي»; say so in the report.

## Gather facts, then ask, then write

Follow the main skill's «Ask first, write once» rule: read the project first, then send him one list of everything the files don't answer (client, prices, timeline if fixed), and write only after the answers come back.

When he points at a project folder, read, in this order, and take facts only from what you read:

1. `README.md`: product overview, capabilities, audited counts (pages, roles, functions), stack.
2. `docs/prd.md`, `docs/SRS.md`, `docs/USER_GUIDE.md` (or whatever the project has): roles, features per role, subsystems.
3. Any audit or review (`docs/audit/…`): real weaknesses and the roadmap. Use these for «نقاط التحسين» and «خطة التنفيذ».
4. `package.json` and the backend folder (`supabase/`, `server/`): confirm the stack and the counts you print.

Numbers on the stats tiles come from the repository (a README "audited snapshot", or files you count yourself), printed exactly as counted. When there is no repository yet, the tiles count what the proposal itself defines (roles, subsystems, weeks to launch), as in the sample.

## Section order

| # | Section | Section types | Content |
| :-- | :-- | :-- | :-- |
| — | Cover | top-level `cover` | `kind` «العرض الفني والمالي», product name as `title`, one-sentence `subtitle`, `to` = the client, always (ask for it) |
| 1 | الفهرس | `heading` (`"toc": false`) + `toc` | filled with page numbers automatically |
| 2 | الملخص التنفيذي | `paragraph` ×2 + `stats` (3–5 tiles) | what it is, its state today, what this proposal offers |
| 3 | المشكلة والحل | `paragraph` ×2 | the pain in the client's words, then the product's answer |
| 4 | مميزات المنصة لكل مستخدم | `cards` (2 or 3 columns) | one card per role, 4–7 concrete features each |
| 5 | الأنظمة الفرعية | `table` | module → what it delivers |
| 6 | البنية التقنية | `kv` | stack in plain words, short enough to sit on one line; no internal file paths |
| 7 | نقاط القوة ونقاط التحسين | `paragraph` + `proscons` | honest; each gap answered by the plan |
| 8 | خطة التنفيذ | `timeline` | phases with durations and 2–3 deliverables each |
| 9 | الاستراتيجية ونموذج التشغيل | `items` | delivery model (SaaS, tenancy, rollout, onboarding), when it adds something the other sections don't say |
| 10 | الباقات والأسعار | `plans` (+ `table` for one-time costs, + `note`) | prices, period, limits, features; mark one plan `highlight` |
| 11 | ما يشمله الاشتراك | `items` | hosting, updates, support, data ownership, privacy |
| 12 | عن مقدّم العرض | `paragraph` + `items` | who he is and 3–4 achievements, each traceable (see below) |
| 13 | الخطوات التالية | `paragraph` + his `signatures` | demo, choose plan, sign |

Drop a section the project has nothing true to say about; padding costs the client's trust and a page.

## Rules for proposals

- **Honesty over sales.** Weaknesses come from the project's own audit or from what you see in the code, written plainly. A proposal that hides known gaps fails the first technical review on the client side. One gap belongs in every proposal he sends alone: the service rests on one engineer, answered by documentation and data handed to the client.
- **Claims you can back.** Integration with, approval by, or certification from a government body goes in only when a file says so: write «مصممة لبيئة المدرسة السعودية», not «معتمدة من الوزارة». A plan tag says «المقترحة لكم», since a new product has no demand figures behind «الأكثر طلبًا».
- **About him.** Every line in «عن مقدّم العرض» comes from `PROFILE.md` or `~/Desktop/Project/aboalrejal/src/components/portfolio/portfolio-data.ts` (his site content, from his résumé): title, city, awards with their year and organisers, project counts. Copy figures exactly.
- **Prices come from him.** If he didn't give prices, ask before writing. You may suggest a plan structure and prices in that question for him to approve or change; nothing goes into the file until he answers. He is not VAT-registered: the pricing note says the prices carry no VAT for that reason.
- Write in formal Saudi business Arabic, first person singular. Technical names (React, Supabase, RAG, SaaS) stay in Latin letters; explain each in a few Arabic words the first time if the client is non-technical.

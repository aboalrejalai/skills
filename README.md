# مهارات أبوالرجال · Abo Alrejal Skills

[![skills.sh](https://skills.sh/b/aboalrejalai/skills)](https://skills.sh/aboalrejalai/skills)

<div dir="rtl">

## ما هذا المستودع

فهرس شخصي منتقى لمهارات الوكلاء (Agent Skills) من إعداد محمد أبوالرجال. كل مهارة فيه تحمل وسمًا أو أكثر:

| الوسم | المعنى |
|---|---|
| `made` | من صنعي |
| `use` | أستخدمها في عملي اليومي |
| `recommend` | أنصح بها |
| `favorite` | من المفضلة، وتظهر في أعلى الصفحة |

لكل مهارة في الموقع بطاقة وصفحة خاصة تعرض ملف `SKILL.md` وقائمة الملفات وأمر التثبيت وملف ZIP للتنزيل ورابط GitHub ورابط skills.sh.

الموقع ثابت (Astro) ومنشور على Cloudflare Workers. العربية في `/` والإنجليزية في `/en/`.

<!-- TODO: أضف رابط الموقع المنشور هنا بعد ربط النطاق -->

## التثبيت

ثبّت مهارة واحدة بالاسم دائمًا:

```bash
npx skills add aboalrejalai/skills --skill kickoff-plan
```

تثبيت عام (لكل المشاريع) لوكيل محدد دون أسئلة:

```bash
npx skills add aboalrejalai/skills@kickoff-plan -g -a claude-code -y
```

اعرض المهارات المتاحة دون تثبيت شيء:

```bash
npx skills add aboalrejalai/skills --list
```

> **تحذير:** لا تشغّل `npx skills add aboalrejalai/skills -y` بدون `--skill` إلا إذا أردت تثبيت كل مهارات المستودع دفعة واحدة.

أوامر تثبيت المهارات الخارجية موجودة في صفحة كل مهارة على الموقع.

## مهارات هذا المستودع

هذه المهارات من صنعي وتعيش في مجلد `skills/`. بقية الفهرس مهارات في مستودعات أخرى.

| المهارة | الوصف |
|---|---|
| `kickoff-plan` | أول محطة في خط kickoff: تقسّم العمل إلى مهام صغيرة مصنّفة حسب المخاطرة، لكل مهمة فحص يشغّله الوكيل، وتحفظ الخطة في `.cursor/plans/`. |
| `kickoff-implement` | تنفّذ خطة kickoff مهمة مهمة على فرع مستقل، وتشغّل فحص كل مهمة وتسجّل الدليل في الخطة. |
| `kickoff-review` | تراجع فرع kickoff مقابل خطته قبل الشحن، بعمق يحدده مستوى المخاطرة، وتعطي حكمًا وقائمة اعتماد. |
| `kickoff-ship` | ترفع الفرع المراجَع وتفتح PR وتنتظر CI وتفتح issues لملاحظات المراجعة، ثم تدمج بعد «اعتمد». |
| `kickoff-setup` | تجهّز أساس kickoff مرة واحدة لكل جهاز، وتهيّئ المشروع لخط kickoff بعد موافقة المستخدم. |
| `kickoff-using` | خريطة المهارات المتخصصة في خط kickoff: أي مهارة تستدعيها كل محطة ومتى. |
| `kickoff-guidelines` | تبني دليل هوية (brand book) من 28 شريحة لأي مشروع أو شركة أو شخص، كملف HTML واحد مع PDF. |
| `tawa-najd` | مستندات A4 رسمية بهوية شركة طوع نجد القابضة: عروض أسعار وعقود وفواتير وخطابات ومحاضر وعروض فنية ومالية. |
| `aboalrejal-docs` | مستندات A4 رسمية باسم محمد أبوالرجال شخصيًا: عروض أسعار وعقود وفواتير وخطابات ومحاضر وتقارير تقنية. |

## إضافة مهارة

- مهارة من صنعي بلا مستودع خاص: أنشئ `skills/<name>/SKILL.md`.
- مهارة في مستودع آخر (لي أو لغيري):

```bash
npm run add -- owner/repo@skill --tag use
```

التفاصيل الكاملة في [docs/adding-skills.md](docs/adding-skills.md).

## التطوير المحلي

```bash
npm install
npm run dev       # خادم التطوير
npm run build     # يبني بيانات الفهرس وملفات ZIP ثم الموقع في dist/
npm run preview   # يعرض dist/ محليًا عبر wrangler dev
```

## النشر

الموقع منشور على Cloudflare Workers (Static Assets). الخطوات في [docs/deploy.md](docs/deploy.md).

## الحقوق

المهارات الخارجية ملك لأصحابها. هذا المستودع لا ينسخها، بل يشير إليها في `catalog.yaml` ويربط بمستودعاتها الأصلية. تُجلب وقت البناء فقط لعرض صفحاتها وبناء ملفات ZIP.

## الرخصة

[MIT](LICENSE)

</div>

---

## What this is

A personal, curated catalog of agent skills by Mohammed Abo Alrejal. Every skill carries one or more tags:

| Tag | Meaning |
|---|---|
| `made` | I wrote it |
| `use` | Installed in my daily setup |
| `recommend` | Worth knowing |
| `favorite` | Pinned to the top |

Each skill on the site gets a card and its own page with the rendered `SKILL.md`, its file list, the install command, a ZIP download, a GitHub link and a skills.sh link.

The site is static (Astro) and deployed on Cloudflare Workers. Arabic lives at `/`, English at `/en/`.

<!-- TODO: add the live site URL once the domain is connected -->

## Install

Always install one skill by name:

```bash
npx skills add aboalrejalai/skills --skill kickoff-plan
```

Global install for one agent, no prompts:

```bash
npx skills add aboalrejalai/skills@kickoff-plan -g -a claude-code -y
```

List the available skills without installing anything:

```bash
npx skills add aboalrejalai/skills --list
```

> **Warning:** do not run `npx skills add aboalrejalai/skills -y` without `--skill` unless you want every skill in this repo installed at once.

Install commands for third-party skills are on each skill's page on the site.

## Skills in this repo

These are my own skills and live in `skills/`. The rest of the catalog points to skills in other repos.

| Skill | Description |
|---|---|
| `kickoff-plan` | First station of the kickoff line: breaks work into atomic, risk-rated tasks, each with a check the agent can run, and saves the plan to `.cursor/plans/`. |
| `kickoff-implement` | Executes a kickoff plan task by task on a feature branch, running each task's check and logging the evidence in the plan. |
| `kickoff-review` | Reviews a kickoff branch against its plan before it ships, with depth set by risk, and returns a verdict and approval checklist. |
| `kickoff-ship` | Pushes a reviewed branch, opens its PR, waits for CI, files issues for should-fix notes, and merges after the owner's «اعتمد». |
| `kickoff-setup` | Installs the kickoff foundation once per machine and sets a project up for the kickoff line, after the user approves. |
| `kickoff-using` | The kickoff line's map of specialist skills: which one each station calls, and when. |
| `kickoff-guidelines` | Builds a 28-slide brand guidelines deck for any project, company or person, as one HTML file plus a PDF. |
| `tawa-najd` | Official A4 documents for Tawa Najd Holding: quotes, contracts, invoices, letters, minutes, and technical & financial proposals. |
| `aboalrejal-docs` | Official A4 documents issued personally by Mohammed Abo Alrejal: quotes, contracts, invoices, letters, minutes, and technical reports. |

## Adding a skill

- My own skill with no repo of its own: create `skills/<name>/SKILL.md`.
- A skill in another repo (mine or someone else's):

```bash
npm run add -- owner/repo@skill --tag use
```

Full guide: [docs/adding-skills.md](docs/adding-skills.md).

## Local development

```bash
npm install
npm run dev       # dev server
npm run build     # builds catalog data and ZIPs, then the site into dist/
npm run preview   # serves dist/ locally with wrangler dev
```

## Deploy

The site runs on Cloudflare Workers (Static Assets). See [docs/deploy.md](docs/deploy.md).

## Credits

Third-party skills belong to their authors. This repo does not copy them: it references them in `catalog.yaml` and links to the upstream repos. They are fetched at build time only to render their pages and build the ZIPs.

## License

[MIT](LICENSE)

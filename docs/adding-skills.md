# إضافة مهارة · Adding a skill

<div dir="rtl">

## الحالات الثلاث

| الحالة | أين تعيش المهارة | ماذا تفعل |
|---|---|---|
| (أ) مهارة من صنعي بلا مستودع خاص | هذا المستودع | أنشئ `skills/<name>/SKILL.md` |
| (ب) مهارة من صنعي في مستودعها الخاص | مستودعها | أضف مدخلًا في `catalog.yaml` |
| (ج) مهارة لشخص آخر | مستودع صاحبها | أضف مدخلًا في `catalog.yaml` |

### (أ) مهارة محلية في `skills/`

```text
skills/
  my-skill/
    SKILL.md
    references/...   (اختياري)
```

القواعد:

- المجلد مسطّح: `skills/<name>/SKILL.md` مباشرة، بلا مجلدات تصنيف.
- اسم المجلد يطابق `name` في الـ frontmatter، بصيغة kebab-case (حروف إنجليزية صغيرة وأرقام وشرطات).
- الحقلان `name` و`description` إلزاميان.
- لا تضع ملف `SKILL.md` في أي مكان آخر من المستودع (مثل `.agents/skills/` أو `.claude/skills/`)، لأن أداة `npx skills` تنشر كل `SKILL.md` تجده.
- أضف المهارة إلى مجموعة في `skills.sh.json` لتظهر مصنّفة في صفحة المستودع على skills.sh.

```markdown
---
name: my-skill
description: What the skill does and when the agent should use it.
---

# My skill
...
```

المهارات المحلية تأخذ افتراضيًا التصنيف `other` والوسمين `made` و`use`. لتغيير وسومها أو تصنيفها أو إضافة ملاحظة، أضف لها مدخلًا تحت `local:` في `catalog.yaml`:

```yaml
local:
  - name: my-skill
    category: planning-workflow
    tags: [made, use, favorite]
    note: { ar: "لماذا هي هنا، بكلماتي.", en: "Why it is here, in my words." }
```

### (ب) و(ج) مهارة في مستودع آخر

الطريقة الأسهل:

```bash
npm run add -- owner/repo@skill --tag use
```

الأمر يقبل أيضًا رابط مجلد على GitHub أو رابط صفحة المهارة على skills.sh:

```bash
npm run add -- https://github.com/owner/repo/tree/main/skills/skill-name --tag recommend
npm run add -- https://skills.sh/owner/repo/skill-name --tag use,favorite
```

الخيارات:

| الخيار | المعنى |
|---|---|
| `--tag use,favorite` | وسم أو أكثر، مفصولة بفاصلة (الافتراضي `use`، و`made` لمستودعاتي) |
| `--category x` | أحد التصنيفات في الجدول أدناه (الافتراضي: يُخمَّن من الوصف) |
| `--ref <ref>` | الفرع أو الوسم (الافتراضي: الفرع الافتراضي للمستودع) |
| `--note-ar "..."` | ملاحظتي بالعربية |
| `--note-en "..."` | ملاحظتي بالإنجليزية |
| `--update` | يستبدل مدخلًا موجودًا للمهارة نفسها بدل الرفض |
| `--dry-run` | يعرض المدخل دون أن يكتبه |
| `--yes`, `-y` | لا يسأل، ويستخدم القيم الافتراضية |

بدون `--tag` و`--category` وفي طرفية تفاعلية، يسألك الأمر عنهما. القائمة الكاملة: `npm run add -- --help`.

أو حرّر `catalog.yaml` يدويًا:

```yaml
skills:
  - source: owner/repo
    path: skills/skill-name    # المجلد الذي فيه SKILL.md، أو "" إذا كان في جذر المستودع
    ref: main                  # اختياري
    name: skill-name           # قيمة name في الـ frontmatter
    category: code-quality
    tags: [use, recommend]
    note: { ar: "لماذا هي هنا.", en: "Why it is here." }
```

المهارات الخارجية لا تُنسخ إلى هذا المستودع. تُجلب وقت البناء فقط لعرض صفحتها وبناء ملف ZIP.

### المجموعات (collections)

الحزم الكبيرة التي تضم عشرات أو مئات المهارات تظهر كبطاقة واحدة بدل بطاقة لكل مهارة. أمر التثبيت المعروض لها هو `npx skills add owner/repo --list`، ومعرّفها (id) يُشتق من اسم المستودع، وعدد المهارات يُحسب وقت البناء.

```yaml
collections:
  - source: owner/repo
    ref: main                  # اختياري
    category: seo-marketing
    tags: [recommend]
    title: { ar: "مهارات التسويق", en: "Marketing skills" }
    description: { ar: "وصف قصير.", en: "Short description." }
```

## التصنيفات

| المفتاح | العربية |
|---|---|
| `code-quality` | جودة الكود |
| `planning-workflow` | التخطيط وسير العمل |
| `agents-delegation` | الوكلاء والتفويض |
| `frontend-design` | الواجهات والتصميم |
| `video-media` | الفيديو والوسائط |
| `seo-marketing` | السيو والتسويق |
| `ecommerce-salla` | التجارة وسلة |
| `documents` | المستندات |
| `memory-knowledge` | الذاكرة والمعرفة |
| `research-tools` | البحث والأدوات |
| `testing` | الاختبارات |
| `security` | الأمان |
| `backend-data` | الخلفية والبيانات |
| `other` | أخرى |

## الوسوم

| الوسم | العربية | المعنى |
|---|---|---|
| `made` | من صنعي | كتبتها بنفسي |
| `use` | أستخدمها | مثبّتة في عملي اليومي |
| `recommend` | أنصح بها | تستحق المعرفة حتى لو لم أستخدمها يوميًا |
| `favorite` | المفضلة | تظهر في أعلى الصفحة |

## مهارات مثبّتة ولم تُضف بعد

```bash
npm run import:lock
```

يقرأ `~/.agents/.skill-lock.json` (سجل أداة `npx skills` للمهارات المثبّتة) ويضيف إلى `catalog.yaml` ما ليس فيه بعد، بالوسم `use` (والوسمين `made` و`use` لمستودعاتي) وتصنيف مخمَّن من الوصف. أضف `-- --dry-run` لترى التغيير قبل كتابته، ثم عدّل المدخلات بـ `npm run add -- <spec> --update ...`.

## بعد الإضافة

ابنِ الموقع محليًا للتأكد:

```bash
npm run build
npm run preview
```

أو ادفع التغيير إلى `main` مباشرة: Cloudflare Workers Builds يعيد بناء الموقع وينشره، وCI على GitHub يفحص البناء دون نشر. التفاصيل في [deploy.md](deploy.md).

</div>

---

## The three cases

| Case | Where the skill lives | What to do |
|---|---|---|
| (a) My own skill, no repo of its own | This repo | Create `skills/<name>/SKILL.md` |
| (b) My own skill in its own repo | That repo | Add an entry to `catalog.yaml` |
| (c) Someone else's skill | The author's repo | Add an entry to `catalog.yaml` |

### (a) A local skill in `skills/`

```text
skills/
  my-skill/
    SKILL.md
    references/...   (optional)
```

Rules:

- Flat layout: `skills/<name>/SKILL.md`, no category folders.
- The folder name equals the frontmatter `name`, in kebab-case (lowercase letters, digits, hyphens).
- `name` and `description` are required.
- Keep `SKILL.md` files out of every other folder in the repo (for example `.agents/skills/` or `.claude/skills/`): the `npx skills` CLI publishes every `SKILL.md` it finds.
- Add the skill to a group in `skills.sh.json` so it is grouped on the repo's skills.sh page.

```markdown
---
name: my-skill
description: What the skill does and when the agent should use it.
---

# My skill
...
```

Local skills default to category `other` and tags `made`, `use`. To change their tags or category, or to add a note, give them an entry under `local:` in `catalog.yaml`:

```yaml
local:
  - name: my-skill
    category: planning-workflow
    tags: [made, use, favorite]
    note: { ar: "لماذا هي هنا، بكلماتي.", en: "Why it is here, in my words." }
```

### (b) and (c) A skill in another repo

The easy way:

```bash
npm run add -- owner/repo@skill --tag use
```

It also accepts a GitHub folder URL or a skills.sh skill URL:

```bash
npm run add -- https://github.com/owner/repo/tree/main/skills/skill-name --tag recommend
npm run add -- https://skills.sh/owner/repo/skill-name --tag use,favorite
```

Options:

| Option | Meaning |
|---|---|
| `--tag use,favorite` | One or more tags, comma-separated (default `use`; `made` for my own repos) |
| `--category x` | One of the categories below (default: guessed from the description) |
| `--ref <ref>` | Branch or tag (default: the repo's default branch) |
| `--note-ar "..."` | My note in Arabic |
| `--note-en "..."` | My note in English |
| `--update` | Replace an existing entry for the same skill instead of refusing |
| `--dry-run` | Print the entry without writing it |
| `--yes`, `-y` | Never ask; use defaults |

With no `--tag`/`--category` and an interactive terminal, it asks for them. Full list: `npm run add -- --help`.

Or edit `catalog.yaml` by hand:

```yaml
skills:
  - source: owner/repo
    path: skills/skill-name    # folder holding SKILL.md, "" when it is at the repo root
    ref: main                  # optional
    name: skill-name           # the frontmatter name
    category: code-quality
    tags: [use, recommend]
    note: { ar: "لماذا هي هنا.", en: "Why it is here." }
```

Third-party skills are not copied into this repo. They are fetched at build time only to render their page and build the ZIP.

### Collections

Large packs with dozens or hundreds of skills show as one card instead of one card per skill. Their install command is `npx skills add owner/repo --list`, its id comes from the repo name, and the skill count is computed at build time.

```yaml
collections:
  - source: owner/repo
    ref: main                  # optional
    category: seo-marketing
    tags: [recommend]
    title: { ar: "مهارات التسويق", en: "Marketing skills" }
    description: { ar: "وصف قصير.", en: "Short description." }
```

## Categories

| Key | English |
|---|---|
| `code-quality` | Code quality |
| `planning-workflow` | Planning & workflow |
| `agents-delegation` | Agents & delegation |
| `frontend-design` | Frontend & design |
| `video-media` | Video & media |
| `seo-marketing` | SEO & marketing |
| `ecommerce-salla` | E-commerce & Salla |
| `documents` | Documents |
| `memory-knowledge` | Memory & knowledge |
| `research-tools` | Research & tools |
| `testing` | Testing |
| `security` | Security |
| `backend-data` | Backend & data |
| `other` | Other |

## Tags

| Tag | Meaning |
|---|---|
| `made` | I wrote it |
| `use` | Installed in my daily setup |
| `recommend` | Worth knowing, even if I don't use it daily |
| `favorite` | Pinned to the top |

## Skills installed but not listed yet

```bash
npm run import:lock
```

Reads `~/.agents/.skill-lock.json` (the `npx skills` record of installed skills) and adds the ones `catalog.yaml` does not list yet, tagged `use` (`made, use` for my own repos) with a category guessed from the description. Add `-- --dry-run` to preview, then adjust entries with `npm run add -- <spec> --update ...`.

## After adding

Build locally to check:

```bash
npm run build
npm run preview
```

Or just push to `main`: Cloudflare Workers Builds rebuilds and deploys the site, and CI on GitHub checks the build without deploying. Details in [deploy.md](deploy.md).

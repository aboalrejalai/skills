# النشر على Cloudflare | Deploying to Cloudflare

[العربية](#العربية) · [English](#english)

---

<div dir="rtl">

## العربية

الموقع ثابت بالكامل (Astro `output: 'static'`) ويُخدَم من **Cloudflare Workers Static Assets** بلا أي كود خادم. الإعدادات كلها في:

| الملف | دوره |
|---|---|
| `wrangler.jsonc` | اسم الـ Worker (`aboalrejal-skills`)، مجلد الأصول `./dist`، صفحة 404، الشرطة المائلة في آخر الرابط، روابط المعاينة |
| `public/_headers` | ترويسات الأمان (CSP وغيرها) والتخزين المؤقت وتنزيل ملفات ZIP |
| `public/_redirects` | تحويل روابط الموقع القديم |
| `public/.assetsignore` | ملفات لا تُرفع (`*.map` و`.DS_Store`) |
| `.github/workflows/ci.yml` | فحص وبناء على GitHub فقط، **بلا نشر** |

يَنسخ Astro مجلد `public/` إلى `dist/`، ولذلك تصل `_headers` و`_redirects` و`.assetsignore` إلى جذر مجلد الأصول حيث يقرؤها Wrangler.

### أ) أول نشر من الحاسوب

```bash
npx wrangler login          # يفتح المتصفح لتسجيل الدخول إلى Cloudflare
npx wrangler whoami         # تأكد من الحساب
npm run deploy              # = npm run build ثم wrangler deploy
```

- `npm run build` يشغّل `catalog` (يستنسخ مستودعات المهارات المذكورة في `catalog.yaml`) ثم `zips` ثم `astro build`.
- في أول نشر قد يطلب Wrangler تسجيل نطاق فرعي `workers.dev`؛ وافق عليه. سيظهر الموقع على `https://aboalrejal-skills.<subdomain>.workers.dev`.
- لتصحيح روابط الـ sitemap والروابط القانونية ضع عنوان الموقع وقت البناء:
  `SITE_URL=https://aboalrejal-skills.<subdomain>.workers.dev npm run deploy`
- معاينة محلية قبل النشر: `npm run build` ثم `npm run preview` (يشغّل `wrangler dev` على `http://localhost:8787`).

### ب) ربط مستودع GitHub بـ Workers Builds

ادمج فرع `rebuild/curated-catalog` في `main` أولًا، فـ `main` الحالي ما زال يحمل الموقع القديم ولن يُبنى.

1. لوحة Cloudflare ← **Workers & Pages** ← **Create** ← **Import a repository**.
   - إن كنت نشرت من الحاسوب في الخطوة (أ) فالـ Worker موجود مسبقًا: افتحه ← **Settings** ← **Builds** ← **Connect** بدلًا من إنشاء واحد جديد.
2. اختر GitHub وامنح تطبيق Cloudflare صلاحية المستودع `aboalrejalai/skills`.
3. الإعدادات:

| الحقل | القيمة |
|---|---|
| Project / Worker name | `aboalrejal-skills` (يجب أن يطابق `name` في `wrangler.jsonc` حرفيًا) |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Root directory | `/` |

4. **Build variables** (متغيرات وقت البناء):
   - `SITE_URL` = عنوان الموقع النهائي، مثل `https://skills.aboalrejal.com` (أو رابط workers.dev إلى أن يُربط النطاق).
   - `NODE_VERSION` = `22` (اختياري، ليطابق CI).
5. احفظ وشغّل أول بناء من تبويب **Deployments**.

لا تُضف أي مفاتيح Cloudflare إلى GitHub: النشر يتم من جهة Cloudflare، وملف CI لا ينشر شيئًا.

### ج) النطاق المخصص

1. يجب أن تكون منطقة النطاق (`aboalrejal.com`) مُدارة على Cloudflare (خوادم الأسماء تشير إلى Cloudflare). إن كان DNS عند مزوّد آخر فانقل خوادم الأسماء أولًا، وإلا فابقَ على رابط workers.dev.
2. احذف سجل `CNAME` القديم لـ `skills` الذي كان يشير إلى GitHub Pages، وإلا سيرفض Cloudflare الإضافة.
3. الـ Worker ← **Settings** ← **Domains & Routes** ← **Add** ← **Custom domain** ← `skills.aboalrejal.com`. ينشئ Cloudflare سجل DNS وشهادة TLS تلقائيًا.
4. حدّث `SITE_URL` في Build variables إلى النطاق الجديد ثم أعد النشر (Retry deployment) لتُحدَّث روابط الـ sitemap.
5. اختياري: بعد أن يعمل النطاق يمكن جعل `"workers_dev": false` في `wrangler.jsonc` حتى لا تُفهرس نسخة مكررة.

### د) ماذا يحدث عند كل دفع (push)

- **دفع إلى `main`**: يستنسخ Workers Builds المستودع، يثبّت الحزم، يشغّل `npm run build` ثم `npx wrangler deploy`، فتصبح النسخة الجديدة هي الحية فورًا.
- **دفع إلى فرع آخر أو Pull Request**: يشغّل `npx wrangler versions upload` فيرفع نسخة دون تحويل الزيارات إليها، مع رابط معاينة خاص بها (`<version>-aboalrejal-skills.<subdomain>.workers.dev`، مفعّل بـ `"preview_urls": true`) ويظهر في صفحة الـ PR.
- **بالتوازي على GitHub Actions** (`ci.yml`): `astro check`، والبناء، والتأكد من وجود `dist/index.html` و`dist/en/index.html` وصفحة مهارة واحدة على الأقل وملف ZIP واحد على الأقل، وأن عدد الملفات ≤ 19,000 ولا ملف أكبر من 25 MiB، وأن كل `skills/*/SKILL.md` اسمه في الـ frontmatter يطابق اسم مجلده وله وصف، ثم `wrangler deploy --dry-run`.
- ملاحظة: فشل CI **لا يمنع** Workers Builds من النشر. لمنع ذلك فعّل حماية فرع `main` واجعل فحص CI إلزاميًا، وادمج عبر Pull Request فقط.

### هـ) حل المشكلات

| المشكلة | السبب والحل |
|---|---|
| فشل البناء: الاسم لا يطابق | اسم الـ Worker في اللوحة يختلف عن `name` في `wrangler.jsonc`. وحّدهما على `aboalrejal-skills`. |
| تجاوز حد الملفات | الخطة المجانية تسمح بـ 20,000 ملف لكل نسخة و25 MiB لكل ملف. CI يفشل عند 19,000. قلّل المهارات أو الملفات المنسوخة، أو انتقل إلى خطة مدفوعة. |
| 404 على رابط صحيح | الروابط تنتهي بـ `/`؛ `‎/skills/x` يُحوَّل 307 إلى `‎/skills/x/` تلقائيًا. تأكد أن المهارة موجودة في `catalog.yaml` وأن البناء أنتجها. `‎/skills/` نفسه يُحوَّل إلى الرئيسية عبر `_redirects`. |
| صفحة 404 العربية تظهر تحت `‎/en/` | Cloudflare يبحث عن `en/404.html` ثم `404.html`. إن بُنيت الصفحة الإنجليزية كـ `en/404/index.html` فلن تُستخدم. |
| التعديل لا يظهر | صفحات HTML لا تُخزَّن (`max-age=0, must-revalidate`) فتظهر فورًا. ملفات `/_astro/*` مخزنة سنة لكن أسماءها تتغير مع كل بناء. ملفات ZIP مخزنة ساعة واحدة. على النطاق المخصص يمكن: Caching ← **Purge Everything**. |
| خطأ CSP في Console | المتصفح يحجب مصدرًا خارجيًا. أضف المصدر إلى السطر المناسب في `public/_headers` (مثل `img-src` أو `script-src`). |
| فشل `npm run build` عند الاستنساخ | مستودع في `catalog.yaml` صار خاصًا أو غُيّر اسمه أو حُذف. صحّح المدخل. |
| `wrangler dev` يفشل بخطأ workerd | انظر الملاحظة أدناه. |

**ملاحظة workerd:** في بيئة التطوير هذه حُجب سكربت `postinstall` الخاص بحزمة `workerd` بسياسة npm لسكربتات التثبيت. عند التحقق (أكتوبر 2026): `npx wrangler --version` يعطي `4.151.0`، و`npx wrangler deploy --dry-run` يعمل، و`wrangler dev` يعمل أيضًا لأن الملف التنفيذي يأتي جاهزًا من الحزمة الاختيارية `@cloudflare/workerd-darwin-arm64` (`workerd 2026-10-12`). إن فشل `wrangler dev` على جهاز آخر بسبب workerd فاسمح بالسكربت: `npm install-scripts approve workerd` ثم أعد التثبيت.

</div>

---

## English

The site is fully static (Astro `output: 'static'`) and served by **Cloudflare Workers Static Assets**, with no server code. Configuration lives in:

| File | Role |
|---|---|
| `wrangler.jsonc` | Worker name (`aboalrejal-skills`), assets dir `./dist`, 404 page, trailing slashes, preview URLs |
| `public/_headers` | Security headers (CSP and others), caching, ZIP downloads |
| `public/_redirects` | Redirects for old-site URLs |
| `public/.assetsignore` | Files that are never uploaded (`*.map`, `.DS_Store`) |
| `.github/workflows/ci.yml` | Check and build on GitHub only, **no deploy** |

Astro copies `public/` into `dist/`, so `_headers`, `_redirects` and `.assetsignore` end up at the root of the assets directory, where Wrangler reads them.

### a) First deploy from the laptop

```bash
npx wrangler login          # opens the browser to sign in to Cloudflare
npx wrangler whoami         # confirm the account
npm run deploy              # = npm run build, then wrangler deploy
```

- `npm run build` runs `catalog` (clones the skill repos listed in `catalog.yaml`), then `zips`, then `astro build`.
- On the first deploy Wrangler may ask you to register a `workers.dev` subdomain; accept. The site appears at `https://aboalrejal-skills.<subdomain>.workers.dev`.
- For correct sitemap and canonical URLs, pass the site URL at build time:
  `SITE_URL=https://aboalrejal-skills.<subdomain>.workers.dev npm run deploy`
- Local preview before deploying: `npm run build`, then `npm run preview` (runs `wrangler dev` on `http://localhost:8787`).

### b) Connect the GitHub repo with Workers Builds

Merge `rebuild/curated-catalog` into `main` first: the current `main` still holds the old site and will not build.

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository**.
   - If you already deployed from the laptop in step (a), the Worker exists: open it → **Settings** → **Builds** → **Connect** instead of creating a new one.
2. Pick GitHub and grant the Cloudflare app access to `aboalrejalai/skills`.
3. Settings:

| Field | Value |
|---|---|
| Project / Worker name | `aboalrejal-skills` (must equal `name` in `wrangler.jsonc` exactly) |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Root directory | `/` |

4. **Build variables**:
   - `SITE_URL` = the final site URL, e.g. `https://skills.aboalrejal.com` (or the workers.dev URL until the domain is attached).
   - `NODE_VERSION` = `22` (optional, matches CI).
5. Save and run the first build from the **Deployments** tab.

Do not add any Cloudflare tokens to GitHub: deploys run on the Cloudflare side, and the CI workflow never deploys.

### c) Custom domain

1. The zone (`aboalrejal.com`) must be on Cloudflare (nameservers pointing to Cloudflare). If DNS is with another provider, move the nameservers first, or stay on the workers.dev URL.
2. Delete the old `skills` `CNAME` record that pointed to GitHub Pages, or Cloudflare will refuse to add the domain.
3. Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → `skills.aboalrejal.com`. Cloudflare creates the DNS record and TLS certificate.
4. Update `SITE_URL` in Build variables to the new domain and redeploy (Retry deployment) so sitemap URLs update.
5. Optional: once the domain works, set `"workers_dev": false` in `wrangler.jsonc` so a duplicate copy is not indexed.

### d) What happens on each push

- **Push to `main`**: Workers Builds clones the repo, installs packages, runs `npm run build`, then `npx wrangler deploy`. The new version goes live immediately.
- **Push to another branch or a pull request**: runs `npx wrangler versions upload`, which uploads a version without sending traffic to it and gives it its own preview URL (`<version>-aboalrejal-skills.<subdomain>.workers.dev`, enabled by `"preview_urls": true`), shown on the PR.
- **In parallel on GitHub Actions** (`ci.yml`): `astro check`; the build; checks that `dist/index.html`, `dist/en/index.html`, at least one skill page and at least one ZIP exist, that dist has at most 19,000 files and none over 25 MiB, and that every `skills/*/SKILL.md` has a frontmatter `name` equal to its folder and a description; then `wrangler deploy --dry-run`.
- Note: a failing CI run does **not** stop Workers Builds from deploying. To gate deploys, protect `main`, make the CI check required, and merge only through pull requests.

### e) Troubleshooting

| Problem | Cause and fix |
|---|---|
| Build fails: name mismatch | The Worker name in the dashboard differs from `name` in `wrangler.jsonc`. Make both `aboalrejal-skills`. |
| File limit exceeded | The free plan allows 20,000 files per version and 25 MiB per file. CI fails at 19,000. Trim skills or copied files, or move to a paid plan. |
| 404 on a valid URL | URLs end in `/`; `/skills/x` is redirected 307 to `/skills/x/` automatically. Check that the skill is in `catalog.yaml` and that the build produced it. `/skills/` itself redirects to the home page via `_redirects`. |
| Arabic 404 page shows under `/en/` | Cloudflare looks for `en/404.html`, then `404.html`. An English page built as `en/404/index.html` is not used. |
| A change does not show up | HTML is not cached (`max-age=0, must-revalidate`), so it updates at once. `/_astro/*` is cached for a year, but its file names change on every build. ZIPs are cached for one hour. On the custom domain you can use Caching → **Purge Everything**. |
| CSP error in the console | The browser blocked an outside source. Add it to the matching directive in `public/_headers` (e.g. `img-src` or `script-src`). |
| `npm run build` fails while cloning | A repo in `catalog.yaml` went private, was renamed, or was deleted. Fix the entry. |
| `wrangler dev` fails with a workerd error | See the note below. |

**workerd note:** in this development environment npm's install-scripts policy blocked the `workerd` package's `postinstall` script. Checked in October 2026: `npx wrangler --version` prints `4.151.0`, `npx wrangler deploy --dry-run` works, and `wrangler dev` also works, because the binary ships prebuilt in the optional package `@cloudflare/workerd-darwin-arm64` (`workerd 2026-10-12`). If `wrangler dev` fails on another machine because of workerd, allow the script with `npm install-scripts approve workerd` and reinstall.

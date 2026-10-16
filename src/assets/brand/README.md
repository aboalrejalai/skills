# Brand assets

The mark is Mohammed Abo Alrejal's personal logo mark, copied unchanged from
`~/Desktop/Project/aboalrejal/identity/brand/logo/transparent/` (`mark-green.svg`, `mark-white.svg`).
`mark.svg` is the same path rescaled to a `0 0 100 100` viewBox with `fill="currentColor"`; it is the
single source used by `src/components/Logo.astro`, `public/favicon.svg`, `og.html` and the apple touch icon.

| File | Made from | How |
|---|---|---|
| `src/components/Logo.astro` | `mark.svg` path, inlined | 32px `rounded-xl bg-primary text-primary-foreground` tile + wordmark |
| `public/favicon.svg` | `mark.svg` path, inlined | hand-written; `#1B8354` tile, `#3DAF6E` under `prefers-color-scheme: dark` |
| `public/apple-touch-icon.png` (180x180) | `mark.svg` | `render.mjs` (sharp) |
| `public/og.png` (1200x630) | `og.html` | `render.mjs` (headless Chrome screenshot, then sharp palette PNG) |

## Regenerate

```bash
node src/assets/brand/render.mjs
```

Needs `sharp` (comes with Astro) and Google Chrome or Chromium (`CHROME=/path/to/chrome` if it is not in
the default macOS or Linux location). The OG image goes through a real browser because librsvg does not
shape Arabic reliably. `og.html` loads IBM Plex Sans Arabic from `node_modules/@fontsource/ibm-plex-sans-arabic`,
so run `npm install` first. Open `og.html` in a browser to preview edits before rendering.
After editing the mark path, update it in `mark.svg`, `Logo.astro`, `public/favicon.svg` and `og.html`.

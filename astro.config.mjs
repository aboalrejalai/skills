import { rename, rmdir } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Astro writes only the root /404 as 404.html; nested ones land at <dir>/404/index.html.
// Cloudflare's not_found_handling "404-page" looks for <dir>/404.html, so move them after build.
const nested404 = (locales) => ({
  name: 'nested-404-html',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      for (const l of locales) {
        await rename(new URL(`${l}/404/index.html`, dir), new URL(`${l}/404.html`, dir));
        await rmdir(new URL(`${l}/404/`, dir));
      }
    },
  },
});

export default defineConfig({
  // Set SITE_URL in Workers Builds once the production domain is known.
  site: process.env.SITE_URL || 'http://localhost:4321',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      filter: (page) => !/\/404\/?$/.test(new URL(page).pathname),
      i18n: { defaultLocale: 'ar', locales: { ar: 'ar', en: 'en' } },
    }),
    nested404(['en']),
  ],
  vite: { plugins: [tailwindcss()] },
});

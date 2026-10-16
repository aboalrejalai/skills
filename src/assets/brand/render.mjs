// Regenerates the raster brand files from the sources in this folder:
//   public/og.png              <- og.html, screenshotted by headless Chrome (real Arabic shaping), then palette-compressed by sharp
//   public/apple-touch-icon.png <- mark.svg on a #1B8354 square, rasterized by sharp (no text, so librsvg is fine)
// Usage (from the repo root): node src/assets/brand/render.mjs
// Chrome is found at $CHROME, then the usual macOS / Linux paths.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const out = (p) => join(root, 'public', p);

function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Chrome not found; set CHROME=/path/to/chrome');
  return found;
}

async function renderOg() {
  const tmp = mkdtempSync(join(tmpdir(), 'og-'));
  const shot = join(tmp, 'og.png');
  try {
    execFileSync(findChrome(), [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--allow-file-access-from-files',
      '--virtual-time-budget=3000', // let the @font-face files load before the capture
      '--window-size=1200,630',
      `--screenshot=${shot}`,
      pathToFileURL(join(here, 'og.html')).href,
    ], { stdio: 'pipe' });
    const meta = await sharp(shot).metadata();
    if (meta.width !== 1200 || meta.height !== 630) throw new Error(`og screenshot is ${meta.width}x${meta.height}, expected 1200x630`);
    await sharp(shot).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(out('og.png'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function renderAppleTouchIcon() {
  // Full-bleed square: iOS applies its own rounded mask.
  const path = readFileSync(join(here, 'mark.svg'), 'utf8').match(/ d="([^"]+)"/)[1];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
    <rect width="180" height="180" fill="#1B8354"/>
    <svg x="40" y="40" width="100" height="100" viewBox="0 0 100 100"><path fill="#fff" fill-rule="evenodd" d="${path}"/></svg>
  </svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out('apple-touch-icon.png'));
}

await renderOg();
await renderAppleTouchIcon();
for (const f of ['og.png', 'apple-touch-icon.png']) console.log(`${f}  ${(statSync(out(f)).size / 1024).toFixed(1)} KB`);

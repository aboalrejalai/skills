#!/usr/bin/env python3
"""Crop logo exports into tight transparent SVGs, a white variant of each, and transparent PNGs.

    python3 prep_logos.py SOURCE_DIR OUT_DIR [--png-dir DIR] [--png-size 1200]
                          [--pad 0.008] [--recolor HEX] [--skip GLOB ...]

Made for Canva-style exports: a square canvas (often 1000x1000) whose first shapes are
full-bleed backgrounds, with the logo somewhere inside. Logos exported tight from
Illustrator or Figma need no cropping; use them as they are. For every SOURCE_DIR/*.svg not
matched by --skip (default: *white-on*, i.e. the owner's reversed copies, which this
script regenerates), it:

  1. removes the background: the leading run of painted shapes that each paint the whole
     canvas in one solid colour (box over 97% of the canvas and every point of a 9x9 probe
     grid inside the fill, measured in headless Chrome, transforms included). The run is
     removed only when ink remains after it and the topmost background's colour differs
     from every colour of that ink; otherwise the shapes are kept (they are part of the
     logo, e.g. a frame) and a warning says so;
  2. measures the ink box of what is left (shapes inside <defs>/<clipPath>/<mask> ignored)
     and sets the viewBox to it plus --pad (fraction of the long side, default 0.8%);
  3. writes OUT_DIR/<name>.svg with the original colours, and a white variant with every
     fill and stroke turned white (or only those equal to --recolor). The white variant
     is <name> with its colour word swapped for "white" ("logo-stacked-green" ->
     "logo-stacked-white") when the name ends in one, else <name>-white ("mark" ->
     "mark-white"). Two inputs that would write the same file stop the run before anything
     is written;
  4. with --png-dir, renders each written SVG to a transparent PNG, --png-size px on its
     long side.

It prints one line per file with the removed-background count and the new viewBox, and
warns when nothing was removed and the ink still fills the canvas (a pre-cropped file, or a
background the script did not recognise: look at the output before using it). Each SVG is
measured in its own page, so clipPath ids that repeat across files cannot collide.
"""
import argparse
import fnmatch
import html
import json
import re
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chrome import dump_dom, find_chrome, run  # noqa: E402

MEASURE = r"""
<pre id="out"></pre><script>
const svg = document.querySelector('svg');
let vb = svg.viewBox.baseVal;
if (!vb || !vb.width) {
  svg.setAttribute('viewBox', `0 0 ${svg.width.baseVal.value} ${svg.height.baseVal.value}`);
  vb = svg.viewBox.baseVal;
}
const canvas = vb.width * vb.height;
const toRoot = (el) => svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
const box = (el) => {
  const b = el.getBBox(), m = toRoot(el);
  const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
    .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const hidden = (el) => el.closest('defs,clipPath,mask,symbol,pattern,marker');
const cs = (el) => getComputedStyle(el);
const colour = (v) => (v || '').trim().toLowerCase();
const isPainted = (el) => {
  if (hidden(el)) return false;
  const s = cs(el);
  const fill = colour(s.fill) !== 'none' && Number(s.fillOpacity) > 0;
  const stroke = colour(s.stroke) !== 'none' && Number(s.strokeOpacity) > 0 && parseFloat(s.strokeWidth) > 0;
  return el.tagName === 'image' || el.tagName === 'use' || fill || stroke;
};
const painted = [...svg.querySelectorAll('rect,path,polygon,polyline,circle,ellipse,line,image,use,text')].filter(isPainted);
const probe = [];
for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++)
  probe.push([vb.x + (i + .5) / 9 * vb.width, vb.y + (j + .5) / 9 * vb.height]);
const fillsCanvas = (el) => {
  if (!(el instanceof SVGGeometryElement) || el.tagName === 'text') return false;
  const s = cs(el);
  if (!/^(rgb|#)/.test(colour(s.fill)) || Number(s.fillOpacity) < .99 || Number(s.opacity) < .99) return false;
  const [x0, y0, x1, y1] = box(el);
  if ((x1 - x0) * (y1 - y0) < 0.97 * canvas) return false;
  const inv = toRoot(el).inverse();
  return probe.every(([x, y]) => el.isPointInFill(new DOMPoint(x, y).matrixTransform(inv)));
};
let run = 0;
while (run < painted.length && fillsCanvas(painted[run])) run++;
let removed = 0, kept = '';
if (run) {
  const rest = painted.slice(run);
  const top = colour(cs(painted[run - 1]).fill);
  const inkColours = new Set(rest.flatMap((el) => [colour(cs(el).fill), colour(cs(el).stroke)]).filter((c) => c && c !== 'none'));
  if (!rest.length) kept = 'the shape that fills the canvas is all there is; kept it';
  else if (inkColours.has(top)) kept = `the shape that fills the canvas has the logo's own colour (${top}); kept it as part of the logo`;
  else { painted.slice(0, run).forEach((el) => el.remove()); removed = run; }
}
let ink = null;
for (const el of svg.querySelectorAll('path,rect,polygon,polyline,circle,ellipse,line,image,use,text')) {
  if (hidden(el)) continue;
  const b = box(el);
  if (b[2] - b[0] <= 0 && b[3] - b[1] <= 0) continue;
  ink = ink ? [Math.min(ink[0], b[0]), Math.min(ink[1], b[1]), Math.max(ink[2], b[2]), Math.max(ink[3], b[3])] : b;
}
const out = { removed, kept, canvas: [vb.x, vb.y, vb.width, vb.height], ink, svg: new XMLSerializer().serializeToString(svg) };
document.getElementById('out').textContent = JSON.stringify(out);
</script>"""


def measure(chrome, path):
    page = "<!doctype html><meta charset=utf-8><body style=margin:0>" + path.read_text(encoding="utf-8") + MEASURE
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(page)
    dom = dump_dom(chrome, Path(f.name).as_uri(), budget=3000)
    Path(f.name).unlink(missing_ok=True)
    found = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    if not found or not found.group(1):
        sys.exit(f"prep_logos.py: Chrome could not measure {path}")
    return json.loads(html.unescape(found.group(1)))


def tighten(svg, vb):
    w, h = round(vb[2]), round(vb[3])
    head = re.match(r"<svg\b[^>]*>", svg).group(0)
    new = re.sub(r'\s(width|height|viewBox)="[^"]*"', "", head)
    new = new[:-1].rstrip("/") + f' width="{w}" height="{h}" viewBox="{" ".join(f"{v:g}" for v in vb)}">'
    return svg.replace(head, new, 1)


def whiten(svg, only=None):
    def swap(m):
        value = m.group(2)
        low = value.strip().lower()
        if low in ("none", "transparent") or low.startswith("url("):
            return m.group(0)
        if only and low != only:
            return m.group(0)
        return f'{m.group(1)}"#ffffff"'
    svg = re.sub(r'(\s(?:fill|stroke)=)"([^"]*)"', swap, svg)
    svg = re.sub(r"((?:fill|stroke)\s*:\s*)(#[0-9a-fA-F]{3,8}|rgb\([^)]*\)|[a-z]+)",
                 lambda m: m.group(0) if m.group(2).lower() in ("none", "transparent") or (only and m.group(2).lower() != only)
                 else f"{m.group(1)}#ffffff", svg)
    return svg


def render_png(chrome, svg_path, png_path, size):
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg_path.read_text(encoding="utf-8")).group(1).split()]
    scale = size / max(vb[2], vb[3])
    w, h = round(vb[2] * scale), round(vb[3] * scale)
    page = (f"<!doctype html><style>html,body{{margin:0;background:transparent}}"
            f"img{{display:block;width:{w}px;height:{h}px}}</style><img src=\"{svg_path.resolve().as_uri()}\">")
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(page)
    run(chrome, "--default-background-color=00000000", f"--window-size={w},{h}",
        f"--screenshot={png_path}", url=Path(f.name).as_uri())
    Path(f.name).unlink(missing_ok=True)
    return w, h


COLOUR_WORDS = {"green", "black", "dark", "color", "colour", "colored", "coloured", "fullcolor", "fullcolour",
                "primary", "brand", "blue", "navy", "red", "gold", "orange", "purple", "teal", "grey", "gray",
                "ink", "rgb", "cmyk"}


def white_name(stem):
    """logo-stacked-green -> logo-stacked-white; mark -> mark-white."""
    head, _, last = stem.rpartition("-")
    return f"{head}-white" if head and last.lower() in COLOUR_WORDS else f"{stem}-white"


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("source", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--png-dir", type=Path)
    ap.add_argument("--png-size", type=int, default=1200)
    ap.add_argument("--pad", type=float, default=0.008)
    ap.add_argument("--recolor", help="whiten only this colour (hex); default: every fill and stroke")
    ap.add_argument("--skip", nargs="*", default=["*white-on*"])
    args = ap.parse_args()

    chrome = find_chrome()
    if not chrome:
        sys.exit("prep_logos.py: no Chrome-family browser found")
    files = sorted(p for p in args.source.glob("*.svg") if not any(fnmatch.fnmatch(p.name, g) for g in args.skip))
    if not files:
        sys.exit(f"prep_logos.py: no SVG in {args.source} (ask the owner for SVG exports; Canva: Share > Download > SVG)")
    args.out.mkdir(parents=True, exist_ok=True)
    if args.png_dir:
        args.png_dir.mkdir(parents=True, exist_ok=True)

    claims = {}
    for p in files:
        for name in (p.stem, white_name(p.stem)):
            claims.setdefault(name, []).append(p.name)
    clashes = {n: srcs for n, srcs in claims.items() if len(srcs) > 1}
    if clashes:
        sys.exit("prep_logos.py: two inputs would write the same file; rename one or --skip it:\n" + "\n".join(
            f"  {n}.svg <- {', '.join(srcs)}" for n, srcs in sorted(clashes.items())))

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda p: (p, measure(chrome, p)), files))

    written = []
    for path, r in results:
        if not r["ink"]:
            sys.exit(f"prep_logos.py: {path.name}: no painted shape found")
        if r["kept"]:
            print(f"warning: {path.name}: {r['kept']}", file=sys.stderr)
        x0, y0, x1, y1 = r["ink"]
        pad = max(x1 - x0, y1 - y0) * args.pad
        vb = [round(v, 3) for v in (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)]
        tight = tighten(r["svg"], vb)
        outputs = {path.stem: tight, white_name(path.stem): whiten(tight, args.recolor.lower() if args.recolor else None)}
        cw, ch = r["canvas"][2], r["canvas"][3]
        if not r["removed"] and (x1 - x0) * (y1 - y0) >= 0.97 * cw * ch:
            print(f"warning: {path.name}: no background removed and the ink fills the canvas (already cropped, or a "
                  "background this script does not recognise); look at the output", file=sys.stderr)
        for name, svg in outputs.items():
            target = args.out / f"{name}.svg"
            target.write_text(svg, encoding="utf-8")
            written.append(target)
        print(f"{path.name}: removed {r['removed']} background shape(s); viewBox {' '.join(f'{v:g}' for v in vb)}"
              f" -> {', '.join(f'{n}.svg' for n in outputs)}")

    if args.png_dir:
        with ThreadPoolExecutor(max_workers=4) as pool:
            sizes = list(pool.map(lambda t: render_png(chrome, t, args.png_dir / f"{t.stem}.png", args.png_size), written))
        for t, (w, h) in zip(written, sizes):
            print(f"png: {args.png_dir / (t.stem + '.png')} ({w}x{h})")


if __name__ == "__main__":
    main()

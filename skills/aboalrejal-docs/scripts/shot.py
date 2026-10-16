#!/usr/bin/env python3
"""Screenshot every A4 page of a built document on Mohammed Abo Alrejal's paper, one PNG per page, for review.

    python3 shot.py document.html [-o out_dir] [--scale 1]

The page renders as it prints: no toolbar, no grey gaps or shadows between pages
(SCREEN_CSS, shared with docx_from_page.py). The pages are counted after the
template has paginated, then each one is captured whole, footer included, as
<out_dir>/<name>-p1.png … -pN.png. Default out_dir: a new temporary folder.
"""
import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]
# Print look on screen. #pages and .page carry gaps for on-screen reading; without
# removing them each page sits lower than the last and the final footer falls off the image.
SCREEN_CSS = """html, body { margin: 0; padding: 0; background: #fff; }
.toolbar { display: none; }
#pages { padding: 0; }
.page { margin: 0; box-shadow: none; }"""
PAGE_W, PAGE_H = 794, 1123  # A4 at 96 dpi


def fail(message):
    sys.exit(f"shot.py: {message}")


def find_chrome():
    for path in CHROME_PATHS:
        if Path(path).exists():
            return path
    for name in ("google-chrome", "chromium", "chromium-browser", "chrome"):
        if shutil.which(name):
            return shutil.which(name)
    return None


def with_css(html, css):
    if "</head>" not in html:
        fail("not an HTML document")
    return html.replace("</head>", f"<style>{css}</style></head>", 1)


def chrome_run(chrome, args, url, capture=False):
    return subprocess.run(
        [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
         "--virtual-time-budget=8000", *args, url],
        check=True, stdout=subprocess.PIPE if capture else subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def shoot(html_path, out_dir, scale=1):
    """Write one PNG per page into out_dir and return their paths."""
    chrome = find_chrome() or fail("no Chrome-family browser found")
    html = html_path.read_text(encoding="utf-8")
    tmp = Path(tempfile.mkdtemp(prefix="ma-shot-"))
    try:
        page = tmp / "page.html"
        page.write_text(with_css(html, SCREEN_CSS), encoding="utf-8")
        dom = chrome_run(chrome, ["--dump-dom"], page.resolve().as_uri(), capture=True).stdout.decode("utf-8", "replace")
        pages = dom.split('<div id="pages">', 1)[-1].split("<script>", 1)[0]  # rendered pages, not the template's source
        count = len(re.findall(r'<section class="page[ "]', pages))
        if not count:
            fail("no pages rendered")
        out_dir.mkdir(parents=True, exist_ok=True)
        shots = []
        for k in range(count):
            # Slide the stack up one A4 height per page; a transform leaves the template's own measuring untouched.
            page.write_text(with_css(html, SCREEN_CSS + f"\n#pages {{ transform: translateY(-{k * 297}mm); }}"), encoding="utf-8")
            png = out_dir / f"{html_path.stem}-p{k + 1}.png"
            chrome_run(chrome, [f"--force-device-scale-factor={scale}", f"--window-size={PAGE_W},{PAGE_H}",
                                f"--screenshot={png}"], page.resolve().as_uri())
            if not png.is_file():
                fail(f"Chrome produced no screenshot for page {k + 1}")
            shots.append(png)
        return shots
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("html", type=Path, help="built document (HTML)")
    parser.add_argument("-o", "--out", type=Path, help="folder for the PNGs (default: a new temporary folder)")
    parser.add_argument("--scale", type=float, default=1, help="device scale factor (2 or 3 for a close look)")
    args = parser.parse_args()
    if not args.html.is_file():
        fail(f"not found: {args.html}")
    out = args.out or Path(tempfile.mkdtemp(prefix="ma-pages-"))
    shots = shoot(args.html, out, args.scale)
    print(f"{len(shots)} page(s):")
    for png in shots:
        print(f"  {png}")


if __name__ == "__main__":
    main()

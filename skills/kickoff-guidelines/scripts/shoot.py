#!/usr/bin/env python3
"""Screenshot every slide of a guidelines deck, and lay them out on a contact sheet.

    python3 shoot.py guidelines.html OUT_DIR [--sheet sheet.png] [--cols 4] [--only 3,7]

Writes OUT_DIR/slide-01.png ... one 1440x810 PNG per `.slide` element, using headless
Chrome. Works on any deck whose slides are `.slide` elements of 1440x810 (the decks this
skill builds, and the Tawa Najd original): each shot loads a temporary copy of the page
with a <base href> back to the deck's folder (so relative assets still resolve) and a
script that removes every slide but one. --sheet also writes a contact sheet of all
slides with their page numbers, for a one-glance review.
"""
import argparse
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chrome import find_chrome  # noqa: E402

W, H = 1440, 810


def count_slides(chrome, page):
    """Count the .slide elements the deck renders (they may be built by script)."""
    probe = page.read_text(encoding="utf-8").replace(
        "</body>", "<script>document.title='SLIDES:'+document.querySelectorAll('.slide').length</script></body>", 1)
    tmp = write_tmp(probe)
    dom = subprocess.run([chrome, "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
                          "--virtual-time-budget=4000", "--dump-dom", tmp.as_uri()],
                         capture_output=True, text=True).stdout
    found = re.search(r"SLIDES:(\d+)", dom)
    return int(found.group(1)) if found else 0


def write_tmp(text):
    f = tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8")
    f.write(text)
    f.close()
    return Path(f.name)


def isolated(page, n):
    """The deck's HTML with a <base> to its folder and only slide n kept."""
    src = page.read_text(encoding="utf-8")
    base = f'<base href="{page.parent.resolve().as_uri()}/">'
    src = re.sub(r"<head([^>]*)>", lambda m: f"<head{m.group(1)}>{base}", src, count=1)
    keep = f"""<script>
document.querySelectorAll('.slide').forEach((s, i) => {{ if (i !== {n - 1}) s.remove(); else s.style.margin = '0'; }});
document.documentElement.style.background = document.body.style.background = '#fff';
</script></body>"""
    return src.replace("</body>", keep, 1)


def shoot(chrome, page, n, out):
    tmp = write_tmp(isolated(page, n))
    subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--allow-file-access-from-files", f"--window-size={W},{H}",
                    "--virtual-time-budget=8000", f"--screenshot={out}", tmp.as_uri()],
                   capture_output=True)
    tmp.unlink(missing_ok=True)
    return out


def contact_sheet(chrome, shots, sheet, cols):
    tw = 460
    th = round(tw * H / W)
    cells = "".join(
        f'<figure><img src="{p.resolve().as_uri()}"><figcaption>{i:02d}</figcaption></figure>'
        for i, p in shots)
    rows = -(-len(shots) // cols)
    width = cols * (tw + 16) + 16
    height = rows * (th + 40) + 16
    page = f"""<!doctype html><meta charset="utf-8"><style>
body {{ margin: 0; padding: 8px; background: #e4e7e5; font: 600 14px/1 -apple-system, sans-serif; }}
main {{ display: grid; grid-template-columns: repeat({cols}, {tw}px); gap: 8px 16px; padding: 8px; }}
figure {{ margin: 0; }} img {{ display: block; width: {tw}px; height: {th}px; box-shadow: 0 0 0 1px #c5cbc7; }}
figcaption {{ padding: 6px 0 10px; color: #384250; }}
</style><main>{cells}</main>"""
    tmp = write_tmp(page)
    subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--allow-file-access-from-files", f"--window-size={width},{height}",
                    "--virtual-time-budget=3000", f"--screenshot={sheet}", tmp.as_uri()],
                   capture_output=True)
    tmp.unlink(missing_ok=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("deck", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--sheet", type=Path, help="also write a contact sheet PNG")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--only", help="comma-separated slide numbers to shoot")
    args = ap.parse_args()

    chrome = find_chrome()
    if not chrome:
        sys.exit("shoot.py: no Chrome-family browser found")
    total = count_slides(chrome, args.deck)
    if not total:
        sys.exit(f"shoot.py: no .slide elements rendered in {args.deck}")
    wanted = [int(x) for x in args.only.split(",")] if args.only else range(1, total + 1)
    args.out.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [(n, pool.submit(shoot, chrome, args.deck, n, args.out / f"slide-{n:02d}.png")) for n in wanted]
        shots = [(n, job.result()) for n, job in jobs]
    print(f"slides: {total} rendered, {len(shots)} shot into {args.out}")
    if args.sheet:
        contact_sheet(chrome, shots, args.sheet, args.cols)
        print(f"sheet:  {args.sheet}")


if __name__ == "__main__":
    main()

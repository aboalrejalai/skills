#!/usr/bin/env python3
"""Build one self-contained Tawa Najd document (quote, contract, invoice, letter).

    python3 build.py data.json [-o out.html] [--pdf]

Reads the document data, embeds every image as base64, and injects the data
into assets/template.html. With --pdf it also prints an A4 PDF through
headless Chrome and reports the page count.

"blank": true makes blank stationery (no title strip, no page number, empty
"sections" allowed); "footerRows": [[label, value], ...] adds rows such as the
bank details to the last page's footer of that one document.
"""
import argparse
import base64
import json
import mimetypes
import re
import shutil
import subprocess
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "template.html"
SECTION_TYPES = {"heading", "paragraph", "note", "items", "totals", "image", "payments", "table",
                 "parties", "kv", "addressee", "toc", "stats", "cards", "proscons", "plans", "timeline"}
CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]


def fail(message):
    sys.exit(f"build.py: {message}")


def data_uri(src, base):
    if src.startswith("data:"):
        return src
    path = (base / src).expanduser() if not Path(src).expanduser().is_absolute() else Path(src).expanduser()
    if not path.is_file():
        fail(f"image not found: {path}")
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def find_gaps(node, path="$"):
    """Yield (path, value) for every empty or still-placeholder value (⟨…⟩ from the starters)."""
    if isinstance(node, dict):
        for key, value in node.items():
            yield from find_gaps(value, f"{path}.{key}")
    elif isinstance(node, list):
        for i, value in enumerate(node):
            yield from find_gaps(value, f"{path}[{i}]")
    elif isinstance(node, str) and (not node.strip() or "⟨" in node):
        yield path, node


def validate(doc):
    # Ask first, write once: a document with a missing value is never built.
    gaps = list(find_gaps(doc))
    if gaps:
        lines = "\n".join(f"  {path}: {value!r}" for path, value in gaps)
        fail(f"{len(gaps)} value(s) are empty or still placeholders. Ask the owner for them, fill the JSON, then build:\n{lines}")
    if not doc.get("title"):
        fail('"title" is required')
    sections = doc.get("sections")
    if not isinstance(sections, list) or (not sections and not doc.get("blank")):
        fail('"sections" must be a non-empty list (an empty list is allowed only with "blank": true)')
    rows = doc.get("footerRows", [])
    if not isinstance(rows, list) or any(not isinstance(r, list) or len(r) != 2 for r in rows):
        fail('"footerRows" must be a list of [label, value] pairs')
    for i, section in enumerate(sections):
        kind = section.get("type")
        if kind not in SECTION_TYPES:
            fail(f"sections[{i}].type is {kind!r}; expected one of {sorted(SECTION_TYPES)}")
        if kind == "payments":
            total = sum(row["pct"] for row in section["rows"])
            if abs(total - 100) > 0.001:
                print(f"warning: payment percentages add up to {total}, not 100", file=sys.stderr)


def find_chrome():
    for path in CHROME_PATHS:
        if Path(path).exists():
            return path
    for name in ("google-chrome", "chromium", "chromium-browser", "chrome"):
        if shutil.which(name):
            return shutil.which(name)
    return None


def print_pdf(html_path, pdf_path):
    chrome = find_chrome()
    if not chrome:
        fail("no Chrome-family browser found for --pdf; open the HTML and use its print button")
    subprocess.run(
        [chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         "--virtual-time-budget=8000", f"--print-to-pdf={pdf_path}", html_path.resolve().as_uri()],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    pages = len(re.findall(rb"/Type\s*/Page(?![a-zA-Z])", pdf_path.read_bytes()))
    print(f"pdf:  {pdf_path} ({pages} pages)")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("data", type=Path, help="document data (JSON)")
    parser.add_argument("-o", "--out", type=Path, help="output HTML (default: next to the data file)")
    parser.add_argument("--pdf", action="store_true", help="also print an A4 PDF with headless Chrome")
    args = parser.parse_args()

    doc = json.loads(args.data.read_text(encoding="utf-8"))
    validate(doc)
    for section in doc["sections"]:
        if section["type"] == "image":
            section["src"] = data_uri(section["src"], args.data.parent)

    title = doc["title"] + (f" رقم {doc['number']}" if doc.get("number") else "") + " — طوع نجد"
    payload = json.dumps(doc, ensure_ascii=False, indent=2).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("__TITLE__", title.replace("<", "&lt;"), 1).replace("__DOC_JSON__", payload, 1)

    out = args.out or args.data.with_suffix(".html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"html: {out}")
    if args.pdf:
        print_pdf(out, out.with_suffix(".pdf"))


if __name__ == "__main__":
    main()

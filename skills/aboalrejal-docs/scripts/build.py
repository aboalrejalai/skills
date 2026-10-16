#!/usr/bin/env python3
"""Build one self-contained document on Mohammed Abo Alrejal's paper (quote, contract, invoice, letter, minutes, proposal).

    python3 build.py data.json [-o out.html] [--pdf]

Reads the document data, embeds every image as base64, and injects the data
into assets/template.html. With --pdf it also prints an A4 PDF through
headless Chrome, names him as the PDF's author, and reports the page count.
Totals carry no VAT (he is not registered) and amounts must be plain numbers;
the build stops with the reason when they are not.

"blank": true makes blank stationery (no title strip, no page number, empty
"sections" allowed); "footerRows": [[label, value], ...] adds rows such as the
bank details (given by the owner for that paper) to the last page's footer of that one document.
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
AUTHOR = "محمد أبوالرجال"
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
    has_totals = any(s.get("type") == "totals" for s in sections)
    for i, section in enumerate(sections):
        kind = section.get("type")
        if kind not in SECTION_TYPES:
            fail(f"sections[{i}].type is {kind!r}; expected one of {sorted(SECTION_TYPES)}")
        if kind == "totals":
            check_totals(section, f"sections[{i}]")
        if kind == "payments":
            check_payments(section, f"sections[{i}]", has_totals)


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def check_totals(section, where):
    # He is an individual, not VAT-registered (PROFILE.md): a bill never carries VAT.
    rate = section.get("vatRate", 0)
    if rate != 0:
        fail(f'{where}.vatRate is {rate!r}; it must be 0. PROFILE.md: he is not VAT-registered, so no document '
             'carries VAT. If he says he has registered, update PROFILE.md and this check first.')
    amounts = [k for k in ("totalExclVat", "totalInclVat") if k in section]
    if not amounts:
        fail(f"{where} needs totalExclVat (the total as a plain number)")
    for key in amounts:
        if not is_number(section[key]):
            fail(f"{where}.{key} is {section[key]!r}; write it as a plain number such as 45000, not text")


def check_payments(section, where, has_totals):
    rows = section.get("rows") or []
    if not rows:
        fail(f"{where}.rows is empty")
    for j, row in enumerate(rows):
        if not is_number(row.get("pct")):
            fail(f"{where}.rows[{j}].pct is {row.get('pct')!r}; write the share as a plain number such as 40")
    if "total" in section and not is_number(section["total"]):
        fail(f"{where}.total is {section['total']!r}; write it as a plain number such as 45000")
    if "total" not in section and not has_totals:
        fail(f'{where} has no amount to split: add a "totals" section or give the payments a "total"')
    total = sum(row["pct"] for row in rows)
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
    set_pdf_author(pdf_path, AUTHOR)
    print(f"pdf:  {pdf_path} ({pages} pages)")


def pdf_text(value):
    """A PDF text string in UTF-16BE hex, which carries Arabic."""
    return b"<FEFF" + value.encode("utf-16-be").hex().upper().encode() + b">"


def set_pdf_author(pdf_path, author):
    """Name him as the PDF's author through an incremental update.

    Chrome writes no /Author and puts its user-agent string in /Creator, which macOS (Spotlight, Finder)
    shows as the author, so /Creator goes. Chrome's PDFs have a classic xref table and a plain Info
    dictionary; any other structure is left untouched.
    """
    data = pdf_path.read_bytes()
    trailer = re.match(rb"trailer\s*<<(.*?)>>\s*startxref\s*(\d+)\s*%%EOF\s*$", data[data.rfind(b"trailer"):], re.S)
    info = trailer and re.search(rb"/Info\s+(\d+)\s+(\d+)\s+R", trailer.group(1))
    bodies = info and list(re.finditer(rb"(?:^|\n)" + info.group(1) + rb"\s+" + info.group(2) + rb"\s+obj\s*<<(.*?)>>\s*endobj", data, re.S))
    if not bodies:
        print("warning: PDF author not set (unexpected PDF structure)", file=sys.stderr)
        return
    num, gen = info.group(1), info.group(2)
    entries = re.sub(rb"/(?:Author|Creator)\s*(<[^>]*>|\((?:\\.|[^\\)])*\))", b"", bodies[-1].group(1)).strip()
    obj = b"\n" + num + b" " + gen + b" obj\n<</Author " + pdf_text(author) + b"\n" + entries + b">>\nendobj\n"
    rest = re.sub(rb"/Prev\s+\d+", b"", trailer.group(1)).strip()
    # Subsection 0 first: the free-list head keeps strict readers from renumbering objects.
    xref = b"xref\n0 1\n0000000000 65535 f \n" + num + b" 1\n" + b"%010d %05d n \n" % (len(data) + 1, int(gen))
    tail = b"trailer\n<<" + rest + b"\n/Prev " + trailer.group(2) + b">>\nstartxref\n%d\n%%%%EOF\n" % (len(data) + len(obj))
    pdf_path.write_bytes(data + obj + xref + tail)


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

    title = doc["title"] + (f" رقم {doc['number']}" if doc.get("number") else "") + " — محمد أبوالرجال"
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

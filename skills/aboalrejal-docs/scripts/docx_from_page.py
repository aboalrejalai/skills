#!/usr/bin/env python3
"""Turn a built one-page document on Mohammed Abo Alrejal's paper (usually blank stationery) into an editable Word file.

    python3 docx_from_page.py document.html [-o document.docx] [--top 43] [--bottom 40] [--side 15]

The page is rendered with headless Chrome exactly as it prints (A4, 300 dpi) and
placed behind the text of the Word header, so every page of the .docx carries the
letterhead, frame, watermark and footer, while the body stays editable (RTL, Kufam).
The margins (mm) default to the template's body area for a blank sheet without footer rows.
"""
import argparse
import copy
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt

from shot import SCREEN_CSS, find_chrome, with_css  # same print look as the review screenshots

SCALE = 3  # 96 dpi × 3 ≈ 288 dpi


def fail(message):
    sys.exit(f"docx_from_page.py: {message}")


def render_png(html_path, png_path):
    """Screenshot the first A4 page at SCALE× with headless Chrome."""
    chrome = find_chrome() or fail("no Chrome-family browser found")
    tmp = Path(tempfile.mkdtemp(prefix="ma-page-"))
    shot = tmp / "page.html"
    shot.write_text(with_css(html_path.read_text(encoding="utf-8"), SCREEN_CSS), encoding="utf-8")
    subprocess.run(
        [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         f"--force-device-scale-factor={SCALE}", "--window-size=794,1123",
         "--virtual-time-budget=8000", f"--screenshot={png_path}", shot.resolve().as_uri()],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    shutil.rmtree(tmp, ignore_errors=True)
    if not png_path.is_file():
        fail("Chrome produced no screenshot")


def anchor_behind_text(run):
    """Convert the run's inline picture into a page-anchored picture behind the text."""
    inline = run._r.find(".//" + qn("wp:inline"))
    anchor = OxmlElement("wp:anchor")
    for k, v in {"distT": "0", "distB": "0", "distL": "0", "distR": "0", "simplePos": "0",
                 "relativeHeight": "251658240", "behindDoc": "1", "locked": "1",
                 "layoutInCell": "1", "allowOverlap": "1"}.items():
        anchor.set(k, v)
    pos = OxmlElement("wp:simplePos"); pos.set("x", "0"); pos.set("y", "0"); anchor.append(pos)
    for tag in ("wp:positionH", "wp:positionV"):
        p = OxmlElement(tag); p.set("relativeFrom", "page")
        off = OxmlElement("wp:posOffset"); off.text = "0"; p.append(off); anchor.append(p)
    for tag in ("wp:extent", "wp:effectExtent"):
        node = inline.find(qn(tag))
        if node is not None:
            anchor.append(copy.deepcopy(node))
    anchor.append(OxmlElement("wp:wrapNone"))
    for tag in ("wp:docPr", "wp:cNvGraphicFramePr", "a:graphic"):
        node = inline.find(qn(tag))
        if node is not None:
            anchor.append(copy.deepcopy(node))
    inline.getparent().replace(inline, anchor)


# Word rejects a file whose XML children are out of schema order, so insert before the first later sibling.
PPR_AFTER_BIDI = ("w:adjustRightInd", "w:snapToGrid", "w:spacing", "w:ind", "w:contextualSpacing", "w:mirrorIndents",
                  "w:suppressOverlap", "w:jc", "w:textDirection", "w:textAlignment", "w:textboxTightWrap",
                  "w:outlineLvl", "w:divId", "w:cnfStyle", "w:rPr", "w:sectPr", "w:pPrChange")
RPR_AFTER = {"w:szCs": ("w:highlight", "w:u", "w:effect", "w:bdr", "w:shd", "w:fitText", "w:vertAlign", "w:rtl", "w:cs", "w:em", "w:lang", "w:eastAsianLayout", "w:specVanish", "w:oMath"),
             "w:rtl": ("w:cs", "w:em", "w:lang", "w:eastAsianLayout", "w:specVanish", "w:oMath"),
             "w:lang": ("w:eastAsianLayout", "w:specVanish", "w:oMath")}
SECT_AFTER_BIDI = ("w:rtlGutter", "w:docGrid", "w:printerSettings", "w:sectPrChange")


def insert_in_order(parent, child, successors):
    for tag in successors:
        node = parent.find(qn(tag))
        if node is not None:
            node.addprevious(child)
            return child
    parent.append(child)
    return child


def set_rtl(paragraph_format_owner):
    pPr = paragraph_format_owner._element.get_or_add_pPr()
    if pPr.find(qn("w:bidi")) is None:
        insert_in_order(pPr, OxmlElement("w:bidi"), PPR_AFTER_BIDI)


def build_docx(png_path, out_path, top, bottom, side, title):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Mm(210), Mm(297)
    sec.top_margin, sec.bottom_margin = Mm(top), Mm(bottom)
    sec.left_margin, sec.right_margin = Mm(side), Mm(side)
    sec.header_distance = sec.footer_distance = Mm(0)
    insert_in_order(sec._sectPr, OxmlElement("w:bidi"), SECT_AFTER_BIDI)  # right-to-left section

    # Default text: Kufam, 11 pt, right-to-left Arabic
    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = "Kufam", Pt(11)
    rPr = normal.element.get_or_add_rPr()
    fonts = rPr.find(qn("w:rFonts"))
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        fonts.set(qn(attr), "Kufam")
    sz_cs = OxmlElement("w:szCs"); sz_cs.set(qn("w:val"), "22")  # 11 pt for Arabic (complex script) too
    insert_in_order(rPr, sz_cs, RPR_AFTER["w:szCs"])
    insert_in_order(rPr, OxmlElement("w:rtl"), RPR_AFTER["w:rtl"])
    lang = OxmlElement("w:lang"); lang.set(qn("w:val"), "en-US"); lang.set(qn("w:bidi"), "ar-SA")  # Latin text proofed in English, Arabic in Arabic
    insert_in_order(rPr, lang, RPR_AFTER["w:lang"])
    set_rtl(normal)
    normal.paragraph_format.line_spacing = 1.5
    normal.paragraph_format.space_after = Pt(6)

    # Header: the rendered page, full A4, behind the text, repeated on every page
    head = sec.header.paragraphs[0]
    head.paragraph_format.space_before = head.paragraph_format.space_after = Pt(0)
    head.paragraph_format.line_spacing = Pt(1)
    run = head.add_run()
    run.font.size = Pt(1)
    run.add_picture(str(png_path), width=Mm(210), height=Mm(297))
    anchor_behind_text(run)
    doc.sections[0].footer.paragraphs[0].paragraph_format.line_spacing = Pt(1)

    # Body: empty paragraphs, ready to type
    for _ in range(3):
        doc.add_paragraph("")

    strip_template_leftovers(doc, png_path)
    now = datetime.now(timezone.utc).replace(microsecond=0)
    cp = doc.core_properties
    cp.title, cp.author, cp.last_modified_by = title, "محمد أبوالرجال", "محمد أبوالرجال"
    cp.language, cp.comments, cp.created, cp.modified = "ar-SA", "", now, now
    doc.save(out_path)


def strip_template_leftovers(doc, png_path):
    """python-docx starts from a Word 2010 template: drop the parts that would show stale or wrong data."""
    main = doc.part
    # Word 2010 reads stylesWithEffects.xml instead of styles.xml, and it still has the template's Calibri defaults.
    for rid, rel in list(main.rels.items()):
        if rel.reltype.endswith("/stylesWithEffects"):
            main.drop_rel(rid)
    # The embedded preview is the template's blank page; show the letterhead instead (or nothing if sips is missing).
    pkg = main.package
    for rid, rel in list(pkg.rels.items()):
        if not rel.reltype.endswith("/thumbnail"):
            continue
        jpeg = png_path.with_name(png_path.stem + "-thumb.jpg")
        made = shutil.which("sips") and subprocess.run(
            ["sips", "-Z", "512", "-s", "format", "jpeg", str(png_path), "--out", str(jpeg)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0 and jpeg.is_file()
        if made:
            rel.target_part._blob = jpeg.read_bytes()
            jpeg.unlink()
        else:
            pkg.drop_rel(rid) if hasattr(pkg, "drop_rel") else pkg.rels.pop(rid)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("html", type=Path, help="built document (HTML)")
    parser.add_argument("-o", "--out", type=Path, help="output .docx (default: next to the HTML)")
    parser.add_argument("--top", type=float, default=43, help="top margin in mm (header 39 + body padding 4)")
    parser.add_argument("--bottom", type=float, default=40, help="bottom margin in mm (footer 38 + body padding 2; 52 with footerRows)")
    parser.add_argument("--side", type=float, default=15, help="side margins in mm")
    parser.add_argument("--keep-png", action="store_true", help="keep the rendered page image next to the .docx")
    args = parser.parse_args()
    if not args.html.is_file():
        fail(f"not found: {args.html}")
    out = args.out or args.html.with_suffix(".docx")
    png = out.with_suffix(".png")
    render_png(args.html, png)
    title = args.html.read_text(encoding="utf-8").split("<title>", 1)[-1].split("</title>", 1)[0] if "<title>" in args.html.read_text(encoding="utf-8") else out.stem
    build_docx(png, out, args.top, args.bottom, args.side, title.replace("&lt;", "<"))
    print(f"docx: {out}")
    if args.keep_png:
        print(f"png:  {png}")
    else:
        png.unlink()


if __name__ == "__main__":
    main()

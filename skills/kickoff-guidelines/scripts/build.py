#!/usr/bin/env python3
"""Build a brand guidelines deck from brand.json: one self-contained HTML, and a PDF with --pdf.

    python3 build.py brand.json [--out guidelines.html] [--pdf [file.pdf]]

brand.json is merged over assets/defaults.json (objects merge key by key, lists replace),
then validated in one round, so every problem is listed at once: missing required fields
(only those of slides that are built; a slide named in "skip" needs none of its fields),
empty values, placeholders (⟨…⟩, TODO, TBD, lorem), unknown icons, a mark that cannot be
inlined or has no construction grid, fonts that cannot be loaded, lack Arabic letters or
the weights the deck shows, and text copied from the example brand (assets/brand.example.json).
Paths in brand.json are relative to its own folder.

The output embeds everything it shows: logos and pattern SVGs as data URIs, the mark as
inline SVG paths, the fonts as base64 (a Google Fonts family is downloaded once, one TTF
per weight, see fonts.py), and the Lucide icons it uses. Nothing is fetched when it renders.

The deck skips slides whose data is absent (no letterhead image, "motif": "none" for the
Najdi slide, no mockups, no banners, ids listed in "skip") and numbers the rest in order.
After writing the HTML the script renders it in headless Chrome and checks what only a
render shows: that every brand font loaded, that no banner's copy runs into its crenellated
band, its logo or its art, and that no mock-up copy overflows its box. It prints the slide
count and every skipped slide. With --pdf it prints a
1440x810 PDF and fails when its page count differs from the number of slides.
"""
import argparse
import base64
import copy
import difflib
import html as htmllib
import json
import mimetypes
import re
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "assets"
sys.path.insert(0, str(HERE))
from chrome import dump_dom, find_chrome, pdf_page_count, print_pdf  # noqa: E402
from fonts import FontError, font_info, google_faces, missing  # noqa: E402
from markgeo import MarkError, analyse, read_mark  # noqa: E402

STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"]
# The Saudi green scale the bundled Najdi SVGs are drawn in; recoloured step by step to the brand's scale.
SOURCE_SCALE = {"50": "#F3FCF6", "100": "#DFF6E7", "200": "#B8EACB", "300": "#88D8AD", "400": "#54C08A",
                "500": "#25935F", "600": "#1B8354", "700": "#166A45", "800": "#14573A", "900": "#104631"}
NAJDI_FILES = ["header-band.svg", "najdi-teeth-down.svg", "najdi-teeth-up.svg",
               "triangle-texture-on-green.svg", "triangle-texture-on-white.svg"]
ELEMENT_KINDS = {"teeth", "chamfer", "gradient", "triangles", "pattern"}
BANNER_FIELDS = {"hero": ["headline", "text"], "tiles": ["tiles", "headline", "text"],
                 "phone": ["headline", "text"], "values": ["headline", "text", "values"],
                 "contact": ["headline", "text", "rows"]}
SLIDE_IDS = ["cover", "intro", "traits", "logos", "construction", "palette", "font-arabic", "font-family",
             "font-latin", "type-scale", "misuse-mark", "misuse-logo", "clear-space", "placement", "patterns",
             "najdi", "elements", "icons", "letterhead", "card", "app-icon", "mockups", "banners", "closing"]
# Drawn by the mockup slides themselves (post actions, storefront bars), so always inlined with them.
MOCKUP_ICONS = {"heart", "message-circle", "send", "bookmark", "ellipsis",
                "menu", "search", "shopping-bag", "house", "layout-grid", "user", "lock"}
# Needed by every deck: the logos and mark appear on most slides, the scale and font on all.
REQUIRED = ["name", "nameLatin", "footerLabel", "year",
            "logos.stacked.onLight", "logos.stacked.onDark", "logos.horizontal.onLight", "logos.horizontal.onDark",
            "logos.mark", "colors.scale", "font.family", "font.nameAr"]
# Needed only when the slide is built; "skip" drops them with the slide.
REQUIRED_BY_SLIDE = {
    "intro": ["intro.paragraphs"],
    "traits": ["traits.items"],
    "construction": ["construction.paragraphs"],
    "palette": ["palette.primaryName", "palette.primaryCode"],
    "font-arabic": ["font.source", "font.license", "typeface.glyph", "typeface.note"],
    "font-family": ["typeface.familySample"],
    "font-latin": ["typeface.latinText", "typeface.latinSample"],
    "type-scale": ["typeScale.bodySample"],
    "elements": ["elements.items"],
    "card": ["card.name", "card.role", "card.rows"],
    "closing": ["closing.text", "closing.copyright"],
}
PLACEHOLDER = re.compile(r"⟨|\bTODO\b|\bTBD\b|lorem ipsum|\bxxx+\b", re.I)
MAY_BE_EMPTY = re.compile(r"^palette\.usage\[\d+\]\.label$")
# Facts of the example brand (Tawa Najd) that can never be true of another brand: refused.
# Other text equal to the example's is listed in a note, since some of it is generic.
EXAMPLE_ONLY = re.compile(r"^(name|nameLatin|title|footerLabel|logos\.|letterhead\.image|font\.file|najdi\.(dir|label)|"
                          r"card\.(name|role)$|closing\.copyright|construction\.paragraphs|"
                          r"typeface\.(glyph|familySample|latinSample\[0\]))")
SHAREABLE = re.compile(r"^(colors\.|motif|lang|year|font\.(family|nameAr|googleFamily|source|license|weightRange)|"
                       r"iconStyle\.names|skip|patterns\.gap)|\]\.(icon|type|kind|fit|bg|file|color)$")
ARABIC = re.compile(r"[؀-ۿ]")
LATIN = re.compile(r"[A-Za-z0-9]")
WEIGHT_NAMES = re.compile(r"\b(Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black)\b")
MIN_BAND_GAP, MIN_LOGO_GAP = 24, 16   # px between a banner's copy and its band, and its logo


def ph(value):
    """A placeholder still waiting for the owner's answer (already reported once)."""
    return isinstance(value, str) and bool(PLACEHOLDER.search(value))


def fail(lines):
    if isinstance(lines, str):
        lines = [lines]
    sys.exit("build.py: refused to build:\n" + "\n".join(f"  - {l}" for l in lines))


def merge(base, over):
    out = copy.deepcopy(base)
    for k, v in over.items():
        out[k] = merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else copy.deepcopy(v)
    return out


def get(d, dotted):
    """Value at a path like "banners.items[1].text", or None."""
    for part in re.findall(r"[^.\[\]]+|\[\d+\]", dotted):
        if part.startswith("["):
            i = int(part[1:-1])
            if not isinstance(d, list) or i >= len(d):
                return None
            d = d[i]
        elif isinstance(d, dict) and part in d:
            d = d[part]
        else:
            return None
    return d


def walk(node, path=""):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from walk(v, f"{path}.{k}" if path else k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk(v, f"{path}[{i}]")
    else:
        yield path, node


def resolve(base, value):
    p = Path(value).expanduser()
    return p if p.is_absolute() else (base / p)


def data_uri(path, text=None):
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    raw = text.encode("utf-8") if text is not None else path.read_bytes()
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


def deck_text(data):
    """Every string the deck prints (tags stripped), for the font coverage check."""
    skip = ("logos.", "letterhead.image", "najdi.dir", "najdi.items", "font.", "latinFont.", "iconStyle.names", "skip")
    if not get(data, "mockups.social"):
        skip += ("mockups.",)   # the default mock-up titles print only with mock-ups
    return " ".join(re.sub(r"<[^>]+>", " ", v) for p, v in walk(data)
                    if isinstance(v, str) and not p.startswith(skip) and not p.endswith((".icon", ".type", ".kind")))


def load_files(key, f, base, errs):
    """A static family given as one file per weight (font.files): a list, each file's weight read from
    its OS/2 table, or an object {css weight: file} that sets the weights by hand. Italic files are
    ignored (the deck sets no italic); two files with one weight are refused, since only one can win."""
    files = f["files"]
    if isinstance(files, dict):
        entries = list(files.items())
    elif isinstance(files, list):
        entries = [(None, p) for p in files]
    else:
        errs.append(f"{key}.files: a list of font files (one static file per weight), or an object {{weight: file}}")
        return None
    by_weight, cps, notes, bad = {}, set(), [], False
    for declared, value in entries:
        if not isinstance(value, str) or not value.strip() or ph(value):
            bad = True   # empty and placeholder values are already reported
            continue
        path = resolve(base, value)
        if not path.is_file():
            errs.append(f"{key}.files: not found: {path}")
            bad = True
            continue
        try:
            info = font_info(path)
        except FontError as e:
            errs.append(f"{key}.files: {path.name}: {e}")
            bad = True
            continue
        if info["italic"]:
            notes.append(f"{key}.files: {path.name} is italic; ignored (the deck sets no italic)")
            continue
        if info["variable"]:
            errs.append(f"{key}.files: {path.name} is a variable font; give it alone as {key}.file")
            bad = True
            continue
        w = info["weights"][0]
        if declared is not None:
            if not re.fullmatch(r"\d{1,4}", str(declared)) or not 1 <= int(declared) <= 1000:
                errs.append(f"{key}.files: key {declared!r} is not a CSS weight (1 to 1000)")
                bad = True
                continue
            if int(declared) != w:
                notes.append(f"{key}.files: {path.name} reports weight {w}; set to {declared}")
            w = int(declared)
        by_weight.setdefault(w, []).append(path)
        cps |= info["codepoints"]
    for w, paths in sorted(by_weight.items()):
        if len(paths) > 1:
            errs.append(f"{key}.files: {', '.join(p.name for p in paths)} all report weight {w}; give {key}.files as an "
                        "object {weight: file} to set each file's weight, or leave out all but one")
            bad = True
    if bad or not by_weight:
        if not bad:
            errs.append(f"{key}.files: no upright font file")
        return None
    weights = sorted(by_weight)
    info = {"codepoints": cps, "weights": (weights[0], weights[-1]), "variable": False, "italic": False}
    return {"family": f["family"], "faces": [(str(w), by_weight[w][0]) for w in weights], "info": info,
            "has": lambda w: w in by_weight, "label": ", ".join(map(str, weights)), "notes": notes}


def load_font(key, f, base, errs):
    """Read a font entry: {"family", "faces": [(css weight, Path)], "info", "has": weight test}, or None."""
    if any(ph(f.get(k)) for k in ("family", "file", "googleFamily")):
        return None
    if not f.get("family"):
        errs.append(f"{key}.family: missing")
        return None
    try:
        if f.get("files") is not None:
            if f.get("file"):
                errs.append(f"{key}: give {key}.file (one file) or {key}.files (one file per weight), not both")
                return None
            return load_files(key, f, base, errs)
        if f.get("file"):
            path = resolve(base, f["file"])
            if not path.is_file():
                errs.append(f"{key}.file: not found: {path}")
                return None
            info = font_info(path)
            lo, hi = info["weights"]
            spec = f.get("weightRange") or (f"{lo} {hi}" if info["variable"] else str(lo))
            has = (lambda w: lo <= w <= hi) if info["variable"] else (lambda w: w == lo)
            label = f"{lo}–{hi}" if info["variable"] else f"{lo} only (a static file)"
            return {"family": f["family"], "faces": [(spec, path)], "info": info, "has": has, "label": label}
        if f.get("googleFamily"):
            faces = google_faces(f["googleFamily"])
            info = font_info(faces.get(400) or next(iter(faces.values())))
            return {"family": f["family"], "faces": [(str(w), p) for w, p in faces.items()], "info": info,
                    "has": lambda w: w in faces, "label": ", ".join(map(str, faces))}
        errs.append(f"{key}: give a local font file ({key}.file), one file per weight ({key}.files), "
                    f"or a Google Fonts family ({key}.googleFamily)")
    except FontError as e:
        errs.append(f"{key}: {e}")
    return None


def check_fonts(data, base, errs, built):
    fonts = {"font": load_font("font", data.get("font", {}), base, errs)}
    if data.get("latinFont"):
        fonts["latinFont"] = load_font("latinFont", data["latinFont"], base, errs)
    text = deck_text(data)
    main, latin = fonts["font"], fonts.get("latinFont")
    if main:
        cps, fam = main["info"]["codepoints"], main["family"]
        gaps = missing(cps, "".join(sorted(set(ARABIC.findall(text)))))
        if ord("ب") not in cps:
            errs.append(f"font: {fam} has no Arabic letters, yet every Arabic line of the deck is set in it and slide 07 "
                        "presents it as the Arabic typeface. Choose an Arabic family for font; a Latin-only family goes in latinFont")
        elif gaps:
            errs.append(f"font: {fam} cannot draw {' '.join(gaps)} used in the deck's text; choose a family that has them, or reword")
        if not latin:
            gaps = missing(cps, "".join(sorted(set(LATIN.findall(text)))))
            if gaps:
                errs.append(f"font: {fam} has no Latin {' '.join(gaps)}; add a Latin family as latinFont")
        if "font-family" in built:
            absent = [w for w, _ in data["typeface"]["weights"] if not main["has"](w)]
            if absent:
                errs.append(f"typeface.weights: {fam} has no {', '.join(map(str, absent))} (it has {main['label']}); "
                            "list only weights it has, so slide 08 shows the real font")
            shown = {n for _, n in data["typeface"]["weights"]}
            named = set(WEIGHT_NAMES.findall(data["typeface"].get("familyRoles", "")))
            if named - shown:
                errs.append(f"typeface.familyRoles: names {', '.join(sorted(named - shown))}, which typeface.weights does not "
                            "list; give each role a weight the font has")
    if latin:
        gaps = missing(latin["info"]["codepoints"], "".join(sorted(set(LATIN.findall(text)))))
        if gaps:
            errs.append(f"latinFont: {latin['family']} cannot draw {' '.join(gaps)}")
    return fonts


def check_example(brand, base, errs, notes):
    """Text left over from the example brand: an error where it cannot be true, a note where it may be."""
    example_path = ASSETS / "brand.example.json"
    example = json.loads(example_path.read_text(encoding="utf-8"))
    same = []
    for path, value in walk(brand):
        if not isinstance(value, str) or not value.strip() or SHAREABLE.search(path):
            continue
        ex = get(example, path)
        if ex == value or (path.startswith(("logos.", "letterhead.image", "font.file", "najdi.dir")) and isinstance(ex, str)
                           and resolve(base, value).resolve() == resolve(example_path.parent, ex).resolve()):
            if EXAMPLE_ONLY.match(path):
                errs.append(f"{path}: still the example brand's {value[:60]!r}; write this brand's own")
            else:
                same.append(path)
    if same:
        notes.append("same text as the example brand, keep only what is true of this brand too: " + ", ".join(same))


def validate(brand, data, base, check_leftovers):
    """Collect every problem at once, so the owner is asked one question round, not many."""
    errs, notes = [], []
    for path, value in walk(brand):
        if isinstance(value, str) and not value.strip() and not MAY_BE_EMPTY.match(path):
            errs.append(f"{path}: empty")
        elif isinstance(value, str) and PLACEHOLDER.search(value):
            errs.append(f"{path}: placeholder {value!r}")
    skip = set(data.get("skip", []))
    for s in sorted(skip - set(SLIDE_IDS)):
        errs.append(f"skip: unknown slide id {s!r} (ids: {', '.join(SLIDE_IDS)})")
    built = set(SLIDE_IDS) - skip
    if data.get("motif") != "najdi":
        built.discard("najdi")
    reported = {re.split(r"[:\[]", e)[0] for e in errs}
    required = REQUIRED + [f for slide, fields in REQUIRED_BY_SLIDE.items() if slide in built for f in fields]
    for field in required:
        if field not in reported and get(data, field) in (None, "", [], {}):
            errs.append(f"{field}: missing")
    if data.get("motif") not in ("najdi", "none") and not ph(data.get("motif")):
        errs.append('motif: must be "najdi" or "none"')

    scale = get(data, "colors.scale") or {}
    for step in STEPS:
        if not ph(scale.get(step)) and not re.fullmatch(r"#[0-9A-Fa-f]{6}", str(scale.get(step, ""))):
            errs.append(f"colors.scale.{step}: needs a #RRGGBB colour (the primary goes at 600)")
    for key in ("ink", "ink2", "muted", "line", "highlight", "danger"):
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", str(get(data, f"colors.{key}") or "")):
            errs.append(f"colors.{key}: needs a #RRGGBB colour")
    accent = get(data, "colors.accent")
    if accent is not None and not ph(accent) and not re.fullmatch(r"#[0-9A-Fa-f]{6}", str(accent)):
        errs.append("colors.accent: needs a #RRGGBB colour (the background of call-to-action buttons)")

    for key in ("stacked.onLight", "stacked.onDark", "horizontal.onLight", "horizontal.onDark", "mark"):
        v = get(data, f"logos.{key}")
        if v and not ph(v) and not resolve(base, v).is_file():
            errs.append(f"logos.{key}: file not found: {resolve(base, v)}")
    mark = report = None
    if get(data, "logos.mark") and not ph(data["logos"]["mark"]) and resolve(base, data["logos"]["mark"]).is_file():
        try:
            mark = read_mark(resolve(base, data["logos"]["mark"]))
            if data.get("markViewBox"):
                mark["viewBox"] = data["markViewBox"]
            report = analyse(mark)
        except MarkError as e:
            errs.append(f"logos.mark: {e}")
    con = data.get("construction", {})
    hand_grid = all(con.get(k) is not None for k in ("cols", "unit", "origin"))
    if "construction" in built and report and not report["grid"] and not hand_grid:
        errs[:] = [e for e in errs if not e.startswith("construction.paragraphs")]
        errs.append(f'construction: {report.get("gridless", "no grid fits the mark")}; add "construction" to skip '
                    "(or set construction.cols, rows, unit, origin and highlight by hand)")

    fonts = check_fonts(data, base, errs, built)
    for f in fonts.values():
        notes.extend((f or {}).get("notes", []))

    traits = get(data, "traits.items")
    if "traits" in built and traits and (not 3 <= len(traits) <= 4 or any(not (t.get("name") and t.get("text")) for t in traits)):
        errs.append("traits.items: 3 or 4 items, each {name, text}")
    elements = get(data, "elements.items") or []
    if "elements" in built:
        if elements and not 3 <= len(elements) <= 4:
            errs.append("elements.items: 3 or 4 items, each {kind, title, text}")
        for i, e in enumerate(elements):
            if ph(e.get("kind")):
                pass
            elif e.get("kind") not in ELEMENT_KINDS:
                errs.append(f"elements.items[{i}].kind: one of {sorted(ELEMENT_KINDS)}")
            elif e["kind"] in ("teeth", "triangles") and data.get("motif") != "najdi":
                errs.append(f'elements.items[{i}].kind: {e["kind"]!r} is a Najdi motif; use it only with "motif": "najdi"')
            if not (e.get("title") and e.get("text")):
                errs.append(f"elements.items[{i}]: needs title and text")
    for slide, key in (("misuse-mark", "misuse.markItems"), ("misuse-logo", "misuse.logoItems")):
        if slide in built and len(get(data, key) or []) != 4:
            errs.append(f"{key}: exactly 4 labels")
    if "card" in built and len(get(data, "card.rows") or []) > 5:
        errs.append("card.rows: at most 5 rows fit on the card")
    sample = get(data, "typeface.latinSample")
    if "font-latin" in built and sample and not isinstance(sample, list):
        errs.append("typeface.latinSample: a list of lines, the first one printed bold")
    banners = (get(data, "banners.items") or []) if "banners" in built else []
    for i, b in enumerate(banners):
        kind = b.get("type")
        if kind not in BANNER_FIELDS:
            errs.append(f"banners.items[{i}].type: one of {sorted(BANNER_FIELDS)}")
            continue
        for f in BANNER_FIELDS[kind]:
            if not b.get(f):
                errs.append(f"banners.items[{i}].{f}: missing (a {kind} banner needs {', '.join(BANNER_FIELDS[kind])})")
        if kind == "tiles" and len(b.get("tiles", [])) != 4:
            errs.append(f"banners.items[{i}].tiles: exactly 4 tiles")
        if kind == "contact" and len(b.get("rows", [])) > 5:
            errs.append(f"banners.items[{i}].rows: at most 5 rows")
        if kind == "values" and len(b.get("values", [])) != 4:
            errs.append(f"banners.items[{i}].values: exactly 4 words")
    if len(banners) > 9:
        errs.append("banners.items: at most 9 banners")
    if "mockups" in built and brand.get("mockups") is not None:
        check_mockups(data["mockups"], errs)
    if "najdi" in built and not get(data, "najdi.label"):
        errs.append("najdi.label: missing (the folder the Najdi SVGs live in, shown under the slide)")
    lh = data.get("letterhead", {})
    if lh.get("image") and "letterhead" in built and not (lh.get("heading") and lh.get("paragraphs")):
        errs.append("letterhead: an image needs heading and paragraphs too")
    icons = json.loads((ASSETS / "lucide-0.469.0.json").read_text(encoding="utf-8"))
    for name in sorted(n for n in collect_icons(data) - set(icons) if not ph(n)):
        near = difflib.get_close_matches(name, icons, 3)
        errs.append(f"icon {name!r}: not a Lucide 0.469.0 icon" + (f" (did you mean {', '.join(near)}?)" if near else ""))
    if check_leftovers:
        check_example(brand, base, errs, notes)
    if errs:
        fail(errs + [f"also: {n}" for n in notes])
    return {"mark": mark, "report": report, "fonts": fonts, "notes": notes}


def check_mockups(mk, errs):
    """mockups: 1 to 3 social posts {headline, text?, icon?}, and an optional store {headline, text?, items, cta?}."""
    social = mk.get("social")
    if not isinstance(social, list) or not 1 <= len(social) <= 3:
        errs.append("mockups.social: 1 to 3 posts, each {headline, text?, icon?}")
        social = social if isinstance(social, list) else []
    for i, post in enumerate(social):
        if not isinstance(post, dict) or not post.get("headline"):
            errs.append(f"mockups.social[{i}].headline: missing (text, or a list of lines)")
    store = mk.get("store")
    if store is None:
        return
    if not isinstance(store, dict):
        errs.append("mockups.store: an object {headline, text?, items, cta?}")
        return
    if not store.get("headline"):
        errs.append("mockups.store.headline: missing (text, or a list of lines)")
    items = store.get("items")
    if not isinstance(items, list) or not 3 <= len(items) <= 4:
        errs.append("mockups.store.items: 3 or 4 service cards, each {icon, label}")
    else:
        for i, it in enumerate(items):
            if not isinstance(it, dict) or not (it.get("icon") and it.get("label")):
                errs.append(f"mockups.store.items[{i}]: needs icon and label")


def collect_icons(data):
    names = set(get(data, "iconStyle.names") or [])
    if get(data, "mockups.social") and "mockups" not in data.get("skip", []):
        names |= MOCKUP_ICONS
    for path, value in walk(data):
        if path.endswith(".icon") and isinstance(value, str):
            names.add(value)
    return names


def font_css(data, fonts):
    """Return (@font-face rules, family list) for the deck's fonts, every face embedded as base64."""
    used = {w for w, _ in data["typeface"]["weights"]} | {400, 500, 600, 700}
    faces, families = [], []
    for key in ("font", "latinFont"):
        f = fonts.get(key)
        if not f:
            continue
        families.append(f["family"])
        chosen = f["faces"] if len(f["faces"]) == 1 else [(w, p) for w, p in f["faces"] if int(w) in used] or f["faces"]
        for weight, path in chosen:
            fmt = {".ttf": "truetype", ".otf": "opentype", ".woff2": "woff2", ".woff": "woff"}.get(path.suffix.lower(), "truetype")
            mime = {"truetype": "font/ttf", "opentype": "font/otf", "woff2": "font/woff2", "woff": "font/woff"}[fmt]
            b64 = base64.b64encode(path.read_bytes()).decode()
            faces.append(f'  @font-face {{ font-family: "{f["family"]}"; src: url(data:{mime};base64,{b64}) format("{fmt}"); '
                         f'font-weight: {weight}; }}')
    return "\n".join(faces), families


def prepare(data, base, ctx):
    """Turn file paths into embedded data and set the construction grid."""
    notes = list(ctx["notes"])
    for kind in ("stacked", "horizontal"):
        for side in ("onLight", "onDark"):
            data["logos"][kind][side] = data_uri(resolve(base, data["logos"][kind][side]))
    data["mark"] = ctx["mark"]

    con = data.setdefault("construction", {})
    if "construction" not in data.get("skip", []):
        report = ctx["report"]
        grid = report["grid"] or {}
        for key in ("cols", "rows", "unit", "origin", "highlight"):
            if con.get(key) is None:
                con[key] = grid.get(key)
        con["rows"] = con.get("rows") or con["cols"]
        con["highlight"] = con.get("highlight") or [0, 0]
        notes.append(f"construction: {con['cols']} x {con['rows']} grid, X = {con['unit']:g}, "
                     f"highlight cell {con['highlight']}; symmetry {report['symmetry']}; edge angles {report['angles']}")

    if data.get("motif") == "najdi":
        src = resolve(base, data["najdi"]["dir"]) if get(data, "najdi.dir") else ASSETS / "najdi"
        files = {}
        for name in NAJDI_FILES:
            path = src / name
            if not path.is_file():
                fail(f"najdi: {path} not found")
            svg = path.read_text(encoding="utf-8")
            for step, hex_ in SOURCE_SCALE.items():
                svg = re.sub(re.escape(hex_), f"@@{step}@@", svg, flags=re.I)
            svg = re.sub(r"@@(\d+)@@", lambda m: data["colors"]["scale"][m.group(1)], svg)
            files[name] = data_uri(path, svg)
        data["najdi"]["files"] = files

    lh = data.get("letterhead", {})
    if lh.get("image"):
        path = resolve(base, lh["image"])
        if path.is_file():
            lh["image"] = data_uri(path)
        else:
            notes.append(f"letterhead: {path} not found; the letterhead slide is skipped until it exists")
            lh["image"] = None
    return notes


def render(data, ctx):
    icons_all = json.loads((ASSETS / "lucide-0.469.0.json").read_text(encoding="utf-8"))
    wanted = collect_icons(data)
    faces, families = font_css(data, ctx["fonts"])
    head = f'"{families[0]}", sans-serif'
    latin = f'"{families[1]}", sans-serif' if len(families) > 1 else head
    c = data["colors"]
    root = "\n".join(
        [f"    --c-{s}: {c['scale'][s]};" for s in STEPS]
        + [f"    --ink: {c['ink']}; --ink-2: {c['ink2']}; --muted: {c['muted']}; --line: {c['line']};",
           f"    --danger: {c['danger']}; --canvas: {c.get('canvas', '#d9dfdb')};",
           f"    --head: {head};", f"    --text: {head};", f"    --latin: {latin};"])
    if data.get("latinFont"):
        data.setdefault("typeface", {}).setdefault("latinName", data["latinFont"]["family"].upper())
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    icons = json.dumps({n: icons_all[n] for n in sorted(wanted)}, ensure_ascii=False)
    title = data.get("title") or f"الدليل الإرشادي — {data['name']}"
    html = (ASSETS / "deck.html").read_text(encoding="utf-8")
    for token, value in (("__LANG__", data.get("lang", "ar")), ("__TITLE__", title.replace("<", "&lt;")),
                         ("__FONT_FACE__", faces), ("__ROOT_VARS__", root),
                         ("/*__DATA__*/null", payload), ("/*__ICONS__*/{}", icons)):
        html = html.replace(token, value, 1)
    return html


# Runs in a throwaway copy of the deck: waits for the fonts, then measures each banner's parts
# (relative to the banner) and lists every font face with its load status.
PROBE = """<script>
(async () => {
  await document.fonts.ready;
  const r = { slides: +document.body.dataset.slides, skipped: document.body.dataset.skipped || "", fonts: [], banners: [] };
  document.fonts.forEach((f) => r.fonts.push([f.family.replace(/^["']|["']$/g, ""), String(f.weight), f.status]));
  const union = (els) => els.map((e) => e.getBoundingClientRect()).filter((q) => q.width || q.height)
    .reduce((a, q) => a ? [Math.min(a[0], q.left), Math.min(a[1], q.top), Math.max(a[2], q.right), Math.max(a[3], q.bottom)]
                        : [q.left, q.top, q.right, q.bottom], null);
  document.querySelectorAll(".slide").forEach((s, i) => {
    const b = s.querySelector("[data-banner]");
    if (!b) return;
    const o = b.getBoundingClientRect();
    const rel = (el, kids) => { if (!el) return null; const u = union(kids ? [el, ...el.children] : [el]); return u && [u[0] - o.left, u[1] - o.top, u[2] - o.left, u[3] - o.top]; };
    r.banners.push({ slide: i + 1, n: +b.dataset.banner, type: b.dataset.type, band: rel(b.querySelector("[data-band]")),
      logo: rel(b.querySelector("[data-logo]")), copy: rel(b.querySelector("[data-copy]")), art: rel(b.querySelector("[data-art]"), true) });
  });
  r.overflows = [];
  document.querySelectorAll(".slide").forEach((s, i) => s.querySelectorAll("[data-fit]").forEach((el) => {
    const dx = el.scrollWidth - el.clientWidth, dy = el.scrollHeight - el.clientHeight;
    if (dx > 1 || dy > 1) r.overflows.push({ slide: i + 1, what: el.dataset.fit, dx, dy });
  }));
  const pre = document.createElement("pre"); pre.id = "kg-probe"; pre.textContent = JSON.stringify(r); document.body.appendChild(pre);
})();
</script></body>"""


def probe(chrome, html):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html.replace("</body>", PROBE, 1))
    try:
        dom = dump_dom(chrome, Path(f.name).as_uri(), budget=8000)
    finally:
        Path(f.name).unlink(missing_ok=True)
    found = re.search(r'<pre id="kg-probe">(.*?)</pre>', dom, re.S)
    return json.loads(htmllib.unescape(found.group(1))) if found else None


def check_render(r, data):
    errs = []
    for o in r.get("overflows", []):
        errs.append(f"slide {o['slide']:02d}: {o['what']} overflows its box by {max(o['dx'], o['dy'])} px; shorten its copy"
                    + (" or lower its size" if o["what"].startswith("mockups.social") else ""))
    for key in ("font", "latinFont"):
        fam = get(data, f"{key}.family")
        if fam and not any(f[0] == fam and f[2] == "loaded" for f in r["fonts"]):
            seen = sorted({f"{f[1]}:{f[2]}" for f in r["fonts"] if f[0] == fam}) or ["no face"]
            errs.append(f"{key}: {fam} did not load in Chrome ({', '.join(seen)}); the deck would print in a fallback font")
    items = get(data, "banners.items") or []
    for b in r["banners"]:
        where = f"slide {b['slide']:02d} (banners.items[{b['n'] - 1}], {b['type']})"
        copy_, band, logo, art = b["copy"], b["band"], b["logo"], b["art"]
        if not copy_:
            continue
        fix = "Shorten the copy, or lower size / raise width" + (" / drop top" if items[b["n"] - 1].get("top") is not None else "")
        if b["type"] != "values" and band and band[1] - copy_[3] < MIN_BAND_GAP:
            errs.append(f"{where}: the copy ends {band[1] - copy_[3]:.0f} px above the crenellated band; "
                        f"it needs {MIN_BAND_GAP}. {fix}")
        if logo and copy_[1] - logo[3] < MIN_LOGO_GAP:
            errs.append(f"{where}: the copy starts {copy_[1] - logo[3]:.0f} px below the logo; it needs {MIN_LOGO_GAP}. {fix}")
        if art and b["type"] == "values" and copy_[3] > art[1]:
            errs.append(f"{where}: the copy runs {copy_[3] - art[1]:.0f} px into the diamonds; shorten it, lower size or top, "
                        "or make the diamonds smaller with valueSize")
        elif art and b["type"] != "values" and copy_[0] < art[2] and art[0] < copy_[2] and copy_[1] < art[3] and art[1] < copy_[3]:
            errs.append(f"{where}: the copy block overlaps the {'tiles' if b['type'] == 'tiles' else 'phone'}; narrow it with width")
    return errs


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("brand", type=Path)
    ap.add_argument("--out", type=Path, help="output HTML (default: guidelines.html next to brand.json)")
    ap.add_argument("--pdf", nargs="?", const=True, help="also print a PDF (default name: next to the HTML)")
    args = ap.parse_args()

    base = args.brand.resolve().parent
    brand = json.loads(args.brand.read_text(encoding="utf-8"))
    data = merge(json.loads((ASSETS / "defaults.json").read_text(encoding="utf-8")), brand)
    is_example = args.brand.resolve() == (ASSETS / "brand.example.json").resolve()
    ctx = validate(brand, data, base, check_leftovers=not is_example)
    notes = prepare(data, base, ctx)
    html = render(data, ctx)

    out = (args.out or base / "guidelines.html").resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    for n in notes:
        print(f"note: {n}")
    print(f"html: {out} ({len(html) // 1024} KB)")

    chrome = find_chrome()
    if not chrome:
        print("warning: no Chrome-family browser found; slides not counted or checked, no PDF")
        return
    r = probe(chrome, html)
    if not r or not r.get("slides"):
        fail("the deck did not render in Chrome (a script error?); open the HTML and check the console")
    count = r["slides"]
    print(f"slides: {count}")
    for s in filter(None, r["skipped"].split(" | ")):
        print(f"skipped: {s}")
    problems = check_render(r, data)
    if problems:
        fail(problems + [f"the HTML was written to {out} so you can look; fix the data and build again"])
    loaded = sorted({f[0] for f in r["fonts"] if f[2] == "loaded"})
    clear = f"; {len(r['banners'])} banner(s) clear of band, logo and art" if r["banners"] else ""
    print(f"checked: fonts loaded ({', '.join(loaded)}){clear}")
    if args.pdf:
        pdf = Path(args.pdf).resolve() if isinstance(args.pdf, str) else out.with_suffix(".pdf")
        if not print_pdf(chrome, out, pdf):
            fail("Chrome did not write the PDF")
        pages = pdf_page_count(pdf)
        print(f"pdf:  {pdf} ({pages} pages)")
        if pages != count:
            fail(f"the PDF has {pages} pages but the deck has {count} slides; a slide overflows its page. "
                 "Shoot the deck (scripts/shoot.py) and fix the slide that spills.")


if __name__ == "__main__":
    main()

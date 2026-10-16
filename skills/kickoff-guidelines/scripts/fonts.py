#!/usr/bin/env python3
"""Fonts for the deck: what a font covers, which weights it has, and under which licence.

    python3 fonts.py "Family Name"      # a Google Fonts family: licence, weights, Arabic letters
    python3 fonts.py path/to/font.ttf   # a local file: weights, Arabic letters

The first form is step 2 of SKILL.md. Its licence comes from the family's METADATA.pb in
the google/fonts repository (folder ofl/, apache/ or ufl/), not from Google Fonts serving
the family: Google serves OFL, Apache 2.0 and Ubuntu Font Licence families alike.

build.py imports this module to embed fonts. A Google Fonts family is downloaded as one
TTF per weight (cached in ~/.cache/kickoff-guidelines/fonts/, or $KICKOFF_FONT_CACHE) and
embedded like a local file, so every deck is self-contained. Coverage and weights
are read from the font's own tables (cmap, fvar, OS/2), so a Latin-only family offered as
the Arabic face, or a weight the family does not have, is caught before anything renders.
Reads TTF, OTF, TTC and WOFF; WOFF2 needs a TTF or OTF instead.
"""
import json
import os
import re
import string
import struct
import sys
import urllib.error
import urllib.request
import zlib
from pathlib import Path

CACHE = Path(os.environ.get("KICKOFF_FONT_CACHE") or Path.home() / ".cache" / "kickoff-guidelines" / "fonts")
CSS2 = "https://fonts.googleapis.com/css2?family={}:wght@{}"
METADATA = "https://raw.githubusercontent.com/google/fonts/main/{}/{}/METADATA.pb"
LICENCES = {"OFL": "OFL", "APACHE2": "Apache 2.0", "UFL": "Ubuntu Font Licence"}
ALL_WEIGHTS = (100, 200, 300, 400, 500, 600, 700, 800, 900)
ARABIC_LETTERS = {chr(c) for c in range(0x0621, 0x063B)} | {chr(c) for c in range(0x0641, 0x064B)}


class FontError(Exception):
    pass


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "kickoff-guidelines"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def cached(url):
    """Download url once into the cache (gstatic URLs carry a version, so they never change)."""
    path = CACHE / re.sub(r"[^A-Za-z0-9._-]", "_", url.split("//", 1)[-1])
    if not path.is_file():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(fetch(url))
    return path


def google_faces(family):
    """{weight: Path of a cached TTF} for every upright weight Google Fonts serves for the family."""
    url = CSS2.format(family.replace(" ", "+"), ";".join(map(str, ALL_WEIGHTS)))
    try:
        css = fetch(url).decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code == 400:
            raise FontError(f"Google Fonts has no family {family!r} (check the spelling on fonts.google.com)")
        raise FontError(f"Google Fonts answered HTTP {e.code} for {family!r}")
    except (urllib.error.URLError, OSError) as e:
        raise FontError(f"could not reach Google Fonts ({e}); download the family's TTF and set font.file")
    faces = {}
    for block in re.findall(r"@font-face\s*\{([^}]*)\}", css):
        w = re.search(r"font-weight:\s*(\d+)", block)
        u = re.search(r"url\((https://[^)]+)\)", block)
        if w and u and "italic" not in block:
            faces[int(w.group(1))] = u.group(1)
    if not faces:
        raise FontError(f"Google Fonts returned no font file for {family!r}")
    try:
        return {w: cached(u) for w, u in sorted(faces.items())}
    except (urllib.error.URLError, OSError) as e:
        raise FontError(f"could not download {family!r} from Google Fonts ({e}); set font.file instead")


def google_licence(family):
    """(folder, licence, subsets) from google/fonts METADATA.pb, or None when the repo has no such family."""
    slug = re.sub(r"[^a-z0-9]", "", family.lower())
    for folder in ("ofl", "apache", "ufl"):
        try:
            meta = fetch(METADATA.format(folder, slug)).decode("utf-8")
        except (urllib.error.URLError, OSError):
            continue
        lic = re.search(r'^license:\s*"([^"]+)"', meta, re.M)
        subsets = re.findall(r'^subsets:\s*"([^"]+)"', meta, re.M)
        return f"{folder}/{slug}", LICENCES.get(lic.group(1), lic.group(1)) if lic else None, subsets
    return None


def _tables(data):
    """{tag: bytes} of the first font in an sfnt, TTC or WOFF file."""
    sig = data[:4]
    if sig == b"wOF2":
        raise FontError("WOFF2 files cannot be read here; give the TTF or OTF of the font")
    if sig == b"wOFF":
        n = struct.unpack(">H", data[12:14])[0]
        out = {}
        for i in range(n):
            tag, off, clen, olen, _ = struct.unpack(">4sIIII", data[44 + 20 * i:64 + 20 * i])
            raw = data[off:off + clen]
            out[tag.decode("latin-1")] = zlib.decompress(raw) if clen < olen else raw
        return out
    base = struct.unpack(">I", data[12:16])[0] if sig == b"ttcf" else 0
    if data[base:base + 4] not in (b"\x00\x01\x00\x00", b"OTTO", b"true"):
        raise FontError("not a TrueType, OpenType or WOFF font")
    n = struct.unpack(">H", data[base + 4:base + 6])[0]
    out = {}
    for i in range(n):
        tag, _, off, length = struct.unpack(">4sIII", data[base + 12 + 16 * i:base + 28 + 16 * i])
        out[tag.decode("latin-1")] = data[off:off + length]
    return out


def _cmap(cmap):
    """Every code point the cmap maps to a real glyph."""
    n = struct.unpack(">H", cmap[2:4])[0]
    subs = {}
    for i in range(n):
        pid, eid, off = struct.unpack(">HHI", cmap[4 + 8 * i:12 + 8 * i])
        subs[(pid, eid)] = off
    for key in ((3, 10), (0, 6), (0, 4), (3, 1), (0, 3), (0, 2), (0, 1), (0, 0)):
        if key not in subs:
            continue
        off = subs[key]
        fmt = struct.unpack(">H", cmap[off:off + 2])[0]
        cps = set()
        if fmt == 12:
            groups = struct.unpack(">I", cmap[off + 12:off + 16])[0]
            for g in range(groups):
                start, end, _ = struct.unpack(">III", cmap[off + 16 + 12 * g:off + 28 + 12 * g])
                cps.update(range(start, end + 1))
            return cps
        if fmt == 4:
            seg = struct.unpack(">H", cmap[off + 6:off + 8])[0] // 2
            ends = struct.unpack(f">{seg}H", cmap[off + 14:off + 14 + 2 * seg])
            p = off + 16 + 2 * seg
            starts = struct.unpack(f">{seg}H", cmap[p:p + 2 * seg])
            deltas = struct.unpack(f">{seg}h", cmap[p + 2 * seg:p + 4 * seg])
            ro_pos = p + 4 * seg
            ranges = struct.unpack(f">{seg}H", cmap[ro_pos:ro_pos + 2 * seg])
            for s in range(seg):
                for c in range(starts[s], ends[s] + 1):
                    if c == 0xFFFF:
                        continue
                    if ranges[s] == 0:
                        g = (c + deltas[s]) & 0xFFFF
                    else:
                        addr = ro_pos + 2 * s + ranges[s] + 2 * (c - starts[s])
                        g = struct.unpack(">H", cmap[addr:addr + 2])[0]
                        g = (g + deltas[s]) & 0xFFFF if g else 0
                    if g:
                        cps.add(c)
            return cps
        if fmt == 0:
            return {c for c in range(256) if cmap[off + 6 + c]}
    raise FontError("the font has no Unicode character map this script can read")


def font_info(path):
    """{"codepoints": set of ints, "weights": (lo, hi), "variable": bool, "italic": bool} of a font file."""
    t = _tables(Path(path).read_bytes())
    if "cmap" not in t:
        raise FontError("the font has no character map")
    info = {"codepoints": _cmap(t["cmap"]), "variable": False, "weights": (400, 400), "italic": False}
    if "OS/2" in t:
        wc = struct.unpack(">H", t["OS/2"][4:6])[0]
        info["weights"] = (wc, wc)
        info["italic"] = bool(struct.unpack(">H", t["OS/2"][62:64])[0] & 1)   # fsSelection bit 0
    if "head" in t:
        info["italic"] = info["italic"] or bool(struct.unpack(">H", t["head"][44:46])[0] & 2)   # macStyle bit 1
    if "fvar" in t:
        fv = t["fvar"]
        axes_off, _, count, size = struct.unpack(">HHHH", fv[4:12])
        for i in range(count):
            a = fv[axes_off + i * size:axes_off + (i + 1) * size]
            tag, lo, _, hi = struct.unpack(">4siii", a[:16])
            if tag == b"wght":
                info["weights"] = (round(lo / 65536), round(hi / 65536))
                info["variable"] = True
    return info


def missing(codepoints, text):
    """Characters of text the font cannot draw, sorted."""
    return sorted({ch for ch in text if ord(ch) not in codepoints})


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    arg = sys.argv[1]
    report = {}
    try:
        if Path(arg).is_file():
            info = font_info(arg)
            report["file"] = arg
        else:
            faces = google_faces(arg)
            info = font_info(faces[400] if 400 in faces else next(iter(faces.values())))
            report["family"] = arg
            report["googleFonts"] = {"weights": sorted(faces)}
            lic = google_licence(arg)
            report["licence"] = ({"source": "Google Fonts", "license": lic[1], "metadata": f"google/fonts {lic[0]}/METADATA.pb",
                                  "subsets": lic[2]} if lic else
                                 "not in the google/fonts repository: ask the owner which licence covers it")
    except FontError as e:
        sys.exit(f"fonts.py: {e}")
    if "googleFonts" not in report:
        lo, hi = info["weights"]
        report["weights"] = f"{lo}-{hi} (variable)" if info["variable"] else f"{lo} only (static)"
    gaps = missing(info["codepoints"], "".join(sorted(ARABIC_LETTERS)))
    report["arabic"] = "all 36 basic letters" if not gaps else (
        "none: not an Arabic typeface" if len(gaps) == len(ARABIC_LETTERS) else f"missing {' '.join(gaps)}")
    latin = missing(info["codepoints"], string.ascii_letters + string.digits)
    report["latin"] = "A-Z a-z 0-9" if not latin else f"missing {' '.join(latin)}"
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

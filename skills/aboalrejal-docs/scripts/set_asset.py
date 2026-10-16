#!/usr/bin/env python3
"""Embed Mohammed Abo Alrejal's logo, mark, watermark, stamp, or font into assets/template.html as base64.

    python3 set_asset.py logo  ~/Desktop/Project/aboalrejal/identity/brand/logo/transparent/logo-horizontal-white.svg
    python3 set_asset.py mark  ~/Desktop/Project/aboalrejal/identity/brand/logo/transparent/mark-white.svg
    python3 set_asset.py watermark ~/Desktop/Project/aboalrejal/identity/brand/logo/transparent/logo-stacked-green.svg
    python3 set_asset.py font  ~/Desktop/Project/aboalrejal/identity/brand/fonts/kufam/Kufam[wght].woff2
    python3 set_asset.py stamp path/to/stamp.png
    python3 set_asset.py logo --clear

The header band is green, so logo and mark must be the white, transparent versions;
the watermark sits on white paper, so it takes the green one. The font is Kufam,
the only brand font; embedding it keeps every page in Kufam offline and in print.

Every document built afterwards carries the new asset. Documents already
built keep the asset they were built with; rebuild them to update.
"""
import argparse
import base64
import mimetypes
import re
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "template.html"
CONSTANTS = {"logo": "LOGO_SRC", "mark": "MARK_SRC", "stamp": "STAMP_SRC", "watermark": "WATERMARK_SRC"}
FONT_TYPES = {".woff2": ("font/woff2", "woff2"), ".woff": ("font/woff", "woff"),
              ".ttf": ("font/ttf", "truetype"), ".otf": ("font/otf", "opentype")}
FONT_RULE = re.compile(r'^(\s*@font-face \{ font-family: "Kufam";.*?src: )url\("[^"]*"\) format\("[^"]*"\)(; \})$', re.M)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("which", choices=[*CONSTANTS, "font"])
    parser.add_argument("image", nargs="?", type=Path, help="the image (or, for font, the .woff2/.ttf file)")
    parser.add_argument("--clear", action="store_true", help="remove the image (logo falls back to the owner's name as text)")
    args = parser.parse_args()

    if args.clear and args.which == "font":
        sys.exit("set_asset.py: the font cannot be cleared; Kufam is the only brand font")
    if args.clear:
        data = ""
    else:
        if not args.image or not args.image.is_file():
            sys.exit(f"set_asset.py: file not found: {args.image}")
        data = base64.b64encode(args.image.read_bytes()).decode()

    html = TEMPLATE.read_text(encoding="utf-8")
    if args.which == "font":
        kind = FONT_TYPES.get(args.image.suffix.lower())
        if not kind:
            sys.exit(f"set_asset.py: font must be one of {', '.join(FONT_TYPES)}")
        if not FONT_RULE.search(html):
            sys.exit(f"set_asset.py: the Kufam @font-face line was not found in {TEMPLATE}")
        src = f'url("data:{kind[0]};base64,{data}") format("{kind[1]}")'
        html = FONT_RULE.sub(lambda m: m.group(1) + src + m.group(2), html, count=1)
    else:
        mime = mimetypes.guess_type(args.image.name)[0] or "image/png" if data else ""
        uri = f"data:{mime};base64,{data}" if data else ""
        pattern = re.compile(rf'^const {CONSTANTS[args.which]} = ".*";$', re.M)
        if not pattern.search(html):
            sys.exit(f"set_asset.py: {CONSTANTS[args.which]} not found in {TEMPLATE}")
        html = pattern.sub(lambda _: f'const {CONSTANTS[args.which]} = "{uri}";', html, count=1)
    TEMPLATE.write_text(html, encoding="utf-8")
    print(f"{args.which}: {'cleared' if args.clear else args.image} -> {TEMPLATE}")


if __name__ == "__main__":
    main()

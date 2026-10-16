#!/usr/bin/env python3
"""Embed the Tawa Najd logo, mark, or stamp into assets/template.html as base64.

    python3 set_asset.py logo  brand/logo/transparent/logo-horizontal-white.svg
    python3 set_asset.py mark  brand/logo/transparent/mark-white.svg
    python3 set_asset.py stamp path/to/stamp.png
    python3 set_asset.py watermark brand/logo/transparent/logo-stacked-green.svg
    python3 set_asset.py logo --clear

The header band is green, so logo and mark must be the white, transparent versions;
the watermark sits on white paper, so it takes the green one.

Every document built afterwards carries the new image. Documents already
built keep the image they were built with; rebuild them to update.
"""
import argparse
import base64
import mimetypes
import re
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "template.html"
CONSTANTS = {"logo": "LOGO_SRC", "mark": "MARK_SRC", "stamp": "STAMP_SRC", "watermark": "WATERMARK_SRC"}


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("which", choices=CONSTANTS)
    parser.add_argument("image", nargs="?", type=Path)
    parser.add_argument("--clear", action="store_true", help="remove the image (logo falls back to the company name as text)")
    args = parser.parse_args()

    if args.clear:
        uri = ""
    else:
        if not args.image or not args.image.is_file():
            sys.exit(f"set_asset.py: image not found: {args.image}")
        mime = mimetypes.guess_type(args.image.name)[0] or "image/png"
        uri = f"data:{mime};base64,{base64.b64encode(args.image.read_bytes()).decode()}"

    html = TEMPLATE.read_text(encoding="utf-8")
    pattern = re.compile(rf'^const {CONSTANTS[args.which]} = ".*";$', re.M)
    if not pattern.search(html):
        sys.exit(f"set_asset.py: {CONSTANTS[args.which]} not found in {TEMPLATE}")
    html = pattern.sub(lambda _: f'const {CONSTANTS[args.which]} = "{uri}";', html, count=1)
    TEMPLATE.write_text(html, encoding="utf-8")
    print(f"{args.which}: {'cleared' if args.clear else args.image} -> {TEMPLATE}")


if __name__ == "__main__":
    main()

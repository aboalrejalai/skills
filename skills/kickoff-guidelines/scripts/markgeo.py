#!/usr/bin/env python3
"""Read a logo mark's geometry: its paths, its construction grid, and its symmetries.

    python3 markgeo.py mark.svg            # JSON report

The construction slide draws the mark on a square grid whose unit X is the mark's stroke
thickness. This module finds that grid from the path coordinates instead of guessing:
the grid is the coarsest one on which every horizontal and vertical edge of the mark falls
(within 2% of a unit). It also measures what the construction text may claim:

  cols, rows, unit, origin   the grid (unit in the SVG's own coordinates)
  minEdgeGap                 smallest distance between two parallel edges, in units
                             (1.0 means the thinnest stroke is exactly X)
  angles                     every edge direction in the mark, in degrees (0 and 90 are
                             horizontal and vertical; 45 means 45-degree chamfers)
  symmetry                   share of ink that matches after rotating the mark by 90, 180
                             or 270 degrees about its centre, or mirroring it (1.0 = exact)
  highlight                  [col, row] of the first grid cell fully covered by ink,
                             scanning from the top row; used to mark X on the slide
  gridless                   why there is no grid, when "grid" is null

A grid is reported only when it means something: the mark has straight edges only (M, L,
H, V, Z, polygon, rect), at least one horizontal and one vertical edge, edges a grid of up
to 64 cells can hold, and one cell fully inked (so X really is the stroke thickness).
Otherwise "grid" is null, "gridless" says why, and brand.json must list "construction" in
"skip" (or set construction.cols/rows/unit/origin/highlight by hand). Symmetry is measured
on the straight-edge outline, so a mark with curves reports "symmetry": null.
"""
import json
import math
import re
import sys
from pathlib import Path

NUM = r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?"
TOKEN = re.compile(rf"[MmLlHhVvZzCcSsQqTtAa]|{NUM}")


class MarkError(ValueError):
    pass


def _attr(tag, name):
    m = re.search(rf'\s{name}\s*=\s*"([^"]*)"', tag) or re.search(rf"\s{name}\s*=\s*'([^']*)'", tag)
    if m:
        return m.group(1)
    style = re.search(r'\sstyle\s*=\s*"([^"]*)"', tag)
    if style:
        m = re.search(rf"(?:^|;)\s*{name}\s*:\s*([^;]+)", style.group(1))
        if m:
            return m.group(1).strip()
    return None


def read_mark(svg_path):
    """Return {"viewBox": "x y w h", "paths": [{"d", "rule"}]} from a flat, single-colour mark SVG."""
    text = Path(svg_path).read_text(encoding="utf-8")
    root = re.search(r"<svg\b[^>]*>", text)
    if not root:
        raise MarkError(f"{svg_path}: no <svg> element")
    vb = _attr(root.group(0), "viewBox")
    if not vb:
        w, h = _attr(root.group(0), "width"), _attr(root.group(0), "height")
        if not (w and h):
            raise MarkError(f"{svg_path}: the <svg> has no viewBox or width/height")
        vb = f"0 0 {float(re.sub('[a-z%]', '', w))} {float(re.sub('[a-z%]', '', h))}"
    vb = " ".join(f"{float(v):g}" for v in re.split(r"[\s,]+", vb.strip()))
    body = text[root.end():]
    if re.search(r"\stransform\s*=", body):
        raise MarkError(f"{svg_path}: the mark uses transform attributes; flatten it (export plain paths) first")
    if re.search(r"<(image|text|use)\b", body):
        raise MarkError(f"{svg_path}: the mark contains <image>, <text> or <use>; it must be plain vector paths")
    paths = []
    for tag in re.findall(r"<(?:path|polygon|polyline|rect)\b[^>]*>", body):
        rule = _attr(tag, "fill-rule") or "nonzero"
        if tag.startswith("<path"):
            d = _attr(tag, "d")
        elif tag.startswith("<rect"):
            x, y = float(_attr(tag, "x") or 0), float(_attr(tag, "y") or 0)
            w, h = float(_attr(tag, "width")), float(_attr(tag, "height"))
            d = f"M {x} {y} L {x + w} {y} L {x + w} {y + h} L {x} {y + h} Z"
        else:
            pts = re.findall(NUM, _attr(tag, "points") or "")
            pairs = [f"{pts[i]} {pts[i + 1]}" for i in range(0, len(pts) - 1, 2)]
            d = "M " + " L ".join(pairs) + (" Z" if tag.startswith("<polygon") else "")
        if d and (_attr(tag, "fill") or "").lower() != "none":
            paths.append({"d": " ".join(d.split()), "rule": rule})
    if not paths:
        raise MarkError(f"{svg_path}: no filled path found")
    return {"viewBox": vb, "paths": paths}


def polygons(d):
    """Split a path into closed polygons. Returns (polys, has_curves)."""
    toks = TOKEN.findall(d)
    polys, cur, i, cmd = [], [], 0, None
    x = y = sx = sy = 0.0
    curves = False

    def num():
        nonlocal i
        i += 1
        return float(toks[i - 1])

    while i < len(toks):
        if re.fullmatch(r"[A-Za-z]", toks[i]):
            cmd = toks[i]
            i += 1
            if cmd in "Zz":
                if cur:
                    polys.append(cur)
                cur, x, y = [], sx, sy
                continue
        if cmd is None:
            raise MarkError("path data does not start with a command")
        rel = cmd.islower()
        c = cmd.upper()
        if c == "M":
            nx, ny = num(), num()
            if rel:
                nx, ny = nx + x, ny + y
            if cur:
                polys.append(cur)
            cur, x, y, sx, sy = [(nx, ny)], nx, ny, nx, ny
            cmd = "l" if rel else "L"
            continue
        if c == "L":
            nx, ny = num(), num()
            x, y = (nx + x, ny + y) if rel else (nx, ny)
        elif c == "H":
            nx = num()
            x = nx + x if rel else nx
        elif c == "V":
            ny = num()
            y = ny + y if rel else ny
        else:
            curves = True
            n = {"C": 6, "S": 4, "Q": 4, "T": 2, "A": 7}[c]
            vals = [num() for _ in range(n)]
            nx, ny = vals[-2], vals[-1]
            x, y = (nx + x, ny + y) if rel else (nx, ny)
        cur.append((x, y))
    if cur:
        polys.append(cur)
    return polys, curves


def _inside(pt, polys, rule):
    px, py = pt
    winding, crossings = 0, 0
    for poly in polys:
        n = len(poly)
        for k in range(n):
            (x1, y1), (x2, y2) = poly[k], poly[(k + 1) % n]
            if (y1 <= py) != (y2 <= py):
                xi = x1 + (py - y1) * (x2 - x1) / (y2 - y1)
                if xi > px:
                    crossings += 1
                    winding += 1 if y2 > y1 else -1
    return crossings % 2 == 1 if rule == "evenodd" else winding != 0


def analyse(mark, max_cells=64, tol=0.02):
    shapes = []
    curves = False
    for p in mark["paths"]:
        polys, c = polygons(p["d"])
        curves |= c
        shapes.append((polys, p["rule"]))
    pts = [pt for polys, _ in shapes for poly in polys for pt in poly]
    minx, maxx = min(p[0] for p in pts), max(p[0] for p in pts)
    miny, maxy = min(p[1] for p in pts), max(p[1] for p in pts)
    w, h = maxx - minx, maxy - miny
    eps = max(w, h) * 1e-4

    xs, ys, angles = set(), set(), set()
    for polys, _ in shapes:
        for poly in polys:
            for k in range(len(poly)):
                (x1, y1), (x2, y2) = poly[k], poly[(k + 1) % len(poly)]
                if abs(x1 - x2) < eps and abs(y1 - y2) < eps:
                    continue
                if abs(x1 - x2) < eps:
                    xs.add(round(x1, 4))
                if abs(y1 - y2) < eps:
                    ys.add(round(y1, 4))
                angles.add(round(math.degrees(math.atan2(y2 - y1, x2 - x1)) % 180, 1))

    def ink(pt):
        return any(_inside(pt, polys, rule) for polys, rule in shapes)

    report = {
        "viewBox": mark["viewBox"],
        "bbox": [round(minx, 3), round(miny, 3), round(w, 3), round(h, 3)],
        "curves": curves,
        "angles": sorted(angles),
    }

    grid, why = None, None
    if curves:
        why = "the mark has curves; a square grid cannot describe it"
    elif not xs or not ys:
        why = "the mark has no horizontal and vertical edges to put on a grid"
    else:
        span = max(w, h)
        for n in range(2, max_cells + 1):
            u = span / n
            on = lambda v, o: abs((v - o) / u - round((v - o) / u)) < tol  # noqa: E731
            if all(on(v, minx) for v in xs) and all(on(v, miny) for v in ys) \
                    and on(minx + w, minx) and on(miny + h, miny):
                grid = {"cols": round(w / u), "rows": round(h / u), "unit": round(u, 4),
                        "origin": [round(minx, 4), round(miny, 4)]}
                break
        if not grid:
            why = f"no grid of up to {max_cells} cells holds every horizontal and vertical edge"

    if grid:
        u = grid["unit"]
        gaps = [b - a for vals in (sorted(xs), sorted(ys)) for a, b in zip(vals, vals[1:]) if b - a > eps]
        report["minEdgeGap"] = round(min(gaps) / u, 3) if gaps else None
        report["axisEdges"] = {"x": sorted(round((v - minx) / u, 3) for v in xs),
                               "y": sorted(round((v - miny) / u, 3) for v in ys)}
        grid["highlight"] = None
        for r in range(grid["rows"]):
            for c in range(grid["cols"]):
                samples = [(minx + (c + fx) * u, miny + (r + fy) * u)
                           for fx, fy in ((.5, .5), (.15, .15), (.85, .15), (.15, .85), (.85, .85))]
                if all(ink(s) for s in samples):
                    grid["highlight"] = [c, r]
                    break
            if grid["highlight"]:
                break
        if not report["minEdgeGap"]:
            grid, why = None, "the mark has no two parallel edges to measure a stroke between"
        elif not grid["highlight"]:
            grid, why = None, "no grid cell is fully inked, so the unit is not the stroke thickness"
    report["grid"] = grid
    if why:
        report["gridless"] = why

    if curves:
        report["symmetry"] = None
        return report
    cx, cy, n = minx + w / 2, miny + h / 2, 72
    transforms = {
        "rot90": lambda x, y: (cx - (y - cy), cy + (x - cx)),
        "rot180": lambda x, y: (2 * cx - x, 2 * cy - y),
        "rot270": lambda x, y: (cx + (y - cy), cy - (x - cx)),
        "mirrorLeftRight": lambda x, y: (2 * cx - x, y),
        "mirrorTopBottom": lambda x, y: (x, 2 * cy - y),
    }
    samples = [(minx + (i + .5) * w / n, miny + (j + .5) * h / n) for i in range(n) for j in range(n)]
    inked = {s: ink(s) for s in samples}
    sym = {}
    for name, t in transforms.items():
        both = either = 0
        for s, a in inked.items():
            b = ink(t(*s))
            either += a or b
            both += a and b
        sym[name] = round(both / either, 3) if either else 0
    report["symmetry"] = sym
    return report


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    try:
        mark = read_mark(sys.argv[1])
    except MarkError as e:
        sys.exit(f"markgeo.py: {e}")
    print(json.dumps(analyse(mark), indent=2))


if __name__ == "__main__":
    main()

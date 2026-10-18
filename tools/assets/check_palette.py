#!/usr/bin/env python3
"""Rumtide asset checker.

Checks every PNG under the given folders against the art bible:
  1. Every visible pixel uses a colour from the Endesga 32 palette.
  2. Alpha is binary (fully opaque or fully transparent), no soft edges.

Usage:
  python3 tools/assets/check_palette.py client/public/assets
  python3 tools/assets/check_palette.py client/public/assets --max-report 5

Exit code 0 when everything passes, 1 when any file fails, 2 on bad usage.
Needs Pillow (python3 -m pip install pillow). Reads files only, never writes.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is missing. Run: python3 -m pip install pillow", file=sys.stderr)
    sys.exit(2)

# Endesga 32 by ENDESGA, the palette locked in docs/GAME_DESIGN.md section 2.1.
ENDESGA32 = {
    "be4a2f", "d77643", "ead4aa", "e4a672", "b86f50", "733e39", "3e2731", "a22633",
    "e43b44", "f77622", "feae34", "fee761", "63c74d", "3e8948", "265c42", "193c3e",
    "124e89", "0099db", "2ce8f5", "ffffff", "c0cbdc", "8b9bb4", "5a6988", "3a4466",
    "262b44", "181425", "ff0044", "68386c", "b55088", "f6757a", "e8b796", "c28569",
}


def hex_of(rgb: tuple[int, int, int]) -> str:
    return "%02x%02x%02x" % rgb


def check_file(path: Path, max_report: int) -> list[str]:
    problems: list[str] = []
    try:
        img = Image.open(path).convert("RGBA")
    except Exception as exc:  # unreadable or not a real PNG
        return [f"cannot read image: {exc}"]
    off_palette: dict[str, int] = {}
    soft_alpha = 0
    for r, g, b, a in img.getdata():
        if a == 0:
            continue
        if a != 255:
            soft_alpha += 1
            continue
        h = hex_of((r, g, b))
        if h not in ENDESGA32:
            off_palette[h] = off_palette.get(h, 0) + 1
    if off_palette:
        worst = sorted(off_palette.items(), key=lambda kv: -kv[1])[:max_report]
        listing = ", ".join(f"#{h} x{n}" for h, n in worst)
        problems.append(
            f"{len(off_palette)} colours outside Endesga 32 ({sum(off_palette.values())} pixels). Worst: {listing}"
        )
    if soft_alpha:
        problems.append(f"{soft_alpha} pixels with partial transparency (alpha must be 0 or 255)")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description="Check Rumtide PNG assets against the art bible.")
    ap.add_argument("folders", nargs="+", help="folders (or single PNG files) to scan")
    ap.add_argument("--max-report", type=int, default=3, help="off palette colours to list per file")
    args = ap.parse_args()

    files: list[Path] = []
    for f in args.folders:
        p = Path(f)
        if p.is_file() and p.suffix.lower() == ".png":
            files.append(p)
        elif p.is_dir():
            files.extend(sorted(p.rglob("*.png")))
        else:
            print(f"not found: {f}", file=sys.stderr)
            return 2
    if not files:
        print("No PNG files found. Nothing to check.")
        return 0

    failed = 0
    for path in files:
        problems = check_file(path, args.max_report)
        if problems:
            failed += 1
            print(f"FAIL {path}")
            for line in problems:
                print(f"     {line}")
        else:
            print(f"ok   {path}")
    print(f"\n{len(files) - failed} of {len(files)} files pass the art bible.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

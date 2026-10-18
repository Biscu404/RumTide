#!/usr/bin/env python3
"""Prose rule checker for Rumtide.

The repo rule (CLAUDE.md): no dashes in prose written for docs, comments or game text.
This script flags the em dash and en dash characters, and in Markdown files a spaced
hyphen used as a dash. It does not flag hyphens inside words, code flags or fenced code.

Usage:
  python3 tools/agents/check_prose.py docs client/src
  python3 tools/agents/check_prose.py docs --ext .md .ts

Exit code 0 when clean, 1 when anything is flagged, 2 on bad usage.
Reads files only, never writes.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

EM = "\u2014"
EN = "\u2013"
SPACED_HYPHEN = re.compile(r"(?<=\S) - (?=\S)")
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".claude", "coverage"}


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    hits: list[tuple[int, str, str]] = []
    in_fence = False
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return hits
    for n, line in enumerate(text.splitlines(), start=1):
        if path.suffix == ".md" and line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if EM in line:
            hits.append((n, "em dash", line.strip()[:100]))
        if EN in line:
            hits.append((n, "en dash", line.strip()[:100]))
        if path.suffix == ".md" and not in_fence and SPACED_HYPHEN.search(re.sub("`[^`]*`", "", line)):
            if not line.lstrip().startswith("|"):  # table rows, skip
                hits.append((n, "spaced hyphen", line.strip()[:100]))
    return hits


def main() -> int:
    ap = argparse.ArgumentParser(description="Flag dashes in prose files.")
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--ext", nargs="+", default=[".md", ".ts", ".tsx", ".json", ".txt"])
    args = ap.parse_args()

    files: list[Path] = []
    for p in map(Path, args.paths):
        if p.is_file():
            files.append(p)
        elif p.is_dir():
            for f in sorted(p.rglob("*")):
                if f.is_file() and f.suffix in args.ext and not f.name.endswith((".test.ts", ".test.tsx")) and not (set(f.parts) & SKIP_DIRS):
                    files.append(f)
        else:
            print(f"not found: {p}", file=sys.stderr)
            return 2

    total = 0
    for f in files:
        for n, kind, snippet in scan_file(f):
            total += 1
            print(f"{f}:{n}: {kind}: {snippet}")
    print(f"\n{total} dash problems in {len(files)} files.")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())

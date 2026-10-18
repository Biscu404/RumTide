#!/usr/bin/env bash
# Installs the third party Claude Code skills Rumtide uses, pinned to exact commits.
#
#   tools/agents/install_third_party.sh [--all-phaser] [--with-webapp-testing] [--force] [--dry-run]
#
# What it installs into .claude/skills/ :
#   * Phaser 4 skills, from the official phaserjs/phaser repo at tag v4.2.1 (MIT).
#     Default: the 16 skills Rumtide needs. --all-phaser installs all 28.
#   * pixel-art-studio by Gamezxz (MIT): Claude draws sprites with Python and Pillow.
#   * webapp-testing from anthropics/skills (Apache 2.0), only with --with-webapp-testing.
#
# Safety: every download is pinned to a full commit hash and verified after fetching.
# If the hash does not match, the script stops and installs nothing from that repo.
# To update a pin, read the upstream diff first, then change the hash below.
# Run from the repository root. Needs git. Works in Git Bash or WSL on Windows.

set -euo pipefail

PHASER_URL="https://github.com/phaserjs/phaser.git"
PHASER_SHA="41be1e462bc600064e498cba370bfa8c5c055a22"   # tag v4.2.1, 2026-07-09
PHASER_TAG="v4.2.1"

PIXEL_URL="https://github.com/Gamezxz/pixel-art-studio.git"
PIXEL_SHA="f8c246635c4621a6c2b427833149afdc3dc3c719"    # 2026-07-11

ANTH_URL="https://github.com/anthropics/skills.git"
ANTH_SHA="dbd4588f9e1033efb41dad4bef2f7947c8993d44"     # 2026-10-09

CORE_PHASER="game-setup-and-config scenes sprites-and-images animations tweens particles cameras \
scale-and-responsive loading-assets audio-and-sound tilemaps text-and-bitmaptext \
input-keyboard-mouse-touch events-system time-and-timers v3-to-v4-migration"
ALL_PHASER="actions-and-utilities animations audio-and-sound cameras curves-and-paths data-manager \
events-system filters-and-postfx game-object-components game-setup-and-config geometry-and-math \
graphics-and-shapes groups-and-containers input-keyboard-mouse-touch loading-assets particles \
physics-arcade physics-matter render-textures scale-and-responsive scenes sprites-and-images \
text-and-bitmaptext tilemaps time-and-timers tweens v3-to-v4-migration v4-new-features"

ALL=0; WEBTEST=0; FORCE=0; DRY=0
for arg in "$@"; do
  case "$arg" in
    --all-phaser) ALL=1 ;;
    --with-webapp-testing) WEBTEST=1 ;;
    --force) FORCE=1 ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

[ -d .claude ] || { echo "Run this from the repository root (no .claude folder here)." >&2; exit 2; }
command -v git >/dev/null || { echo "git is required." >&2; exit 2; }

SKILLS_DIR=".claude/skills"
LICENSE_DIR="tools/agents/licenses"
mkdir -p "$SKILLS_DIR" "$LICENSE_DIR"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# fetch_pinned URL SHA DIR [TAG] [SPARSE_PATHS...]
fetch_pinned() {
  local url="$1" sha="$2" dir="$3" tag="${4:-}"; shift 4 || true
  git init -q "$dir"
  git -C "$dir" remote add origin "$url"
  if [ "$#" -gt 0 ]; then
    git -C "$dir" sparse-checkout init --cone
    git -C "$dir" sparse-checkout set "$@"
  fi
  if ! git -C "$dir" fetch -q --depth 1 --filter=blob:none origin "$sha" 2>/dev/null; then
    [ -n "$tag" ] || { echo "Could not fetch $sha from $url" >&2; return 1; }
    git -C "$dir" fetch -q --depth 1 --filter=blob:none origin tag "$tag"
  fi
  git -C "$dir" checkout -q FETCH_HEAD
  local got; got="$(git -C "$dir" rev-parse HEAD)"
  if [ "$got" != "$sha" ]; then
    echo "HASH MISMATCH for $url: expected $sha, got $got. Nothing installed from it." >&2
    return 1
  fi
}

copy_skill() { # SRC_DIR NAME
  local src="$1" name="$2" dest="$SKILLS_DIR/$2"
  if [ -e "$dest" ] && [ "$FORCE" -eq 0 ]; then
    echo "  skip   $name (already installed, use --force to replace)"; return
  fi
  if [ "$DRY" -eq 1 ]; then echo "  would install $name"; return; fi
  rm -rf "$dest"; mkdir -p "$dest"
  cp -R "$src"/. "$dest"/
  echo "  added  $name"
}

echo "1/3 Phaser skills (tag $PHASER_TAG, commit ${PHASER_SHA:0:8})"
if [ "$ALL" -eq 1 ]; then PH_LIST="$ALL_PHASER"; else PH_LIST="$CORE_PHASER"; fi
PH_DIR="$WORK/phaser"
# shellcheck disable=SC2086
fetch_pinned "$PHASER_URL" "$PHASER_SHA" "$PH_DIR" "$PHASER_TAG" skills
for s in $PH_LIST; do
  [ -f "$PH_DIR/skills/$s/SKILL.md" ] || { echo "  missing $s upstream, skipping" >&2; continue; }
  copy_skill "$PH_DIR/skills/$s" "$s"
done
[ "$DRY" -eq 1 ] || cp "$PH_DIR/LICENSE.md" "$LICENSE_DIR/phaser-LICENSE.md" 2>/dev/null || true

echo "2/3 pixel-art-studio (commit ${PIXEL_SHA:0:8})"
PX_DIR="$WORK/pixel"
fetch_pinned "$PIXEL_URL" "$PIXEL_SHA" "$PX_DIR" "" 
PX_STAGE="$WORK/pixel-stage"; mkdir -p "$PX_STAGE"
cp "$PX_DIR/SKILL.md" "$PX_STAGE/"; cp -R "$PX_DIR/scripts" "$PX_STAGE/"; cp -R "$PX_DIR/references" "$PX_STAGE/"
[ -f "$PX_DIR/LICENSE" ] && cp "$PX_DIR/LICENSE" "$PX_STAGE/"
copy_skill "$PX_STAGE" "pixel-art-studio"
[ "$DRY" -eq 1 ] || { [ -f "$PX_DIR/LICENSE" ] && cp "$PX_DIR/LICENSE" "$LICENSE_DIR/pixel-art-studio-LICENSE" || true; }

echo "3/3 webapp-testing (commit ${ANTH_SHA:0:8})"
if [ "$WEBTEST" -eq 1 ]; then
  AN_DIR="$WORK/anth"
  fetch_pinned "$ANTH_URL" "$ANTH_SHA" "$AN_DIR" "" skills/webapp-testing
  copy_skill "$AN_DIR/skills/webapp-testing" "webapp-testing"
else
  echo "  skipped (add --with-webapp-testing if you want Playwright UI checks)"
fi

echo
echo "Done. Next: read what was installed before you trust it."
echo "  grep -rn -E 'allowed-tools|hooks|subprocess|requests|urllib|socket' $SKILLS_DIR"
echo "  python3 -m pip install pillow    # needed by pixel-art-studio and the palette checker"

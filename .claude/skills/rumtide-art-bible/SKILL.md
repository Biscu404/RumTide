---
name: rumtide-art-bible
description: "Rumtide's visual rules: the locked Endesga 32 palette, tile and sprite sizes, replay resolution, UI look, colour blind safe icons, file naming and the asset check. Use before making, importing or reviewing any sprite, tile, icon, UI style, font or animation."
---

# Rumtide art bible

Source: `docs/GAME_DESIGN.md` section 2. If this file and that section disagree, the document wins and this file needs fixing.

## The one rule

Every visible pixel in the repo uses one of the 32 Endesga 32 colours. No exceptions, no blends. Check with `python3 tools/assets/check_palette.py <path>` (also `npm run assets:check`).

## Palette roles

| Role | Hex |
|-|-|
| Deep sea | `#124e89`, `#262b44` |
| Shallows and highlights | `#0099db`, `#2ce8f5` |
| Sand and parchment | `#ead4aa`, `#e4a672` |
| Wood | `#b86f50`, `#733e39`, `#3e2731` |
| Gold and coins | `#feae34`, `#fee761` |
| Jungle | `#63c74d`, `#3e8948`, `#265c42` |
| Danger, blood, bounty | `#e43b44`, `#a22633` |
| UI ink and night | `#181425`, `#3a4466` |
| Foam, sails, text on dark | `#ffffff`, `#c0cbdc` |

The checker accepts all 32 palette colours, so the other twelve are available when a role needs a shade the table lacks.

## Sizes

* Map tiles: 16 by 16. Water is a 4 frame loop. Islands are hand placed tiles.
* Ships: sloop 32 by 32, brigantine 48 by 48, frigate 64 by 64. Sail colour and flag are player cosmetics, made as cheap palette swaps.
* Replays: internal resolution 320 by 180, scaled up by whole numbers only. Two ships side on, cannon smoke, splash columns, grappling lines, a crew of 4 tiny sailors that cheer or panic.
* Map nodes (ports, reefs, wrecks) are clear icons on top of the pretty map, joined by dotted sea lane lines.

## UI look

* Parchment panels on dark wood frames, like a captain's desk at night.
* Menus, forms and the Tide Report are HTML styled to look pixel, so they reflow on any screen. Only the map and battle replays are canvas.
* Phone first. Test on a small phone in sunlight.
* Pixel font for headings and numbers (m5x7, m6x11 or Pixelify Sans), rendered at whole number sizes.
* Every number that goes up gets a tiny celebration: coins arc into the chest, the bar ticks.
* Colour blind safe: maneuver icons differ by shape as well as colour. Never carry meaning with colour alone.

## Never

* Anti aliasing, gradients, blur, glow with soft edges.
* Semi transparent pixels. Alpha is 0 or 255.
* Scaling by anything but whole numbers, or mixing pixel densities in one view.
* Any colour outside Endesga 32.
* Imported art that has not been recoloured with `pixelpipe.py --palette endesga32`.

## House rules (proposed, confirm with Biscu before treating as law)

* One pixel dark outline in `#181425` on ships and characters.
* Light comes from the top left.
* Shading ramps shift hue (warmer in light, cooler in shadow) instead of only darkening.

## Files

* Final PNGs: `client/public/assets/sprites/<group>/` where group is one of ships, tiles, ui, fx, icons.
* Names: lowercase with underscores and the size, for example `ship_sloop_32.png`. Sheets end in `_sheet.png` with a matching `.json`.
* Build scripts: `art/src/`. Briefs: `art/briefs/`. Previews: `art/previews/` (not committed).
* Imported art: record source, author and licence in `client/public/assets/CREDITS.md`.

## Review checklist

1. Palette check passes.
2. Reads clearly at 1x on a phone.
3. Matches its neighbours: outline, shading, light direction, pixel density.
4. Correct size and frame count.
5. Meaning does not depend on colour alone.
6. Source and licence recorded if imported.

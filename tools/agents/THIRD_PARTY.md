# Third party material

Everything here is pinned to an exact commit by `tools/agents/install_third_party.sh`. Read the upstream diff before you change a pin.

| What | Source | Pinned to | Licence | Installed as |
|-|-|-|-|-|
| Phaser 4 agent skills (16 of 28 by default) | https://github.com/phaserjs/phaser | tag v4.2.1, commit 41be1e462bc600064e498cba370bfa8c5c055a22 | MIT | `.claude/skills/<name>/` |
| pixel-art-studio | https://github.com/Gamezxz/pixel-art-studio | commit f8c246635c4621a6c2b427833149afdc3dc3c719 | MIT | `.claude/skills/pixel-art-studio/` |
| webapp-testing (optional) | https://github.com/anthropics/skills | commit dbd4588f9e1033efb41dad4bef2f7947c8993d44 | Apache 2.0 | `.claude/skills/webapp-testing/` |

## Inspiration, nothing copied

The role split, the preloaded skills idea and the report format are inspired by Claude Code Game Studios by Donchitos (https://github.com/Donchitos/Claude-Code-Game-Studios, MIT, commit be8993bbc5a1f016bc770b2846ce06272d284526). The agent files in this repo were rewritten for Rumtide and contain none of its text.

## Looked at and not used

* opusgamelabs/game-creator: built for Phaser 3, requires its own EventBus and `window.__GAME__` conventions, and no licence file was found in the repo when it was checked on 18 October 2026.
* AlterLab_GameForge: last commit March 2026, engine neutral and generic.
* The Godot, Unity and Unreal specialists in Claude Code Game Studios.

## Licences

Upstream licence files are copied to `tools/agents/licenses/` by the installer.

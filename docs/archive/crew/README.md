# Parked crew roles

Parked on 7 November 2026 so that every session stops loading their descriptions. Nothing in them was changed. Engine, balance, simulator and doc work never used them, and the art and sound work they are for has not started.

* Parked roles: `art-director`, `pixel-artist`, `sound-designer`, `producer`, `qa-tester`, `game-designer` (in `agents/`).
* Parked skills: `feature` and `gate` (in `skills/`). They delegate to the parked roles, so they only work with all of them restored.
* Still live in `.claude/agents/`: `narrative-writer` (player facing text) and `engineer`.

To restore everything, run these two commands from the repository root:

```
git mv docs/archive/crew/agents/*.md .claude/agents/
git mv docs/archive/crew/skills/feature docs/archive/crew/skills/gate .claude/skills/
```

To restore only the art roles, move just `art-director.md` and `pixel-artist.md`. Then update the Crew section of `CLAUDE.md` so it names the live roles.

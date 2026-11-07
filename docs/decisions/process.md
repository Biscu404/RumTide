# Process decisions (archive)

Process only entries (no game rule, no ids), moved word for word out of `docs/DECISIONS.md` on 7 November 2026 so that file can be read in one go. Newest first. They count as `docs/DECISIONS.md` in the order of authority.

## 2026-11-06: CLAUDE.md trimmed (process)

Process only. CLAUDE.md went from about 8.6 KB to about 7.2 KB. The wording was tightened. No rule was removed or changed, and no game rule changed.

## 2026-11-05: Using fewer tokens, round 2 (process)

Process only. No game rule, balance number or engine file changed. Round 1 split this file and added "Saving tokens"; round 2 cuts what every session loads and what a task reads by default.

* **`docs/GAMEPLAY.md` is an index now.** The text moved word for word into `docs/gameplay/`, one file per top level section (`00-how-to-read.md` for the intro and the v0.2 change table, then `01-time.md` to `22-open-decisions.md`), every line under 2,000 characters. Section numbers are unchanged, so "GAMEPLAY 8.9" in code and docs still means the heading `## 8.9`, which is now in `docs/gameplay/08-combat.md`. The index keeps the title and version line and has one line per file with its section numbers. `08-combat.md` is the only big file (about 37 KB), so read just its part.
* **The 16 Phaser API skills were parked** with `git mv` in `docs/reference/phaser/` (each folder keeps its `SKILL.md` and `references/REFERENCE.md`), so they no longer add 16 skill descriptions to every session. They are read on demand: CLAUDE.md says to read the matching file before any Phaser work, and `.claude/agents/engineer.md` and `docs/CREW.md` say the same. `tools/agents/check_prose.py` skips `docs/reference/`, because those notes are third party text kept as written (they hold 52 spaced hyphens and dashes). `feature`, `gate`, the `rumtide` skills and `pixel-art-studio` stay in `.claude/skills/`.
* **CLAUDE.md went from about 10.9 KB to about 8.6 KB.** "Current focus" is gone: the next task is written in `docs/STATUS.md` and nowhere else, and the Definition of done no longer asks for a CLAUDE.md edit. The v0.2 design index became two lines (v0.3 sections through the GAMEPLAY index, GAME_DESIGN sections by Grep, with 4.4 and 14 kept as the two rules from the old index). The long command help moved word for word into the new `docs/COMMANDS.md`, with one short line per command left in CLAUDE.md. The repeated rules were merged (the Phaser pin and the Preact rule are in Stack and rules once, engine purity and randomness once). It did not reach 6 KB, because every rule was kept.
* **The crew rule changed.** Engine, balance, simulator and doc tasks are done in the main session and never delegated. A role is used only for art, sound or player facing text, or when Biscu runs `/feature` or `/gate`. `docs/STATUS.md` no longer names roles on the next task line.
* **`docs/CREW.md` lost Parts 1 to 3** (install, verify, first real runs C1 to C7), moved word for word into `docs/archive/CREW-install.md` with a two line header. Parts 4 to 8 and the appendices stay. The content tasks C2 to C5 that `docs/STATUS.md` points to are in the archive file.
* **Three more lines in "Saving tokens":** never read a test file over 20 KB whole (add new tests in a new small file next to the module, for example `shellback.p32b.test.ts`, and find helpers with Grep); read `git diff --stat` before the hunks of a golden Tide change; and the "Big docs" line now points to `docs/gameplay/`.
* **`.claude/settings.json` was added** with `permissions.deny` for Read of `./node_modules/**`, `./dist/**`, `./.claude/worktrees/**` and `./package-lock.json`. The deny also stops the Read tool on `node_modules/phaser/types/phaser.d.ts`, which the Phaser rule used to name, so the rule and "Searches" now allow one exception: a Bash grep for a single API name in that file.

## 2026-10-26: Using fewer tokens (process)

Biscu asked why Claude Code used so many tokens. No game rule changed.

* **This file was split.** It had grown to about 56,000 tokens, more than one read can hold, so every task hit a read error and read it again in pieces. Everything older than P3.2a moved to four files in `docs/decisions/`, listed at the top of this file, with every row kept word for word. The two rows over 2,000 characters (D211, D216) were split into two rows each, because longer lines are cut off when read.
* **CLAUDE.md gained a "Saving tokens" section:** long runs go in the background with `--json` into the git ignored `sim-results/` folder and are never polled, big docs are read by section, `.claude/worktrees` is never searched, subagents get exact sections, and `docs/STATUS.md` stays short.
* **The engineer and the game designer run on Sonnet** (`model: sonnet`), like qa-tester and sound-designer.
* **`docs/STATUS.md` was cut from about 9 KB to 3 KB.** It points to the ids here instead of repeating them.
* **The five old worktrees were removed** (all clean and merged), and `.claude/worktrees/` is git ignored, so searches no longer find old copies of the code.

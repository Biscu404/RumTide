# Rumtide: instructions for Claude Code

Rumtide is a pixel art pirate game for friends: asynchronous, browser first, growing from 6 players to many more. v0.2 runs one Tide (turn) a day; v0.3 runs two, at 13:00 and 20:00 Europe/Bucharest.

Next task and what waits on Biscu: `docs/STATUS.md`. Done work: `git log` and `docs/DECISIONS.md` (older in `docs/decisions/`). Task ids: the Rumtide Roadmap tracker on claude.ai. Research: `docs/RESEARCH.md`. Command help: `docs/COMMANDS.md`.

## Docs

* Order of authority when documents disagree: `docs/DECISIONS.md`, then `docs/GAMEPLAY.md` (the source of truth for `engine_v3`), then `docs/GAME_DESIGN.md`, which still covers the pillars, art and audio, co op, fairness and architecture.
* v0.3 sections are found through the index in `docs/GAMEPLAY.md`, which names the file in `docs/gameplay/` for each section number.
* `docs/GAME_DESIGN.md` (v0.2) sections are found by Grep for their heading, never by reading it whole. Its 4.4 (encounter rules) must be implemented exactly as written; its 14 holds `balance.ts` and the formulas to copy.

## Stack and rules

* TypeScript everywhere, built with Vite, tested with Vitest. Supabase (Postgres, Auth, Edge Functions, pg_cron). Static hosting on Cloudflare Pages. Every dependency is pinned to an exact version (`.npmrc` sets `save-exact`).
* Phaser 4, pinned to exactly `4.2.1`, for `MapScene` and `ReplayScene` only. Every menu, form and text screen is Preact. Before any Phaser work, read the matching file in `docs/reference/phaser/`; do not assume Phaser 3 APIs. For an API those notes miss, check https://docs.phaser.io or the installed types in `node_modules/phaser/types/phaser.d.ts`, which match the pin.
* The rules engines (`supabase/functions/_shared/engine` and `engine_v3`) are pure TypeScript: no network, no database, no `Date.now`, no `Math.random`. Randomness comes only from the seeded Rng passed in (in `engine_v3`, `rngFor(seed, ...labels)` in `engine_v3/rng.ts`; give every new kind of roll its own labels so it never shifts anyone else's rolls). Iterate collections in sorted id order so every Tide is reproducible from its snapshot and seed.
* Engine files import each other with the `.ts` extension (`./types.ts`), because Edge Functions run on Deno. The client and tools import the engine as `@engine/...`.
* Every gameplay number lives in `balance.ts`. Never hardcode one anywhere else. Season differences (length, cost multiplier, hulls, galleon Tides) come from `SEASON_PRESETS`.
* The client never writes game tables. All game writes go through Edge Functions, which validate with Zod and then with the engine. The server owns positions, stats, gold, cargo, outcomes and seeds. The logic of each function lives in `supabase/functions/_shared/api/handlers.ts` over the `GameStore` interface; each `index.ts` only wires a request to it. Change a migration and the `SupabaseStore` together.
* Every engine change needs a unit test. Run the tests and the bot season before finishing a task.
* Keep `supabase/` and `client/` cleanly separate. When a second developer joins, one owns `supabase/` and the other owns `client/`, and engine changes need both to review.

## Version 0.3 engine rules (engine_v3)

* `engine_v3` lives in `supabase/functions/_shared/engine_v3/`, next to the v0.2 `engine/`. Do not edit `engine/` while building v0.3, unless a task says so.
* Read the 2026-10-18 entry "Version 0.3 engine core" in `docs/decisions/v03-core-to-p3-1.md` before changing `engine_v3`, and add your own calls at the top of `docs/DECISIONS.md` with the task id.
* Engine functions never mutate their inputs; `resolveTide` clones the state it is given. Encounters go through the `EncounterResolver` hook in `tide.ts`, so combat stays out of movement code.
* Only erasable TypeScript in `engine_v3` (no enums, namespaces or parameter properties), so Node, Deno and the browser can all run it.
* Maps are JSON in `supabase/functions/_shared/maps/` (`cradle.json` is v0.3) and must pass `validateMap`.
* `engine_v3/golden/six-ships.json` is the golden Tide. If a change alters it on purpose, run `npm run golden:update`, read the diff and mention it. If it changes and you did not mean it to, you have a bug.

## How to work

* Do one task at a time and keep changes small. After each task, say what you changed and what to check.
* If a request conflicts with the design doc, say so before writing code.
* For v0.3 work, build only what the current brief in `docs/briefs/` asks for. New ideas go into `docs/IDEAS.md`, not into the code.
* Ask before adding a new dependency.
* When a design decision changes, update `docs/DECISIONS.md` in the same commit.
* Do not use dashes in prose you write (docs, comments, game text). Use commas or full stops instead.

## Saving tokens

Usage limits are shared by every session and subagent, so work cheaply:

* **Long runs.** The full `npm run sim:v3` (11 to 20 minutes) and long bot seasons pass the 10 minute command limit. Start them as a background command (`-- --json sim-results/<name>.json` for the simulator; make the git ignored `sim-results` folder first) and wait for the finish notice. Never wait with `sleep` loops, never check again and again, never start the same run twice. While tuning use `-- --quick` and `-- --check N`; do the full run once, at the end of the task.
* **Big docs.** Read the `docs/GAMEPLAY.md` index, then only the one file in `docs/gameplay/` you need (`08-combat.md` is about 9,000 tokens, so read just its part). `docs/GAME_DESIGN.md` (about 22,000) and `docs/decisions/` are too big to read whole: find the heading or decision id with Grep and read only that part, with an offset and a limit.
* **Tests.** Never read a test file over 20 KB whole. Add new tests in a new small file next to the module (for example `shellback.p32b.test.ts`) and find the helpers you need with Grep.
* **Golden Tide.** After a change, read `git diff --stat` first, then only the hunks you need.
* **Decisions.** `docs/DECISIONS.md` holds only the newest work; its top section says where older ids live and when to move old sections out. Keep every line of every doc under 2,000 characters, because longer lines are cut off when read and then edits on them fail.
* **Searches.** Never search or read inside `node_modules`, `dist`, `.claude/worktrees` or `package-lock.json` (`.claude/settings.json` denies Read of them). The one exception is a Bash grep for one API name in the Phaser types.
* **Subagents.** Each one starts with nothing and reads everything again. Do small tasks yourself. When you do delegate, name the exact sections to read, not whole files.
* **Doc updates.** Keep `docs/STATUS.md` short: the next task, a few lines on where things stand, and what waits on Biscu. The next task is written there and nowhere else; the details belong in `docs/DECISIONS.md` and nowhere else.

## Definition of done

A task is done when its own checks pass and all of this is true:

* In the same commit, update `docs/DECISIONS.md` with the new rule calls and `docs/STATUS.md` with the next task.
* Run `npm run check` and `npm run prose:check`. Run the full simulator only if the task's own check asks for it.
* Push the branch and open a pull request. Biscu let Claude merge pull requests on 19 October 2026: once both checks pass, merge it, pull `main`, and give Biscu the link and what to check.
* Never describe branch or merge state in a doc. Git and the pull request hold that.
* Biscu never edits docs by hand, so you make every doc change.

## Commands (flags and timings in `docs/COMMANDS.md`)

* `npm run dev`, `build`, `test`, `typecheck`, `check` (types and all tests)
* `npm run sim` v0.2 balance simulation; `bots` bot season; `sim:v3` v0.3 combat simulator, ten checks
* `npm run tide:demo` resolve one v0.3 Tide; `golden:update` rewrite the golden Tide
* `npm run assets:check` art palette; `prose:check` dashes in prose

## Crew (specialist roles)

* Eight roles live in `.claude/agents/` (producer, art-director, pixel-artist, game-designer, narrative-writer, engineer, qa-tester, sound-designer); see `docs/CREW.md`. Engine, balance, simulator and doc tasks are done in the main session, never delegated. Use a role only for art, sound or player facing text, or when Biscu runs `/feature` (one feature through the crew) or `/gate` (a quality gate).
* Art follows the `rumtide-art-bible` skill (Endesga 32 only); run `npm run assets:check` after touching assets. Player facing text follows `rumtide-lore`; run `npm run prose:check` after writing text.
* Roles report back in under 200 words: what changed, files touched, what to check, open questions.

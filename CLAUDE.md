# Rumtide: instructions for Claude Code

Rumtide is a pixel art pirate game for friends: asynchronous, browser first, 6 players growing to many more. v0.2 runs one Tide (turn) a day; v0.3 runs two, at 13:00 and 20:00 Europe/Bucharest.

Next task and what waits on Biscu: `docs/STATUS.md`. Done work: `git log` and `docs/DECISIONS.md` (older in `docs/decisions/`). Task ids: the Rumtide Roadmap tracker on claude.ai. Research: `docs/RESEARCH.md`. Command flags: `docs/COMMANDS.md`.

## Docs

* Authority when documents disagree: `docs/DECISIONS.md`, then `docs/GAMEPLAY.md` (source of truth for `engine_v3`), then `docs/GAME_DESIGN.md` (pillars, art and audio, co op, fairness, architecture).
* Find v0.3 sections through the index in `docs/GAMEPLAY.md`, which names the file in `docs/gameplay/` for each section number. Find `docs/GAME_DESIGN.md` (v0.2) sections by Grep for the heading, never by reading it whole. Its 4.4 (encounter rules) must be implemented exactly as written; its 14 holds `balance.ts` and the formulas to copy.

## Stack and rules

* TypeScript, Vite, Vitest. Supabase (Postgres, Auth, Edge Functions, pg_cron). Cloudflare Pages. Pin every dependency to an exact version (`.npmrc` sets `save-exact`); ask before adding one.
* Phaser 4, exactly `4.2.1`, for `MapScene` and `ReplayScene` only; every menu, form and text screen is Preact. Before Phaser work read the matching file in `docs/reference/phaser/`; never assume Phaser 3 APIs. For a missing API check https://docs.phaser.io or `node_modules/phaser/types/phaser.d.ts`.
* Both engines (`supabase/functions/_shared/engine` and `engine_v3`) are pure TypeScript: no network, no database, no `Date.now`, no `Math.random`. Randomness comes only from the seeded Rng (in `engine_v3`, `rngFor(seed, ...labels)` in `engine_v3/rng.ts`; every new kind of roll gets its own labels). Iterate collections in sorted id order so every Tide replays from its snapshot and seed.
* Engine files import each other with the `.ts` extension (Deno); client and tools import `@engine/...`.
* Every gameplay number lives in `balance.ts`, never elsewhere. Season differences come from `SEASON_PRESETS`.
* The client never writes game tables. Writes go through Edge Functions, which validate with Zod, then the engine. The server owns positions, stats, gold, cargo, outcomes and seeds. Logic lives in `supabase/functions/_shared/api/handlers.ts` over `GameStore`; each `index.ts` only wires a request. Change a migration and `SupabaseStore` together.
* Every engine change needs a unit test. Run the tests and the bot season before finishing a task.
* Keep `supabase/` and `client/` separate. With a second developer, one owns each and engine changes need both to review.

## engine_v3

* Lives in `supabase/functions/_shared/engine_v3/`. Do not edit the v0.2 `engine/` unless a task says so.
* Before changing it, read the 2026-10-18 entry "Version 0.3 engine core" in `docs/decisions/v03-core-to-p3-1.md`. Add your own calls at the top of `docs/DECISIONS.md` with the task id.
* Functions never mutate inputs; `resolveTide` clones its state. Encounters go through the `EncounterResolver` hook in `tide.ts`.
* Erasable TypeScript only (no enums, namespaces or parameter properties), so Node, Deno and browsers run it.
* Maps are JSON in `supabase/functions/_shared/maps/` and must pass `validateMap`.
* `engine_v3/golden/six-ships.json` is the golden Tide. If you changed it on purpose, run `npm run golden:update`, read the diff and mention it. If you did not mean to, you have a bug.

## How to work

* One task at a time, small changes. After each, say what changed and what to check.
* If a request conflicts with the design doc, say so before writing code.
* For v0.3, build only what the current brief in `docs/briefs/` asks. New ideas go in `docs/IDEAS.md`.
* When a design decision changes, update `docs/DECISIONS.md` in the same commit.
* No dashes in prose you write (docs, comments, game text); use commas or full stops.

## Saving tokens

Usage limits are shared by every session and subagent.

* **Long runs.** Full `npm run sim:v3` (11 to 20 minutes) and long bot seasons pass the 10 minute command limit: run them in the background (`-- --json sim-results/<name>.json`; make the git ignored `sim-results` folder first) and wait for the finish notice. No `sleep` loops, no repeated checks, never start the same run twice. While tuning use `-- --quick` and `-- --check N`; run the full one once, at the end.
* **Big docs.** Read the `docs/GAMEPLAY.md` index, then only the one `docs/gameplay/` file you need (`08-combat.md` is about 9,000 tokens: read just its part). `docs/GAME_DESIGN.md` and `docs/decisions/` are too big to read whole: Grep the heading or decision id and read that part with an offset and a limit.
* **Tests.** Never read a test file over 20 KB whole. Add new tests in a new small file next to the module (like `shellback.p32b.test.ts`); Grep for helpers.
* **Golden Tide.** Read `git diff --stat` first, then only the hunks you need.
* **Docs.** Keep every doc line under 2,000 characters (longer lines are cut off and edits on them fail). `docs/DECISIONS.md` holds only the newest work; its top section says where older ids live. Keep `docs/STATUS.md` short: the next task (written there and nowhere else), a few lines on where things stand, and what waits on Biscu. Details belong in `docs/DECISIONS.md` only.
* **Searches.** Never search or read `node_modules`, `dist`, `.claude/worktrees` or `package-lock.json` (`.claude/settings.json` denies Read of them), except a Bash grep for one API name in the Phaser types.
* **Subagents.** Each starts with nothing and rereads everything. Do small tasks yourself; when you delegate, name the exact sections to read.

## Definition of done

A task is done when its own checks pass and:

* In the same commit, `docs/DECISIONS.md` has the new rule calls and `docs/STATUS.md` the next task.
* `npm run check` and `npm run prose:check` pass. Run the full simulator only if the task's own check asks.
* Push the branch and open a pull request. Biscu let Claude merge pull requests on 19 October 2026: once both checks pass, merge it, pull `main`, and give Biscu the link and what to check.
* Never describe branch or merge state in a doc. Biscu never edits docs by hand, so you make every doc change.

## Commands (flags and timings in `docs/COMMANDS.md`)

`npm run dev`, `build`, `test`, `typecheck`, `check` (types and all tests), `sim` (v0.2 balance), `bots` (bot season), `sim:v3` (v0.3 combat simulator, ten checks), `tide:demo` (resolve one v0.3 Tide), `golden:update`, `assets:check` (art palette), `prose:check` (dashes in prose).

## Crew

* Eight roles in `.claude/agents/` (see `docs/CREW.md`). Engine, balance, simulator and doc tasks are done in the main session, never delegated. Use a role only for art, sound or player facing text, or when Biscu runs `/feature` or `/gate`.
* Art follows the `rumtide-art-bible` skill (Endesga 32 only; run `npm run assets:check`). Player facing text follows `rumtide-lore` (run `npm run prose:check`). Roles report in under 200 words: what changed, files touched, what to check, open questions.

# Rumtide: instructions for Claude Code

Rumtide is a pixel art pirate game for a small group of friends. It is asynchronous, browser first, built to grow from 6 players to many more. The v0.2 prototype runs one Tide (turn) per day; the v0.3 design moves to two Tides a day, at 13:00 and 20:00 Europe/Bucharest.

The full design is in `docs/GAME_DESIGN.md`. It is long, so do not read it all at once. Read only the sections you need, using the index below. Research and sources are in `docs/RESEARCH.md`.

## Current focus

* Next task: P2.4, the encounter: parley, the escape roll, the starting range, applying a battle to the world, towing, and the Captain and Step data model additions. Brief: `docs/briefs/P2-combat.md`. Task ids come from the Rumtide Roadmap tracker on claude.ai.
* Done work is in `git log` and `docs/DECISIONS.md`.
* Decisions waiting on Biscu are in `docs/STATUS.md`.

## Version 0.3 engine rules (engine_v3)

* The v0.3 engine lives in `supabase/functions/_shared/engine_v3/`, next to the v0.2 engine in `engine/`.
* `docs/GAMEPLAY.md` is the source of truth for v0.3 gameplay. Where it disagrees with `docs/GAME_DESIGN.md`, GAMEPLAY.md wins for `engine_v3`. GAME_DESIGN.md still covers the pillars, art and audio, co op, fairness and architecture.
* Read the 2026-10-18 entry in `docs/DECISIONS.md` before changing `engine_v3`, and add your own calls there with the task id.
* Do not edit the v0.2 `engine/` while building v0.3, unless a task says so.
* Randomness comes only from `rngFor(seed, ...labels)` in `engine_v3/rng.ts`. Give every new kind of roll its own labels so it never shifts anyone else's rolls.
* Engine functions never mutate their inputs; `resolveTide` clones the state it is given. Encounters go through the `EncounterResolver` hook in `tide.ts`, so combat stays out of movement code.
* Only erasable TypeScript in `engine_v3` (no enums, namespaces or parameter properties), so Node, Deno and the browser can all run it.
* Maps are JSON in `supabase/functions/_shared/maps/` (`cradle.json` is v0.3) and must pass `validateMap`.
* `engine_v3/golden/six-ships.json` is the golden Tide. If a change alters it on purpose, run `npm run golden:update`, read the diff and mention it. If it changes and you did not mean it to, you have a bug.

## Design doc index (docs/GAME_DESIGN.md, v0.2)

* Top of file: one page summary and the key decisions table
* 3.5: Season 0 beta scope, pacing tables, success checks
* 4: world, map, movement and encounter rules (4.4 must be implemented exactly as written)
* 5: ships, stats, upgrades, pacing
* 6: economy and trade
* 7: combat, loot, parley
* 8: co op and fleets
* 9: fairness and anti bullying rules
* 10: events and story
* 12: reminders, notifications, catch up for missed Tides
* 14: `balance.ts`, `SEASON_PRESETS` and all formulas (copy from here)
* 15: architecture, data model, what the server owns
* 16: scope tiers (what is in the MVP and what is not)
* 19: build plan, day by day

## Stack

* TypeScript everywhere, built with Vite, tested with Vitest
* Phaser 4, pinned to exactly `4.2.1`, for `MapScene` and `ReplayScene` only
* Preact for every menu, form and text screen
* Supabase: Postgres, Auth, Edge Functions, pg_cron
* Static hosting on Cloudflare Pages

## Rules

* The rules engine (`supabase/functions/_shared/engine`) is pure TypeScript. No network, no database, no `Date.now`, no `Math.random`. Randomness comes only from the seeded Rng passed in.
* Every gameplay number lives in `balance.ts`. Never hardcode one anywhere else. Season differences (length, cost multiplier, hulls, galleon Tides) come from `SEASON_PRESETS`.
* The client never writes game tables. All game writes go through Edge Functions, which validate with Zod and then with the engine. The server owns positions, stats, gold, cargo, outcomes and seeds. The logic of each function lives in `supabase/functions/_shared/api/handlers.ts` over the `GameStore` interface; the `index.ts` of each function only wires a request to it. Change a migration and the `SupabaseStore` together.
* Inside the engine, iterate collections in sorted id order so every Tide is reproducible from its snapshot and seed.
* Every engine change needs a unit test. Run the tests and the bot season before finishing a task.
* Phaser is pinned to version 4. Check the Phaser 4 docs (https://docs.phaser.io) and do not assume Phaser 3 APIs. The installed types in `node_modules/phaser/types/phaser.d.ts` always match the pinned version, so check an API there when in doubt.
* Engine files import each other with the `.ts` extension (`./types.ts`), because Edge Functions run on Deno. The client and tools import the engine as `@engine/...`.
* Every dependency is pinned to an exact version (`.npmrc` sets `save-exact`).
* Keep Phaser to `MapScene` and `ReplayScene`. All menus are Preact.
* Keep `supabase/` and `client/` cleanly separate. When a second developer joins, one owns `supabase/` and the other owns `client/`, and engine changes need both to review.

## How to work

* Do one task at a time and keep changes small. After each task, say what you changed and what to check.
* If a request conflicts with the design doc, say so before writing code.
* For v0.3 work, build only what the current brief in `docs/briefs/` asks for. New ideas go into `docs/IDEAS.md`, not into the code.
* Ask before adding a new dependency.
* When a design decision changes, update `docs/DECISIONS.md` in the same commit.
* Do not use dashes in prose you write (docs, comments, game text). Use commas or full stops instead.

## Definition of done

A task is done when its own checks pass and all of this is true:

* In the same commit, update `docs/DECISIONS.md` with the new rule calls, the next task line under Current focus in this file, and `docs/STATUS.md`.
* Run `npm run check` and `npm run prose:check`.
* Push the branch, open a pull request and give Biscu the link.
* Never describe branch or merge state in a doc. Git and the pull request hold that.
* Biscu never edits docs by hand, so you make every doc change.

## Commands

* Start the dev server: `npm run dev`
* Run the tests: `npm test`
* Check types: `npm run typecheck`
* Build for production: `npm run build` (output in `dist/`)
* Run the balance simulation: `npm run sim` (checks the combat table of section 7.3, a bot trader against the solo pacing of sections 3.5 and 5.5, and the galleon odds of section 8.2)
* Check everything at once: `npm run check` (types and all tests, v0.2 and v0.3)
* Resolve one v0.3 Tide and print it: `npm run tide:demo`
* Rewrite the v0.3 golden Tide after an intentional rule change: `npm run golden:update`
* Run a bot season: `npm run bots` (six scripted captains and a six raider brawl play Season 0 on the real engine over 30 seeds each, `npm run bots -- 100` for more; every season is played twice, directly and through the Edge Function handlers, and the two must end identically; fails on any impossible state, crash, non deterministic season or insane total)

## Crew (specialist roles)

* Eight roles live in `.claude/agents/`: producer, art-director, pixel-artist, game-designer, narrative-writer, engineer, qa-tester, sound-designer. Use the matching role for its kind of work. Details and workflows are in `docs/CREW.md`.
* When documents disagree, the order of authority is `docs/DECISIONS.md`, then `docs/GAMEPLAY.md`, then `docs/GAME_DESIGN.md`.
* Art follows the `rumtide-art-bible` skill (Endesga 32 only). Run `npm run assets:check` after touching assets.
* Player facing text follows the `rumtide-lore` skill. Run `npm run prose:check` after writing text.
* Slash commands: `/feature` runs one feature through the crew, `/gate` runs a quality gate.
* Roles report back in under 200 words: what changed, files touched, what to check, open questions.

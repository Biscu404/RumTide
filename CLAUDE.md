# Rumtide: instructions for Claude Code

Rumtide is a pixel art pirate game for a small group of friends. It is asynchronous: one Tide (turn) per day, browser first, built to grow from 6 players to many more.

The full design is in `docs/GAME_DESIGN.md`. It is long, so do not read it all at once. Read only the sections you need, using the index below. Research and sources are in `docs/RESEARCH.md`.

## Current focus

Building Season 0: a two week beta (14 Tides) for six friends, built by one developer. Follow section 19.1 of the design doc, one day at a time. Update this line when the focus changes.

## Design doc index (docs/GAME_DESIGN.md)

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
* The client never writes game tables. All game writes go through Edge Functions, which validate with Zod and then with the engine. The server owns positions, stats, gold, cargo, outcomes and seeds.
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
* Build only what is in the MVP table in section 16.1. New ideas go into `docs/IDEAS.md`, not into the code.
* Ask before adding a new dependency.
* When a design decision changes, update `docs/DECISIONS.md` in the same commit.
* Do not use dashes in prose you write (docs, comments, game text). Use commas or full stops instead.

## Commands

* Start the dev server: `npm run dev`
* Run the tests: `npm test`
* Check types: `npm run typecheck`
* Build for production: `npm run build` (output in `dist/`)
* Run the balance simulation: `npm run sim` (checks the combat table of section 7.3, a bot trader against the solo pacing of sections 3.5 and 5.5, and the galleon odds of section 8.2)
* Run a bot season: `npm run bots` (six scripted captains and a six raider brawl play Season 0 on the real engine over 30 seeds each, `npm run bots -- 100` for more; fails on any impossible state, crash, non deterministic season or insane total)

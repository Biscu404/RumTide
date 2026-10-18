# Rumtide status

**Date:** 2026-10-18. **Branch:** `crew-setup` (code clean, this file not yet committed). **Focus:** P2 combat, milestone M2 "First battle", brief `docs/briefs/P2-combat.md`.
**In one line:** P0 and P1 are merged to `main`. P2.1 is committed but not on `main`. P2.2 to P2.6 are not started. Only the engine tests and `tools/v3` use `engine_v3`. No server, client, bot or sim does yet.
Authority order: `docs/DECISIONS.md`, then `docs/GAMEPLAY.md`, then `docs/GAME_DESIGN.md`.

## 1. Done
- **v0.2 prototype** (14 to 15 Oct, Days 1 to 7 and client steps 1 to 8): engine in `supabase/functions/_shared/engine/`, handlers, migrations 1 to 6, admin page, fleets, ReplayScene v0, income bonuses, standing orders, Legend, exploration deck, palette and sound, runbook `docs/PLAYTEST.md`. Last known state (`docs/DECISIONS.md`, 15 Oct): 573 tests, typecheck, sim, bots and build passed.
- **P0 foundations:** GAMEPLAY v0.3, defaults for the open decisions (P0.3), shield length and Boom placeholder (P0.4).
- **P1.2 to P1.9 engine core:** rng streams, map (`cradle.json` only), knowledge, Watches, wind and currents, voyage plans, Tide resolver with the `EncounterResolver` hook, golden Tide. Merged as PR #3 (`f4fff55`).
- **P2.0:** brief written. D26 fixes the Power Rating formula, but `powerRating()` is not in `ship.ts` yet.
- **P2.1 helm and guns** (commit `f6fcf77`, branch `p2-1-helm-and-guns`): `combat/types.ts`, `helm.ts`, `guns.ts`, `testing.ts`, with tests, and 23 rule calls D27 to D49. Verified 2026-10-18 on `crew-setup`: `npm run check` passes (typecheck clean, 53 test files, 920 tests, golden Tide unchanged). Not on `main`.
- **Crew setup** (`611f2fb`): 8 roles, skills, `npm run assets:check`, `npm run prose:check`, `docs/CREW.md`.

## 2. In progress
- **P2 combat:** 1 of 6 tasks committed. The tree is clean, so nothing is half written.
- **Loose ends:** land P2.1 on `main` (no sign of a PR). Merge `crew-setup` separately. Create `docs/IDEAS.md`, which `CLAUDE.md` and the producer role point to.

## 3. Next (in order)
1. **Close P2.1.** `npm run check` now passes (see section 1). What is left is Biscu's call: push it, open a PR, and confirm D35, D36 and D42. qa-tester has not reviewed it.
2. **P2.2** (engineer): `boarding.ts`, `battle.ts` (`runBattle`), `loot.ts`. It picks up the seams left by P2.1: Board and Repel (D29), Cut Free (D37), skipping guns on an escaped round (D36), applying the Reef scrape (D44), and how Crippled is recorded (D48). Check: seven outcomes, loot table, fairness factor, cap, Cradle halving, same seed gives the same record.
3. **P2.3** (engineer, game-designer for templates): `doctrine.ts`, the four templates, an ability slot tested with a fake ability, and what a Jettison round does (D48).
4. **P2.4** (engineer): `encounter.ts` with parley, escape, towing, shields and bounties. It also builds a real `BattleShip` (D49), sets `charted` and `withCurrent` (D40, D41), and adds the `Captain` and `SeasonState` fields and `powerRating()`. `combatEncounter` becomes the default resolver. Run `npm run golden:update` once. Check: `npm run tide:demo` shows real battles.
5. **P2.5** `fleet.ts` and **P2.6** `shellback.ts` (engineer). Both after P2.4 (inferred).
6. **P3** combat simulator and tuning (named in the brief, scope inferred). It must measure GAMEPLAY 8.9.
- **In parallel, no engine code (suggested, inferred):** the `docs/CREW.md` first runs C2 to C5. Those are `docs/LORE.md`, `docs/audio/events.md` and `docs/qa/baseline.md`. None exists.

## 4. Blocked
Nothing blocked. Open questions that could become blockers:
- **Biscu:** does the v0.2 internal playtest (`docs/PLAYTEST.md`) still happen now that Season 0 is the v0.3 column? No entry says.
- **Biscu:** only default #6 of the P0.3 table is recorded as your call. The other seven are defaults. #1 and #2 start to matter at P6.3 and P5.
- **Rule calls D28 to D49** were made during P2.1 under "simplest reading". Only D27 was your call. D35, D36 and D42 change the feel of a fight most.
- **GAMEPLAY 19.1 streak breaker** is unbuilt (D34) and no task owns it. It needs luck history on `Captain`.

## 5. Cut list
- **Order in `docs/GAME_DESIGN.md` 16.1:** music (not built), Escort intent, battle previews (not built), animated replay while keeping the text replay, weekly awards (not built). GAMEPLAY 21 lists Escort as a Pact and does not repeat the order, so confirm it for v0.3 (inferred).
- **Never cut (16.1):** fleets, standing orders, Shore Leave, the Discord webhook, the admin Retry button. The 18:00 reminder is a Must and is not built (no "reminder" anywhere in `supabase/`). GAMEPLAY 1.1 wants two reminders a day.
- **Fallback:** "Season 0 lite" (GAMEPLAY 21 note). It was offered and declined on 18 Oct (DECISIONS P0.3 #6). Only Biscu can switch to it.
- **Deferred by design (GAMEPLAY 21, Season 1 column):** Frigate, Old Moorings, trophies and ship traits, Medium Hotspots, Secrets, Doctrine Copies, Spies, the Forger, map fragments, ranks 4 and 5, prisoners, paid Gazette services, player wager markets, extra scenes, cut ins. Storms and the Maw (D25).
- **Out of P2 scope (brief):** crew abilities (P8.4), reputation effects (P8.6), intel picks on Capture (P7.3), salvage (P5 or later), all tuning (P3).
- **Deferred in DECISIONS:** Mutiny Rules, Hall of Legends, `profile` and Parting Shots, retry of a Tide stuck in `resolving`, joining after a season starts, recolouring real sprites and the pixel font (needs a CC0 pack decision).

## 6. Top five risks
| # | Risk | Evidence | Impact | Next step |
|-|-|-|-|-|
| 1 | Scope and schedule | GAMEPLAY 21 says the Season 0 column is several times the v0.2 MVP, "2 to 3 months of evenings". Biscu chose all of it. The roadmap runs to at least P13, and 1 task of P2 is done. No Season 0 date is recorded. | The date slips and friends drift before launch. | Agree the lite fallback trigger and a review date now. |
| 2 | Fairness and balance unmeasured | The brief defers all tuning to P3. No v0.3 sim or bots exist (`tools/sim` and `tools/bots` run v0.2). P2.1 alone made 23 rule calls. GAMEPLAY 8.9 and 20 have no tool behind them. | A dominant doctrine or a harsh loss hits friends first. This damages the pillar "fair fights and soft falls". | Build the P3 simulator right after P2.4. Confirm D35, D36 and D42. |
| 3 | Nothing playable on v0.3 until P12 and P13, and the live stack is unproven | Only `tools/v3` imports `engine_v3`. DECISIONS lists items "not run anywhere": Deno entry files, the cron migration, migrations 3 to 5 on a real project. `docs/PLAYTEST.md` is all unticked. The server assumes one Tide a day. | A failed Tide on a live project is the worst day. Two Tides a day doubles the exposure. | Run one live rehearsal Tide before P12. Have qa-tester gate P12. |
| 4 | Content and art gap | `client/public/assets/` holds only `.gitkeep` and an empty `sprites/`. `art/` (`briefs`, `src`, `previews`) and `docs/text/`, `docs/audio/`, `docs/qa/`, `docs/specs/` exist but are empty, and `docs/LORE.md` does not exist. GAMEPLAY 12.6 needs 30 Squalls, 8 Tales, 6 Sagas and 4 trait Tales. | A working engine with no nightly story. This hurts the pillar "a story every night". | Start `docs/CREW.md` C2 to C5 alongside P2. |
| 5 | Unmerged work and doc drift | `main` and `origin/main` are both at `f4fff55`. P2.1 and the crew commit have no `origin` ref. `crew-setup` sits on top of P2.1. GAME_DESIGN 16.1 says 14 Tides, GAMEPLAY says 28. | Lost or tangled work, and confusion when a second developer joins. | Push and merge P2.1 first, then `crew-setup` as its own PR. |

# Rumtide status

**Date:** 2026-11-05. Short on purpose: the details are in `docs/DECISIONS.md`, which this file only points to. Authority order: `docs/DECISIONS.md` (with `docs/decisions/`), then `docs/GAMEPLAY.md`, then `docs/GAME_DESIGN.md`.

## Next task

**P3.2b**: bring Old Shellback's check 5 into its band of 35% to 80% (Gunline 86%, Boarder 100% and Firebrand 88% are over the top) with `B.shellback` and the numbers he reads, and keep the other nine checks passing. Then P3.2c (D108 and the gate pace) and P3.2d (the guard test, the full run, the golden Tide, the docs). P3.2 was split on 26 October 2026; P3.2a (Drill luck and check 8) is done (D216, D217). The plan and the findings are under "What is left of P3.2" in `docs/DECISIONS.md`. The brief is `docs/briefs/P3-combat-testing.md`.

## Where things stand

* Nine of the ten simulator checks pass on the quick run. Only check 5 fails (D212). Check 8 passes since P3.2a (D216, D217).
* The full run has not been repeated since the Old Shellback rework (the last table is under D197). Run it once at the end of P3.2d, not during tuning.
* Not measured yet: fleets of styled ships, and the Gazette (no v0.3 generator). `npm run bots` still plays the v0.2 engine. P3.3 is Biscu's: watch 10 sample replays.

## Waiting on Biscu

Confirm these rule calls (find each id with the table at the top of `docs/DECISIONS.md`):
* **D201 to D212 and D214** (P3.B2 piece 3): Old Shellback as built and the text. Read D204, D205 and D206 first. The writer's invented facts in D214 are PROPOSED until approved.
* **D216 and D217** (P3.2a): Drill has luck now, so a drilled crew can have a worse day than an untrained one; the Drill 15 line is read on decided battles.
* **D185 to D192** (P3.B3): the lines drawn on the new checks, mainly D186, D190, D191 and D192.
* **D113 and D114** (P3.1): the lines on two checks that say "about" (D140 and D136 since changed them).
* **D97, D95, D91** (P2.5): fleet battles, towing and Helm moves.
* **D57** (P2.2): the fairness factor and loot on a Sunk ship.
* **D35, D36, D42** (P2.1): grappling, escaping past Far, and the Shallows.

Open questions:
* Does the v0.2 internal playtest in `docs/PLAYTEST.md` still happen?
* P0.3 defaults #1 and #2 start to matter at P6.3 and P5.
* The streak breaker of GAMEPLAY 19.1 is unbuilt (D34) and no task owns it.

## Top risks

1. **Scope and schedule.** The Season 0 column is several times the v0.2 MVP and no Season 0 date is recorded. Next: agree a lite fallback trigger and a review date.
2. **Balance.** Check 5 still fails and every Old Shellback number is a cliff. No v0.3 bot season exists. Next: P3.2b to P3.2d in order.
3. **Nothing playable on v0.3 until P12 and P13**, and the live stack (Deno entry files, the cron migration, migrations 3 to 5) has never run. Next: one live rehearsal Tide before P12.
4. **Content and art gap.** No sprites, no `docs/LORE.md`, and GAMEPLAY 12.6 needs 30 Squalls, 8 Tales, 6 Sagas and 4 trait Tales. Next: C2 to C5 in `docs/archive/CREW-install.md`.
5. **Doc drift.** GAME_DESIGN 16.1 says 14 Tides, GAMEPLAY says 28. Next: fix 16.1 when a task touches Tide counts.

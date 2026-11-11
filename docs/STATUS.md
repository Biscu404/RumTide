# Rumtide status

**Date:** 2026-11-12. Short on purpose: the details are in `docs/DECISIONS.md`, which this file only points to. Which doc wins when they disagree is in `CLAUDE.md`.

## Next task

**P3.2b**: bring Old Shellback's check 5 into its band of 35% to 80% (Gunline 86%, Boarder 100% and Firebrand 88% are over the top) with `B.shellback` and the numbers he reads, and keep the other nine checks passing. Then P3.2c (D108 and the gate pace) and P3.2d (the guard test, the full run, the golden Tide, the docs). P3.2 was split on 26 October 2026; P3.2a (Drill luck and check 8) is done (D216, D217). The plan and the findings are under "What is left of P3.2" in `docs/DECISIONS.md`. The brief is `docs/briefs/P3-combat-testing.md`.

## Where things stand

* While tuning, run `npm run sim:tune` (about 1 minute). Nine of the ten simulator checks pass on the quick run. Only check 5 fails (D212). Check 8 passes since P3.2a (D216, D217).
* The full run has not been repeated since the Old Shellback rework (the last table is under D197). Run it once at the end of P3.2d, not during tuning.
* Not measured yet: fleets of styled ships, and the Gazette (no v0.3 generator). `npm run bots` still plays the v0.2 engine. P3.3 is Biscu's: watch 10 sample replays.

## Waiting on Biscu

No rule call waits for confirmation. Biscu accepted every one as built on 12 November 2026 (the entry of that date in `docs/DECISIONS.md`), and from now on Claude makes the balance and design detail calls and logs them there (CLAUDE.md, "How to work").

Open questions:
* Does the v0.2 internal playtest in `docs/PLAYTEST.md` still happen?
* P0.3 defaults #1 and #2 start to matter at P6.3 and P5.
* The streak breaker of GAMEPLAY 19.1 is unbuilt (D34) and no task owns it.

## Top risks

1. **Scope and schedule.** The Season 0 column is several times the v0.2 MVP and no Season 0 date is recorded. Next: agree a lite fallback trigger and a review date.
2. **Balance.** Check 5 still fails and every Old Shellback number is a cliff. No v0.3 bot season exists. Next: P3.2b to P3.2d in order.
3. **Nothing playable on v0.3 until P12 and P13**, and the live stack (Deno entry files, the cron migration, migrations 3 to 5) has never run. Next: one live rehearsal Tide before P12.
4. **Content and art gap.** No sprites, no `docs/LORE.md`, and GAMEPLAY 12.6 needs 30 Squalls, 8 Tales, 6 Sagas and 4 trait Tales. Next: C2 to C5 in `docs/briefs/content-tasks.md`.
5. **Doc drift.** GAME_DESIGN 16.1 says 14 Tides, GAMEPLAY says 28. Next: fix 16.1 when a task touches Tide counts.

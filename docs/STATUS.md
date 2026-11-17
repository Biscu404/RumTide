# Rumtide status

**Date:** 2026-11-17. Short on purpose: the details are in `docs/DECISIONS.md`, which this file only points to. Which doc wins when they disagree is in `CLAUDE.md`.

## Next task

**Sandbox stages 1 and 2**: Biscu tries both pages (`npm run sandbox`, then http://localhost:5180 for the battle viewer and http://localhost:5180/tide.html for one Tide in the Cradle) and says what to change or whether stage 3 starts. The battle viewer had a readability pass on 17 November (D243 to D248): look at that first. The brief is `docs/briefs/sandbox.md`: stage 3 is a short solo run of several Tides that ends at Old Shellback. Do not start it before Biscu says so.

Beside it, **P3.3** is Biscu's: watch 10 sample replays (`docs/briefs/P3-combat-testing.md`). Combat tuning is finished: P3.2a to P3.2d are all done.

## Where things stand

* **All ten simulator checks pass on the full run** of 17 November 2026 (D222). Old Shellback falls to the best doctrine of each style 49% to 77% of the time (D218 to D221).
* A guard test in `npm run check` plays the quick run of nine of the ten checks, so a later change cannot undo the tuning quietly (D223). Check 2 is only in the full run.
* The sandbox battle viewer and one Tide in the Cradle are built (D227 to D242). Old Shellback fights by his new rules there too, because the sandbox runs the real engine.
* While tuning, run `npm run sim:tune` (about 1 minute). Run the full `npm run sim:v3` once at the end.
* Not measured yet: fleets of styled ships, and the Gazette (no v0.3 generator). `npm run bots` still plays the v0.2 engine.

## Waiting on Biscu

No rule call waits for confirmation. Biscu accepted every one as built on 12 November 2026 (the entry of that date in `docs/DECISIONS.md`), and from now on Claude makes the balance and design detail calls and logs them there (CLAUDE.md, "How to work").

Open questions:
* Does the v0.2 internal playtest in `docs/PLAYTEST.md` still happen?
* P0.3 defaults #1 and #2 start to matter at P6.3 and P5.
* The streak breaker of GAMEPLAY 19.1 is unbuilt (D34) and no task owns it.

## Top risks

1. **Scope and schedule.** The Season 0 column is several times the v0.2 MVP and no Season 0 date is recorded. Next: agree a lite fallback trigger and a review date.
2. **Balance.** The ten checks pass, but they are duels of fresh sloops. No v0.3 bot season exists, so the real pace at Old Shellback's gate is not measured. Next: a v0.3 bot season, when a task owns it.
3. **Nothing playable on v0.3 until P12 and P13, except the sandbox**, and the live stack (Deno entry files, the cron migration, migrations 3 to 5) has never run. Next: one live rehearsal Tide before P12.
4. **Content and art gap.** No sprites, no `docs/LORE.md`, and GAMEPLAY 12.6 needs 30 Squalls, 8 Tales, 6 Sagas and 4 trait Tales. Next: C2 to C5 in `docs/briefs/content-tasks.md`.
5. **Doc drift.** GAME_DESIGN 16.1 says 14 Tides, GAMEPLAY says 28. Next: fix 16.1 when a task touches Tide counts.

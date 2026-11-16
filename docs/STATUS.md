# Rumtide status

**Date:** 2026-11-16. Short on purpose: the details are in `docs/DECISIONS.md`, which this file only points to. Which doc wins when they disagree is in `CLAUDE.md`.

## Next task

**Sandbox stage 1**: Biscu tries the battle viewer (`npm run sandbox`, then http://localhost:5180) and says what to change or whether stage 2 starts. The brief is `docs/briefs/sandbox.md`: stage 2 is one Tide in the Cradle with a few bot captains, stage 3 a short solo run that ends at Old Shellback. Do not start a stage before Biscu says so.

Combat tuning is paused at nine of ten checks by Biscu's call of 16 November 2026. P3.2b (Old Shellback's check 5) and P3.2d wait until Biscu restarts them; the plan and the findings are under "What is left of P3.2" in `docs/DECISIONS.md`, and the brief is `docs/briefs/P3-combat-testing.md`. P3.2a and P3.2c are done.

## Where things stand

* The sandbox battle viewer is built: two ships, one battle on the real `engine_v3`, round by round, in the browser with no server.
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
2. **Balance.** Check 5 still fails and every Old Shellback number is a cliff. No v0.3 bot season exists. Next: P3.2b and P3.2d, once Biscu restarts the tuning.
3. **Nothing playable on v0.3 until P12 and P13, except the sandbox**, and the live stack (Deno entry files, the cron migration, migrations 3 to 5) has never run. Next: one live rehearsal Tide before P12.
4. **Content and art gap.** No sprites, no `docs/LORE.md`, and GAMEPLAY 12.6 needs 30 Squalls, 8 Tales, 6 Sagas and 4 trait Tales. Next: C2 to C5 in `docs/briefs/content-tasks.md`.
5. **Doc drift.** GAME_DESIGN 16.1 says 14 Tides, GAMEPLAY says 28. Next: fix 16.1 when a task touches Tide counts.

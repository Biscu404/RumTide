# Rumtide status

**Date:** 2026-10-22. Authority order: `docs/DECISIONS.md`, then `docs/GAMEPLAY.md`, then `docs/GAME_DESIGN.md`.

## Next task

**P3.B2** (engineer): build `docs/specs/boarding.md` and `docs/specs/fighting-styles.md` together in `engine_v3`. Both were approved on 22 October 2026 (D121 to D129): the deck fight, Drill, six distances, and six Fighting Styles plus the Smuggler in place of the four templates. Then **P3.B3** (engineer and qa-tester) teaches the simulator the Deck orders and the styles, including the new wheel check.

**P3.2** (tune `balance.ts` until the checks of GAMEPLAY 8.9 and the wheel check pass) is paused until P3.B3 is done. It starts from the prototype's numbers in the styles spec, and its known jobs are the two hard counters, the Rammer and Boarder lean, draws, and Old Shellback. The P3.1 baseline is in `docs/DECISIONS.md` (D109 to D115). The brief is `docs/briefs/P3-combat-testing.md`. P3.3 is Biscu's: watch 10 sample replays and judge how they feel.

## Waiting on Biscu

Confirm these rule calls, all in `docs/DECISIONS.md`:
* **D113 and D114** (P3.1): the lines drawn on two checks that say "about". Twice the Power Rating passes at 83% to 92% of the fought battles (battles that end Escaped are left out, because a random plan flees by chance), and Old Shellback passes at 40% to 60%. P3.2 tunes to these lines.
* **D97** (P2.5): every ship of a fleet that loses a Sunk or Captured battle is towed home, and they all pay the loot together. The other reading tows only the ships at 0 Hull.
* **D95** (P2.5): any ship at 0 Hull ends a fleet battle against its whole side, and one ship striking its colours takes its fleet out of the fight (v0.2 7.2).
* **D91** (P2.5): the two flagships' Helm moves move the one range. A fleet mate's Helm move only sets its own rake or flank shot, though its Board and Open Range can still grapple and cut free.
* **D57** (P2.2): the fairness factor and the Cradle halving apply to PvP only, and a Sunk ship gives up at most the multiplier's share. GAMEPLAY 8.7 read literally strips the loser of everything whatever the factor.
* **D35** (P2.1): ships only grapple when both play Close In while already at Close, or through Board. Every other shrink stops at Close.
* **D36** (P2.1): any growth past the farthest distance ends the battle as Escaped. With six distances that is Far (D121).
* **D42** (P2.1): the Shallows. A Brigantine or Frigate without Local Knowledge must win a Helm contest to reach Close, or the range stops one band short (Short, with six distances, D121).

Answer these open questions:
* **v0.2 playtest:** does the internal playtest in `docs/PLAYTEST.md` still happen now that Season 0 is the v0.3 column?
* **P0.3 defaults:** only default #6 of the P0.3 table was Biscu's call. #1 and #2 start to matter at P6.3 and P5.
* **Streak breaker:** GAMEPLAY 19.1 is unbuilt (D34) and no task owns it.

## Top risks

| # | Risk | Evidence | Impact | Next step |
|-|-|-|-|-|
| 1 | Scope and schedule | GAMEPLAY 21 says the Season 0 column is several times the v0.2 MVP, "2 to 3 months of evenings". Biscu chose all of it. The roadmap runs to at least P13, and P2 combat is built but untuned. The boarding rework (D116 to D120) adds three tasks before tuning can finish, plus a sixth upgrade track of 15 levels and a third supply. The Fighting Styles (D121 to D129) add six styles, two distances, the Ram, the Mortar, Hot Shot and fire, all in Season 0. No Season 0 date is recorded. | The date slips and friends drift before launch. | Agree the lite fallback trigger and a review date now. |
| 2 | Fairness and balance unmeasured | The v0.3 combat simulator exists since P3.1 (`npm run sim:v3`), but nothing is tuned. No v0.3 bot season exists (`tools/bots` runs v0.2). P2.1 to P2.6 made 82 rule calls (D27 to D108) and only D27, D64, D65, D75, D76, D100 and D105 were Biscu's. Measured before tuning, with the four old templates: four of the five checks of 8.9 fail (Skirmisher wins 67% of the field, Repel is never the best play, 2 to 1 Power Rating wins 97%, Old Shellback loses to the starting Brawler every time), and one fight a Tide makes a queue at his gate (D108). GAMEPLAY 20 has no tool behind it yet. | A dominant doctrine or a harsh loss hits friends first. This damages the pillar "fair fights and soft falls". | Build the boarding and the Fighting Styles (P3.B2), then tune against the simulator in P3.2. A scratch prototype put every style between 33% and 50% of the field. Confirm D35, D36, D42, D57, D91, D95 and D97. |
| 3 | Nothing playable on v0.3 until P12 and P13, and the live stack is unproven | Only the engine tests and `tools/v3` use `engine_v3`. DECISIONS lists items "not run anywhere": Deno entry files, the cron migration, migrations 3 to 5 on a real project. `docs/PLAYTEST.md` is all unticked. The server assumes one Tide a day. | A failed Tide on a live project is the worst day. Two Tides a day doubles the exposure. | Run one live rehearsal Tide before P12. Have qa-tester gate P12. |
| 4 | Content and art gap | `client/public/assets/` holds only `.gitkeep` and an empty `sprites/`. `art/`, `docs/text/`, `docs/audio/`, `docs/qa/` and `docs/specs/` are empty, and `docs/LORE.md` does not exist. GAMEPLAY 12.6 needs 30 Squalls, 8 Tales, 6 Sagas and 4 trait Tales. | A working engine with no nightly story. This hurts the pillar "a story every night". | Start `docs/CREW.md` C2 to C5 alongside P2. |
| 5 | Doc drift | GAME_DESIGN 16.1 still says 14 Tides while GAMEPLAY says 28. | Confusion when a second developer joins. | Fix 16.1 to match GAMEPLAY the next time a task touches Tide counts. |

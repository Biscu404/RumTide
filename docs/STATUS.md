# Rumtide status

**Date:** 2026-10-24. Authority order: `docs/DECISIONS.md`, then `docs/GAMEPLAY.md`, then `docs/GAME_DESIGN.md`.

## Next task

**P3.2** (game designer and qa-tester) tunes `balance.ts` until the ten checks of `npm run sim:v3` pass. The brief is `docs/briefs/P3-combat-testing.md`. **P3.B3 is built:** the simulator plays the six Fighting Styles on ships that really have them, with the Deck orders, Drill and Fire Pots (D182 to D200). Its ten checks are the five of GAMEPLAY 8.9 (1 field share, 2 best play, 3 seat split, 4 Power Rating, 5 Old Shellback) and five more (6 the wheel, 7 equal spending, 8 Drill, 9 Lashed fast, 10 the Smuggler escapes). `npm run sim:v3 -- --set path=number` tries a number of `balance.ts` for one run, so P3.2 can search without editing the file. A full run takes 11 minutes on an idle machine, the quick run about 3.

**Where the checks stand, with no number tuned (the table under D197).** Eight of ten pass:
* Field share: Firebrand 51.4% at most, Skirmisher 36.4% at least. The wheel: all 15 pairs inside their bands. Equal spending: Boarder 58.2% at 5 levels, the nearest to the 60% cap. Lashed fast: 33.5%. The Smuggler escapes 33.9% at least (against the Rammer). Twice the Power Rating wins 86.9%. All 17 plays are clearly best somewhere.
* **Check 8 (Drill) fails and no number can fix it (D198).** Boarder against Boarder, Drill 5 and Drill 15 both win 100% of the time against Drill 0. QA set `drill.perLevel` to half and to an eighth of its starting values and Drill 5 still won 100%, because the deck fight has no luck roll and any edge wins the grind. P3.2 starts with a luck roll in the melee, then retunes `perLevel`. This replaces the advice of D181 to start by halving the number. The Power Rating also under-rates Drill: a Drill 10 Boarder rates 1.2 times a fresh sloop and beats a fresh field 87.7%.
* **Check 5 (Old Shellback) fails and waits for piece 3 (D200).** Every style beats him in 2000 of 2000 fights.

**P3.B2 piece 3 is not built** (D200). Its brief said pieces 1, 2 and 3 were merged, but the code holds pieces 1 and 2 only (D142 to D181). Piece 3 is the Old Shellback rework (D133, D140), the replay and Gazette text, and GAMEPLAY rewritten to match. Until it is built check 5 cannot be tuned, and the gate pace is meaningless. P3.2 can tune everything else meanwhile.

Watch while tuning: the checks nearest their lines are Gunline over Skirmisher 79.3% (cap 80), Firebrand over Boarder 56.0% and Boarder over Bombardier 56.1% (floor 55), Bombardier and Skirmisher 63.2% (cap 65), and the Boarder at 5 levels. Board from Short, the Mortar outside its own mirror and Ram pass check 2 thinly. The pooled field share hides the water: the Bombardier wins 85% in an uncharted Reef and 12% in Kelp. Fleets of styled ships are not measured by anything yet, and `npm run bots` still plays the v0.2 engine. P3.3 is Biscu's: watch 10 sample replays and judge how they feel.

## Waiting on Biscu

Confirm these rule calls, all in `docs/DECISIONS.md`:
* **D200** (P3.B3): your brief for this task said P3.B2 piece 3 was merged, and it is not. Should piece 3 (the Old Shellback rework, replay and Gazette text, GAMEPLAY) go before P3.2, or after the first tuning of checks 1 to 4 and 6 to 10? STATUS names P3.2 next, as asked.
* **D185 to D192** (P3.B3): the lines drawn on the new checks. The wheel 55% to 80% and 35% to 65% are the spec's. The ones the build chose: Drill 5 against Drill 0 must win 55% to 80% (D190), Lashed fast passes at 40% or less from 100 tries (D191), the Smuggler is the seventh style and sits outside check 1 (D192), and equal spending is played at 5 and 10 levels with no floor (D186).
* **D113 and D114** (P3.1): the lines drawn on two checks that say "about". Twice the Power Rating passes at 83% to 92% of the fought battles (battles that end Escaped are left out, because a random plan flees by chance), and Old Shellback passes at 40% to 60%. P3.2 tunes to these lines. D140 since replaced the Old Shellback line with a band per style, 35% to 80%, and D136 changed the Power Rating formula to meet the first line.
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
| 1 | Scope and schedule | GAMEPLAY 21 says the Season 0 column is several times the v0.2 MVP, "2 to 3 months of evenings". Biscu chose all of it. The roadmap runs to at least P13, and P2 combat is built but untuned. The boarding rework (D116 to D120) adds three tasks before tuning can finish, plus a sixth upgrade track of 15 levels and a third supply. The Fighting Styles (D121 to D134) add six styles, two distances, the Ram, the Mortar, Hot Shot, fire and a reworked Old Shellback, all in Season 0. No Season 0 date is recorded. | The date slips and friends drift before launch. | Agree the lite fallback trigger and a review date now. |
| 2 | Fairness and balance measured, not tuned | The v0.3 combat simulator (`npm run sim:v3`, ten checks, P3.B3) plays the six Fighting Styles and the Deck orders. Before any tuning eight of ten pass (the table under D197). Check 8 fails: Drill decides a deck fight alone, and no number fixes it because the deck fight has no luck roll (D198). Check 5 fails at 100% until the Old Shellback rework (piece 3, D200). P2.1 to P2.6 made 82 rule calls (D27 to D108) and only D27, D64, D65, D75, D76, D100 and D105 were Biscu's. No v0.3 bot season exists (`tools/bots` runs v0.2). One fight a Tide makes a queue at his gate (D108). GAMEPLAY 20 has no tool behind it yet. | A dominant doctrine or a harsh loss hits friends first. This damages the pillar "fair fights and soft falls". | Tune against the simulator in P3.2: a luck roll in the melee first, then the Drill number. Build piece 3. Confirm D35, D36, D42, D57, D91, D95 and D97. |
| 3 | Nothing playable on v0.3 until P12 and P13, and the live stack is unproven | Only the engine tests and `tools/v3` use `engine_v3`. DECISIONS lists items "not run anywhere": Deno entry files, the cron migration, migrations 3 to 5 on a real project. `docs/PLAYTEST.md` is all unticked. The server assumes one Tide a day. | A failed Tide on a live project is the worst day. Two Tides a day doubles the exposure. | Run one live rehearsal Tide before P12. Have qa-tester gate P12. |
| 4 | Content and art gap | `client/public/assets/` holds only `.gitkeep` and an empty `sprites/`. `art/`, `docs/text/`, `docs/audio/`, `docs/qa/` and `docs/specs/` are empty, and `docs/LORE.md` does not exist. GAMEPLAY 12.6 needs 30 Squalls, 8 Tales, 6 Sagas and 4 trait Tales. | A working engine with no nightly story. This hurts the pillar "a story every night". | Start `docs/CREW.md` C2 to C5 alongside P2. |
| 5 | Doc drift | GAME_DESIGN 16.1 still says 14 Tides while GAMEPLAY says 28. | Confusion when a second developer joins. | Fix 16.1 to match GAMEPLAY the next time a task touches Tide counts. |

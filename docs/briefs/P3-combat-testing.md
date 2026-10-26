# Brief P3: Combat testing

Roadmap tasks P3.1 to P3.3, milestone M3. P3.1 and P3.2 are Claude Code's with the game designer and the QA tester. P3.3 is Biscu's. Written on 19 October 2026.

## Goal

GAMEPLAY 8.9 lists five things the bot simulator must show "before this combat system is locked". P2 built the combat and tuned nothing. P3 builds the simulator that measures all five, then tunes `balance.ts` until all five pass.

## P3.1: the simulator (`tools/v3/sim/`, `npm run sim:v3`)

Thousands of fights across doctrines, power gaps and terrain, on the real `engine_v3`, in under a minute for a quick run. It changes no rule and no number. Run `npm run sim:v3 -- --quick` while tuning and `npm run sim:v3` to judge.

### The five checks and how each is measured

The doc says "about" for some of them. These are the lines the simulator draws, and D109 to D114 in `docs/DECISIONS.md` say why.

| # | GAMEPLAY 8.9 | Measured as | Passes when |
|-|-|-|-|
| 1 | No template wins more than 60% against the field of the others | Equal fresh sloops. Each template meets each other template in 9 scenes and both seats. A win is a battle that template won, as a share of all battles | Every template's share, averaged over the scenes, is at most 60% |
| 2 | Every Helm move and Guns order is the best choice somewhere | 576 situations (a battle at round 1 to 4 between two templates, in a scene). All 24 plays are tried for that round on the same seeds | Each of the 4 Helm moves and 6 Guns orders is clearly best (2 standard errors ahead of every other) in at least one situation where the choice matters |
| 3 | Equal ships split wins evenly | The battles of check 1, without the doctrines: of the battles somebody won, the hunter's share, pooled and for each mirror match | The 95% range of the hunter's share reaches into 45% to 55%, in every scene |
| 4 | A ship with twice the Power Rating wins about 85 to 90% of the time | Random plans (the 7.3 method). A fresh sloop against a balanced stronger sloop, at ratios 1, 1.25, 1.5 and 2, in 9 scenes and both seats. Battles that end Escaped are left out | The stronger ship wins 83% to 92% of the fought battles at ratio 2, and the share rises with the ratio |
| 5 | Old Shellback is beatable by a fresh sloop with a good doctrine, about half the time | A fresh sloop on Tide 6, through the real Tide loop. A search finds the best doctrine a new captain can save, and it is confirmed on fights it never saw | The confirmed share is 40% to 60% |

## P3.B3: the simulator learns the styles (done, D182 to D200)

The table above is the P3.1 measure. Since the Fighting Styles and the deck fight (P3.B2), the same five checks play the six styles, and five more checks were added. The lines are test lines in the simulator, not gameplay numbers.

| # | Measured as | Passes when |
|-|-|-|
| 1 | The six style templates, played by ships that really have the style, equal fresh sloops, 9 scenes, both seats | Every style from 25% to 60% of the field |
| 2 | Situations grouped by the distance the round starts at, 17 plays: the 4 Helm moves, 11 Guns orders (Mortar for the Bombardier only, Hot Shot for the Firebrand only, Charge, Volley, Repel and Fire Pots in Grappled situations, Fire Pots between ships at Drill 5), Ram and Board from Short | Each of the 17 is clearly best in at least one situation |
| 5 | The search for a good doctrine, once for each of the six styles (and the Smuggler, printed and not judged) | Each style's confirmed share from 35% to 80% (D140) |
| 6 | The wheel: the 15 pairs of the styles spec, from the battles of check 1 | 12 designed wins from 55% to 80% of decided battles, 3 even pairs from 35% to 65% |
| 7 | Equal spending: the same levels N (5 and 10) spent the way each style would, Boarder on Drill, Rammer on Hull, the rest on Cannons | No style above 60% |
| 8 | Drill: Boarder against Boarder | Drill 5 against Drill 0 wins 55% to 80%; Drill 15 against Drill 0 lies between the shares check 4 gives for the rating ratios either side of 1.38 |
| 9 | Lashed fast: an equal ship that tries to Cut Free from a Boarder's edge | Wins at most 40% of its tries (a third, with room for noise) |
| 10 | The Smuggler against each of the six styles | Escapes at least 30% of its fights against every style |

Checks 3 and 4 keep their P3.1 measure (3 now reads the six styled templates). The ten checks run with `npm run sim:v3`, and `-- --check` takes 1 to 10.

Beside the five, the report prints the gate pace of GAMEPLAY 2.5 (median captain passes by Tide 7 to 9, nobody later than Tide 12) worked out from the win chance on each Tide. It is not a pass or fail check. It is the measurement D108 asked for.

## P3.2: run the checks and tune

**Split into four tasks on 26 October 2026 (D216 and the table under it in `docs/DECISIONS.md`):** P3.2a Drill luck and check 8 (done), P3.2b Old Shellback and check 5, P3.2c the decision on D108 with the gate pace, P3.2d the guard test, the full run, the golden Tide and the docs. The list below is what the four do together.

* Run the full simulator. Change `balance.ts` only, and only by doubling or halving, never nudging by 5% (the rule at the top of `balance.ts`).
* Log every change in `docs/DECISIONS.md` with the number before and after, and the check it moves.
* Change a rule only if no number can fix a check, and say so in `docs/DECISIONS.md`.
* The golden Tide will move. Run `npm run golden:update`, read the diff, and mention it.
* Add a test that the quick run passes all ten checks, so a later number change cannot undo this quietly.
* Start with check 8 (D198): no `drill.perLevel` moves it, so the deck fight needs a luck roll first, then the number. Check 5 can now be tuned on the reworked Old Shellback (D212): three styles are over the 80% top.
* Decide D108 (the queue at Old Shellback's gate) with the gate pace.

## P3.3: Biscu watches 10 sample replays

After P3.2, `npm run sim:v3 -- --replays` prints ten sample battles in plain words, picked to show the cycle of 8.4, a rake, a grapple, a Capture, a Sunk and a fight with Old Shellback. Biscu signs off on how they read or lists what feels wrong.

## Out of scope

Crew abilities and traits (P8), NPC doctrines (P9), the economy (P6.3), fleets (the checks are one ship against one ship), and the streak breaker of 19.1.

## Done checks

* P3.1: `npm run check` passes with the simulator's own tests, `npm run sim:v3 -- --quick` runs in under a minute and reports all five checks, and the baseline numbers are in `docs/DECISIONS.md`.
* P3.2: `npm run sim:v3` passes all ten checks and `npm run check` includes a test that guards them.

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

Beside the five, the report prints the gate pace of GAMEPLAY 2.5 (median captain passes by Tide 7 to 9, nobody later than Tide 12) worked out from the win chance on each Tide. It is not a pass or fail check. It is the measurement D108 asked for.

## P3.2: run the checks and tune

* Run the full simulator. Change `balance.ts` only, and only by doubling or halving, never nudging by 5% (the rule at the top of `balance.ts`).
* Log every change in `docs/DECISIONS.md` with the number before and after, and the check it moves.
* Change a rule only if no number can fix a check, and say so in `docs/DECISIONS.md`.
* The golden Tide will move. Run `npm run golden:update`, read the diff, and mention it.
* Add a test that the quick run passes all five checks, so a later number change cannot undo this quietly.
* Decide D108 (the queue at Old Shellback's gate) with the gate pace.

## P3.3: Biscu watches 10 sample replays

After P3.2, `npm run sim:v3 -- --replays` prints ten sample battles in plain words, picked to show the cycle of 8.4, a rake, a grapple, a Capture, a Sunk and a fight with Old Shellback. Biscu signs off on how they read or lists what feels wrong.

## Out of scope

Crew abilities and traits (P8), NPC doctrines (P9), the economy (P6.3), fleets (the checks are one ship against one ship), and the streak breaker of 19.1.

## Done checks

* P3.1: `npm run check` passes with the simulator's own tests, `npm run sim:v3 -- --quick` runs in under a minute and reports all five checks, and the baseline numbers are in `docs/DECISIONS.md`.
* P3.2: `npm run sim:v3` passes all five checks and `npm run check` includes a test that guards them.

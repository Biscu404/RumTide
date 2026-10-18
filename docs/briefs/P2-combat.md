# Brief P2: Combat

Roadmap tasks P2.1 to P2.6, milestone M2 "First battle". Owner: Claude Code. Written by Cowork (P2.0), 18 October 2026.

## Goal

Replace the Phase 1 encounter stub with real battles. When this brief is done, two ships that meet in a Tide fight a full five round battle with programmed doctrines, the result changes the world (damage, loot, towing, wrecks), and the replay records every round so the client can play it back later.

Balance is NOT part of this brief. Use the numbers in `balance.ts` as they are. P3 (combat testing) builds the simulator and tunes them.

## Read first

* `docs/GAMEPLAY.md` section 8 (all of it), 2.5 (Old Shellback), 6.3 and 6.4 (damage tracks, Hands).
* `docs/GAME_DESIGN.md` v0.2 sections 7.5 (fleet battles), 7.6 (parley) and 9 (fairness, bounties, shields).
* `docs/DECISIONS.md`, especially D5 to D10 and D26.
* `supabase/functions/_shared/engine_v3/tide.ts`: the `EncounterResolver` hook. Combat plugs in there.

## Where it plugs in

* Write `combatEncounter: EncounterResolver` in `engine_v3/combat/encounter.ts`.
* Make it the default resolver in `resolveTide`. Keep `stubEncounter` exported for tests that only care about movement.
* The resolver receives both ships and captains as mutable objects and returns which ships freeze. A ship that escapes or parleys keeps sailing; a ship that fought stops for the rest of the Tide.
* This changes the golden replay on purpose. Run `npm run golden:update` once at the end and check the new replay reads right in `npm run tide:demo`.

## Files

Everything here is the v0.3 engine in `supabase/functions/_shared/engine_v3/`. Do not touch the v0.2 engine in `engine/`: the prototype keeps running on it until the server and client move over. Tests sit next to the code as `*.test.ts`, as in the rest of the repo.


| File | Holds | Task |
|-|-|-|
| `engine_v3/combat/types.ts` | Range, HelmMove, GunsOrder, DoctrineRule, Doctrine, BattleShip, RoundRecord, BattleRecord, BattleOutcome | P2.1 |
| `engine_v3/combat/helm.ts` | Helm scores, contests and the pair table of GAMEPLAY 8.4 | P2.1 |
| `engine_v3/combat/guns.ts` | The damage formula and the ammo by range table of 8.5 | P2.1 |
| `engine_v3/combat/boarding.ts` | Grappling, boarding strength, Capture, Cut Free, Repel (8.6) | P2.2 |
| `engine_v3/combat/battle.ts` | `runBattle(input): BattleRecord`, pure: five rounds, end checks, outcome | P2.2 |
| `engine_v3/combat/loot.ts` | Loot shares, fairness factor, cap, Cradle halving, wrecks and flotsam | P2.2 |
| `engine_v3/combat/doctrine.ts` | Rule evaluation, validation, the four templates | P2.3 |
| `engine_v3/combat/encounter.ts` | Parley, escape roll, battle, applying results to the world | P2.4 |
| `engine_v3/combat/fleet.ts` | Sides, flagship, fleet bonus, Desperate Defence | P2.5 |
| `engine_v3/combat/shellback.ts` | Old Shellback's statline, habits and the Narrows gate | P2.6 |

Export the public parts from `engine_v3/index.ts`. Every number goes in `balance.ts` (`B.combat`, `B.loot`, `B.fairness`, `B.escape`, `B.parley`, `B.fleet`, `B.shellback` already exist).

## Data model additions

* `Captain`: `doctrines: Doctrine[]` (up to 3, named), `defaultDoctrine: string`, `parley: "off" | 1.25 | 1.5`, `noQuarter: boolean`, `bounty: number`, `bossesBeaten: string[]`.
* `Step`: optional `doctrine?: string` on `sail` and `lurk` steps. Which doctrine a ship uses: the step's, else the plan's `doctrine`, else the captain's default.
* `SeasonState`: `wrecks` and `flotsam`, each a record of `{ id, water, goods, plunder, untilTide }`. Salvage itself is P5 and later; this brief only creates them.
* `ReplayEvent`: a new `battle` event carrying the whole `BattleRecord`, plus `parley`, `escape` and `towed` events.
* `newCaptain` gives every captain the Brawler template as their only doctrine.
* Add `powerRating(ship)` to `ship.ts`, as DECISIONS D26.

## Rules to implement

### Before the battle (P2.4)

1. **Parley** (v0.2 7.6): if the target set a parley threshold and the hunter's side PR is at least threshold times the target's PR, the target pays 10% of its plunder and cargo and both sail on, unless the hunter set No Quarter. A No Quarter refusal against a weaker ship adds a bounty (v0.2 9 rule 2).
2. **Escape roll**: only the target rolls, and never in a mutual encounter. Chance = target Sails ÷ (target Sails + hunter Sails), times 1.3 for a Quiet stance, plus 0.2 in Fog, clamped to 0.05 and 0.75. An escaped target keeps sailing; the hunter freezes.
3. **Starting range and wind gauge** (8.1): Long; Medium in Fog; a Lurker picks Long or Medium (add `ambushRange` to the lurk step, default Medium). The wind gauge goes to the higher Helm score, Lurkers get the 1.2 bonus on that check, nobody has it in a Calm.

### Each round (P2.1 to P2.3)

Follow GAMEPLAY 8.3 exactly:

1. Evaluate each doctrine top down. The first rule whose conditions hold gives a Helm move and a Guns order. Ability rules fire their ability and evaluation continues below them for the Helm move and Guns order. Abilities are a registry keyed by id: register none in this brief (crew arrive in P8.4), but make the slot work and test it with a fake ability.
2. Helm: compute both Helm scores (8.4 formula), resolve the pair from the table, apply terrain overrides (Shallows, Kelp, Reef scrape).
3. Guns fire at the new range, at the same time, with the 8.5 formula. Round shot hits Hull, Chain hits Rigging, Grape removes Hands. Apply staleness, Hold Fire's bonus, powder use and out of powder.
4. Boarding melee if Grappled (8.6).
5. End checks: Sunk, Captured, Struck Colours, Escaped. After 5 rounds: Victory on points (10 point lead in damage share) or Draw.

Use one rng stream per battle round: `rngFor(tideSeed, "battle", hunterId, targetId, round)`. Luck applies only where GAMEPLAY 19.1 lists it.

### After the battle (P2.2, P2.4)

* Loot by outcome from the 8.7 table, times the fairness factor, times 0.5 in the Cradle, capped at `capPerBattle × Boom` (use a Boom of 1 until P5).
* Sunk: the winner grabs 25%, the rest becomes a Wreck in that water for 4 Tides.
* Captured: 40% plus one pick. Until intel (P7) and crew (P8) exist, the pick is always gold; leave a clear seam for the other picks.
* Jettisoned cargo becomes Flotsam for 2 Tides.
* Losers of a Sunk or Captured battle are **towed** at the end of the Tide to their nearest known Harbour, docked, with Hull raised to at least half. They sail freely next Tide.
* A PvP loss gives a shield until `tide + B.shieldTidesAfterPvpLoss`. Hunting a player ends your own shield early.
* Bounties: v0.2 9 rule 2, shrinking 10% per Tide.

### Fleets (P2.5)

v0.2 7.5 as written: fleet mates in the same water who are hunting or escorting join their side; each ship's doctrine reads the enemy flagship's moves; side damage is summed with the fleet bonus and shared out by max Hull; Desperate Defence for outnumbered player sides.

### Old Shellback (P2.6)

* An NPC captain (`kind: "npc"`, `npcRole: "boss"`) in `the_narrows` with Hull 300, no Rigging (Chain shot does nothing, its Helm score is a fixed number in balance), and claws that board as 40 Hands.
* Its doctrine: rounds 1 and 2 Close In; round 3 it rears up and Round shot does double damage to it; rounds 4 and 5 it grapples.
* Each Tide its plan is a Lurk that only engages captains who are not in their own `bossesBeaten`. Captains who have beaten it pass freely.
* Being on the winning side adds `old_shellback` to `bossesBeaten`. That is the gate the Crossing code (P5.6) will check.
* Beaten, it returns at full Hull next Tide. From Tide 9 (`shellbackDecayFromTide`) it loses 8% of its Hull each Tide.

## Tests to write

* Every pair in the Helm table, every Guns order at every range, Hold Fire, staleness and out of powder.
* A doctrine whose first rule never matches falls through to Otherwise; ability rules continue evaluation.
* Each of the seven outcomes can happen, and loot matches the table.
* The fairness factor for a bully and for an underdog; the per battle cap; Cradle halving.
* Parley paid, parley refused with No Quarter, escape succeeded, escape failed, no escape in a mutual encounter.
* Towing puts the loser in a Harbour, docked, at least half Hull.
* Two against one with the fleet bonus and Desperate Defence.
* A fresh sloop with a sensible doctrine can beat Old Shellback, and a captain who beat it is never engaged by it again.
* The same battle with the same seed gives an identical `BattleRecord`.

## Done checks

* `npm run check` passes (the v0.2 tests too), with the new tests above.
* `npm run tide:demo` shows both fixture encounters as real battles, round by round, in plain words.
* The golden file was updated on purpose, once.
* Every rule call you had to make is written in `docs/DECISIONS.md` under a new "Phase 2" heading, with its task id.

## Out of scope

Crew abilities and traits (P8.4), reputation effects (P8.6), intel picks on Capture (P7.3), salvaging wrecks (P5 or later), any balance tuning (P3).

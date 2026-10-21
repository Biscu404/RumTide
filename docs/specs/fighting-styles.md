# Spec: Fighting Styles and six distances

**Status: approved, 22 October 2026.** Biscu asked for more real fighting doctrines and for five or six distances, then handed the calls over on 21 October 2026: "just test them, I trust your judgement, if there is a problem, just fix it." The decisions are D121 to D128 in `docs/DECISIONS.md`. This spec and `docs/specs/boarding.md` are built together in P3.B2. Every number here is a starting value found in a scratch prototype (see "Measured"), and P3.2 tunes them again on the real engine.

## The problem

* Only two of the four templates fight to win. The Runner and the Coward both end fights early, by escaping or by striking colours.
* The Brawler was two styles glued together: a rammer and a boarder.
* Four distances (Long, Medium, Close, Grappled) left no room for a style to own its part of a fight.
* P3.1 measured the Skirmisher at 67% of the field, above the 60% cap of check 1, because nothing punished a ship that rakes.

## The player story

* **Bombardier:** "My spotters see them first, so the fight starts at Far and my mortar is the only gun that reaches. When they close I turn away and keep shelling."
* **Rammer:** "I dash in two bands at a time and drive my prow into their hull. I never ram a Firebrand."
* **Boarder:** "My grapnel lines reach from Short. Once I am over the rail, their Skirmisher is just a crew with cutlasses."
* **Gunline:** "I hold my ground and brace. A rake that would gut another ship barely scratches me, and every broadside lands."
* **Firebrand:** "Hot Shot and pitch. A ship that rams me or lashes itself to me burns with me."
* **Skirmisher:** "I cross their bow the moment they charge, and slip away when they get too close."

## The rules

### 1. Six distances

* **Far, Long, Medium, Short, Close, Grappled.** Short is new between Medium and Close. Far is new beyond Long.
* Battles start at Long, at Medium in Fog (as now), and at Far when either flagship is a Bombardier.
* A ship **escapes by going past Far.** Opening Range at Long now reaches Far, not freedom, so a ship that runs needs one more good turn.
* Grappling is unchanged (D35): both ships Close In at Close, or a Board order at Close. A Boarder can also Board from Short (section 3).
* Terrain: in Kelp the range never goes beyond Medium. In Shallows, a Brigantine or Frigate that loses its contest stops at Short instead of Close. The Long penalties of Rocky and Fog also apply at Far.
* The range factor of each Guns order:

| Order | Far | Long | Medium | Short | Close |
|-|-|-|-|-|-|
| Round shot | 0.2 | 0.6 | 1.0 | 1.0 | 1.0 |
| Chain shot | 0.4 | 1.0 | 0.8 | 0.6 | 0.4 |
| Grapeshot | 0 | 0 | 0.5 | 0.85 | 1.2 |
| Mortar (Bombardier only) | 1.0 | 1.0 | 0.9 | 0 | 0 |
| Hot Shot (Firebrand only) | 0 | 0.3 | 0.3 | 1.0 | 1.0 |

* While Grappled the great guns are quiet and the deck fight decides (boarding spec).

### 2. Fighting Styles

* A captain picks a **Fighting Style** together with the starting doctrine. The style gives a **trait** and its **template** doctrine.
* The trait belongs to the captain, not to the rules. The doctrine stays fully editable, and each trait pays only when its own move or order is played, so a captain who writes another style's rules does not get that style's trait.
* A captain can change style in a City. The price and any wait are set with the Harbour (P5).
* Replays and the battle preview show each ship's style, so a trait is never a hidden bonus (the worry behind D117).

| Style | Home distance | Wins by | Trait | Signature |
|-|-|-|-|-|
| Bombardier | Far and Long | Shelling from out of reach | Spotters, Zeroing In, small crew | Mortar |
| Gunline | Medium | Broadsides | Braced, Steady Deck | Holding its ground |
| Skirmisher | Short | Rakes and crippling | Kite | Cross Their Bow |
| Rammer | Close | Smashing the Hull | Dash | Ram |
| Boarder | Grappled | Capture, the best loot | Grapnel lines | Board from Short |
| Firebrand | Short and Close | Fire | Fireship, Tinderbox | Hot Shot, Fire Pots from the start |
| Smuggler | None | Getting away with the cargo | Slippery | Strikes early |

The Smuggler is the trader's style. It replaces the Runner and the Coward and sits outside the fighting wheel.

### 3. The traits and new moves

**Bombardier**

* **Mortar:** a Guns order only a Bombardier can give. It hits Hull, by the table above. Shells are lobbed: rakes, flank shots and turning away do not change them, and the Mortar never goes stale. Each shell hits 80% of the time, and a hit starts a fire 40% of the time.
* **Zeroing In:** for each round in a row that the range has not changed, the Mortar does 10% more, up to 50%.
* **Spotters:** a battle with a Bombardier flagship starts at Far.
* **Small crew:** the mortar takes the deck, so a Bombardier sails with 60% of the Hands. Boarders love it.

**Gunline**

* **Braced:** in a round it Holds, a rake against it counts as x1.35 instead of x2, it is not weakened by the rake, and a Ram against it does 70%.
* **Steady Deck:** in a round it Holds, its guns do 40% more.

**Skirmisher**

* **Kite:** Opening Range does not weaken its guns.

**Rammer**

* **Dash:** Close In moves one band further, so it closes two bands a round against a ship that Holds.
* **Ram:** at Close, a Rammer's Close In is a Ram. It misses against Cross Their Bow, and when the other ship wins the chase. Otherwise a Helm contest decides: on a hit the other ship loses 30 Hull and the Rammer 12. A Ram never grapples.
* **The dash can spoil a rake:** when a ship crosses a dashing Rammer's bow, a Helm contest decides. If the Rammer wins, the rake does x1.5 instead of x2 and the Rammer is not weakened.

**Boarder**

* Keeps the **boarder's edge** of the boarding spec (First over the rail x1.5, Lashed fast x2), which any ship earns by boarding (D117).
* **Grapnel lines:** Board works from Short as well as from Close, and a Board that fails on Helm score becomes a Helm contest with the Boarder's score counted three times. It is the Drill 10 Grapnels unlock, held from the start. Other styles still unlock Grapnels at Drill 10.

**Firebrand**

* **Fire:** a burning ship loses 14 Hull at the end of the round. Fires come from Hot Shot (30% of hits), the Mortar (40% of hits), a Firebrand's Fire Pots and the Fireship trait. A fire can sink a ship, and a Sunk ship is towed as always. A Fire Pot thrown by any other style keeps the boarding spec's rule: it never takes a ship below 1 Hull.
* **Hot Shot:** a Guns order only a Firebrand can give. It hits Hull, by the table above.
* **Fire Pots from Drill 0,** with 6 pots in the hold to start.
* **Fireship:** a ship that Rams a Firebrand catches a blaze that burns for 4 rounds. While Grappled with a Firebrand, the enemy deck catches fire 60% of the time each round.
* **Tinderbox:** a crew fighting a Firebrand on deck fights at 85% of its strength.

**Smuggler**

* **Slippery:** +25% Helm in a round it Opens Range.
* Its template strikes its colours at 40% Hull, to keep most of its cargo (8.7).

### 4. Overtime

* A deck fight still going when round 5 ends goes on for up to 2 more rounds. Guns stay quiet, Cut Free still works, and the battle ends the same way as before.

### 5. The wheel

Each fighting style beats two, loses to two and is even with one. The table also shows what the prototype measured (see "Measured" for how): the share of decided battles that went the designed way.

| Style | Beats | Loses to | Even with |
|-|-|-|-|
| Bombardier | Gunline (85%), Firebrand (61%) | Rammer, Boarder | Skirmisher (64%, and half the fights are draws) |
| Gunline | Skirmisher (78%), Boarder (64%) | Rammer, Bombardier | Firebrand (39%) |
| Skirmisher | Rammer (69%), Firebrand (67%) | Gunline, Boarder | Bombardier |
| Rammer | Gunline (70%), Bombardier (80%) | Skirmisher, Firebrand | Boarder (71%, leans to the Rammer) |
| Boarder | Skirmisher (56%), Bombardier (59%) | Gunline, Firebrand | Rammer |
| Firebrand | Boarder (68%), Rammer (73%) | Skirmisher, Bombardier | Gunline |

### 6. Templates

At most 3 rules with conditions, then Otherwise, so every template fits the base slots (D64).

* **Bombardier:** IF Grappled THEN Open Range, Repel. IF range is at most Short THEN Open Range, Round shot. IF range is Medium THEN Open Range, Mortar. Otherwise Hold, Mortar.
* **Gunline:** IF Grappled THEN Open Range, Repel. IF range is at most Close THEN Hold, Grapeshot. IF range is at least Long THEN Close In, Round shot. Otherwise Hold, Round shot.
* **Skirmisher:** IF Grappled THEN Open Range, Repel. IF their last Helm move was Close In THEN Cross Their Bow, Round shot. IF range is at least Medium THEN Close In, Round shot. Otherwise Cross Their Bow, Round shot.
* **Rammer:** IF Grappled THEN Open Range, Repel. IF their last Helm move was Cross Their Bow THEN Open Range, Round shot. Otherwise Close In, Round shot.
* **Boarder:** IF Grappled AND their last order was Repel THEN Hold, Volley. IF Grappled THEN Hold, Charge. IF range is at most Short THEN Close In, Board. Otherwise Close In, Round shot.
* **Firebrand:** IF Grappled THEN Hold, Fire Pots. IF their last Helm move was Cross Their Bow THEN Open Range, Hot Shot. Otherwise Close In, Hot Shot.
* **Smuggler:** IF my Hull is below 40% THEN Surrender. IF Grappled THEN Open Range, Repel. Otherwise Open Range, Chain shot.

### 7. What else changes

* **The four templates of 8.8 go.** The Brawler becomes the Boarder (this replaces the Brawler template of boarding spec section 5) and the Rammer. The Runner and the Coward become the Smuggler.
* **Doctrine conditions:** range tests know the six distances, and **"Their style is X"** is new, so a captain can write one rule for the counter they fear. "I have Fire Pots" comes from the boarding spec.
* **NPC brains (P9):** merchants and locals fight as Smugglers (the D85 idea in IDEAS), navy patrols as Gunlines, and pirates use the other styles.
* **Old Shellback** has no style. Measured against a fresh sloop of each style, the Gunline and the Skirmisher beat him every time, the Bombardier 7% (the rest are draws), and the Rammer, Boarder and Firebrand never. P3.2 retunes him for check 5 (section "Acceptance").
* **Fleets:** each ship uses its own trait. A Ram and a fire land on the enemy flagship, as guns do (D91). A battle starts at Far if either flagship is a Bombardier.
* **Crew (P8):** the Gunner's Heated Shot gives any style one round of Hot Shot. Skill trees may add to a trait, never copy another style's.
* **Replays and the Gazette:** the style badge, Rams, mortar arcs, fires and the two new distances. The art director adds the Far and Short positions to `ReplayScene`, and the narrative writer writes the lines.
* **Power Rating:** styles are equal on paper and do not change it.

## Edge cases

* Two Rammers can both Ram in the same round.
* A Ram and a Board in the same round: the Ram lands first, then the Board can still grapple.
* A Crippled Rammer can still Close In, so it can still Ram.
* A Mortar out of Powder fires at the out of Powder factor, like guns.
* Zeroing In starts again whenever the range changes.
* A new fire on a burning ship keeps whichever fire burns longer.
* A doctrine copied from a captain of another style can name Mortar or Hot Shot. A ship without that style fires Round shot instead, so a copied doctrine always plays.
* Every new roll (Ram, mortar hit, fire, the dash spoiling a rake, grapnel lines) has its own seed labels, so it never shifts anyone else's rolls.

## Numbers (names for `balance.ts`)

* `combat.ranges`: the six distances. `combat.range` gains `far` and `short` for every order, and the `mortar` and `hot` rows of the table above.
* `styles.bombardier`: `mortarHit` 0.8, `mortarFire` 0.4, `zeroStep` 0.1, `zeroMax` 1.5, `handsShare` 0.6, `startFar` true.
* `styles.gunline`: `bracedRake` 1.35, `bracedRam` 0.7, `steadyDeck` 1.4.
* `styles.skirmisher`: `kite` true.
* `styles.rammer`: `dashBands` 1, `ramHull` 30, `ramSelf` 12, `spoiledRake` 1.5.
* `styles.boarder`: `grapnelLines` true, `grapnelBonus` 3.
* `styles.firebrand`: `hotShotFire` 0.3, `startPots` 6, `ramBlazeRounds` 4, `emberChance` 0.6, `tinderbox` 0.85.
* `styles.smuggler`: `slippery` 1.25, `strikeHullPct` 40.
* `combat.fire`: `hull` 14, `rounds` 1.
* `combat.overtime`: 2.
* `combat.deck` (boarding spec): starting values `pairWin` 1.8, `pairLose` 0.75, Fire Pots `hit` 1.4. `combat.edge`: `firstOverTheRail` 1.5, `lashedFast` 2.
* Luck stays 0.9 to 1.1. A wider luck range softened the counters a little in the search, but it would take skill out of every fight.

## Measured (scratch prototype, 22 October 2026)

* **How:** a scratch copy of `engine_v3` with these rules added, all six templates against each other, equal fresh sloops, the nine waters of the simulator, both seats, 100 battles each, Drill 0. The numbers came from a coordinate search scored on the wheel, with luck kept at 0.9 to 1.1. Nothing from the prototype is merged: P3.B2 builds it properly.
* **Field share** (wins against the other five): Bombardier 33%, Gunline 39%, Skirmisher 34%, Rammer 46%, Boarder 35%, Firebrand 50%. No style is above 60%. Before this, with four templates, the Skirmisher had 67%.
* **The wheel:** 10 of the 12 designed wins land between 56% and 78% of decided battles. Two are harder counters than wanted: the Bombardier over the Gunline (85%) and the Rammer over the Bombardier (80%). Of the even pairs, the Rammer and Boarder lean 71% to the Rammer, and the Skirmisher and Bombardier draw half their fights.
* **Mechanics the search found no use for,** so they are not in this spec: a Ram that staggers the next Helm move, a Ram that is easier against a ship that Holds, a Ram that hands a Boarder the grapple, fire that weakens guns, fires that burn longer for a Firebrand, Zeroing In raising the hit chance, and a Helm bonus for a Bombardier turning away.
* **Draws:** 12% to 17% of fights for the close styles, 28% for the Skirmisher and 37% for the Bombardier.
* **Smuggler:** escapes 32% of fights against a Rammer, about half against the Gunline, Skirmisher, Boarder and Firebrand, and 89% against a Bombardier.
* **Upgrades:** with the same number of upgrade levels spent the way each style would (the Boarder on Drill, the Rammer on Hull, the others on Cannons), no style goes above 55% of the field at 5 or 10 levels. Single matchups do swing a lot, which is what check 4 (Power Rating) is for. Giving everyone Drill 10 while only the Boarder uses it put the Boarder at 69%, so Drill must be priced against the other upgrades in P5.

## Pillars

* **Fights reward reading the opponent:** every style has a counter and a counterplay, the badge shows which style you face, and "Their style is X" lets a doctrine plan for it.
* **Fair fights and soft falls:** no style dominates the field, and a ship sunk by fire is towed like any other.
* **A story every night:** rams, mortar arcs and fireships are the moments a replay is made of.
* **It rules out:** picking a style per battle (you sail as one captain), gear for single crew members, and stacking two styles' traits.

## Acceptance (qa-tester, with `npm run sim:v3`)

1. **Check 1 with six styles:** between equal fresh sloops, no style above 60% of the field and none below 25%.
2. **The wheel check (new):** each designed win between 55% and 80% of decided battles, and each even pair between 35% and 65%.
3. **Equal spending:** with the same upgrade levels spent the way each style would, no style above 60% of the field.
4. **Check 2** learns the new plays: Ram, Mortar, Hot Shot, and Board from Short are each the best play in at least one situation.
5. **Check 5:** every style's template beats Old Shellback at least sometimes, and the average over the six is 40% to 60%.
6. **The Smuggler** escapes at least 30% of fights against every style.
7. Every battle replays the same from its seed, and `npm run bots` passes.

## Cut first if time slips

1. Overtime.
2. Zeroing In.
3. The dash spoiling a rake. Without it the Skirmisher counters the Rammer much harder.

Never cut the six distances, the six styles or their signature moves. They are what fixes check 1 and gives every style a way to win.

## Later (Season 1, in `docs/IDEAS.md`)

* **Trickster** (False Colours): looks like a merchant, hides its rules from replays, and its first broadside does double damage.
* **Dread** (Black Flag): every Hand the enemy loses forces a nerve check, and a failed check strikes their colours.

## Build plan

| Task | Owner | What |
|-|-|-|
| P3.B2 | engineer (Claude Code) | `engine_v3`: this spec and the boarding spec together. Six distances, the styles and their traits, Ram, Mortar, Hot Shot, fire, overtime, templates, doctrine conditions, replay text, tests and the golden Tide. GAMEPLAY rewritten to match |
| P3.B3 | engineer and qa-tester | The simulator learns Deck orders and styles: six templates in check 1, the wheel check, equal spending, the new plays in check 2 |
| P3.2 | game designer and qa-tester | Tuning resumes: the two hard counters, the Rammer and Boarder lean, draws, and Old Shellback |
| P5 and P6 | | Changing style in a City, Fire Pots and Drill prices |
| Art and text | art director, pixel artist, narrative writer | Style badges, the Far and Short positions, rams, mortar arcs, fire, and their lines |

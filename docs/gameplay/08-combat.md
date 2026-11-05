# 8. Combat

## 8.1 How a battle starts

* From an encounter (3.7), after parley and the escape roll.
* **Starting range:** Long. In Fog, Medium. In Kelp, Medium (the range never goes beyond Medium there). A Lurker who springs an ambush chooses Long or Medium, and its choice wins over Fog (D39).
* **Spotters:** when either flagship is a Bombardier, a start at Long becomes a start at **Far** (D121, D142). A start at Medium stays Medium, and Kelp never allows Far.
* **Wind gauge:** goes to the ship with the higher Helm score at the start (8.4), and Lurkers get +20% on this check. No gauge in Calm. The gauge gives +20% to the Helm score, and so to every Helm contest, for the whole battle.
* Parley (v0.2 7.6), the fairness factor, bounties and shields (v0.2 section 9) all still apply. A Harbour has no battles, ever (2.2).

## 8.2 Battle state

* **Range:** six distances, from far to near: **Far, Long, Medium, Short, Close, Grappled.** A ship escapes by going past Far.
* **Each ship:** Hull points, Rigging points, Hands, Powder, Fire Pots, unused crew abilities, and whether it is burning. Its Fighting Style and its Drill are fixed for the battle.
* **Rounds:** up to 5, then up to 2 more of **overtime** while the ships are still Grappled (8.6). A doctrine can name rounds 1 to 5, and "round at least 5" stays true in overtime.

## 8.3 A round, step by step

1. Each ship's doctrine is checked from the top; the first rule whose conditions are true gives that ship a **Helm move** and a **Guns order**, or a special action (8.8). An order the ship's style cannot give is played as Round shot.
2. **Surrender** comes first. If a rule says Surrender, the colours come down and nothing else happens this round, fire included (Struck Colours, 8.7).
3. Crew abilities called by those rules resolve first, in order of Helm score. [P8: the engine records the rules that fired and resolves no ability yet.]
4. **Helm** resolves: the Helm scores, range changes, Dash, rakes and flank shots, the terrain overrides and the Reef scrape (8.4). If the ships began the round Grappled, the table is skipped and a ship that plays Open Range tries to **Cut Free** instead (8.6).
5. **The Ram:** a Rammer that played Close In at Close drives into the other flagship (8.4).
6. **Board:** a Board order is tried at the range the Helm step left, at Close or at Short for a Boarder. If it succeeds the ships are Grappled (8.6).
7. **Guns** fire at the same time, at the new range (8.5). In the round the ships grapple they fire at Close, as the ships come together. If the round began Grappled the great guns are quiet, and they stay quiet in the round a ship cuts free, because every hand is at the axes. A hit of Hot Shot or of the Mortar may set the enemy flagship alight.
8. If the ships are Grappled, the **deck fight** resolves (8.6): both crews strike at once with their Deck orders. Then a Volley burns its Powder, each Fire Pot thrown is used up and rolls for a fire, and a Fireship's embers roll.
9. **Fire:** every burning ship loses Hull (8.5).
10. End checks, in this order: Sunk, Captured, driven off (Old Shellback only, 2.5), Escaped (8.7). Struck Colours was settled at step 2.

After the last round, one side wins on points or it is a Draw (8.7). A round that ends in an Escape fires no guns and has no deck fight, but fire still burns.

## 8.4 Helm

Moves: **Close In**, **Hold**, **Open Range**, **Cross Their Bow**. A Crippled ship (Rigging at 0) cannot Open Range or Cross, so those play as Hold (6.3).

**Helm score** = Sails × (current Rigging ÷ max Rigging) × (1 + Helmsman, skill and trait bonuses) × wind gauge (1.2) × terrain (Shallows Sloop 1.15, Local Knowledge 1.15, moving with a Strong Current 1.15), and then the style of the round: a Smuggler that Opens Range counts **Slippery** (× 1.25), and a Boarder that Closes In counts **the chase** (× 1.3). The score counts in every contest of the round. Old Shellback's score is fixed at 10 (2.5).

**Helm contest:** ship A wins with probability A ÷ (A + B), rolled from the Tide seed.

**Distances and bands:** the six distances are Far, Long, Medium, Short, Close and Grappled, and a **band** is one step between two of them. A ship escapes by going past Far.

| A plays | B plays | Result |
|-|-|-|
| Close In | Close In | Range shrinks 2 bands (both at Close means Grappled) |
| Close In | Hold | Range shrinks 1 band |
| Close In | Open Range | Helm contest (the chase): the winner moves range 1 band their way. If Close In wins, it also gets a stern shot (+25% guns) |
| Hold | Hold | No change |
| Hold | Open Range | Range grows 1 band; the ship that Opens fires 25% weaker (it is turning away) |
| Open Range | Open Range | Range grows 2 bands; past Far, both disengage and the battle ends as Escaped |
| Cross Their Bow | Close In or Hold | **Rake:** the crosser's guns do double damage and the raked ship's guns 25% less. Against Close In, range also shrinks 1 band |
| Cross Their Bow | Open Range | The cross fails: the ship that Opens gets a flank shot (+25%) and the crosser fires 25% weaker; range grows 1 band |
| Cross Their Bow | Cross Their Bow | Circling: no range change; both fire 25% weaker |

* **The cycle:** Cross beats Close In and Hold. Open Range beats Cross. Close In and Hold beat Open Range (the ship that Opens loses gun power, and Close In may win the chase). Which range you *want* decides which risk you take.
* **Escape:** the range going past Far ends the battle as Escaped. Opening Range at Long reaches Far, not freedom, so a ship that runs needs one more good turn (D121). From Long, Open Range against Open Range escapes at once (2 bands). Otherwise a ship at Far escapes when it Opens Range against a Hold, wins the chase against Close In, or beats a Cross.
* **Terrain overrides:** in Shallows, a Brigantine or Frigate without Local Knowledge must win a Helm contest to reach Close, even against Close In, and if it loses the range stops at Short (D42, D142). In Kelp, range never goes beyond Medium, so nobody escapes. On a Reef, every Cross or Close In costs 10 Hull unless that water is Charted for you.
* **While Grappled** the table is skipped: a ship that plays Open Range tries to **Cut Free**, and any other move keeps the ships together (8.6).
* **Dash** (Rammer, D150): a Close In that brings the ships nearer moves the range one band further, never past Close and never into a grapple. A Rammer closes two bands a round against a ship that Holds. A chase it loses is not a dash, and two Rammers each add a band.
* **The dash spoils a rake** (Rammer): when a ship crosses the bow of a Rammer that Closes In, a Helm contest decides, at any distance. If the Rammer wins, the rake counts 1.75 instead of 2.0 and the Rammer is not weakened.
* **Kite** (Skirmisher): Opening Range does not weaken its guns.
* **Braced and Steady Deck** (Gunline, in a round it Holds, D148): a rake against it counts 1.35 instead of 2.0 and it is not weakened by the rake, and its guns do 40% more.
* **The Ram** (Rammer, D151): at Close, a Rammer's Close In is a Ram. It is resolved after the Helm step and before the Board and the guns, and it strikes the enemy flagship.
  * It misses if the other ship crossed its bow, or got away (it won the chase, so the range is no longer Close). Otherwise a Helm contest, the Rammer's score against the flagship's, decides.
  * On a hit the struck ship loses 30 Hull and the Rammer loses 4. Against a Gunline that Holds the blow is 70% (21 Hull), and against a Boarder that plays Board it is 50%, because its grapnels are already on the Rammer's bow.
  * A Ram that lands never grapples: a mutual Close In at Close stays at Close. A Ram that misses is a plain Close In, so a mutual Close In still grapples. A Board in the same round is still tried after the Ram.
  * A Crippled Rammer can still Close In, so it can still Ram, but with no Rigging its Helm score is 0. Two Rammers can both Ram.
  * A ship that Rams a Firebrand catches a blaze (8.5).

## 8.5 Guns

The range factor of each order at the five distances where the great guns fire. While Grappled the great guns are quiet and the deck fight decides (8.6), so there is no Grappled column.

| Order | Hits | Far | Long | Medium | Short | Close | Who can fire it |
|-|-|-|-|-|-|-|-|
| Round shot | Hull | 0.2 | 0.6 | 1.0 | 1.0 | 1.0 | Everyone |
| Chain shot | Rigging | 0.4 | 1.0 | 0.8 | 0.6 | 0.4 | Everyone |
| Grapeshot | Hands | 0 | 0 | 0.5 | 0.85 | 1.2 | Everyone |
| Mortar | Hull | 1.1 | 1.1 | 0.85 | 0 | 0 | Bombardier only |
| Hot Shot | Hull | 0 | 0.3 | 0.3 | 1.0 | 1.0 | Firebrand only |

The orders that fire no great guns:

| Order | What it does |
|-|-|
| Hold Fire | Nothing. Uses no Powder; next round's guns do 1.5 times damage |
| Board | Try to grapple, after the Helm step: only at Close, or at Short for a Boarder. Succeeds if your Helm score is at least theirs, or if they also Board or Hold (8.6) |
| Charge, Volley, Repel, Fire Pots | The Deck orders (8.6). They count only while Grappled. At any other range they do nothing, fire no guns and use nothing |

**Damage per round:**

`damage = 22 × (Cannons ÷ 10)^0.6 × range factor × gunnery × helm modifier × terrain × powder × luck`

* gunnery = min(1, Hands ÷ 60% of max Hands)
* helm modifier: rake 2.0, flank or stern shot 1.25, weakened 0.75, and a Gunline's Steady Deck 1.4 (8.4)
* terrain: shots at Long and at Far count 0.75 in Rocky water and 0.5 in Fog
* powder: 0.5 if out of Powder
* luck: seeded, 0.9 to 1.1 (19.1)
* Hold Fire's 1.5 (the round after it), staleness and the Mortar's Zeroing In multiply on top.
* Round shot, the Mortar and Hot Shot remove Hull points; Chain shot removes Rigging points (and does nothing to a ship with none); Grapeshot removes 1 Hand per 3 damage. Damage is rounded to whole points and never goes past what the target has left.
* **Staleness:** the same Guns order three rounds in a row does 20% less, from the third round on. The Mortar never goes stale.
* **Powder:** a ship that fires burns its hull's Powder per round (6.5). A ship with none fires at half damage and burns none.

**The Mortar** (Bombardier only, D137, D146)

* Hits Hull, by the table above, and is the best Hull shot at Far and Long. It takes the rake, flank and weakened factors of the Helm step like any gun.
* Each shell hits 80% of the time. A shell that misses does nothing, but still uses its Powder.
* A hit starts a fire 40% of the time, which burns for 2 rounds.
* **Zeroing In:** the Mortar does 10% more for each round in a row it is fired with the range unchanged, the first such round already counting, up to 50% more. Any other order, or a change of range, starts it again.
* Any ship that is not a Bombardier and is given the Mortar fires Round shot instead.

**Hot Shot** (Firebrand only, D138, D169)

* Hits Hull, by the table above, and is strong only at Short and Close. The shot is heated in the galley fire, so it uses twice the Powder of other shot. With less than that left it still fires and uses up the rest.
* 30% of the hits start a fire, which burns for 3 rounds.
* Any ship that is not a Firebrand and is given Hot Shot fires Round shot instead. In P8 the Gunner's Heated Shot gives any style one round of Hot Shot (7.3).

**Fire** (D138, D170)

* A burning ship loses **12 Hull** at the end of each round, after the deck fight, for as many rounds as the fire burns, the round it was lit included. A fire can sink a ship, and a Sunk ship is towed as always (8.7).
* Fires start from: a Hot Shot hit (30%, 3 rounds), a Mortar hit (40%, 2 rounds), a Firebrand's Fire Pot (30% of throws, 3 rounds, 8.6), the embers of a Fireship (40% each round while Grappled with a Firebrand, 2 rounds) and a Ram on a Firebrand (2 rounds, 8.4). Hot Shot, the Mortar, Fire Pots and embers set the enemy flagship alight. A Ram sets the ramming ship alight.
* A **Gunline** drills for fire: a burning Gunline loses only 60% of the fire's Hull (7). A burning **Firebrand** loses twice as much (24), because of the pitch in its hold.
* A new fire on a burning ship keeps whichever fire burns longer.
* A fire's Hull counts as damage dealt by the other side for Victory on points (8.7).
* A round that ends in an Escape still burns. A round of Struck Colours stops everything, fire too. Fires belong to the battle and burn out with it: none carries into the next battle or the next Tide.

## 8.6 Boarding: the deck fight

**Getting Grappled**

* Two ways: both ships Close In while already at Close, or a **Board** order. A Board is tried after the Helm step, at the range that step left: at Close, or at Short for a Boarder (grapnel lines). It succeeds if your Helm score is at least theirs, or if they also Board or Hold. A third way belongs to Old Shellback alone: his claw snatch (2.5), which counts as his Board, so he holds the edge.
* **Grapnels:** a Board that would fail on Helm score gets a Helm contest instead. A Boarder has Grapnels from Drill 0, and its score counts 3 times in that contest. Any other ship unlocks them at Drill 10, and its score counts once (6.2).
* A grapple that comes from Close In against Close In never tries the Board orders. A Ram that lands never grapples, but a Board in the same round still can (8.4).
* The guns of the round the ships grapple fire at Close, as the ships come together, and then the deck fight begins in the same round (D163).

**While Grappled**

* The great guns are quiet. Round shot, Chain shot, Grapeshot, the Mortar and Hot Shot fire nothing, roll no luck and use no Powder, which is why the 8.5 table has no Grappled column (D160).
* The Helm table is skipped. A ship that plays Open Range tries to **Cut Free**; any other move keeps the ships together. A Crippled ship cannot Cut Free.
* The order a rule gives is a **Deck order**. If the rule gives a Guns order instead (a rule written for another range), the crew fights with Fists.

**The Deck orders**

| Order | Weapons | Hit | Guard | Beats | Uses |
|-|-|-|-|-|-|
| Charge | Cutlasses | 1.5 | 1.25 | Volley: the charge reaches the muskets before they reload | Nothing |
| Volley | Muskets and swivel guns | 1.1 | 1.0 | Repel: the crew massed at the rail is an easy target | Powder, like a round of guns |
| Repel | Pikes at the rail | 0.6 | 0.6 | Charge: the charge runs onto the pikes | Nothing |
| Fire Pots | Clay pots of pitch and rum, lit and thrown | 1.4 | 1.0 | Nothing, but it ignores the guard of Repel | 1 Fire Pot a throw. A Firebrand may throw from Drill 0, any other style from Drill 5 |
| Fists | Fists and belaying pins | 1.0 | 1.0 | Nothing | Nothing |

* **Hit** is how hard a crew strikes. **Guard** is how much of the other crew's strike it takes, so Repel guards well and a Charge leaves the crew open.
* **The cycle** works like the Helm cycle of 8.4: Charge beats Volley, Volley beats Repel, Repel beats Charge. In a pairing the order that wins strikes 1.8 times harder and the order that loses strikes at 0.75. Fire Pots and Fists are outside the cycle.
* **Fists** is what a crew fights with when its order is a Guns order, a Volley with no Powder, or Fire Pots with no pot or no right to throw one. It is never a choice in a doctrine. Fists against Fists is the plain melee: each side removes 20% of its own boarding strength.
* **In the round the ships grapple,** only a crew whose own Board made the grapple (or joined it, because both ships Boarded) fights as a Charge. Every other crew fights with Fists, whatever its rule said, so the first round cannot be Repelled. A grapple from Close In against Close In gives both crews Fists. From the next round a Charge and a Repel count as given, a Volley counts if the ship had Powder when the round began, and Fire Pots count with a pot and the right to throw it (D161).

**The melee** (both crews strike at once)

`Hands lost by B = 0.2 × strength of A × hit of A's order × pairing × guard of B's order`

* **strength** = Hands × (1 + Bosun, trait and Background bonuses) × the Drill factor (6.2, with its luck of that round) × Kelp (1.15, for both ships) × First over the rail (1.25, below) × Fighters (1.2, a Boarder's crew) × Tinderbox (0.8, a crew fighting a Firebrand on deck).
* **pairing:** 1.8 for the order that wins the cycle, 0.75 for the one that loses it, otherwise 1.
* **Second Wave** (Drill 15): after the exchange the crew strikes once more at a quarter of its strength, which makes the whole strike 1.25 times as large.
* Losses are whole Hands. Half of all lost Hands are wounded (6.4).
* **Captured:** after a deck fight, a side whose Hands fall below 40% of the other side's, or below 20% of its own max, surrenders (8.7). Grapeshot thinning a crew never captures it, only a deck fight does.
* **There is no luck roll in the deck fight itself.** The dice are the Cut Free contests, the grapnels and whether a Fire Pot catches. Between equal ships that makes a small edge in strength decisive at the starting numbers (D181, D198), and whether the melee should get a luck roll is a call for P3.2.

**Fire Pots**

* A throw uses up one pot, caught or not, and rolls 30% for a fire.
* A **Firebrand's** pot that catches sets the enemy flagship alight for 3 rounds (fire is in 8.5).
* Any **other style's** pot that catches is a flash: the throwing ship and the enemy flagship each lose 8 Hull at once, and neither is ever taken below 1 Hull. Nothing burns after it.

**The boarder's edge** (D117, D162)

* The **boarder** is the ship whose Board made the grapple. If both ships Board in the same round, or the grapple came from Close In against Close In, nobody holds the edge. Any captain can earn it by boarding, whatever their style.
* **First over the rail:** in the round it grapples, the boarder's Board fights as a Charge with its strength × 1.25. The other crew chose its order before the grapple and fights with Fists.
* **Lashed fast:** while the grapple lasts, the boarder's Helm score counts 2 times in every Cut Free contest of the ship it holds, so an equal ship wins about 1 try in 3. A ship with Grapnels (a Boarder, or any ship at Drill 10) is lashed fast in every grapple it is in, not only the ones it made. A boarder that cuts free of the ship it boarded gets no help.
* **Harder to repel:** the first round cannot be Repelled, and Lashed fast keeps the defender in the fight. In later rounds Repel still beats Charge, on purpose; the boarder's answer to Repel is Volley.
* The edge ends when the grapple does. A new grapple makes a new boarder.

**Cut Free**

* A Grappled ship that plays Open Range rolls a Helm contest against the enemy flagship (a fleet mate rolls its own). If either ship wins, the range returns to Close.
* In that round there is no deck fight, no new grapple is tried, and the great guns of both ships stay quiet, because every hand is at the axes (D135, D162).

**Overtime**

* A deck fight still going when round 5 ends goes on for up to 2 more rounds (D127, D164). The guns stay quiet, Cut Free still works, and the battle ends as before: a Capture, a Sinking, or points after the last round played. If the ships have cut free and are no longer Grappled when round 5 ends, there is no overtime.

**Crew** [P8]: the Bosun's Brawler branch adds to boarding strength on top of Drill, and Boarders Away (an instant grapple) gives the edge (7.3).

## 8.7 Outcomes

| Outcome | How | Winner gets | Loser |
|-|-|-|-|
| Sunk | Hull reaches 0, from guns, a Ram, a Reef scrape or fire | 25% of the loser's plunder and cargo, grabbed from the water; Fear | Towed to the nearest known Harbour, Hull raised to at least half, sailing again next Tide. The rest of its cargo becomes a **Wreck** in that water |
| Captured | Wins the deck fight (8.6): the loser's Hands fall below 40% of the winner's, or below 20% of its own max | 40% of plunder and cargo, plus one pick: an intel original, two intel copies, or one crewmate prisoner; volunteers (6.4) | Towed as above. Nothing permanent is lost |
| Struck Colours | The loser's doctrine says Surrender. It is settled first in the round: the colours come down and nothing else happens, fire included | 15% of plunder and cargo | Ship stops taking damage |
| Driven off | Old Shellback only: his Hull falls below 35% or his claws below 25% of their full strength (D205) | Counts as Struck Colours: 15% of plunder and cargo. It beats him (2.5) | He retreats into his shell and is back next Tide |
| Crippled | Rigging reaches 0 | Battle goes on; the crippled ship cannot Open Range or Cross (it plays Hold, so it cannot Cut Free either), so this usually ends in a Capture | Limps one hop per Tide until repaired |
| Escaped | Range goes past Far | Nothing | Nothing |
| Victory on points | After the last round played (5, or up to 7 in overtime), one side leads by 5 points of damage share (D132) | 20% of plunder and cargo | |
| Draw | Otherwise | Nothing | Nothing |

* **End checks run in this order:** Sunk, then Captured (only after a deck fight), then driven off (Old Shellback only), then Escaped. If both ships reach 0 Hull in the same round, the side that dealt more damage in the battle wins the Sinking, and equal damage is a Draw. A ship that fire sinks in the round a Capture would have happened is Sunk. A fire can sink a ship (8.5), and the Sunk ship is towed as always. If both sides fall below the Capture line, the side with fewer Hands is Captured, and equal Hands is a Draw.
* **Damage share** (for Victory on points): a hit counts as its share of the victim's max on that track (Hull, Rigging or Hands), averaged over the victim's tracks (three, or two for a ship with no Rigging). Hull lost to a Ram, to fire or to a Fire Pot flash counts as damage dealt by the other side, and a Reef scrape does not. A lead of exactly 5 points counts.
* **Old Shellback is never beaten on points** (2.5): a fight with him that reaches the end on points is a Draw, whoever led (D205).
* All loot is multiplied by the fairness factor and capped per battle (v0.2 section 9). When a fleet splits the loot, the Hull a fire took counts for the ship that lit the fire.
* **Spill:** cargo thrown overboard (the Jettison ability or a doctrine rule) becomes **Flotsam** in that water for 2 Tides. Anyone can Salvage it.
* **Wrecks** last 4 Tides. Each Salvage takes 5 units.
* Sinking pays less than capturing but is safer. Greed pushes you to board, which is riskier.

## 8.8 Doctrines

* A doctrine is an ordered list of **rules**. Each round, the first rule whose conditions are true fires.
* A rule is: **IF** up to 2 conditions **THEN** a Helm move and a Guns order, or Surrender, or Jettison.
* **Ability rules** are the exception: when one fires, the crew ability triggers and the doctrine keeps checking the rules below it to find this round's Helm move and Guns order. [P8: the engine has the slot and no abilities yet.]
* The last rule is always *Otherwise*, with no condition.
* **Slots** count the rules that have conditions: 3, plus Command ranks 1 and 4 (+1 each), plus a Helmsman (+1), plus Navy Deserter (+1). Cap 7. The Otherwise rule is always there and is free (D64).
* **Conditions:**
  * Range is X, at least X, or at most X, over the six distances. Far is the farthest and Grappled the nearest, so "range at least Long" means Long or Far
  * Round is N, or at least N. A doctrine can name rounds 1 to 5, and "round at least 5" stays true in overtime
  * My or their Hull, Rigging or Hands above or below N%
  * Their last Helm move or Guns order was X. The Deck orders are Guns orders, so "their last order was Repel" works
  * **Their style is X** (D128): one rule for the counter you fear. It is false against a ship with no style, such as Old Shellback
  * Enemy type: merchant, navy, monster, player, Brethren captain, or a named captain
  * Terrain is X; the wind gauge is mine or theirs
  * I have Powder; **I have Fire Pots**; an ability is still unused
* **Orders a rule can give** next to its Helm move: Round shot, Chain shot, Grapeshot, Hold Fire, Board, Mortar and Hot Shot (8.5), and the Deck orders Charge, Volley, Repel and Fire Pots (8.6). Fists is never a choice: it is what a crew falls back to.
* **A copied doctrine always plays** (D146, D173). The Mortar, given to a ship that is not a Bombardier, and Hot Shot, given to one that is not a Firebrand, are played as Round shot, and the replay says so. Fire Pots with no pot or no right to throw one, and a Volley with no Powder, are played as Fists. A Deck order at any other range does nothing, fires no guns and uses nothing. The doctrine editor will warn about all of these [client, not built].
* **Abilities in rules** [P8]: *IF range is Medium AND round at least 2 THEN Gunner: Heated Shot.*
* Each captain saves **3 named doctrines**; voyage plan steps pick which one to use (*"intercept with Boarders"*).
* **Templates** are the beginner doctrines, one for each Fighting Style (8.8a), and a captain starts with the template of their style as their first saved doctrine. Each is at most 3 rules with conditions and an Otherwise, so every one fits the base slots (D64). They replace the four of the first v0.3 draft: the Brawler became the Rammer and the Boarder, the Runner and the Coward became the Smuggler, and the Skirmisher was rewritten (D123). A captain with no style starts with the Boarder (D172). Their rules, exactly as built:
  * **Bombardier:** IF Grappled THEN Open Range, Repel. IF range is at most Short THEN Open Range, Round shot. IF range is Medium THEN Open Range, Mortar. Otherwise Hold, Mortar.
  * **Gunline:** IF Grappled THEN Open Range, Repel. IF range is at most Close THEN Hold, Grapeshot. IF range is at least Long THEN Close In, Round shot. Otherwise Hold, Round shot.
  * **Skirmisher:** IF Grappled THEN Open Range, Repel. IF their last Helm move was Close In THEN Cross Their Bow, Round shot. IF range is at least Medium THEN Close In, Round shot. Otherwise Cross Their Bow, Round shot.
  * **Rammer:** IF Grappled THEN Open Range, Repel. IF their last Helm move was Cross Their Bow THEN Open Range, Round shot. Otherwise Close In, Round shot.
  * **Boarder:** IF Grappled AND their last order was Repel THEN Hold, Volley. IF Grappled THEN Hold, Charge. IF range is at most Short THEN Close In, Board. Otherwise Close In, Round shot.
  * **Firebrand:** IF Grappled THEN Hold, Fire Pots. IF their last Helm move was Cross Their Bow THEN Open Range, Hot Shot. IF range is at least Medium THEN Close In, Round shot. Otherwise Close In, Hot Shot. Hot Shot is weak beyond Short and costs double Powder, so the template saves it for Short and Close.
  * **Smuggler:** IF my Hull is below 40% THEN Surrender. IF Grappled THEN Open Range, Repel. Otherwise Open Range, Chain shot. It strikes its colours early to keep most of its cargo (8.7).
* **Fleet battles** (v0.2 7.5, D91 to D95, D152, D174):
  * One range, moved by the two flagships. Each ship's doctrine is judged against the enemy flagship's moves, and each ship uses its own trait.
  * A Ram, a Mortar shell, a Hot Shot and a Firebrand's fire land on the enemy flagship, as guns aim at it. The flash of a Fire Pot from any other style costs the throwing ship and the enemy flagship. A mate's Close In never moves the range, and Spotters read the two flagships only.
  * In the deck fight each ship's Deck order is judged against the enemy flagship's. The side's crews are added up, and the side bonus applies once. The edge goes to the side whose ship made the grapple, a mate's Board included, and Lashed fast doubles the flagship's score in a mate's Cut Free contest too.
* **Information:** replays are public and show which rule fired each round and each ship's style, so careful viewers can reconstruct a captain's doctrine. A **Doctrine Copy** can also be taken on a Capture (10.2).
* **Battle preview** [client, not built]: the browser runs 200 simulated battles against the target's last known doctrine (rebuilt from replays) or a template, and shows the target's style.

Example doctrine, *Boarders*:

1. IF their Hull below 30% THEN Close In, Board
2. IF range is Long THEN Close In, Chain shot
3. IF enemy type is merchant THEN Close In, Grapeshot
4. IF round is 3 AND Gunner ability unused THEN Gunner: Double Shot
5. Otherwise: Cross Their Bow, Round shot

Example round: the *Salty Gull* (Boarders) meets the *Wet Sock* at Medium range in Open water. Round 3: the Gull's rule 4 fires (Double Shot, then its rule 5 move, Cross Their Bow). The Sock's doctrine says "IF round is 3 THEN Hold, Round shot". Cross against Hold is a rake: the Gull's doubled shot does about 4 times normal damage and the Sock's guns do 25% less. The replay shows the Gull swinging across the Sock's bow, the Gunner's cut in, and a huge splinter cloud. (Had the Sock been a Gunline, Braced would have cut the rake from 2.0 to 1.35.)

Example deck rules, *Reading the Rail*, written to read the other crew (8.6):

1. IF Grappled AND their last order was Charge THEN Hold, Repel
2. IF Grappled AND their last order was Repel THEN Hold, Volley
3. IF Grappled THEN Hold, Charge
4. Otherwise: Close In, Round shot

Repel beats Charge, Volley beats Repel and Charge beats Volley, so rules 1 and 2 answer what the other crew did last round and rule 3 beats a Volley.

## 8.8a The Fighting Styles

* A captain picks a **Fighting Style** at creation, with the starting doctrine (5.1, D122). It gives a **trait** and a **template** (8.8). Six styles fight and sit on one wheel. The Smuggler is the trader's style and sits outside it.
* The trait belongs to the captain, not to the rules, and pays only in a round its own move or order is played. A captain who copies another style's doctrine gets the rules and not the trait.
* The battle record carries each ship's style, so replays and the battle preview show it as a badge and no trait is a hidden bonus (D122, D143).
* **The wheel:** each fighting style beats two, loses to two and is even with one. These are soft counters, so no style is a free pick and none is a dead one. The simulator holds each designed win to 55% to 80% of decided battles and each even pair to 35% to 65% (8.9, check 6).

| Style | Home distance | Trait | Signature move | Beats | Loses to | Even with |
|-|-|-|-|-|-|-|
| Bombardier | Far and Long | Spotters, Zeroing In, small crew | Mortar | Gunline, Firebrand | Rammer, Boarder | Skirmisher |
| Gunline | Medium | Braced, Steady Deck, Long Nines, fire drill | Holding its ground | Skirmisher, Boarder | Rammer, Bombardier | Firebrand |
| Skirmisher | Short | Kite | Cross Their Bow | Rammer, Firebrand | Gunline, Boarder | Bombardier |
| Rammer | Close | Dash | Ram | Gunline, Bombardier | Skirmisher, Firebrand | Boarder |
| Boarder | Grappled | Grapnel lines, Fighters, the chase, grapnels catch the prow | Board from Short | Skirmisher, Bombardier | Gunline, Firebrand | Rammer |
| Firebrand | Short and Close | Fireship, Tinderbox, Fire Pots from the start | Hot Shot | Boarder, Rammer | Skirmisher, Bombardier | Gunline |
| Smuggler | None | Slippery | Strikes early | Outside the wheel | | |

**The traits, one by one** (every number is in `balance.ts` under `styles` and `combat.fire`):

* **Bombardier:** the **Mortar** (8.5), **Spotters** (the battle starts at Far, 8.1), **Zeroing In** (the Mortar does 10% more for each round in a row the range has not changed, up to 50% more), and a **small crew**: the mortar takes the deck, so a Bombardier sails with 60% of the Hands (6.4). Boarders love it.
* **Gunline**, in a round it Holds: **Braced** (a rake against it counts 1.35 instead of 2.0, it is not weakened by the rake, and a Ram against it does 70%), **Steady Deck** (its guns do 40% more) and **Long Nines** (its Round shot at Long counts 0.8 instead of 0.6). **Fire drill:** a burning Gunline loses only 60% of the fire's Hull.
* **Skirmisher:** **Kite.** Opening Range does not weaken its guns.
* **Rammer:** **Dash** (Close In moves one band further), the **Ram**, and the **dash spoils a rake** (all in 8.4).
* **Boarder:** **Grapnel lines** (Board works from Short, and a Board that fails on Helm score becomes a Helm contest with its score counted 3 times), **Fighters** (its crew fights with 20% more boarding strength), **the chase** (its Helm score counts 1.3 times in a round it Closes In), and **grapnels catch the prow** (a Ram against it in a round it plays Board does half). It also earns the boarder's edge (8.6), as any ship does by boarding.
* **Firebrand:** **Hot Shot** (8.5), **Fire Pots from Drill 0** with 2 pots to start (8.6), **Fireship** (a ship that Rams a Firebrand catches a blaze of 2 rounds, and while Grappled with a Firebrand the enemy deck catches fire 40% of the time each round) and **Tinderbox** (a crew fighting a Firebrand on deck fights at 80% of its strength, and the pitch in the hold burns both ways: a burning Firebrand loses twice the fire's Hull). Fire is in 8.5.
* **Smuggler:** **Slippery** (its Helm score counts 1.25 times in a round it Opens Range). Its template strikes its colours below 40% Hull.

Changing style in a City is [P5]: the price and any wait are set with the Harbour, and the change has to cap or fill the Hands (D145). Styles are equal on paper and do not change the Power Rating (6.2). In P8, skill trees may add to a trait but never copy another style's, and the Gunner's Heated Shot gives any style one round of Hot Shot (7.3). Two more styles, the Trickster and the Dread, wait for Season 1 (`docs/IDEAS.md`).

## 8.9 Verify before building

The bot simulator must show all of these before this combat system is locked:

* No template doctrine wins more than 60% against the field of the others.
* Every Helm move and every Guns order is the best choice in at least one situation.
* Equal ships split wins evenly.
* A ship with twice the Power Rating wins about 85 to 90% of the time.
* Old Shellback is beatable by a fresh Sloop with a good doctrine, about half the time.

Those five lines say "about" and "the field", so the simulator (`npm run sim:v3`, `tools/v3/sim/`) draws a line for each. Since the Fighting Styles, the deck fight and Drill it also runs five more checks, ten in all (`-- --check` takes 1 to 10). **These are the lines the simulator draws** (D109 to D115, D182 to D200). They are test lines, not gameplay numbers, so they live in the simulator and not in `balance.ts`. The fights run the real engine with ships that really have their style, in 9 scenes (open water in a Breeze, a Calm and a Gale, the Shallows, a Reef both Charted and not, Rocky, Fog and Kelp) and in both seats. Check 5 plays the Narrows instead.

| # | Measured as | Passes when |
|-|-|-|
| 1 The field | The six style templates against each other, equal fresh sloops | Every style wins from 25% to 60% of the field, averaged over the scenes |
| 2 Best play | Situations grouped by the distance the round starts at, every play tried on the same seeds. 17 plays: the 4 Helm moves; the Guns orders Round shot, Chain shot, Grapeshot, Hold Fire, Board, Repel, Mortar, Hot Shot, Charge, Volley and Fire Pots; the Ram; and Board from Short | Each of the 17 is clearly best (2 standard errors ahead of every other play) in at least one situation. Fire Pots are judged between ships at Drill 5. Fists is a fallback, so it is not checked |
| 3 Seat split | The battles of check 1 without the doctrines: of the battles somebody won, the hunter's share, pooled and in each mirror match | The 95% range of the hunter's share reaches into 45% to 55%. A mirror with no decided battle passes |
| 4 Power Rating | Random plans (the v0.2 7.3 method): a fresh sloop against a balanced stronger sloop at rating ratios 1, 1.25, 1.5 and 2. Battles that end Escaped are left out | The stronger ship wins 83% to 92% of the fought battles at ratio 2, and the share rises with the ratio |
| 5 Old Shellback | A fresh sloop on Tide 6 through the real Tide loop. A search finds the best doctrine a new captain of that style can save, and it is confirmed on fights it never saw. It runs once for each style; the Smuggler is searched and printed, not judged | Each style's confirmed share is from 35% to 80% (D140) |
| 6 The wheel | The 15 pairs of the styles, read from the battles of check 1 | The 12 designed wins from 55% to 80% of decided battles, the 3 even pairs from 35% to 65% |
| 7 Equal spending | The same levels N (5 and 10) spent the way each style would: the Boarder on Drill, the Rammer on Hull, the other four on Cannons | No style above 60% of the field |
| 8 Drill | Boarder against Boarder | Drill 5 against Drill 0 wins 55% to 80% of decided battles. Drill 15 against Drill 0 wins a share between the shares check 4 finds for the rating ratios either side of 1.38 (a Drill 15 sloop rates 1.38 times a fresh one) |
| 9 Lashed fast | An equal fresh sloop that tries to Cut Free from a Boarder holding the edge | It wins at most 40% of its tries (a third, with room for noise), from at least 100 tries |
| 10 The Smuggler | A fresh Smuggler against each of the six styles | It escapes at least 30% of its battles against every style |

* Beside the ten checks the report prints the **gate pace** of 2.5, worked out from the win chance on each Tide: the median captain should pass by Tide 7 to 9 and nobody later than Tide 12. It is printed, not pass or fail.
* The results and the findings that P3.2 tunes from are in `docs/DECISIONS.md` (D197 to D200). The brief is `docs/briefs/P3-combat-testing.md`.

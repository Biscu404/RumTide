# Spec: boarding, the deck fight

**Status: proposed, 20 October 2026.** Biscu made the four big calls (D116 to D120 in `docs/DECISIONS.md`). Everything else here is the game designer's proposal until Biscu approves this spec. Approval starts the build (P3.B2). Once it is built, GAMEPLAY 6.2, 6.4, 6.5, 8.3, 8.5, 8.6, 8.8 and 8.9 are rewritten to match and this file points at them.

## The problem

* While ships are grappled, cannon fire decides the fight. Round shot does half damage, Chain shot nothing and Grapeshot full damage, and the melee is one formula: each side removes 20% of its own boarding strength from the other. There is nothing to read and nothing to buy for it except more Berths.
* P3.1 measured the result: **Repel was the best play in 0 of the 350 situations that matter** (check 2). P3.2 then tried two fixes on top of its first three number changes. With no guns at all while grappled, the Brawler fell to 5% of the field and Repel became a free pick, because every other order did nothing. With Round shot off and Grapeshot kept, the Brawler stayed healthy at 53% but check 2 still failed on Repel alone.
* No number can give Repel a job, so the rule changes (the P3 brief allows that when no number can fix a check). Biscu's call: rework boarding from the ground up (D116).

## The player story

* **The boarder:** "My Brawler closes, throws the grapnels and goes over the rail first. Their doctrine reads my Charge and Repels with pikes, so next round my rule says Volley, and the muskets cut down the crew massed at the rail. I spent my gold on Drill, so my Cutthroats hit harder, and once they are Sea Wolves they strike twice."
* **The defender:** "They boarded me. My rule says: if grappled and they Charged last round, Repel. I held the rail, then cut free."

## The rules

### 1. Grappled means the deck fight

* While Grappled, the great guns are quiet. Round shot, Chain shot and Grapeshot fire nothing, so the Grappled column of the 8.5 table goes. The swivel guns live on inside Volley.
* While Grappled, the order a rule gives is a **Deck order**. If the rule gives a Guns order instead (a rule written for another range), the crew fights with Fists.
* A Deck order at any other range does nothing and fires no guns, as Repel does today. The doctrine editor warns about it.
* Helm while Grappled is unchanged: Open Range tries to Cut Free, and any other move keeps the ships together.

### 2. The Deck orders

| Order | Weapons | What it does | Beats | Uses |
|-|-|-|-|-|
| Charge | Cutlasses | Hits hardest and takes the most | Volley: the charge reaches the muskets before they reload | Nothing |
| Volley | Muskets and swivel guns | Steady hits, few losses | Repel: the crew massed at the rail is an easy target | Powder, like a round of guns |
| Repel | Pikes at the rail | Takes the fewest, hits little | Charge: the charge runs onto the pikes | Nothing |
| Fire Pots | Clay pots of pitch and rum, lit and thrown (the molotov of the age) | Hits hard and ignores Repel. Each throw may start a fire | Nothing | 1 Fire Pot, and Drill 5 |
| Fists | Fists and belaying pins | Today's plain melee, the fallback | Nothing | Nothing |

* **The cycle** works like the Helm cycle of 8.4: Charge beats Volley, Volley beats Repel, Repel beats Charge. In each pairing the winning order hits harder and the losing order hits softer. Fire Pots and Fists are outside the cycle.
* **Fists** is what a crew does when its order is a Guns order, a Volley with no Powder, or Fire Pots with no pots or Drill below 5. It is not a choice in the doctrine editor.
* **Fire Pots** are a third supply beside Provisions and Powder (6.5): sold in Towns and Cities, they take Hold space, and a new captain has none. Each throw rolls for a **fire**, which costs both ships Hull, because they are lashed together. A fire never takes a ship below 1 Hull: the crews put it out.
* **The melee**, both sides at once as today:
  `Hands B loses = kill share x strength of A x hit of A's order x pairing x guard of B's order`
  * strength = Hands x (1 + Bosun, trait and Background bonuses) x Drill x Kelp x First over the rail (section 3)
  * hit: how hard an order strikes. guard: how much of a strike a crew takes (Repel low, Charge high). Fire Pots ignore Repel's guard.
  * pairing: the cycle's bonus for the order that wins the pairing, and its penalty for the order that loses it. Otherwise 1.
* Everything else of 8.6 stays: Capture when a side's Hands fall below 40% of the other's or 20% of its own max (and D55 for ties), and half of all lost Hands are wounded (6.4).

### 3. The boarder's edge (the Brawler buff)

The **boarder** is the ship whose Board order made the grapple. If both ships Board in the same round, or the grapple came from Close In against Close In at Close (D35), nobody has the edge. The edge goes to whoever boards, so the Brawler earns it by boarding and any captain can (D117).

* **First over the rail:** in the round it grapples, the boarder's Board fights as a Charge, with its strength times a bonus. The other ship chose its order before the grapple, so its crew fights with Fists. A ship that also played Board fights as a Charge without the bonus.
* **Lashed fast:** while the grapple lasts, the boarder's Helm score is multiplied in every Cut Free contest. A ship it boarded finds it hard to break away.
* **The guns of the grapple round** fire at Close, as the ships come together, and then the grapple happens. Today they fire at the Grappled range. This keeps a price on boarding: the boarder fires nothing that round (D29) and takes a broadside on the way in.
* **Harder to repel:** the first round cannot be Repelled at all, and Lashed fast keeps the defender in the fight. In later rounds Repel still beats Charge, on purpose: a counter that never works is the bug P3.1 found. The boarder's answer to Repel is Volley.

### 4. Drill, the Hands track

* A sixth ship upgrade beside Hull, Cannons, Sails, Berths and Hold: **Drill 0 to 15, in three stages of five levels.** Stage 1 is **Deckhands** (1 to 5), stage 2 **Cutthroats** (6 to 10), stage 3 **Sea Wolves** (11 to 15).
* Each level adds boarding strength. A level in a later stage adds more than one in an earlier stage, and costs more. The season preset's cost multiplier applies, as for every upgrade.
* Bought like the other upgrades, in a Town or City. Drill belongs to the ship: new hires are trained by the old hands, and Drill is never lost to a tow, a Capture or a hiring.
* **Finishing a stage unlocks something:**

| Drill | Stage done | Unlock |
|-|-|-|
| 5 | Deckhands | **Fire Pots:** the crew can use the Fire Pots order |
| 10 | Cutthroats | **Grapnels:** Lashed fast holds for you in every grapple you are in, not only the ones you made, and a Board that would fail on Helm score gets a Helm contest instead |
| 15 | Sea Wolves | **Second Wave:** in every melee round, after the exchange, your side strikes once more at a share of its strength |

* **Season 0 has all three stages** (D120). The cap is a season preset number, so a later season can lower it.
* **Power Rating counts Drill:** Hands count as Hands times the Drill factor (D26 changes), so parley, the fairness factor and bounties see a drilled crew.

### 5. What else changes

* **Templates (8.8).** Each gets a Grappled rule inside its 3 slots. The Brawler becomes: IF Grappled AND their last order was Repel THEN Hold, Volley; IF Grappled THEN Hold, Charge; IF range is Close THEN Close In, Board; Otherwise Close In, Round shot. The Runner keeps Open Range with Repel when Grappled. The Skirmisher and the Coward rules are set in the build and logged in DECISIONS.
* **Doctrine conditions.** "Their last Guns order was X" also reads Deck orders, and "I have Fire Pots" is new.
* **Old Shellback.** His claws Charge (Claw and Shell gets a Grappled rule), and because he Boards in rounds 4 and 5 he has the boarder's edge: once he holds you, he is hard to shake. He has no Powder, so he never Volleys. His statline gains a Drill level, tuned in P3.2.
* **Fleets (D91, D94).** Each ship's Deck order is judged against the enemy flagship's Deck order, as Helm is. Side totals and shares stay as D94. The edge belongs to the side whose ship made the grapple. A fire burns the throwing ship and the enemy flagship.
* **Crew (P8).** The Bosun's Brawler branch adds to boarding strength on top of Drill, and Boarders Away (an instant grapple) gives the edge.
* **Replays and the Gazette.** Each melee round shows both Deck orders, who won the pairing, the edge and any fire. The narrative writer writes the lines.
* **NPC brains (P9)** get Deck orders in their doctrines.

## Edge cases

* Both ships Board in the same round: they grapple, nobody has the edge, and both fight as a Charge without the bonus.
* Grappled by Close In against Close In: nobody has the edge, and both crews fight with Fists that round.
* A Cut Free that wins returns the range to Close with no melee that round (D61). The edge ends with the grapple, and a new grapple makes a new boarder.
* A Crippled ship cannot Cut Free (unchanged).
* Out of Powder: Volley falls back to Fists, it does not fire at half strength.
* A doctrine may name Fire Pots without Drill 5 or without pots. It falls back to Fists, so a copied doctrine always plays.
* A fire is a seeded roll with its own labels, so it never shifts anyone else's rolls.
* A Jettison round plays Hold and Hold Fire (D65). Hold Fire is a Guns order, so a crew that jettisons while Grappled fights with Fists.
* A captain who misses a Tide: doctrines are standing orders, nothing changes.
* Kelp still adds 15% boarding strength to both sides.

## Numbers (names for `balance.ts`)

The build picks first values so that Fists matches today's melee, and P3.2 tunes them by doubling or halving.

* `combat.boarding`: keeps `killShare`, `captureRatio` and `captureOwnShare`, and loses `repel`.
* `combat.range`: the `grappled` entries go.
* `combat.deck`: `hit` and `guard` for each of `charge`, `volley`, `repel`, `firePots` and `fists`; `pairWin` and `pairLose` for the cycle; `fireChance` and `fireHull`.
* `combat.edge`: `firstOverTheRail` (the strength bonus) and `lashedFast` (the Cut Free factor).
* `drill`: `stageSize`, `perLevel` (one per stage), `baseCost`, `growth`, `stageCost` (one per stage), `unlocks` (`firePots`, `grapnels`, `secondWave`) and `secondWaveShare`.
* `supplies.firePotPrice`, `holdSpace.firePots`, `start.firePots`.
* `SEASON_PRESETS.<season>.drillMaxLevel`.
* `power`: Hands count times the Drill factor.

## Pillars

* **Fights reward reading the opponent:** the deck cycle is the Helm cycle on deck, and replays show both orders, so a defender can learn a boarder's habits.
* **Fair fights and soft falls:** Drill only adds strength and is never lost, a Capture still costs nothing permanent, and a fire cannot sink anyone.
* **A story every night:** charges, volleys and fires are the best moments a replay can show.
* **It rules out:** a live boarding minigame, buying weapons one by one (Drill is the one track), and gear for single crew members.

## Acceptance (qa-tester, with `npm run sim:v3` and `npm run bots`)

1. The five checks of 8.9 pass after P3.2. Check 2 gains the Deck orders: each of Charge, Volley, Repel and Fire Pots is clearly best in at least one Grappled situation (Fire Pots in situations between ships at Drill 5). Fists is a fallback, not a choice, so it is not checked.
2. The Brawler stays a real plan: at least 40% of the field in check 1. The guns off test left it at 5%.
3. Lashed fast works: an equal ship trying to Cut Free from its boarder wins at most about a third of its tries.
4. Drill matters without deciding alone: between equal sloops, Drill 5 wins most boarding fights against Drill 0, and Drill 15 against Drill 0 stays inside the Power Rating line of check 4.
5. Old Shellback, with his new habits, still passes check 5 (40% to 60%).
6. No fire takes a ship below 1 Hull, and every battle replays the same from its seed.
7. `npm run bots` passes. The golden Tide diff is read and mentioned.

## Cut first if time slips

1. Second Wave: stage 3 becomes power only.
2. The fire roll: Fire Pots become a plain strong order.
3. The Helm contest of Grapnels: Grapnels keep only Lashed fast in every grapple.

Never cut the cycle or the boarder's edge. They are what fix check 2 and keep the Brawler alive.

## Build plan

| Task | Owner | What |
|-|-|-|
| P3.B1 | Biscu | Approve this spec, or say what to change |
| P3.B2 | engineer (Claude Code) | `engine_v3`: Deck orders and the cycle, the edge, Fire Pots and the fire, the Drill stat and Power Rating, doctrine conditions, templates, Old Shellback's habits, replay text, tests and the golden Tide. GAMEPLAY rewritten to match |
| P3.B3 | engineer and qa-tester | The simulator learns Deck orders: Grappled plays in check 2, drilled scenes, the Brawler floor and the Lashed fast measure |
| P3.2 | game designer and qa-tester | Tuning resumes on the new boarding, including the new numbers |
| P5 and P6 | | Buying Drill and Fire Pots in a Harbour, and their prices |

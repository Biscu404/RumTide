# 6. Your ship

## 6.1 Hulls

| Hull | Stat multiplier | Hold | Watches | Crewmate slots | Max Hands at Berths 0 | Rig | Cost |
|-|-|-|-|-|-|-|-|
| Sloop | 1.0 | 10 | 6 | 2 | 30 | Fore and aft (good upwind) | Starting ship |
| Brigantine | 1.35 | 16 | 6 | 3 | 60 | Mixed | 600 |
| Frigate | 1.8 | 24 | 7 | 5 | 120 | Square (fast downwind) | 2,400 |

* Costs are multiplied by the season preset's cost multiplier and paid in Shipwright instalments (v0.2 5.2). With two Tides a day, every cost and income number must be retuned by the sim before Season 0.
* The Frigate is [S1].

## 6.2 Stats and upgrades

Six upgradable stats. Hull, Cannons, Sails, Berths and Hold go from level 0 to 10, and Drill from 0 to 15. Costs are exponential as in v0.2 5.3: the next level costs 60 doubloons × 1.35 to the power of the level you have now, times the season preset's cost multiplier. A level of Drill costs what the same level of any other stat costs (D141).

| Stat | Does |
|-|-|
| Hull | Hull points (the sinking track) |
| Cannons | Gun damage |
| Sails | Rigging points, Helm score, +1 Watch at level 5 |
| Berths | Max Hands, +12% per level |
| Hold | Cargo capacity |
| Drill | Boarding strength, and the three unlocks below |

The old Crew stat is gone. Boarding strength now comes from Hands (6.4), Drill and crewmates.

**Drill, the Hands track** (D119, D120, D165)

* Three stages of five levels: **Deckhands** (levels 1 to 5), **Cutthroats** (6 to 10) and **Sea Wolves** (11 to 15). Each level adds boarding strength, and a later stage adds more per level: 4% a level in the first stage, 6% in the second, 8% in the third. So Drill 5 is +20%, Drill 10 is +50% and Drill 15 is +90%. In a deck fight (8.6) the bonus is not the same every round: each round a drilled crew brings a seeded share of it, from minus 2 times to 4 times (an average of 1), so a drilled crew wins most deck fights and loses some, and now and then has a bad day worse than an untrained crew. A crew with no Drill has no bonus to vary.
* Finishing a stage unlocks something:

| Drill | Stage done | Unlock |
|-|-|-|
| 5 | Deckhands | **Fire Pots:** the crew can use the Fire Pots order (a Firebrand has it from the start) |
| 10 | Cutthroats | **Grapnels:** Lashed fast holds for you in every grapple you are in, not only the ones you made, and a Board that would fail on Helm score gets a Helm contest instead (a Boarder has them from the start) |
| 15 | Sea Wolves | **Second Wave:** in every melee round your crew strikes once more after the exchange, which makes its blow 1.25 times as large |

* Season 0 has all three stages. The cap is `drillMaxLevel` in the season preset, 15 in both seasons, so a later season can lower it. Nothing enforces a cap until buying exists [P5].
* Drill belongs to the ship. A tow, a Capture or lost Hands never take it away. It is bought like the other upgrades, at a shipwright [P5].

**Power Rating** (parley, the fairness factor, bounties and NPC scaling read it; D26, D136, D144, D166)

* S = (max Hull ÷ 10 + Cannons + Sails + Hands ÷ 3) ÷ 4, and the rating is 10 × (S ÷ 10)^1.6. A fresh Sloop is 10. The exponent makes the rating grow faster than the stats, because Hull, guns and crew multiply in a fight.
* Hands are the Hands aboard now, counted against the ship's own crew, so a full Bombardier rates as a full crew. They are multiplied by the Drill factor, so a Drill 15 Sloop rates about 1.38 times a fresh one. A monster's claws are not drilled.
* A Fighting Style does not change the rating: styles are equal on paper. A ship with twice the rating should win 83% to 92% of the battles that are fought (8.9, check 4).

**Materials [S1]:** a shipwright sells every upgrade with materials included. Bring your own Timber (Hull, Hold, Berths) or Canvas (Sails) and the upgrade costs 30% less. This makes traders useful to everyone without ever blocking anyone.

## 6.3 Damage tracks

* **Hull points:** at 0 the ship is Sunk, whether guns, a Ram, a Reef scrape or fire took the last of them.
* **Rigging points** (from Sails): at 0 the ship is Crippled: it cannot Open Range or Cross in battle (those moves play as Hold, so it cannot Cut Free either), and outside battle it limps one hop per Tide until repaired in a Town or City.
* **Hands:** a headcount (6.4).
* **Repairs:** any Town or City harbour repairs everything for gold. A Village repairs Hull only, up to 50%. Repair at sea is in 3.2.

## 6.4 Hands (manpower)

Hands are a number, like manpower in a Paradox game.

* **Max Hands:** Sloop 30, Brigantine 60, Frigate 120, each +12% per Berths level. A **Bombardier** sails with 60% of that (a fresh Bombardier sloop has 18), because the mortar takes the deck (D145). Hiring, healing, the Watch penalty below, gunnery and Capture all read the smaller number, and the Power Rating counts Hands against the ship's own crew (6.2).
* **What they do:**
  * **Gunnery:** gun damage × min(1, Hands ÷ 60% of max). A ship below 60% of its Hands fires weaker.
  * **Boarding strength:** Hands × (1 + crew modifiers: Bosun, traits, Background) × Drill (6.2). The deck fight (8.6) adds Kelp, First over the rail, Fighters and Tinderbox.
  * **Sailing:** below 40% of max, the ship loses 1 Watch.
* **Losses:** grapeshot and the deck fight take Hands. Half of each loss is **wounded** and returns after 2 Tides (1 Tide with a Surgeon); the other half is gone.
* **Hiring:** in a Harbour, from the settlement's pool (Village 5, Town 15, City 40 per Tide), shared by everyone docked there, first come first served during sessions. Cost: 3 doubloons each × the Boom.
* **Volunteers:** after a Capture, up to 20% of the defeated ship's surviving Hands join you if you have Berth room.
* **No wages, no upkeep** (v0.2 rule). Hands only cost money to replace.

## 6.5 Supplies

Kept deliberately light: three supplies, and nothing is ever used while docked or away. A new captain starts with 4 Provisions and 6 Powder.

* **Provisions:** every Tide that ends with you at sea uses Provisions: Sloop 1, Brigantine 2, Frigate 3. Each unit takes half a Hold space (D13). Cheap at every settlement.
  * Out of Provisions means **Short Rations**: 1 Watch less, and crewmates lose 3 Loyalty per Tide. No starvation, no mutiny, no losing the ship.
* **Powder:** every round your guns fire uses Powder: Sloop 1, Brigantine 2, Frigate 3. Each unit takes half a Hold space. Out of Powder, guns do half damage.
  * Hot Shot uses twice as much (8.5). A Volley uses as much as a round of guns (8.6). Hold Fire, Board and the other Deck orders use none.
  * Sold in Towns and Cities: cheap in the Crown Keys, dear in the Maw.
* **Fire Pots** (D167): clay pots of pitch and rum for the deck fight (8.6). Each throw uses one, and each takes half a Hold space. A Firebrand starts with 2 and every other captain with none, and a captain who is not a Firebrand also needs Drill 5 to throw one (6.2). Sold in Towns and Cities like Powder, but the buying screen and the price are [P5].
  * Like the other supplies they are not cargo: loot never takes them, they never go into a Wreck or Flotsam, and a tow keeps them (9.1). What a battle does not use is still in the hold afterwards.
* Docked ships use nothing, and standing orders dock you while you are away, so absence costs nothing.
* **The tension:** supplies compete with cargo for Hold space, Provisions set how far from settlements you can roam, and a Fire Pot is Hold space spent on the chance of a fire.

## 6.6 History and heritage

**What each piece is**

* **Figurehead:** the carved wooden figure on the front of a ship, under the bowsprit. Sailors believed it brought luck and guarded the ship; it was the ship's face. In game it is a cosmetic you earn (mermaid, sea serpent, skull, a grumpy duck for the Soggy Boot winner). It shows on the ship portrait and gives your ship its signature shape on the map. Optional: a tiny blessing, about 2% to one thing.
* **Scars:** decals left by specific battles and events at fixed spots on the ship portrait (patched planks, a mismatched sail patch, a scorched mast, a cannonball stuck in the stern, kraken sucker marks). Tap one to read its story: *"Cannonball from the Wet Sock, Gullhaven, Tide 9."* 5 slots per hull; when full, you choose which to keep.
* **Ship's Log:** an automatic biography of each hull: launch Tide, voyages, battles, notable events.
* **Trophies:** items taken from beaten rivals and big events (an enemy flag, the galleon's bell, a kraken tooth). They belong to **you**, not the hull. They hang on the Trophy Wall in your cabin, and you can display one in the rigging.
* **Ship traits:** titles a hull earns, each with a tiny effect: *Lucky* (survived 3 Decisive losses), *Ghost* (never caught in 10 Tides at sea), *Galleon Slayer*.

**Your rule: scars stay with the ship that earned them.**

* When you buy a new hull, the old one goes to **the Old Moorings**: a gallery (reached from any City harbour) where every ship you have owned this season is moored with its scars, traits, log and portrait. It is a museum of your season, and old ships also appear in the Hall of Legends.
* The new hull starts clean: no scars, no ship traits.

**Heritage: what moves to the new ship.** This is your decision (22). My recommendation:

| Item | Moves? |
|-|-|
| Ship name | Your choice: keep it with a numeral (*Wet Sock II*) or rename |
| Flag and sail colours | Yes, they are yours |
| Figurehead | Yes, it can be moved (sailors really did this) |
| Trophies | Already on your cabin wall |
| Crew | Always |
| Scars and ship traits | No, they stay with the old ship |

## 6.7 Naming

* Players name their captain, ship (and every later hull), every crewmate, their fleet (alliance) and the fleet's hideout [Later].
* Limit 24 characters, optional profanity filter. Renaming is free and shows in the log (*"Pete is now Peg Leg Pete"*).

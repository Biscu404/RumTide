# 2. The world

## 2.1 Hierarchy

* **World** (the Brine) contains 5 to 7 **archipelagos**.
* Each archipelago contains 3 to 6 **islands**.
* Each island has 2 to 4 **waters** around it (for example Harbour, Reefside, Lee Shore, Deep Channel) and 1 to 3 **sites** on land (settlement, ruins, dig spot, cave, wreck on the beach).
* **A ship is always in exactly one water.** Waters are the nodes of the movement graph.
* **Lanes** join waters: around an island, and to neighbouring islands. Every lane has a bearing (compass direction, used by wind) and a current (3.3).
* **Straits** join archipelagos. Sailing one is a Crossing (3.5).
* **Sites** are reached from an adjacent water by Landing (4.3).

## 2.2 Water terrain

Each water has one terrain type.

| Terrain | Movement | Combat | Other |
|-|-|-|-|
| Open | Normal | Neutral; all ranges | Few sites |
| Shallows | Frigates pay 1 extra Watch to leave | Brigantines and Frigates must win a Helm contest to reach Close range, and stop at Short if they lose; Sloops +15% Helm | Smuggler coves, fishing |
| Reef | 1 extra Watch to leave, unless the water is Charted | Every Cross or Close In costs 10 Hull, unless Charted | Wrecks common |
| Rocky | Normal | Shots at Long and Far 25% weaker (cover) | Caves, hidden coves |
| Fog | Normal; ships here are invisible to Lookouts outside this water | Battles start at Medium (8.1); shots at Long and Far 50% weaker; escape chance +20% | Ambush spots, ghost events |
| Kelp | 1 extra Watch to leave | Range can never go beyond Medium, so nobody escapes; boarding strength +15% for both crews | Odd salvage |
| Strong Current | Lanes from it carry strong currents (3.3) | The ship moving with the current gets +15% Helm | |
| Harbour | Exists only beside a settlement; Dock here | **No combat, ever** | Trade, repair, recruit |

Weather sits on top of terrain (3.3): Calm, Breeze, Gale, plus Storm in the Maw.

## 2.3 Islands and settlements

| Tier | Example | Offers |
|-|-|-|
| Wild | Whisper Rock | Sites only |
| Village | Driftwood Key | Supplies, market with 2 to 3 goods, rumours, Hands pool 5 per Tide |
| Town | Tarpot Isle | Market with 4 goods, shipwright (repairs, upgrades up to level 6), tavern (recruits, rumours, wagers, notice board), Hands pool 15 |
| City | Gullhaven | Full market, shipwright (all upgrades, new hulls), tavern, cartographer (sells charts), Gazette office, Hands pool 40 |

* About 3 islands in 4 have a settlement. At most one City per archipelago.
* A settlement gives its island a Harbour water.

## 2.4 The Cradle (Season 1 start, also used in Season 0)

| Island | Tier | Known at Tide 1? | Role |
|-|-|-|-|
| Gullhaven | City | Yes | Grimbeard's hometown, tutorial start, "The Gullhaven Job" quest for the second crewmate |
| Driftwood Key | Village | Yes | First trade run, First Mate tutorial |
| Tarpot Isle | Town | Yes, but only Sketched | Shipwright, tavern |
| Whisper Rock | Wild | No | Hidden. Ruins hold the clue to the Narrows; a castaway to recruit |
| Hermit's Reach | Wild | No | Hidden. The Narrows, Old Shellback's lair, the exit strait |

* At Tide 1 you see Gullhaven and Driftwood Key Charted, Tarpot Sketched, and nothing else.
* Whisper Rock becomes Rumoured through a tavern rumour or a lucky Survey. Hermit's Reach becomes Rumoured only after someone explores Whisper Rock's ruins (or buys that knowledge from someone who has).
* **The Harbour Mistress's Truce:** no hunting of players in the Cradle until Tide 5. After that, PvP loot in the Cradle is halved for the whole season, so it stays a soft landing.
* **Exit:** the Narrows strait at Hermit's Reach. Old Shellback blocks it for each captain until they have beaten him (2.5).

## 2.5 Old Shellback (the gate boss)

* Lives in the Narrows: Shallows terrain plus Strong Current.
* Statline: Hull 300, **no Rigging** (Chain shot does nothing), Cannons 22, a Helm score fixed at 10 that no wind gauge, terrain or crew changes, and claws that fight as 52 Hands when grappling (D100, D101, D140). He has no Fighting Style, so "Their style is X" is never true of him. His claws only Charge: he never Volleys.
* **His shell:** every hit on him does 80% of its damage, whether it comes from the great guns, a Ram or a fire, except in the round he rears up. A Mortar shell falls on the shell from above and does three times its damage to him in every round, ignoring the shell, which is what a bomb vessel is for (D133, D201).
* **His moods:** each fight he closes in first, rears up in one round of 2, 3 or 4, and grapples from then on. The round is a seeded roll for each fight, so no doctrine can count on a round, and the replay shows a tell in the round before he rears up (D133, D202 to D204). In the rear-up round he holds still and holds fire, and his shell does not turn the blow aside. While the ships are Grappled his claws Charge and he does not rear up.
* **The claw snatch:** a ship that crosses his bow at Short or Close while he Closes In is caught. The ships are Grappled and he holds the boarder's edge (8.6), so the rake that wins against ships does not work on him (D206). Once he holds a ship his claws Charge, and he never Opens Range.
* **Beaten** means he is Sunk, Captured or driven off. He retreats into his shell when his Hull falls below 35% or his claws below 25% of their full strength (D205). **A Victory on points never beats him.**
* What it teaches: reading the other side's moves instead of the calendar, ammo choice, the Mortar, terrain. The bestiary will print his habits after you watch him fight once [not built].
* **Personal gate:** every captain must beat him once, which means being on the winning side of a battle in which he was Sunk, Captured or driven off. Other captains can join your fight (fleet battle rules, co op prize with the N to the power 1.5 rule).
* It never dies for good: beaten, it retreats into its shell and is back next Tide, a little angrier.
* **No queue at the gate:** he fights every captain who reaches him in a Tide, once each, and comes out of his shell whole for each of them, whatever the last fight did to him. A battle stops every other ship for the rest of the Tide, but not him (D225). A fleet that meets him together still has one battle.
* **Catch up:** from Tide 9 it loses 8% of its Hull every Tide, compounding (it is getting tired), so nobody stays stuck.
* **Reward for each captain who beats it** [P5.6, P7]: the title *Shellback*, gold, and a **Shellback's Chart** found inside its shell: a Sketch of 1 or 2 other archipelagos and the strait routes to them. Each captain's chart is drawn separately from the set, so captains branch out to different archipelagos and immediately hold charts worth trading.
* Target: median captain passes it by Tide 7 to 9; nobody later than Tide 12. The best doctrine each Fighting Style can write should beat him 35% to 80% of the time (8.9, check 5): every style has a way through, and nobody beats him every time.

## 2.6 The other archipelagos

| Archipelago | Identity | Terrain mix | Danger | Typical NPCs | Phase |
|-|-|-|-|-|-|
| Rumhaven Reach | Pirate city, black market | Mixed | 2 | Pirates, smugglers | S0 |
| Saltteeth Shoals | Reefs and sandbars | Shallows, Reef, Rocky | 2 | Smugglers, fishers | S0 |
| Crown Keys | Admiralty, safe trade | Open, Harbours | 1 | Navy, merchants | S1 |
| Mistveil Isles | Fog, ruins, mysteries | Fog, Strong Current | 3 | Treasure hunters, ghosts | S1 |
| The Maw | Storms, monsters, best loot | Open, Strong Current, storms | 4 | Monsters, a Pirate Lord | S1, opens Tide 31 |
| Grimbeard's Rest | Hidden finale | Unknown | 5 | The Kraken | S1, revealed by 4 fragments |

## 2.7 Density rules

* **Target:** every captain has a meaningful interaction with another captain (meet, fight, trade, pact, shared hotspot) every 2 to 3 Tides. Bots measure it (20).
* **Levers:** a shared start in the Cradle; straits as choke points; hotspots placed where 2 or more captains can reach them within one Tide (11); battles leaving wrecks and flotsam; contracts that send several captains to the same port.
* If the bots show too little interaction: spawn Small Hotspots near isolated captains first, then shrink the map.

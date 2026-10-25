# Rumtide: Gameplay Systems

Version 0.3, 18 October 2026. Companion to [GAME_DESIGN.md](GAME_DESIGN.md) (v0.2) and [RESEARCH.md](RESEARCH.md).

# How to read this

* This document explains how every gameplay system works inside the game: the objects, their states, the rules that change them, and the numbers that drive them.
* **Where this conflicts with GAME_DESIGN.md v0.2, this document wins.** Superseded v0.2 sections: 3 (loop and pacing), 4 (world and movement), 5.1 and 5.2 (stats and hulls), 7.1 to 7.4 (combat), 10.1 (exploration deck), 12.4 (catch up timing). Still valid: the pillars, art and audio (2), economy basics (6), co op and fleets (8), anti bullying (9), parley (7.6), architecture (15), risks (17).
* Every number is a **starting value**. All of them live in `balance.ts`, and bots tune them before any friend plays.
* Phase tags: **[S0]** in the Season 0 beta, **[S1]** arrives in Season 1, **[Later]** after that. Section 21 has the full scope table. A tag like **[P5]** names the roadmap task that builds a rule that is decided but not built yet.
* Combat (section 8), Old Shellback (2.5), Drill, supplies and the Fighting Styles describe the combat as built in `engine_v3` (P3.B2), checked against `balance.ts` on 24 October 2026. A recent rule carries its decision number in brackets (D121 and so on, in `docs/DECISIONS.md`). Where the code and a doc disagree, the code is what is built.

## What changed since v0.2

| Topic | v0.2 | v0.3 |
|-|-|-|
| Tides | One per day at 21:00 | Two per day at 13:00 and 20:00, identical |
| Map | 36 node graph, all visible | World, archipelagos, islands, waters; hidden until charted |
| Movement | Speed in hops | Watches (action points) spent on hops and actions; costs set by WCS and terrain |
| Combat | 3 round triangle | Up to 5 rounds (2 more of overtime in a deck fight) over six distances: helm, ammo, three damage tracks, programmed doctrines, fire |
| Fighting Styles | Four template doctrines (first v0.3 draft) | Six styles and the Smuggler, each with a trait, signature moves and a template, on one wheel of counters (8.8a) |
| Boarding | One melee formula with the guns still firing (first v0.3 draft) | The deck fight: great guns quiet, Deck orders in a cycle, the boarder's edge, Drill as a sixth ship stat (8.6) |
| Crew | A stat | Named crewmates with roles, skill trees, traits and loyalty; Hands as manpower |
| Start | Spread across ports | Everyone starts in the Cradle with a story, gated by a boss |
| New systems | | Backgrounds, captain skills, reputation, supplies, intel, hotspots, events, NPC brains, rivals, pacts, agendas, Gazette services, wagers, scenes |

# 1. Time

## 1.1 The two Tides

* Two Tides a day at **13:00 and 20:00, Europe/Bucharest**. Both work exactly the same way: same rules, same Gazette edition, same replays.
* Launch day: Tide 1 resolves at 20:00. After that they alternate 13:00, 20:00, 13:00 and so on.
* Windows between Tides: 20:00 to 13:00 is 17 hours (overnight); 13:00 to 20:00 is 7 hours (afternoon). The short afternoon window is why a voyage plan can cover two Tides (3.6).
* **Early Tide:** if every active captain is Ready, the Tide resolves at the next 5 minute cron tick. The Tide after it still waits for its scheduled time, so Tides never bunch up.
* **Reminders:** one ping 2 hours before each Tide, only to captains who are not Ready. At most 2 Tide posts and 2 reminders a day.

| Time | What happens |
|-|-|
| 11:00 | Reminder to captains not Ready |
| 13:00 | Tide resolves, Gazette edition, replays |
| 13:00 to 20:00 | Afternoon window (7 hours) |
| 18:00 | Reminder to captains not Ready |
| 20:00 | Tide resolves, Gazette edition, replays |
| 20:00 to 13:00 | Overnight window (17 hours) |

## 1.2 One session (2 to 5 minutes)

1. **Gazette** opens if a Tide resolved since your last visit.
2. **Port and ship** (instant, only when docked for port actions): trade, upgrades, repairs, hire Hands, buy supplies, crew skill points, recruit.
3. **Events:** answer pending choices.
4. **Diplomacy:** pacts, intel trades, wagers, Gazette services.
5. **Plan:** voyage plan for the next Tide (and optionally the one after), pick a doctrine.
6. **Ready.**

Rule: port actions happen instantly during your session. Everything at sea happens at the Tide.

## 1.3 Season shape

| | Season 0 (beta) | Season 1 |
|-|-|-|
| Length | 14 days, 28 Tides | 21 days, 42 Tides (recommended; 28 days and 56 Tides is the alternative, see 22) |
| Map | The Cradle plus 2 archipelagos | The Cradle plus 5 archipelagos plus 1 hidden |
| Act 1: The Cradle | Tides 1 to about 8 | Tides 1 to about 8 |
| Act 2 | Tides 9 to 28 | The Open Brine, Tides 9 to 30 |
| Act 3 | None; finale BHS on Tide 28 | Grimbeard's Rest, Tides 31 to 42; Kraken finale on Tide 42 |

Why 21 days for Season 1: v0.2 chose 28 days with one Tide a day. With two Tides a day, 21 days already means 42 resolutions, half again as many as v0.2's full season.

## 1.4 Season 1 story: The Last Voyage of Old Grimbeard

* Old Grimbeard, greatest pirate of the Brine, has died in his hometown of **Gullhaven**, in the **Cradle Isles**.
* His will leaves each of his young protégés (the players and a few NPC rookies) one sloop from his fleet and nothing else. That is why everyone starts equal, in the same place.
* His hoard lies somewhere beyond **the Narrows**, a strait guarded by **Old Shellback**, a giant hermit crab that wears a sunken galleon as its shell. Legend says only Grimbeard ever got past it.
* **Act 1:** learn to captain, recruit crew, find the hidden islands, beat Old Shellback.
* **Act 2:** the Open Brine. Grimbeard's torn map is scattered as fragments. Trade, fight, chart, scheme.
* **Act 3:** four fragments reveal **Grimbeard's Rest**, a hidden archipelago guarded by the Kraken. Finale.

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

# 3. Movement: Watches and WCS

## 3.1 Watches (action points)

* Every Tide each ship gets a budget of **Watches** (named after the shifts sailors stand). Every action at sea costs Watches.
* Base by hull: Sloop 6, Brigantine 6, Frigate 7.
* Upgrades: Sails level 5 gives +1; captain Seamanship rank 2 gives +1; a Navigator's Current Reader branch gives +1; rare trinkets and events give +1. Cap: 9.
* Penalties: Hands below 40% of max costs 1; Short Rations costs 1 (6.5); a hold over 80% full costs 1.
* Unused Watches are lost at the end of the Tide (Lurking spends them on purpose).

## 3.2 Action costs

| Action | Watches | Effect |
|-|-|-|
| Hop (sail one lane) | 2 base, changed by WCS and terrain, minimum 1 | Move to the next water; charts that water and the lane you used |
| Survey | 2 | Charts every lane touching this water, including currents; Sketches the sites of the adjacent island; 30% chance to reveal a hidden lane or a Rumoured island nearby |
| Land | 2 | Visit a Sketched or Charted site on the adjacent island: charts it and triggers its event or loot |
| Dock | 1 | Enter the Harbour: ship safe, plunder banked, port actions available in your next session |
| Lurk | All remaining, at least 2 | Wait in this water until the end of the Tide and intercept ships that match your filter |
| Salvage | 2 | Collect flotsam, or 5 units from a wreck, in this water |
| Repair at sea | 2 | Restore 15% Hull, using 2 Timber from the hold (Shipwright's Apprentice needs none) |
| Meet | 1 | Trade with another captain in the same water at the same moment (both must plan it) |
| Crossing | The whole Tide | 3.5 |

## 3.3 WCS: the Wind and Current System

Two layers set the cost of every hop.

**Currents** (permanent, part of the map)

* Every lane has a current: None, Mild or Strong, flowing one way along the lane.
* Mild: with it, the hop costs 1 less; against it, 1 more.
* Strong: with it, 1 less; against it, 2 more.
* Currents never change during a season, so learning them is permanent knowledge.

**Wind** (changes every Tide, one wind per archipelago)

* Each Tide every archipelago rolls a wind: Calm, Breeze from one of 8 compass points, or Gale from one of 8 compass points.
* **Calm:** every hop costs 1 more. Sloops ignore Calm (light enough to row).
* **Breeze:** hops within 45 degrees of downwind cost 1 less; hops within 45 degrees of upwind cost 1 more.
* **Gale:** like Breeze, but upwind hops cost 2 more, and every hop at sea deals 5% Rigging damage.
* **Rigs:** Sloops (fore and aft rig) ignore the upwind penalty. Frigates (square rig) get 1 more off downwind hops. Brigantines use the plain rules.
* **Storms** (the Maw, and some events): every Tide at sea deals 10% Hull and 10% Rigging damage.

**Hop cost**

`hop = max(1, 2 + terrain + current + wind + rig)`, where each term is a small whole number from the tables above.

Example: a Sloop sails east from Driftwood Key to Gullhaven along a lane with a Mild current flowing east, while a Breeze blows from the west (so east is downwind). The hop is 2, then 1 off for the current and 1 off for the wind, which makes 0, raised to the minimum of 1. The same hop back west costs 2, plus 1 for the current, plus nothing for the wind (Sloops ignore upwind): 3 Watches.

## 3.4 Knowing the WCS

* The planner shows a lane's true cost only if you know its current, and the wind only if you know the forecast. Unknown parts show as "?" and the planner assumes the base cost.
* At resolution the **true** cost is used. If your Watches run out mid plan, your ship stops in the last water it reached (**Becalmed Short**). That is where it is for meetings and encounters. Knowledge means precise plans; ignorance means ending up somewhere you did not plan, maybe next to a hunter.
* **Ways to learn currents:**
  * Sail the lane: you feel it, and it is charted.
  * Survey: charts every lane touching that water.
  * A Navigator (Current Reader branch): reveals currents within 1 hop every Tide, 2 hops at a higher node.
  * Captain Seamanship rank 1: see the currents of every lane touching your water; rank 3: within 2 hops.
  * Buy a Current Chart from a cartographer or a captain; trade for one; steal one on a Capture.
  * **Pencil marks:** a friend tells you about a current in the group chat? Tap the lane and pencil it in. The planner uses pencil marks for estimates, drawn in grey on your Chart and marked unverified until you sail the lane. This supports out of game talk, and out of game lies.
* **Wind forecast:** printed free in the Gazette for every archipelago you have visited, one Tide ahead. A Lookout's Weatherwise branch or captain Seamanship rank 5 sees 2 Tides ahead.

## 3.5 Crossings between archipelagos

* To cross, you must be in a water touching a strait and know the strait (at least Sketched on your Chart).
* A Crossing takes the whole Tide. You arrive in the strait water on the far side at the end of the Tide.
* During a Crossing you can only meet ships crossing the same strait in the opposite direction that Tide (rare, head on, dramatic).
* Nobody can lurk inside a strait, but the strait waters at each end are natural choke points.
* **First Sighting:** the first time you reach a new archipelago, all its islands become Rumoured on your Chart and the islands visible from the strait water become Sketched.

## 3.6 Voyage plans

* A plan is a list of **steps**. A step is one action plus at most one condition.
* Step actions: Sail to (a destination; the planner routes the hops, and you can pin a route), Survey, Land, Dock, Lurk, Salvage, Repair, Meet, Escort (follow a fleet mate).
* Conditions: a ship matching a filter is in sight; a price is above or below a number; my Hull is below a percentage; the wind is X; a named captain is in this water; at least N Watches are left.
* **Stance:** every Sail to step carries a stance. **Trade** (the default) never starts fights. **Quiet** gives a better escape chance but cannot hunt. **Hunt** starts encounters with ships matching a filter: merchants, players, anyone, ships carrying cargo, or one named captain.
* If a condition is false, that step is skipped and the plan continues with the next.
* **Step slots:** 3 by default; up to +2 from a Navigator's Stargazer branch; +1 from Seamanship rank 4; cap 6.
* **Two Tide plans:** write Plan A for the next Tide and Plan B for the Tide after. If you do not log in between them, Plan B runs; if you do, you can change it.
* **Standing orders** when there is no plan: docked ships stay docked; ships at sea sail to the nearest known Harbour and Dock.
* **Simple mode:** tap a destination and an intent; the planner writes the steps.

Example plan, as the orders screen shows it:

> Sail to **Reef Pass**. **Lurk** for ships **carrying cargo**, fight with doctrine **Boarders**. *If nothing comes:* at the next Tide, Sail to **Gullhaven** and **Dock**.

## 3.7 How a Tide resolves (movement)

This replaces v0.2 section 4.4 and goes into the engine as written.

1. Every plan is expanded into timed actions. Time inside a Tide is measured in **ticks** of one Watch (ticks 0 to 9). Each action starts and ends on a tick.
2. The engine advances tick by tick. Every ship's position is known at every tick: in a water, or on a lane between two waters.
3. **Meetings:** two ships meet if they are in the same water at the same tick, or on the same lane in opposite directions during overlapping ticks.
4. **Encounters:** a meeting becomes an encounter if one ship is Hunting or Lurking with a filter that matches the other, and the other is not protected (in a Harbour, under the Cradle Truce, or under a shield).
5. **Sight:** a Lurker sees every ship entering its water; a Lookout sees ships in neighbouring waters (Fog blocks both). Sight is what makes "if in sight" conditions true.
6. **Parley** (v0.2 7.6), then the **escape roll** (v0.2 formula plus terrain bonuses), then **battle** (8). A battle ends movement for both ships for the rest of the Tide.
7. A step the ship cannot afford: it stops where it is (Becalmed Short).
8. Order of resolution: by tick, then by water id, using the Tide's stored seed. Any Tide can be replayed exactly.
9. Ships that end the Tide at sea use supplies (6.5).

## 3.8 Tells and the reveal

* Orders stay sealed until the Tide. The **Ready board** in every tavern shows a wax seal next to each captain who has sealed their orders, and nothing else.
* Some session actions leak **tells**: short public hints posted right away on the notice board of the port where they happened, and in the Gazette's Harbour Gossip line.

| Action in port | Tell |
|-|-|
| Buying 5 or more Powder | *"The Wet Sock bought 6 barrels of powder in Tarpot."* |
| Hiring 10 or more Hands | *"The Salty Gull is hiring fighting men in Gullhaven."* |
| Buying Provisions for 4 or more Tides | *"The Wet Sock is provisioned for a long voyage."* |
| Filling more than half the Hold with cargo | *"The Salty Gull left Driftwood Key riding low in the water."* |
| Buying a chart | *"The Wet Sock's captain was seen at the cartographer's."* |

* **Hiding tells:** Smuggler's Kid and Cunning rank 1 each hide one tell per Tide. The Spy's Saboteur branch hides every tell of one kind.
* **Faking tells:** buy things you will not use, which costs real gold. [S1] The Saboteur capstone posts one invented tell per Tide.
* **The reveal:** at the Tide, the Tide Turn cinematic (19.2) draws every route you can see at once: yours, your fleet mates', and every ship within sight. Then the Gazette's *Who Called It* line names the captains whose Lurk caught its target or whose wager paid.

# 4. Exploration and the Captain's Chart

## 4.1 Knowledge levels

Every map element (archipelago, island, water, lane, site) has one of four levels, separately for each captain.

| Level | On your Chart | How you get it |
|-|-|-|
| Unknown | Blank parchment and sea monster doodles | |
| Rumoured | Dotted outline with a question mark | Rumours, events, First Sightings, lucky Surveys |
| Sketched | Shape and type, no detail: no currents, no site contents | Seeing it from a neighbouring water, sketch charts, the Shellback's Chart |
| Charted | Full detail: terrain, currents, sites, hazards | Sailing, Surveying, Landing, full charts from others |

## 4.2 What counts

* **Chart points:** each water 1, each lane's current 0.5, each site 1.
* **Coverage** = (Charted points + half of Sketched points) ÷ total points in the world.
* **Fully charted island:** all its waters, lanes and sites Charted. Rewards: an Island Chart item (copyable intel you can sell), +2 Fame, and Local Knowledge in all its waters.
* **Local Knowledge:** fighting in a water you have Charted against a ship that has not gives you +15% Helm and immunity to that water's terrain penalties (reef scrapes, grounding).

## 4.3 How exploring an island works

* Each thing is charted once. You do not need to visit the same water again and again.
  * **Sail into a water:** charts that water and the lane you came along.
  * **Survey** (2 Watches): charts every lane touching that water and Sketches the island's sites.
  * **Land** (2 Watches): charts one site and triggers its event or loot.
* **Some sites want a second visit:**
  * **Dig spots:** the first Landing charts the spot; digging only works if you hold the matching Treasure Map or clue.
  * **Deep sites** (caves, ruins): a 2 or 3 step Tale where each step is a Landing on a different Tide.
* A typical island with 3 waters and 2 sites takes about 10 Watches to chart fully: one and a half to two Tides.

## 4.4 Getting charts from others

| Source | What you get | Cost |
|-|-|-|
| City cartographer | A Sketch chart of any archipelago you have reached, or full Island Charts of islands near that city | Gold, scaled by the Boom |
| Another captain | Any copyable chart they hold | Whatever you agree |
| A Capture | One original, or two copies, from their Logbook | A won boarding |
| Events, wrecks, bottles | Random charts and rumours | Free |
| Shellback's Chart | Sketch of 1 or 2 archipelagos and their straits | Beating Old Shellback |

Charts you did not make are drawn in a different ink (4.6). Forgeries look exactly like the real thing until checked (10.5).

## 4.5 Coverage target and budget

* **Goal:** a good captain of any build reaches 50 to 70% coverage by mid season (Tide 21 of 42 in Season 1), and more by the two thirds mark.
* **Rule:** nobody gets there by exploring alone. Own exploration tops out around 30% by mid season even for a dedicated explorer. The rest has to come from other captains, so exploring itself pushes people to trade, scheme and fight.

Design budget by mid season (bots must confirm it):

| Source | Explorer | Trader | Fighter |
|-|-|-|-|
| Own sailing, Surveys and Landings | 30% | 18% | 14% |
| First Sightings and the Shellback's Chart | 8% | 8% | 8% |
| Bought charts | 10% | 22% | 10% |
| Traded, gifted, pact swaps | 7% | 7% | 8% |
| Stolen on Captures | 0% | 0% | 15% |
| **Total** | **55%** | **55%** | **55%** |

* Implied Season 1 map size: about 220 chart points (roughly 90 waters, 140 lanes and 60 sites). Season 0 is about half that.
* An explorer charting about 3 points per Tide gets 30% by Tide 21. Explorers earn by selling what they chart.

## 4.6 The two map views

**The Captain's Chart (zoomed out, not playable)**

* A parchment map of the whole world as **you** know it, drawn in ink.
* Shows: knowledge levels; your pencil marks; your sightings as ghost ship icons stamped with their Tide, fading as they age; hotspots you know about; rival markers; your fleet's ships.
* **Ink by source:** your own lines in solid brown; bought charts in blue; traded or gifted in green; stolen in red. A forgery is drawn in the ink of the source it claims.
* Animations: ink lines draw themselves when something gets charted; Rumoured outlines are dotted pencil; the Tide Turn cinematic plays here (19.2).
* Opens from the map table in your cabin, or from a button on any screen.

**Local Waters (playable)**

* Detailed, animated pixel art of the archipelago you are in, centred on your island.
* Shows: terrain (water colour by depth, reefs, rocks, kelp, fog), currents as arrows on lanes you know, a wind vane, ships in sight, settlements, sites, hotspots, and your plan as a dotted line with step icons and Watch costs.
* This is where you build voyage plans and watch your ship's part of the Tide play out.

# 5. Your captain

## 5.1 Creation

* **Look:** layered pixel portrait and sprite: body, skin, face, hair, hat, coat, one accessory (eyepatch, hook, parrot on the shoulder, tattoo).
* **Names:** captain, ship, flag (shape, colours, symbol), and a one line Parting Shot.
* **Background:** one of nine (5.2).
* **Fighting Style:** one of seven, picked together with the starting doctrine (D122, D123). Six fight: Bombardier, Gunline, Skirmisher, Rammer, Boarder and Firebrand. The seventh is the Smuggler, the trader's style. The style gives a **trait** and a **template doctrine** (8.8a). You start with that template as your first saved doctrine and your default, and you can edit it freely (8.8).
* The trait belongs to you, not to the doctrine, and pays only in a round its own move or order is played. A captain who writes another style's rules gets the rules and not the trait.
* Changing style in a City is planned [P5]: the price and any wait are set with the Harbour.
* **No crewmate yet.** You sail alone through the tutorial (7.1).

## 5.2 Backgrounds

Rule: the perk is clearly stronger than the quirk. Each Background has a Saga (a 3 to 5 step story chain, 12.1) that triggers during the season.

| Background | Perk | Quirk | Saga |
|-|-|-|-|
| Navy Deserter | +1 doctrine slot; Cannons start at level 1 | Navy patrols treat you as if you had a small bounty | *The Old Commodore*: your former captain comes hunting |
| Smuggler's Kid | Hidden Hold: 5 units that cannot be inspected or looted; may hide one tell per Tide | Honest delivery contracts pay you 10% less | *Dad's Last Run* |
| Merchant's Heir | Buy 8% cheaper and sell 8% dearer everywhere | Crewmates gain 10% less XP from battles | *The Family Business* |
| Shipwright's Apprentice | Repairs 40% cheaper; Repair at sea needs no Timber | Cannon upgrades cost 10% more | *The Unfinished Ship* |
| Castaway | Starts with one of Grimbeard's map fragments; +25% finds when Landing | Hiring Hands costs 10% more (people find you odd) | *The Island That Wasn't* |
| Fisher's Child (reworked) | Uses half the Provisions; catches 2 Provisions on any Tide ending at sea in Shallows or Kelp; Surveys reveal currents one extra hop away | Fame gains 10% lower (the Gazette ignores fishing folk) | *The Drowned Village* |
| Cartographer | Survey costs 1 Watch instead of 2; charts you sell fetch 25% more | Boarding strength 10% lower | *The Missing Page* |
| Disgraced Noble | Gazette services half price; starts with 15 Fame | A debt collector event once a week takes a little gold | *Blood and Debt* |
| Tavern Brawler | Boarding strength +15%; Hands 20% cheaper to hire | Some tavern events end in a bar fight that bans you from that tavern for a Tide | *The Undefeated* |

The old Fisher's Child perk (one archipelago charted at the start) is gone: now that knowledge is power, it was far too strong.

## 5.3 Captain rank and skills

* Captain XP comes from Tides at sea, battles, charting, events, pacts kept and hotspots. Ranks 1 to 10.
* Each rank gives 1 point to spend in one of three skills, 5 ranks each. Ten points across 15 ranks means everyone makes choices.

| Rank | Seamanship | Command | Cunning |
|-|-|-|-|
| 1 | See currents on every lane touching your water | +1 doctrine slot | Hide one tell per Tide |
| 2 | +1 Watch | Crewmates gain 15% more XP | Tavern rumours 30% cheaper |
| 3 | See currents within 2 hops | Wounded Hands return 1 Tide sooner | Spot forgeries (60%) |
| 4 | +1 plan step; storm damage halved | +1 doctrine slot | Gazette services 25% cheaper |
| 5 | Wind forecast 2 Tides ahead | Fleet aura: fleet mates in your battles +5% Helm | One extra Accusation (15.3) |

## 5.4 Reputation

Three meters from 0 to 100. Trust starts at 50; Fear and Fame start at 0.

| Deed | Trust | Fear | Fame |
|-|-|-|-|
| Keep a pact to its end | +5 | | +1 |
| Break a pact | minus 25 | +5 | +5 |
| Complete a delivery contract | +2 | | +1 |
| Win a PvP battle | | +5 | +2 |
| Sink a ship | | +6 | +2 |
| Capture a ship | | +4 | +3 |
| Refuse parley from a weaker ship | minus 5 | +4 | |
| Front page story about you | | | +3 |
| Take part in a Big Hotspot | | | +6 |
| Fully chart an island | | | +2 |
| First to discover an archipelago | | | +8 |
| Caught spying | minus 10 | | +2 |

* **Drift:** Fear and Fame lose 2% per Tide (legends fade unless fed). Trust drifts 1 point per Tide back toward 50.
* **Tiers:** Low 0 to 24, Mid 25 to 59, High 60 to 100.
* **Titles** come from your two highest meters and show on your name tag:

| | High Trust | Low Trust |
|-|-|-|
| High Fear | The Iron Captain | The Shark of (your home archipelago) |
| High Fame | The Honest Corsair | The Silver Tongue |
| High Fear and Fame | The Legend | The Terror of the Brine |
| All Low | Who? | The Rumour |

**Effects:**

* **Trust:** High halves the stakes others ask in pacts and brings better NPC contracts. Below 25, you can only sign pacts with a stake.
* **Fear:** High makes NPC merchants Strike Colours at once when you hunt them (15% loot, no fight) and triggers weaker players' parley. Brawler traits are more common among your recruits.
* **Fame:** High brings better recruits (they start at higher levels) and more Gazette coverage, good and bad. Brethren captains seek you out, because beating a famous captain is how they climb.

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

* Three stages of five levels: **Deckhands** (levels 1 to 5), **Cutthroats** (6 to 10) and **Sea Wolves** (11 to 15). Each level adds boarding strength, and a later stage adds more per level: 4% a level in the first stage, 6% in the second, 8% in the third. So Drill 5 is +20%, Drill 10 is +50% and Drill 15 is +90%.
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

# 7. Crew

## 7.1 When you get crew

| When | What happens |
|-|-|
| Tides 1 and 2 (tutorial story mission) | You sail alone |
| End of the tutorial | Recruit your **First Mate**: the character you met in the tutorial. You customise their look and name |
| Tides 3 to about 6 | Just you and your First Mate |
| After *The Gullhaven Job* quest, or captain rank 2 | Second slot opens; recruit before you leave the Cradle |
| Brigantine | Third slot |
| Frigate | Fourth and fifth slots |
| Some trait quests | A **Mascot** slot that does not count toward the limit (7.8) |

## 7.2 Anatomy of a crewmate

* **Role:** one of eight, fixed (7.3).
* **Origin leanings:** 1 or 2 starting buffs that push them in a direction. A Navy Gunner starts with +10% Round shot; a pirate Gunner with +10% Grapeshot.
* **Traits:** 1 or 2 at recruitment (usually one good, one quirky or bad); more come from events. Maximum 4.
* **Level** 1 to 10, 1 skill point per level from level 2 (9 points in total).
* **Skill tree:** 3 branches per role, each with 4 nodes and a capstone. A capstone needs all 4 nodes of its branch. With 9 points you can fully master one branch (5 points) and put 4 elsewhere, or spread them. Respec at a City tavern for gold. The tree is opened by talking to the crewmate in the Deck scene.
* **Loyalty** 0 to 100, starts at 50.
* **Look:** you customise it once, at recruitment, and then it is locked. If another captain ever gets this crewmate, they look exactly the same, so everyone recognises them.
* **Name:** you choose it.
* **Memory:** they remember every captain they have sailed with (*"Sailed with Biscu, Tides 3 to 19"*).

## 7.3 Roles and branches

| Role | Branch 1 | Branch 2 | Branch 3 | Battle ability (once per battle) |
|-|-|-|-|-|
| Gunner | Artillerist: more damage | Powder Monkey: reloads, less Powder | Sharpshooter: Chain shot, officer shots | Heated Shot or Double Shot |
| Helmsman | Racer: Watches, escapes | Dancer: Helm contests, rakes | Pilot: terrain, no grounding | Hard About: cancel an enemy rake |
| Bosun | Brawler: boarding | Taskmaster: Hands efficiency | Recruiter: cheaper Hands, more volunteers | Boarders Away: instant grapple |
| Lookout | Eagle Eye: sight range | Signalman: fleet coordination | Weatherwise: wind forecasts | Spot the Tell: see the enemy's next Helm move |
| Quartermaster | Merchant: prices | Purser: supplies, Hold | Fence: selling loot and intel | Jettison: dump cargo for +Helm |
| Surgeon | Field Medic: wounded return faster | Herbalist: crewmate injuries | Shantyman: loyalty and morale | Patch Up: restore Hands mid battle |
| Navigator | Current Reader: WCS | Cartographer: charting, checking intel | Stargazer: plan steps, Crossings | Read the Water: terrain bonus this battle |
| Spy | Infiltrator: copy intel in port | Courier: secret messages, pacts | Saboteur: tells, pre battle sabotage | Cut the Lines: enemy starts with Rigging damage |

**Crew and the Fighting Styles** [P8]

* A skill tree may add to a style's trait, and never copies another style's trait (8.8a).
* The Gunner's Heated Shot gives any style one round of Hot Shot (8.5).
* The Bosun's Brawler branch adds to boarding strength on top of Drill, and Boarders Away (an instant grapple) also gives the edge (8.6).

**Example: the full Navigator tree**

| Node | Current Reader | Cartographer | Stargazer |
|-|-|-|-|
| 1 | Reveal currents within 1 hop every Tide | Surveys Sketch one extra site | +1 plan step |
| 2 | +1 Watch | Check intel for forgery (70%, takes 1 Tide) | Crossings leave you 2 Watches on arrival |
| 3 | Reveal currents within 2 hops | Island Charts you sell fetch 30% more | Wind forecast 2 Tides ahead |
| 4 | Strong currents with you save 2 instead of 1 | Survey costs 1 Watch less | +1 plan step |
| Capstone | *Tidecaller*: once per Tide, ignore one adverse current | *Master Cartographer*: fleet mates gain Local Knowledge in every water you have Charted | *North Star*: inside your current archipelago, your plans never Becalm Short |

## 7.4 XP

* Crewmates earn XP from actions in their own field: Gunners from rounds fired, Navigators from Watches sailed and points charted, Quartermasters from trade value, Surgeons from Hands restored, Spies from intel taken. Everyone aboard also gets a flat share from battles and events.
* Pace: about level 4 by mid season and level 7 to 8 by the end for a crewmate in steady use.

## 7.5 Loyalty

| Raises loyalty | Lowers loyalty |
|-|-|
| Wins (+2) | Decisive losses (minus 5) |
| Sharing a big haul (+3) | Short Rations (minus 3 per Tide) |
| Rum ration (+1 per unit, up to 3 per Tide) | Breaking pacts (minus 2, only for Honourable crewmates) |
| Finishing their trait quest (+10) | Being left in a rival's brig (minus 10) |
| A Surgeon with the Shantyman branch | Long stretches without action (minus 1 per 3 idle Tides) |

* **80 or more:** unlocks their personal Tale and +5% to their abilities.
* **Below 30:** they can be poached or turned (7.6).
* **Below 10:** they may leave at the next port, with a warning in the log one Tide earlier.

## 7.6 Injury, capture, poaching

* **Injury:** when their ship loses a battle Decisively, each crewmate has a 25% chance of injury: out for 2 Tides (1 with a Surgeon). Another player can never kill a crewmate.
* **Capture:** a Capture win lets the winner take one crewmate prisoner instead of an intel pick. Prisoners sit in the captor's Brig.
  * The owner can pay a ransom (set by the captor, capped at 100 × the Boom) or wait: prisoners walk free after 3 Tides.
  * **Turning:** if the prisoner's Loyalty to their own captain is below 30, the captor may offer them a place. If they accept, they switch permanently, keeping their look, name, memory, level and skills.
* **Poaching:** a captain whose Spy (Infiltrator branch) or Bosun (Recruiter branch) is docked in the same port can make an offer to another captain's crewmate whose Loyalty is below 30. It costs gold and works if the offer beats a loyalty roll. The owner learns who did it, which starts a Grudge (13.4).
* **Death:** only through your own choices in a few rare event chains, always clearly warned (*"This could cost Pete his life. Continue?"*).
* **The rule in one line:** keep your crew loyal and nobody can take them.

## 7.7 Recruiting

* **Taverns:** 2 candidates per Tide in Towns, 4 in Cities, rerolled every Tide, shown as characters sitting at tavern tables.
* **Events:** castaways, stowaways, rescued sailors.
* **Captures:** turned prisoners (7.6).
* **Brethren:** beaten NPC captains whose loyalty is broken (13.3).
* **Legends:** unique NPCs found through quests, such as the Forger (10.4).
* Cost: gold and a free slot. A dismissed crewmate goes to the nearest tavern's candidate pool, where anyone can hire them.

## 7.8 Trait quests

Every quirky or bad trait carries a hidden Tale that starts after the crewmate has been aboard for a while, or at a trigger. Finishing it transforms the trait, and sometimes gives a lot more.

| Trait | Tale | Possible outcomes |
|-|-|-|
| Afraid of Parrots | *The Parrot Problem*: a parrot stalks the ship for three Tides, stealing hats and food. Trap it, befriend it, or sell it | **Befriend:** the parrot joins as a **Mascot** (an extra slot; once per battle it squawks the enemy captain's last order, revealing one rule of their doctrine), and the trait becomes *Parrot Whisperer*. **Trap:** the trait becomes *Fearless* and you get a trinket. **Sell:** gold now, but the parrot returns later, perched on a rival captain's shoulder |
| Seasick | *Sea Legs*: one cure per Tide (ginger, a witch's tonic, sailing into a storm on purpose) | *Iron Stomach* (your ship takes half storm damage), or *Landlubber* (they settle ashore, give you a permanent discount in that port and free the slot) |
| Drunkard | *The Last Barrel*: a legendary rum barrel. Drink it, sell it, or let them brew | *Master Brewer* (turns Provisions and Sugar into Rum at sea), *Sober Hero* (+20% ability power), or *Hopeless* if you keep enabling them |
| Superstitious | *The Ghost Lantern*: a lantern only they can see shining | *Spirit Talker*: sees ghost ships and hidden wrecks, unlocks Mistveil secrets |
| Greedy | *The Golden Tooth*: they find a gold tooth and want more | *Treasure Nose* (+finds when Landing), or they rob your Chest and run, becoming a Brethren rival |
| Homesick | *The Letter Home*: deliver a letter to their village | Their home village appears on the map as a friendly Harbour for you: discounts and a safe port |
| Wanted | *Past Catches Up*: a bounty hunter arrives | Buy a pardon (trait gone), turn the hunter into a named rival, or recruit the hunter |
| Clumsy | *The Accident*: they break something important | *Lucky Fool*: your ship's luck streak breaker triggers sooner (19.1) |

## 7.9 Events change crewmates

* Event choices can give crewmates traits, good or bad, depending on how you handle them.
* Example, *Fever Aboard*: let the Surgeon treat it (the Surgeon gains XP and *Steady Hands*), quarantine the sick crewmate (they gain *Resentful*), or fight it with the rum ration (the sick crewmate gains *Iron Liver*, and the Surgeon gains *Offended*).
* Every trait from an event names its cause: *"Fearless: survived the Kraken, Tide 38."*

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

* **strength** = Hands × (1 + Bosun, trait and Background bonuses) × the Drill factor (6.2) × Kelp (1.15, for both ships) × First over the rail (1.25, below) × Fighters (1.2, a Boarder's crew) × Tinderbox (0.8, a crew fighting a Firebrand on deck).
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

# 9. Trade and economy

## 9.1 Goods

| Category | Goods | Used for | Phase |
|-|-|-|-|
| Supplies | Provisions, Powder, Fire Pots | Range at sea, gunfire, the deck fight | S0 |
| Staples | Rum, Sugar, Spice | Profit; Rum also raises crew loyalty | S0 |
| Materials | Timber, Canvas | Repair at sea (Timber), cheaper upgrades | Timber S0, Canvas S1 |
| Luxuries | Pearls, Ghostwood, Kraken Ink | High profit, found only far from the Cradle | S1 |
| Contraband | Cursed Gold, Forbidden Relics | Huge profit, illegal in the Crown Keys | S1 |

* Supplies are not cargo (D167): hunters do not look for them, loot never takes them, they never go into a Wreck or Flotsam, and a tow keeps them. Fire Pots are sold in Towns and Cities like Powder; the buying screen and the price are [P5].

## 9.2 Markets

* Each settlement **makes** 1 or 2 goods (sold at 0.6 times base) and **wants** 1 or 2 (bought at 1.6 times base). Other goods trade at base. Villages trade only 2 or 3 goods.
* Each archipelago has a trade identity:

| Archipelago | Makes (cheap) | Wants (dear) |
|-|-|-|
| The Cradle | Provisions, Timber, Rum | Spice |
| Rumhaven Reach | Rum, Powder | Contraband (black market), Luxuries |
| Saltteeth Shoals | Pearls, Contraband | Provisions, Timber |
| Crown Keys | Powder, Canvas, Sugar | Luxuries |
| Mistveil Isles | Ghostwood | Powder, Rum |
| The Maw | Kraken Ink | Everything, at a premium |

* **Price drift** (v0.2 6.3): every unit sold lowers that port's price 1.5%; each Tide prices move halfway back to normal.
* **You only see prices where you are, or where you hold a fresh Price Sheet** (intel, valid for 2 Tides). A trader's edge is information.

## 9.3 Contracts

* Settlements post delivery contracts on the tavern notice board: *"Deliver 12 Timber to Tarpot within 4 Tides: 300 doubloons and +2 Trust."*
* Public. The first captain to deliver wins; latecomers can still sell at market.
* **Shortages** (a Small or Medium Hotspot): one port pays 3 times the price for one good for 2 Tides.

## 9.4 Guild shares and blockades [S1]

* Towns and Cities each have 10 **Guild shares** for sale. Every Tide, shareholders split 5% of the value of all player trades at that port.
* Holding 4 or more shares makes you the port's **Patron**: your name on the port and 5% better prices there.
* **Blockade:** a captain Lurking in the water that leads to a Harbour, with the Blockade intent, stops ships from docking unless they pay a toll (set by the blockader, at most 10% of cargo value) or fight. Each Tide of blockade raises that port's prices 20% and cuts the Patron's dividends. In the Crown Keys, the Navy responds.

## 9.5 Smuggling [S1]

* Contraband cannot be sold in the Crown Keys and is seized if found there.
* Navy patrols inspect ships they meet in Crown waters (50% chance). Hidden Hold units are never found.
* Black markets (Rumhaven, Saltteeth) pay double for Contraband.

## 9.6 How trade connects everything

* Traders supply Powder and Fire Pots (fighters need them), Provisions (explorers need range), and Timber and Canvas (everyone's upgrades get cheaper).
* Price Sheets and Charts are intel, so traders buy information and explorers sell it.
* Cargo means weight (fewer Watches when the Hold is over 80% full) and risk (loot), so traders hire escorts through pacts (14) or choose routes through terrain where small ships win.
* Guild shares turn ports into territory; blockades turn territory into conflict.

# 10. Intel

## 10.1 The intel item

```ts
interface Intel {
  id: string;
  type: "chart" | "currentChart" | "sighting" | "priceSheet" | "rumour" | "secret"
      | "doctrine" | "treasureMap" | "mapFragment" | "letter";
  subject: string;              // an island, a lane set, a captain, a port
  payload: unknown;             // the knowledge itself
  sourceCaptainId: string | null;
  createdTide: number;
  expiresTide: number | null;
  copyable: boolean;            // copies can be duplicated; originals only move
  isTrue: boolean;              // server only, never sent to clients
  forgedBy?: string;            // server only
}
```

## 10.2 Types

| Type | About | Copy or original | Expires | Main sources | Phase |
|-|-|-|-|-|-|
| Chart | An island (full) or an archipelago (sketch) | Copy | No | Exploring, cartographers, trades, captures | S0 |
| Current Chart | The currents of lanes in an area | Copy | No | Surveys, Navigators, cartographers | S0 |
| Sighting | A ship: where, when, how full, heading | Copy | After 4 Tides | Lookouts, Lurking, harbourmaster bribes, the Gazette | S0 |
| Price Sheet | Prices at one port | Copy | After 2 Tides | Visiting, Quartermasters, trades | S0 |
| Rumour | Something in the future: a hotspot, an NPC's plan | Copy | When it happens | Taverns, events, Gazette plants | S0 |
| Secret | A person: an NPC's weakness, a player's agenda clue, a crewmate's loyalty | Copy | No | Events, Spies, captures | S1 |
| Doctrine Copy | One saved doctrine as it was when taken | Copy | No | Capture pick | S1 |
| Treasure Map | One dig spot | Original | No | Events, wrecks, Brethren | S0 |
| Map Fragment | A piece of Grimbeard's map | Original | No | Story, Big Hotspots, captures | S1 |
| Sealed Letter | Quest item | Original | Varies | Events | S1 |

## 10.3 Rules

* **Trading:** intel goes into the trade window alongside goods and gold. The buyer sees the type, subject, source and age, but not the payload until the trade completes. With copies, the seller keeps theirs; originals move.
* **Fleet sharing:** fleet mates share copies for free with one tap.
* **Stealing:**
  * The Capture pick: one original, or two copies (8.7).
  * A Spy's **Infiltrate** (port action, once per Tide, Infiltrator branch): try to copy one random entry from a captain docked in the same port. Chance = Spy level against the target's Cunning. If caught: Trust minus 10, the target learns who it was, and a Grudge starts.
* **Decay:** Sightings and Price Sheets fade on your Chart and then expire.
* **Overselling:** selling the same copy to many captains is allowed, and the Gazette may notice (*"The Whisper Rock chart has now been sold to half the Brine"*).

## 10.4 The Forger

* **Exactly one Forger exists in the world:** a legendary NPC, *Inkfinger Isolde* (working name), hidden in the Mistveil Isles in Season 1 (Saltteeth Shoals in Season 0).
* **Recruiting her:** finish her Tale *The Perfect Copy*, 4 steps over several Tides: find her, deliver something rare, survive her betrayal test, pay her price. She takes a crewmate slot.
* **Only one captain has her at a time.** She can be poached or turned like any crewmate, and her loyalty is fickle (minus 2 per Tide unless paid), so she will change hands, and everyone will want her.
* **Forger's Kit:** a second route. At most 2 kits exist per season, found in Medium Hotspots or deep sites. Each kit has 3 uses.
* **What she forges** (one per Tide, costs gold): any copyable intel (a chart with wrong currents, a false sighting, a fake rumour, a fake price sheet). Once per season she can forge a **Treasure Map**, an original that leads to an empty dig, or to wherever her owner is lurking.
* Forgeries are flagged false on the server and look exactly like the source they claim.

## 10.5 Checking intel

* **Acting on it** reveals the truth: you sail the lane and the current is wrong, you dig and the chest is not there.
* **Navigator, Cartographer branch:** 70% to detect a forgery; inspecting takes 1 Tide.
* **Captain Cunning rank 3:** 60% to detect.
* **When a forgery is found:** the victim sees who sold it to them, which starts a Grudge. A Cartographer's detection also traces the forger's owner 50% of the time (Trust minus 15 for them, publicly).

# 11. Hotspots

| Tier | How often | Warning | Lasts | Built for | Examples | Rewards |
|-|-|-|-|-|-|-|
| Small (SHS) | 1 or 2 per archipelago every Tide | None. Seen by anyone in sight of that water, or holding a fresh sighting or rumour | 1 Tide | Solo | Floating crates, a small convoy, a castaway, a price spike, a trinket buoy | Small gold, a recruit, a good deal |
| Medium (MHS) | Rarest: about 1 every 8 to 10 Tides, worldwide | None, they are surprises. A rumour spreads after the first Tide, so the second Tide becomes a race | 2 Tides | Solo or a pair | A ghost ship, a whale pod (Kraken Ink), a mutinous Brethren crew wanting a new captain, a storm uncovered wreck, a Forger's Kit | Medium gold, unique items, special recruits |
| Big (BHS) | On a schedule, every 6 to 8 Tides | Announced 2 Tides ahead in the Gazette, with location | 1 Tide (the fight) | Fleets | The Treasure Galleon, the Admiralty Payroll Convoy, a Sunken Armada surfacing, a Pirate Lord's feast, the Kraken (finale) | Big gold (co op prize rule), trophies, map fragments, Fame |

* **Interpretation:** you asked for Medium Hotspots to happen less often than the rest, so they are the rarest tier and the surprise tier. If you meant "between Small and Big", they become every 3 to 4 Tides and get a 1 Tide warning instead.
* **Placement:** weighted toward waters that at least 2 captains can reach within one Tide. A Big Hotspot never lands in the same archipelago twice in a row. Small Hotspots spawn more often near captains who have had no interaction for 2 Tides (the density lever, 2.7).
* **Big Hotspot schedule:** Season 0 on Tides 8, 15, 22 and 28 (the finale galleon). Season 1 every 7 Tides, plus the Kraken on Tide 42.

# 12. Events

## 12.1 Sizes

| Size | Steps | Spread over | Options per step | How often, per captain |
|-|-|-|-|-|
| Squall | 1 | Instant | 2 | Up to 1 new one per Tide |
| Tale | 2 to 5 | 2 to 6 Tides | 2 or 3 | One active at a time; a new one about every 4 Tides |
| Saga | 5 to 8 | The season | 2 or 3 | Your Background Saga and your Agenda Saga |

## 12.2 Triggers

* **Place:** Landing on a site, entering a water, docking in a settlement.
* **State:** a crewmate's trait plus time aboard, a reputation threshold, Short Rations, a rival nearby, an item held.
* **Time:** the start of an Act, the aftermath of a Big Hotspot.
* Each Tide the engine collects every event a captain qualifies for and draws at most one new Squall, by weight. Tales start from Squall choices, from sites, or from traits.

## 12.3 A choice

* Each option has: text; optional requirements (role, trait, Background, reputation tier, item, gold); immediate effects; optional delayed effects, which resolve some Tides later and are reported in the Gazette.
* Options you cannot take are shown greyed out with their requirement (*"[Surgeon] Treat the fever"*), so players learn what a crew would unlock.
* Consequences are hinted in words, never in numbers (*"The crew looks nervous"*).
* No option is obviously right.

## 12.4 Event file format

Events are data files, so you and Claude can write dozens without touching game code.

```json
{
  "id": "singing_skull",
  "size": "tale",
  "trigger": { "on": "land", "siteTag": "wreck", "chance": 0.15 },
  "steps": {
    "found": {
      "text": "Your crew fishes up a skull that hums shanties.",
      "options": [
        { "id": "keep", "text": "Keep it. The crew loves the music.",
          "effects": [ { "loyaltyAll": 3 }, { "ifTrait": "superstitious", "loyaltyLoss": 5 } ],
          "next": { "step": "humming", "afterTides": 1 } },
        { "id": "sell", "text": "Sell it to the tavern keeper.",
          "requires": { "docked": "town" },
          "effects": [ { "gold": 40 } ] },
        { "id": "toss", "text": "Toss it back. Some things should stay drowned.",
          "effects": [] }
      ]
    },
    "humming": {
      "text": "At night the skull hums a direction, always the same one.",
      "options": [
        { "id": "follow", "text": "Follow it.", "next": { "step": "owner", "afterTides": 1 } },
        { "id": "gag", "text": "Gag it with a sock.", "effects": [ { "addTrait": "jinxed_ship" } ] }
      ]
    },
    "owner": {
      "text": "The humming leads to a wreck full of treasure, and to Captain Mags, who wants her skull back.",
      "options": [
        { "id": "fight", "text": "Fight her for it.", "effects": [ { "battle": "brethren:mags" } ] },
        { "id": "return", "text": "Give it back.", "effects": [ { "favour": "brethren:mags" } ] },
        { "id": "bargain", "text": "[Quartermaster] Bargain.", "requires": { "role": "quartermaster" },
          "effects": [ { "gold": 120 }, { "grudge": "brethren:mags" } ] }
      ]
    }
  }
}
```

Whatever the choice, *The Singing Skull* ends with a named Brethren rival or ally: **events feed the rival system.**

## 12.5 Special forms

* **Mirror Tales:** two captains get opposite sides of the same Tale without being told who the other is (*"Deliver the crate to Gullhaven"* against *"Intercept the crate before Gullhaven"*). The ending depends on both. The Gazette reveals who was who.
* **Cross player Squalls:** a choice about another captain (*"A bottle washes up with a letter addressed to Mihai. Read it, deliver it, or sell it to his rival?"*).
* **Background Sagas** (5.2), **Agenda Sagas** (15), **trait Tales** (7.8).

## 12.6 Content needed for Season 0

* 30 Squalls, 8 Tales, short 3 step Sagas for the 6 Backgrounds in Season 0, and trait Tales for 4 traits.
* Written to the tone rules in v0.2 section 2.4. Claude can draft them in bulk from a short style guide; you edit for voice.

# 13. NPC captains, rivals and bots

## 13.1 One brain for every NPC

All NPC ships (merchants, navy, pirates, rookies, lords) and the test bots run on the same **Captain Brain**.

1. **Goals:** a ranked list of motivations (get rich, revenge on X, finish my quest, protect my home waters, climb the ranks).
2. **Candidates:** the brain generates 20 to 50 possible voyage plans from what *it* knows. NPCs obey fog of war and only use their own Chart.
3. **Scoring:** each plan gets an expected value for each goal, weighted by personality: Greed, Aggression, Caution, Loyalty, Curiosity.
4. **Choice:** the best plan, plus a doctrine from its own doctrine set.

* NPCs follow the same rules as players: Watches, WCS, supplies, fog. Locals know the currents of their home archipelago (Local Knowledge).
* **Fighting Styles [P9]:** the brain picks a style and its template for each NPC: merchants and locals fight as Smugglers, navy patrols as Gunlines, and pirates and the Brethren use the other styles (8.8a). Until P9 an NPC ship has no style and no trait and starts with the Boarder template (D172); Old Shellback has a doctrine of his own (2.5).
* Everything is seeded from the Tide seed, so NPC behaviour replays exactly.

## 13.2 Kinds of NPC captains

| Kind | Where | Count | Purpose |
|-|-|-|-|
| Cradle Rookies | Start in the Cradle with the players, in the same sloop | 3 to 4 | Grimbeard's other protégés, each with a personal plot; rivals and allies from Tide 1 |
| Locals | Every archipelago | 4 to 8 per archipelago | Traders, fishers, smugglers, navy; they keep the world alive. Ship level scales with the archipelago's danger |
| Brethren | Ranked pirate captains | 12 to 16 | The rival hierarchy (13.3) |
| Lords and monsters | One per archipelago, plus bosses | 6 to 8 | Old Shellback, the Pirate Lords, the Kraken |

**Cradle Rookie plots** (examples):

* **Wendell Proudfoot** wants to beat Old Shellback first to impress his famous mother. If a player beats it before him, he takes it personally and starts a Grudge.
* **Marigold Teach** quietly collects map fragments and offers pacts to anyone who holds one.
* **Bones McGill** only wants to open a tavern. He trades fairly and needs Timber; help him and his tavern becomes a new Harbour in the Cradle in Act 2.

Plots move forward whether or not players get involved, and the Gazette reports them.

## 13.3 The Brethren

* **Anatomy:** name, epithet, portrait, rank (Sea Rat, Captain, Commodore, Pirate Lord), home archipelago, 2 strengths, 1 weakness, 1 fear, a doctrine set, a personality, and a memory of every captain they have met.
* **Memory:** after each battle the NPC records who it fought, the result, and how (ammo, rakes, boarding).
  * **If it lost:** it gains a scar and an adaptation against what beat it (*"Burnt by heated shot: now fire resistant"*), plus a Grudge against that captain (a bonus against them, and it will look for them).
  * **If it won:** promotion progress, and maybe a new trait (*"Sockslayer"*).
* **Promotions:** wins against players and other NPCs move a Brethren captain up the ranks. Between Tides, Brethren also fight each other, simulated and reported.
* **Weaknesses are Secrets** (intel): learned through events, rumours, Spies, or by fighting them twice.
* **Recruiting:** Capture a Brethren captain after they have lost twice (their crew's loyalty is broken) and they may join you as a crewmate, keeping their traits. Their role comes from their fighting style.
* **Entrance:** a wanted poster slams onto the screen whenever one appears or returns.

## 13.4 The Grudge Book

* For every pair of captains (players and named NPCs) the engine counts: fights and who won, betrayals, thefts, captures, poachings, pacts kept, and trades.
* When the counts cross a threshold, the relationship gets a name:

| State | Trigger | Effect |
|-|-|-|
| Rivalry | 3 or more contests over the same things (hotspots, contracts, ports) | The Gazette tracks it |
| Feud | 3 or more fights between the pair | +25% Legend for wins against each other, a trophy per win, a running tally in the Gazette |
| Vendetta | One betrayed the other (broken pact, theft, poaching) | The victim gets +15% damage against the betrayer until it is settled |
| Sworn Kin | 3 or more pacts kept and no betrayals | The convoy bonus between them doubles |

* **Settling a Vendetta:** a Duel pact or a Truce pact (14.2).

## 13.5 Test bots

* `tools/bots` plays whole seasons headless with 6 bot captains in player archetypes: Explorer, Trader, Raider, a Fleet pair, and a Casual who skips Tides. They all use the Captain Brain.
* It runs 100 seasons in minutes and reports every metric in section 20, so balance changes are tested before anyone plays.

# 14. Pacts

## 14.1 Lifecycle

* **Proposed:** a captain picks the type, terms, duration and an optional stake.
* **Answered:** the other captain accepts, counters (new terms go back) or declines.
* **Active:** the engine checks it after every Tide.
* **Ended:** Kept (it ran its full term), Broken, or Expired (its conditions can no longer happen).

## 14.2 Types

| Type | Terms | What the engine checks | Phase |
|-|-|-|-|
| Truce | Neither hunts the other for N Tides | Any encounter where one hunted the other | S0 |
| Escort | A escorts B on given Tides | A ends each of B's steps in the same water and joins B's battles | S0 |
| Split | Agreed shares of a named Big Hotspot prize | Splits the loot automatically | S0 |
| Tribute | A pays B a sum every Tide; B never hunts A | Payments taken automatically; any hunt | S1 |
| Delivery | A brings goods to a place by a Tide; B pays | Goods delivered (transferred automatically) | S1 |
| Swap | Intel or goods exchanged at the Tide | Both sides delivered, or neither | S1 |
| Duel | A fight at an agreed place and Tide, for agreed stakes | The battle happens; stakes paid | S1 |

* **Self enforcing pacts** (Split, Swap, Tribute payments) cannot be broken, only cancelled, and cancelling counts as breaking.
* **Breakable pacts** (Truce, Escort, Delivery, Duel) are judged after each Tide.

## 14.3 Stakes

* An optional escrow in gold, held by the Brethren Notary.
* Kept: each stake goes back to its owner. Broken: the breaker's stake goes to the victim.
* Captains with Trust below 25 can only sign pacts with a stake.

## 14.4 Breaking a pact

* **Always allowed.** It is a pirate game.
* Automatic consequences: the breaker's stake goes to the victim, Trust minus 25, a BETRAYAL headline in the next Gazette, and a Vendetta for the victim.
* Because orders are sealed, a betrayal is only discovered at the Tide reveal. That moment is the drama.
* Captains with high Trust are the best allies and have the most to lose, so a big betrayal happens maybe once a season, and it lands hard.

# 15. Secret Agendas

## 15.1 The draw

* At Tide 3 (after the tutorial) each captain draws 3 agendas and secretly keeps 1.
* **Second act:** at mid season (Tide 21 in Season 1, Tide 14 in Season 0) each agenda escalates or twists, delivered as a Saga step. [S1]

## 15.2 Types and limits

| Type | Example | Phase |
|-|-|-|
| Personal | Own trophies from 3 different rivals | S0 |
| Discovery | Be the first to fully chart 3 islands in one archipelago | S0 |
| Targeted | Finish the season with more Fame than a named captain | S0 |
| Chaotic | Sign 3 pacts and break all 3 | S0 |
| Secret Helper | Make sure a named captain takes part in a winning Big Hotspot, without them ever finding out | S1 |
| Mystery | A personal Saga | S1 |

* Agendas target competition, never ruin: none requires sinking or capturing the same player more than once.
* Each captain is the target of at most one agenda.

## 15.3 Clues, accusations and scoring

* **Agenda clues** are Secret intel: gained from events, Spies, captures and careless pacts.
* **Accusation:** once per season (one more with Cunning rank 5), at any Tide, publicly accuse a captain of holding an agenda of a given type (and naming its target, if it has one).
  * **Right:** +40 Legend for you; their agenda's reward is halved.
  * **Wrong:** minus 20 Legend and minus 10 Fame for you.
  * Both results are announced in the Gazette.
* **Scoring:** a completed agenda is worth about 15 to 20% of a typical final Legend: enough to swing ranks, not enough to decide them alone.
* **The Big Reveal:** at the finale, every agenda is shown one by one in a cinematic.

# 16. The Gazette

## 16.1 Editions

* One edition every Tide (13:00 and 20:00), the same format both times.
* Sections: three headlines; the battle of the Tide (with a replay link); market news; wind forecasts; rivalry tallies; hotspot notices; one rumour (possibly false); Polly's gossip column.
* Posted to Discord with the Tide jingle (v0.2 12).

## 16.2 Bias

* The editor, **Polly Quillsworth** (working name), holds a **Favour** score for every captain, from hostile to adoring.
* Favour moves with paid services, with Fame, and with scoops (giving Polly a piece of intel raises her Favour toward you).
* Favour decides the wording: the same event becomes *"BRAVE BISCU BREAKS BLOCKADE"* or *"BISCU BUMBLES THROUGH BLOCKADE"*.
* Nicknames come from reputation titles and running gags: repeated blunders get a running count.

## 16.3 Paid services [S1]

From the Gazette Office scene in any City, or its menu.

| Service | Effect | Cost (× the Boom) |
|-|-|-|
| Puff Piece | A flattering story about you or your fleet next edition; +3 Fame | 40 |
| Smear | An anonymous negative story about a rival; minus 3 Fame for them | 60 |
| Bury | A story about you (a betrayal, a loss) is left out | 80 |
| Plant | A rumour you build from templates is printed; every reader gets it as Rumour intel | 100 |
| Exposé | Reveal who paid for any story in the last 3 editions | 120 |

* **Sealed bids:** when two requests clash (a Puff against a Smear of the same captain, a Bury against an Exposé), the higher payment wins and the loser gets half back.
* Exposés can reveal Plants too: *"SCANDAL: the 'galleon at Gullhaven' rumour was planted by Anna."*

## 16.4 How it is written

* Season 0: about 200 headline templates with variables, and Favour based word choices.
* Later option: Claude writes each edition from the Tide's event log in Polly's voice, for cents a day. The engine stays deterministic, because the text is only presentation, written after the Tide resolves.

# 17. Tavern Wagers (betting)

## 17.1 Markets

The **Bookie** (an NPC in every tavern; the markets are shared everywhere) posts 3 to 6 markets each Tide, generated from public information:

* *"Will the Treasure Galleon be sunk or captured at Tide 15?"*
* *"Will the Wet Sock dock in Gullhaven next Tide?"* (generated from a public tell or sighting)
* *"Who wins the Feud fight between Anna and Mihai, if it happens?"*
* *"Most Fame gained this week: Anna, Mihai, or the field?"*
* *"Will anyone beat Old Shellback next Tide?"*

[S1] Captains can also propose a market (20 doubloons). It must be about a public outcome the engine can check.

## 17.2 How the odds work

* **Pool betting:** all stakes on all outcomes of a market go into one pool. When it resolves, the winning side splits the whole pool in proportion to their stakes, minus a 5% Bookie cut (a gold sink).
* The pool's current split is visible and shows the implied odds (*"72% of the money says the galleon falls"*).
* No odds to set and no house risk: the Bookie can never go broke, and it is fair by construction.

## 17.3 Rules

* Bets close when the Tide resolves (the same deadline as orders) and pay out in that Tide.
* Maximum stake per market: 15% of your Chest or 200 × the Boom, whichever is lower.
* You cannot bet on a market where you, a fleet mate, or someone you have an active pact with is a subject. You know your own orders.
* Winnings go to your Chest. A win of 5 times your stake or more makes the Gazette.
* **Wagers are tells:** the amount bet on each side is public, but not who bet. If a lot of money suddenly says the Wet Sock will not make port, its captain has just learned something.

## 17.4 Example

* Market: *"Will the Wet Sock dock in Gullhaven at Tide 12?"* The pool holds 300 on Yes and 100 on No.
* You put 50 on No. The pool is now 300 on Yes and 150 on No: 450 in total.
* The Wet Sock is ambushed and never docks. After the 5% cut the pool is 427. The No side (150) splits it, so your 50 returns 50 ÷ 150 × 427 = **142**.
* The Gazette: *"Someone knew. 150 doubloons said the Wet Sock would never make it."*

# 18. Living scenes

* Every scene is built from one reusable component: background art, hotspots, idle character sprites, and a dialog panel. A new scene is data plus art, not new code.
* **Walking is optional flavour.** Tap a hotspot and your captain walks there, or use the menu shortcut. Every action is reachable in at most 2 taps from the main screen.
* Ships and characters show their state: ship portraits show live damage (holes, torn sails, scars); crewmate portraits show bandages when injured and a frown when Loyalty is low.

| Scene | Where | Hotspots | Phase |
|-|-|-|-|
| Deck | Your ship | Crewmates (talk, skill tree, quests), the helm (voyage plan), the cannons (doctrines), the ship's bell (Ready) | S0 |
| Captain's Cabin | Your ship | Map table (Captain's Chart), Trophy Wall, strongbox (Chest), Logbook (intel), desk drawer (Agenda) | S0 |
| Tavern | Towns and Cities | Recruits at tables, the Bookie, the notice board (contracts, wanted posters), the rumour monger, Liar's Dice | S0 |
| Harbour | Settlements | Market stalls, shipwright, Hands recruiter, supplies, the Old Moorings | S0 as a menu, S1 as a scene |
| Hold | Your ship | Cargo and supplies stacked as crates and barrels | S1 |
| Crow's Nest | Your ship | The Lookout's report and sightings | S1 |
| Brig | Your ship | Prisoners: ransom, turn or release | S1 |
| Gazette Office | Cities | Polly's desk (services), the archive of old editions | S1 |
| Brethren Cove | Rumhaven Reach | The rival hierarchy laid out as a pirate court | S1 |
| Old Moorings | City harbours | Your past ships with their scars | S1 |
| Governor's Mansion | Crown Keys | Pardons, letters of marque | Later |
| Fleet Hideout | Your fleet's island | Shared table, growing treasure pile, moored ships | Later |
| Island Landing | Sites | Walk to dig spots and ruins | Later |
| Hall of Legends | Website page | Every season's ships, winners and agendas | Later |

# 19. Presentation: luck and cinematics

## 19.1 Fair luck

* **Where luck exists, and only there:** damage variance (0.9 to 1.1), Helm contest rolls (the chase, Cut Free, the Ram, the dash, grapnels), Mortar shells hitting, fires catching, escape rolls, event draws, and trait procs. The deck fight itself has no roll (8.6).
* **Telegraphed:** you knew it was possible (a forecast, a cursed item you chose to keep).
* **Earned:** it comes from your choices (Lucky Pete fires because you recruited Lucky Pete).
* **Bounded:** luck shifts a result at most one step (a loss into a draw), never a rout into a win.
* **Streak breaker** [not built: it needs a luck history for each captain, D34]: after 3 battles in a row where luck went against you, your next battle's luck range becomes 1.0 to 1.1. The *Lucky Fool* trait makes this happen after 2.
* **Mostly funny:** most luck moments are flavour, like a whale surfacing between the ships so nobody can fire for a round.

## 19.2 Cinematics

All of them are skippable, at most 10 seconds long, and built from pixel art plus camera work: pans, zooms, screen shake, letterbox bars, slow motion and a sound sting.

| Cinematic | When | Phase |
|-|-|-|
| The Tide Turn | Every Tide: a bell rings, a wave sweeps the Captain's Chart, every route you can see draws at once, clashes flash | S0 |
| Battle replay | Every battle: rules revealed round by round, smoke, splinters, damage numbers | S0 |
| Front page spin | The Gazette spins in like an old movie newspaper | S0 |
| Battle cut ins | A crewmate's close up and shouted line when their ability fires | S1 |
| Wanted poster slam | A Brethren captain appears or returns | S1 |
| Event panels | Comic style panels with a little parallax, for Tales | S1 |
| Level up flourish | A crewmate levels up or a trait transforms | S1 |
| The Big Reveal | Finale: agendas revealed one by one | S1 |
| Battle GIF | The day's best battle exported to Discord as a GIF | Later |

# 20. Bot targets: what "working" means

| Metric | Target |
|-|-|
| Interactions per captain | One every 2 to 3 Tides |
| Old Shellback passed | Median by Tide 7 to 9; everyone by Tide 12 |
| Chart coverage at mid season | 50 to 70% for every good archetype; no more than 40% from own exploring alone |
| Fighting Style balance | No style above 60% of the field or below 25%. The wheel holds: each designed win 55% to 80% of decided battles, each even pair 35% to 65%. With equal levels spent the way each style would, no style above 60% |
| Old Shellback by style | The best doctrine each style's captain can write beats him 35% to 80% of fights |
| Drill, Lashed fast, the Smuggler | In a Boarder against Boarder fight, Drill 5 beats Drill 0 in 55% to 80% of decided battles; an equal ship wins at most 40% of its Cut Free tries against a boarder's edge; the Smuggler escapes at least 30% of its battles against every style |
| First Brigantine | Median around one third of the season |
| Longest stretch without a purchase | Under 4 Tides |
| Missed Tides | A captain who misses 3 days ends above 85% of an unbroken captain's earnings |
| Big Hotspot turnout | At least 2 fleets or 3 captains at every one |
| Wager markets | At least 3 open markets every Tide |
| Becalmed Short | Happens to captains without WCS knowledge about 1 Tide in 4, and almost never to captains with it |

# 21. Scope: Season 0 and later

| System | Season 0 | Season 1 | Later |
|-|-|-|-|
| Tides | Two per day, identical | | |
| Map | The Cradle, Rumhaven Reach, Saltteeth Shoals | Crown Keys, Mistveil, the Maw, Grimbeard's Rest | Procedural maps |
| Watches and WCS | Full | | |
| Captain's Chart and Local Waters | Full, with simple ink animations | Richer animation | |
| Exploration | Knowledge levels, Survey, Land, coverage | Deep sites | Island Landing scene |
| Intel | Charts, Current Charts, Sightings, Price Sheets, Rumours, Treasure Maps; stealing on Capture | Secrets, Doctrine Copies, Spies, the Forger, map fragments | |
| Backgrounds | 6 of 9, with short Sagas | All 9, full Sagas | More |
| Captain skills | All three skills, ranks 1 to 3 | Ranks 4 and 5 | |
| Reputation | Trust, Fear, Fame, titles, basic effects | All effects | |
| Ship | Sloop and Brigantine, 6 stats (Drill included, all three stages), 3 damage tracks, Hands, Provisions, Powder and Fire Pots | Frigate, materials, Old Moorings | |
| History | Scars and the Ship's Log | Trophies, figureheads, ship traits | |
| Crew | 2 slots, 8 roles, trees with all branches, traits, loyalty | Poaching, prisoners, Mascots, Brethren recruits | |
| Fighting Styles | Six styles and the Smuggler, with their traits, moves and template doctrines; the wheel (8.8a). Changing style in a City is [P5] | Trickster and Dread (`docs/IDEAS.md`) | |
| Combat | Full doctrine combat: six distances, helm, ammo, the deck fight, Drill, fire, overtime, terrain | Crew ability cut ins | |
| Trade | Supplies and Staples, markets, contracts | Materials, Luxuries, Contraband, guild shares, blockades | |
| Hotspots | Small and Big | Medium | |
| Events | 30 Squalls, 8 Tales, 4 trait Tales | Mirror Tales, full Sagas | |
| NPCs | Captain Brain, 3 Cradle Rookies, Locals, Old Shellback, 6 Brethren | Full Brethren hierarchy, Lords | |
| Rivals | Grudge Book: Rivalry and Feud | Vendetta, Sworn Kin | |
| Pacts | Truce, Escort, Split | All types | |
| Agendas | Personal, Discovery, Targeted, Chaotic; accusations | Second acts, Secret Helper, Mystery | |
| Gazette | Templates with bias | Paid services | Claude written editions, a rival paper |
| Wagers | Bookie markets | Player markets | |
| Scenes | Deck, Cabin, Tavern, Harbour as a menu | Hold, Crow's Nest, Brig, Gazette Office, Brethren Cove, Old Moorings | The rest |
| Cinematics | Tide Turn, replays, front page spin | Cut ins, poster slams, panels, the Big Reveal | Battle GIFs |

**A note on size:** even this Season 0 column is several times the v0.2 MVP. My rough guess is 2 to 3 months of evenings solo instead of 3 to 4 weeks. On 18 October 2026 Biscu chose the full column over an earlier "Season 0 lite" (the Cradle only, combat, crew, Watches and WCS, charting, pacts and agendas). The Fighting Styles, Drill and fire add to that size.

# 22. Open decisions

1. **Season 1 length:** 21 days and 42 Tides (recommended), or 28 days and 56 Tides.
2. **Heritage:** which items move to a new hull (recommendation in 6.6).
3. **Medium Hotspots:** the rarest surprise tier (as written), or between Small and Big.
4. **Cradle Truce:** no PvP in the Cradle until Tide 5. Right length?
5. **The Forger:** one unique NPC plus 2 kits per season, or the NPC only.
6. **Working names** to keep or replace: the Cradle, Gullhaven, Old Shellback, Polly Quillsworth, Inkfinger Isolde, Wendell Proudfoot, Marigold Teach, Bones McGill, Watches, WCS.
7. **GAME_DESIGN.md:** fold this document into a v0.3 of the main design doc once these decisions are made, so there is one source of truth for Claude Code.

Decided and removed: **Season 0 shape.** Biscu chose the full Season 0 column of section 21 on 18 October 2026, and Fighting Styles joined that column (D122).

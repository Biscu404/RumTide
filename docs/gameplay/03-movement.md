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

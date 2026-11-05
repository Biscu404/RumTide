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

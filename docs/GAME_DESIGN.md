# Rumtide: Game Design Document

Version 0.2, 14 October 2026. Working title. Season 0 is a two week beta built by one developer; a second developer joins after it. Research and sources live in [RESEARCH.md](RESEARCH.md); section numbers like R2.2 point there.

# One page summary

**Pitch.** Rumtide is a pixel art pirate game for a crew of friends, played in a few minutes a day in the browser. Every day you give your little ship its orders: where to sail, what to do on arrival, and how to fight if trouble finds you. Every evening at 21:00 the **Tide** turns: all orders resolve at once, and the whole group watches the day's hauls, ambushes and disasters play back as tiny animated scenes. Upgrades arrive in small, steady doses. The big prizes (treasure galleons, the season's sea monster) need captains to sail together, and rival fleets can ambush and outguess each other under rules that stop anyone from being bullied out of the game.

**Target feeling.** "The group chat lights up at nine." Anticipation during the day, a shared story every night, a small win every session.

**Three pillars.**

1. **Two minutes a day, a story every night.** Respect for time first (R2.2).
2. **Together is better.** Solo always works, but fleets earn far more (R4.1, R4.2).
3. **Fair fights, soft falls.** Secret simultaneous plans decide battles, and you only ever lose what you were carrying (R1.2, R5.3).

**The loop.** Read the Tide Report, spend gold in port, set tomorrow's orders and battle plan, press Ready. One Tide per day. Weekly treasure galleon. A 28 Tide season ends with a group boss fight, a Hall of Legends and a fresh map.

**Key decisions**

| Decision | Choice | Main evidence | Alternative considered |
|-|-|-|-|
| Pace | Async: one Tide per day, early if everyone is Ready | Subterfuge, Neptune's Pride turn mode, BBS daily turns | Scheduled real time sessions |
| Map | Node graph of sea lanes, about 6 nodes per player | Neptune's Pride stars, Diplomacy provinces, Cook on density | Free tile movement |
| Combat | Secret 3 round plans on a maneuver triangle, resolved by server, replayed as animation | Frozen Synapse, Sirlin yomi | Real time cannon aiming |
| Loss | Only carried plunder and cargo at risk; never upgrades | Sea of Thieves, Sid Meier's Pirates | Full loot |
| Progression | Exponential costs, linear stats, three hulls, season reset | Pecorella idle math, R3.4 | Cosmetic only |
| Co op | Superlinear rewards (N to the power 1.5) plus fleet bonus and roles | Elite Dangerous CGs, Koster trust spectrum | Shared XP only |
| Anti bullying | Punch down penalty, bounties, shields, safe ports, zones, parley | Clash of Clans, Albion, Travian critique | Players police themselves |
| Season | 28 Tides, then reset with cosmetic legacy. Season 0, the beta, is 14 Tides | Neptune's Pride month, Kingdom of Loathing ascension | Persistent endless world |
| Stack | Phaser 4 for map and replays only, Preact for UI, shared TypeScript engine, Supabase Edge Functions and pg_cron | Supabase limits, team skills | All UI inside Phaser |

**Plan in one line.** Build the beta solo, then run **Season 0**: a two week beta of 14 Tides for six friends, with one map, sloop and brigantine, trade, NPC hunting, PvP with battle plans, upgrades, a daily Tide, simple replays and Discord announcements. A second developer joins after Season 0, and the full 28 Tide season comes after that.

**Biggest risks.** Scope creep, a solo build that runs long, the code getting tangled once a second developer joins, a runaway leader, and friends drifting away after week one. Each has a mitigation in section 17.

# 1. Vision

## 1.1 Pitch

You are a small time captain in the Brine, a warm archipelago of rum ports, reefs and rumours. You start with a leaky sloop and 120 doubloons. Each day you decide one voyage: run sugar to a port that pays double, hunt a fat merchant spotted off Gullrock, explore a wreck, or shadow your friend's ship and see what they are up to. At the Tide, the sea moves all at once. Sometimes you come home rich. Sometimes your best friend was waiting behind the reef with a better plan. Either way, tomorrow you go again, a little stronger, and the group has a new story.

## 1.2 Target feeling

* During the day: "What is everyone going to do tonight?"
* At the Tide: "Watch the replay, I called it!"
* Over a week: "Our fleet is finally strong enough for the galleon."
* At season end: "Same time next month?"

## 1.3 Pillars and what they rule out

| Pillar | Means | Rules out |
|-|-|-|
| Two minutes a day, a story every night | Every session has a meaningful choice and ends with Ready. The Tide Report is a story, not a spreadsheet. | Anything that rewards checking more than twice a day. Upkeep chores. Timers shorter than a night. |
| Together is better | Fleets earn about 1.6 to 1.9 times what solo captains earn. Some prizes need two or three ships. | Solo being unviable. Rewards that shrink when shared. |
| Fair fights, soft falls | Outcomes come from stats plus reading your opponent. You lose at most part of what you carry, and you are back at sea the next day. | Losing upgrades or your ship. Being farmed while asleep. Fights decided before they begin. |

# 2. Aesthetic and vibe

## 2.1 Art style

**Decision: chunky top down pixel art on 16 by 16 tiles, ships 32 to 64 pixels, one locked palette (Endesga 32).**

* Evidence: Monkey Island fans' attachment to pixels (R6.1); free CC0 pirate packs exist in this style (R6.3); Endesga 32's warm rust to cream range suits wood, sand, gold and sunsets, and it has enough blues and teals for a game that is mostly water.
* Alternative: PICO 8's 16 colours. Faster to draw in and very readable, but the sea would feel flat. Good for the first prototype week if art slows you down.

Concrete rules:

* World map: 16 by 16 tiles, animated water (4 frame loop), islands as hand placed tiles. The map is a pretty background; the playable nodes (ports, reefs, wrecks) sit on top as clear icons with dotted sea lane lines between them.
* Ships: sloop 32 by 32, brigantine 48 by 48, frigate 64 by 64. Sail colour and flag are player cosmetics (palette swaps, cheap to make).
* Replays: internal resolution 320 by 180, scaled up by whole numbers only (pixel perfect). Two ships side on, cannon smoke puffs, splash columns, grappling lines, a little crew of 4 pixel sailors that cheer or panic.
* Recolour every asset into Endesga 32 with one script before it enters the repo. Mixed palettes are the fastest way to look cheap.

Palette roles (Endesga 32, verify values against Lospec before locking):

| Role | Hex |
|-|-|
| Deep sea | `#124e89`, `#262b44` |
| Shallows and highlights | `#0099db`, `#2ce8f5` |
| Sand and parchment | `#ead4aa`, `#e4a672` |
| Wood | `#b86f50`, `#733e39`, `#3e2731` |
| Gold and coins | `#feae34`, `#fee761` |
| Jungle | `#63c74d`, `#3e8948`, `#265c42` |
| Danger, blood, bounty | `#e43b44`, `#a22633` |
| UI ink and night | `#181425`, `#3a4466` |
| Foam, sails, text on dark | `#ffffff`, `#c0cbdc` |

## 2.2 UI feel

* Parchment panels on dark wood frames, like a captain's desk at night. Pixel Frog's wood and paper UI kit is the starting point.
* Phone first. Menus, forms and the Tide Report are normal HTML styled to look pixel, so they reflow on any screen. Only the map and battle replays are canvas.
* Fonts: a pixel font for headings and numbers (Daniel Linssen's free m5x7 or m6x11, or Google's Pixelify Sans), rendered at whole number sizes. Long text uses the same font at a readable size; test on a small phone in sunlight.
* Every number that goes up gets a tiny celebration: coins arc into the chest, the stat bar ticks, a "ding" plays.
* The orders screen reads like a sentence: *"Sail to **Gullrock Shoals**, **Hunt merchants**, fight with **Broadside, Outmaneuver, Board**, parley if they are **50% stronger**."*

## 2.3 Music and sound

**Decision: shanty flavoured chiptune with a slightly rough folk feel, short stings for battle, and one signature Tide jingle.**

* Evidence: Sea of Thieves' worn instruments and stings that do not push players into fights; Flinthook's clear melodies, shop shanty and satisfying coins; Black Flag's crew shanties (R6.2).
* Alternative: no music, ambience only (waves, gulls, creaking). Cheaper, and honestly fine for the MVP if nobody on the team can make music.

Concrete plan:

* Four loops, 60 to 90 seconds each: **Port** (relaxed shanty, accordion and whistle), **Open Sea** (rolling 6/8 rhythm), **Tide Report** (hopeful, builds slowly), **Danger** (low drums, used only on the map when a hunter is adjacent).
* Battle replays use stings only: a drum roll when plans are revealed, a brass hit for a won round, a sad trombone slide for a struck flag.
* The **Tide jingle**: a 3 second motif (bell plus fanfare) that plays when the Tide resolves and in every notification. It becomes the group's Pavlovian bell.
* Tools with no budget: BeepBox or jummbox in the browser for music, jsfxr for sound effects, freesound.org CC0 for waves and gulls.
* Audio starts muted until the first tap (browsers require it anyway) and remembers the choice.

## 2.4 Tone and humour

* Warm, cheeky, a bit absurd. Think Monkey Island and Kingdom of Loathing, not grimdark (R6.1, R2.5).
* Every item, event and NPC gets one joke at most, in one or two short lines. *"A Suspiciously Damp Map. Someone has clearly sat on it."*
* No toilet humour (the main complaint about Pixel Piracy, R1.6), no cruelty, no real world colonial villains. The antagonists are the stuffy Admiralty, sea monsters and each other.
* Pirate speak in labels only: doubloons, Struck Colours, Parley, Shore Leave. A glossary tooltip explains each term once.
* Players write their own flavour: ship name, flag, and a one line **Parting Shot** taunt shown in replays when they win. This is the cheapest content in the game and the most loved.

# 3. Core loop

## 3.1 One session (2 to 5 minutes)

1. **Tide Report.** Opens automatically if a Tide has happened since your last visit. Headlines first ("The Wet Sock was boarded off Gullrock!"), then your own log, then a button per battle replay.
2. **Port or Sea view.** If docked: sell cargo, buy cargo, repair, buy upgrades, contribute to your next hull. These happen instantly, which gives the session a quick reward.
3. **Orders.** Pick a course (up to your speed in hops), an intent, your 3 round battle plan and your parley threshold. A preview shows the route, any visible NPCs, and danger zones.
4. **Talk.** Check the group chat, plot with your fleet, make promises you may or may not keep.
5. **Ready.** Press the big Ready button. If everyone is Ready, the Tide turns early.

## 3.2 One day

| Time (Europe/Bucharest) | What happens |
|-|-|
| 21:00 | Tide resolves. Discord post with headlines and a link. |
| 21:00 to 23:00 | Peak chatter: replays, gloating, revenge plans. |
| Next day, any time | Players check in, trade, set orders. |
| 18:00 | Reminder to anyone not Ready: "The tide turns in 3 hours." |
| 20:30 | Last call to anyone still not Ready. |
| Any time | If every active captain is Ready, the Tide turns immediately (at most once per day, then the next one is at 21:00 the following day). |

## 3.3 One week (7 Tides)

| Tide in week | Beat |
|-|-|
| 1 | **Trade Winds.** Market prices reshuffle; one port has a boom. Weekly fleet contracts are posted (V2). |
| 3 | **Rumours.** A message in a bottle hints where the galleon will appear. |
| 6 | **Galleon sighted.** Location announced one Tide ahead so fleets can gather. |
| 7 | **Galleon Tide.** The weekly co op prize resolves. Weekly awards and a Discord recap post. |

## 3.4 One season (28 Tides)

| Week | Name | What changes |
|-|-|-|
| 1 | Calm Seas | Low prices, weak NPCs, PvP rewards reduced by half while everyone learns. Fleets form. |
| 2 | Trade Winds | Full PvP. Brigantines appear. First fleet rivalries. |
| 3 | Blood in the Water | The Maw opens (dangerous outer waters with the best loot). Navy patrols hunt bounties. |
| 4 | The Kraken's Wake | Season finale: everyone feeds a community goal; Tide 28 is a group boss fight. Exact scores hidden for the last 3 Tides. |

Week 1 is deliberately gentle, following Cook's advice to keep early interactions non zero sum and introduce cutthroat choices after bonds form (R4.1).

## 3.5 Season 0: the two week beta

Season 0 is the first real test with your friends. It is half the length and about half the content of a full season, and it exists to answer one question: do these six friends want to keep playing? One developer builds it. A second developer joins after it (section 19.2).

| | Season 0 (beta) | Full season (Season 1 onward) |
|-|-|-|
| Length | 14 Tides, two weeks | 28 Tides, four weeks |
| Hulls | Sloop and Brigantine | Adds the Frigate |
| Progression costs | 0.67 times (upgrades and hulls) | 1.0 times |
| Zones | Crown and Free Waters | Adds the Maw |
| Week 1 | Calm Seas (PvP loot halved) | Same |
| Week 2 | Trade Winds (full PvP) | Same |
| Weeks 3 and 4 | None | Blood in the Water, the Kraken's Wake |
| Co op prizes | Treasure Galleon on Tides 7 and 14 | Galleon on Tides 7, 14 and 21, Kraken on Tide 28 |
| Finale | Tide 14 galleon, then the final Legend reveal | The Bell and the Kraken |
| Fog of Legend | Off | Last 3 Tides |
| Story | None, just the sea | Old Grimbeard |

Calm Seas halves PvP loot, so Season 0 has only 7 Tides of full PvP. That is enough for a first test of the fairness rules.

**Why progression costs are 0.67 times.** A season half as long needs its milestones to arrive earlier. In simulation (400 runs per row), at full costs a solo trader reaches the Brigantine on Tide 11 of 14, so the first big milestone would land in the last three days of the beta. At 0.67 times:

| Captain | Brigantine (median Tide) | Frigate, if it existed | Earned by Tide 14 |
|-|-|-|-|
| Solo trader | 8 | Not reached | about 3,100 |
| Solo raider | 8 | Reached by 17% on Tide 14 | about 2,900 |
| Fleet of 2 | 7 | Tide 14 | about 4,700 |
| Fleet of 3 | 7 | Tide 13 | about 5,500 |

The longest stretch without an upgrade is about 1 Tide for every captain type, and a solo trader who misses Tides 5 to 7 still reaches the Brigantine on Tide 10 and earns about 85% of what an unbroken captain earns. Fleets of 2 or 3 could afford a Frigate on Tides 13 and 14, so leave the Frigate out of Season 0 and let them keep buying upgrades. If you want a finale carrot, build it and enable it for fleets only.

Season 0 pacing (solo trader and fleet of 3, averages):

| Tide | Solo income | levels | PR | hull | Fleet of 3 income | levels | PR | hull |
|-|-|-|-|-|-|-|-|-|
| 1 | 97 | 5.0 | 11.2 | Sloop | 116 | 5.0 | 11.2 | Sloop |
| 2 | 113 | 6.9 | 11.5 | Sloop | 136 | 7.7 | 11.7 | Sloop |
| 3 | 130 | 9.2 | 12.2 | Sloop | 156 | 10.2 | 12.4 | Sloop |
| 4 | 134 | 10.8 | 12.4 | Sloop | 164 | 11.0 | 12.4 | Sloop |
| 5 | 150 | 11.6 | 12.6 | Sloop | 182 | 11.7 | 12.6 | Sloop |
| 6 | 158 | 12.0 | 12.7 | Sloop | 190 | 12.5 | 13.3 | Sloop |
| 7 | 163 | 12.8 | 13.8 | Sloop | 762 (galleon) | 20.1 | 20.0 | Brigantine |
| 8 | 186 | 14.5 | 18.1 | Brigantine | 354 | 21.1 | 20.1 | Brigantine |
| 9 | 280 | 17.4 | 18.9 | Brigantine | 390 | 22.0 | 20.4 | Brigantine |
| 10 | 313 | 20.3 | 20.0 | Brigantine | 406 | 22.9 | 20.7 | Brigantine |
| 11 | 324 | 21.1 | 20.1 | Brigantine | 409 | 23.8 | 21.1 | Brigantine |
| 12 | 352 | 21.9 | 20.3 | Brigantine | 427 | 24.7 | 21.4 | Brigantine |
| 13 | 362 | 22.7 | 20.7 | Brigantine | 437 | 25.9 | 28.0 | Frigate |
| 14 | 374 | 23.6 | 21.0 | Brigantine | 1,355 (galleon) | 32.4 | 31.7 | Frigate |

The fleet rows for Tides 13 and 14 show a Frigate because the simulation allowed one. Without a Frigate in Season 0 those two rows would show a Brigantine with extra upgrades instead (not simulated).

**What Season 0 must tell you.** These bars are suggestions, not evidence based, so change them if they do not fit your group:

* Captains submit orders on at least 7 of every 10 Tides.
* Every Tide resolves on time with no hand fixes to the data.
* At least four of the six want another season.
* At least one fight and one galleon run get talked about in the group chat without prompting.
* After Tide 14, ask everyone three questions: what was confusing, what was boring, and what would you change first.

Season 0 runs on the same engine as a full season. Its differences live in `SEASON_PRESETS` (section 14), so nothing is hardcoded.

# 4. World and map

## 4.1 Structure

**Decision: the sea is a graph of named nodes joined by sea lanes, drawn over a pretty pixel map. Ships move from node to node.**

* Evidence: Neptune's Pride and Subterfuge use stars and outposts joined by travel paths; Diplomacy uses provinces. Graphs make simultaneous movement, interception and fog of war simple and testable. Cook's density advice (R4.1): about 6 nodes per player keeps ships bumping into each other without crowding.
* Alternative: free movement on a tile grid. More "sailing" feel, but pathfinding, collision and interception rules get much harder to build, balance and explain.

## 4.2 The MVP map: the Brine (36 nodes)

| Node type | Count | Purpose |
|-|-|-|
| Port | 6 | Safe harbour. Trade, repairs, upgrades, banking. No combat ever. |
| Open sea | 16 | Lanes and junctions where hunters lurk. |
| Island | 8 | Explore for events, treasure, castaways. |
| Wreck | 5 | Explore for salvage and plunder, sometimes haunted. |
| Fort | 1 | Admiralty fort. Scenery in MVP, co op raid target in V2. |

Ports and their goods (three goods in MVP: Rum, Sugar, Spice):

| Port | Zone | Makes (cheap) | Wants (dear) |
|-|-|-|-|
| Port Regal | Crown | Sugar | Rum |
| Saint Brine | Crown | Spice | Sugar |
| Rumhaven | Free | Rum | Spice |
| Gullrock | Free | Spice | Rum |
| Driftwood Key | Free | Sugar | Spice |
| Last Lantern | Maw edge | nothing | everything, at a premium |

Ports sit 2 to 4 hops apart, so a sloop (speed 2) completes a trade leg in 1 or 2 Tides. The profitable routes deliberately cross Free waters, where hunters wait.

## 4.3 Zones

| Zone | Rules | Rewards |
|-|-|-|
| Crown Waters (around Port Regal and Saint Brine) | Hunting a player is allowed but automatically earns a bounty, and plunder taken is halved. Navy patrols from week 3. | Lowest. Safe trade routes. |
| Free Waters (most of the map) | Normal rules. | Normal. |
| The Maw (outer edge, opens week 3) | Storms (random hull damage), sea monsters, no ports except Last Lantern on the edge. | Loot and event rewards times 1.5. |

Players choose their risk by where they sail, like Albion's zones (R5.2), rather than by toggling a PvP flag. The MVP has only Crown and Free Waters; Last Lantern works as a remote Free port until the Maw opens in V2.

## 4.4 Movement and encounters

Each Tide resolves like this. These rules go into the engine exactly as written.

1. **Courses.** Every ship has a course: a list of adjacent nodes, no longer than its speed. An empty course means stay put.
2. **Steps.** Movement happens in up to 3 steps. In each step every ship with course left moves one hop.
3. **Meetings.** After each step, two ships meet if they are on the same node, or if they swapped nodes along the same lane in that step.
4. **Encounters.** A meeting becomes an encounter only if at least one ship is Hunting and its target filter matches the other ship, and the other ship is not protected (docked, or under a shield).
5. **Escape roll.** The hunted ship tries to slip away (formula in section 14). If it escapes, both continue.
6. **Battle.** Otherwise the ships fight (section 7). Everyone in an encounter stops moving for the rest of the Tide. Fleet mates on the same node who are Hunting or Escorting join their side.
7. **Exploration.** A ship that ends its course on an island or wreck with the Explore intent, and did not fight, draws an event.
8. **Docking.** A ship that ends on a port docks: its plunder is banked, its hull is repaired (for a fee), and it can trade next session.
9. **Order.** Encounters resolve in step order, then by node id, using the Tide's stored random seed, so any Tide can be replayed exactly.

## 4.5 Intents

| Intent | Effect |
|-|-|
| Trade Run | Default. Does not start fights. Normal escape chance. |
| Sail Quietly | Better escape chance. Cannot hunt or explore. |
| Hunt | Starts fights with whatever matches your filter: merchants only, players only, anyone, or one named captain. |
| Explore | Draws an event if you end on an island or wreck. |
| Escort | Copies a fleet mate's course and joins any battle they are in. |

## 4.6 NPC ships

NPCs keep the world alive when friends are quiet (BBS lesson, R2.4) and give peaceful players a way to fight without PvP.

| NPC | Where and when | Habit (shown in the in game bestiary) | Carries |
|-|-|-|-|
| Small Trader | Trade lanes, every Tide | Outmaneuvers 60% of the time | 10 cargo units |
| Fat Merchant | Trade lanes, every Tide | Outmaneuvers, then boards | 30 cargo units |
| Navy Patrol | Crown Waters, week 3 onward | Broadside 60% of the time; hunts captains with bounties | small purse, clears bounties |
| Treasure Galleon | Weekly, announced a Tide ahead | Broadside, Board, Broadside | the weekly co op prize |
| Sea Serpent | The Maw, week 3 onward | Boards (wraps around you) 60% of the time | salvage and trinkets |

Each Tide the server spawns roughly 0.75 merchants per player on lanes between ports, visible on the map one Tide ahead, so captains can race each other to the same prize. If two hunters reach the same merchant, they share it in proportion to damage dealt, unless one of them is also hunting players.

# 5. Ships and progression

## 5.1 Stats

Every ship has five stats. Each maps to one thing so players can read a build at a glance.

| Stat | Does |
|-|-|
| Hull | Hit points. |
| Cannons | Damage when you Broadside. |
| Sails | Damage when you Outmaneuver; escape chance; +1 speed at level 5. |
| Crew | Damage when you Board; patches 10% hull per Tide at sea. |
| Hold | Cargo capacity, which caps both trade profit and how much loot you can carry off. |

**Power Rating (PR)** summarises a ship in one number: a fresh sloop is 10. It is shown on every ship's name tag so nobody is surprised by who is strong.

## 5.2 Hulls

| Hull | Stat multiplier | Base hold | Speed | Cost |
|-|-|-|-|-|
| Sloop | 1.0 | 10 | 2 | Starting ship |
| Brigantine | 1.35 | 16 | 2 | 600 doubloons |
| Frigate | 1.8 | 24 | 3 | 2,400 doubloons |

Upgrade levels carry over when you change hull, so nothing bought is ever wasted. A new hull is paid in instalments to the **Shipwright** at any port: a progress bar you feed whenever you are docked. That turns saving into visible progress instead of a dry spell, which the simulation showed was the biggest pacing problem.

A fourth hull (Galleon, or a captured prize ship) is a V2 or Dream feature.

## 5.3 Upgrades

Each stat has levels 0 to 10. Each level adds 12% of the hull's base value (linear benefit). Costs grow 35% per level (exponential cost), following idle game math (R3.1).

| Level bought | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-|-|-|-|-|-|-|-|-|-|-|
| Cost | 60 | 81 | 109 | 148 | 199 | 269 | 363 | 490 | 662 | 894 |

Maxing one stat costs about 3,270 doubloons; maxing all five costs about 16,400, which no one reaches in a 28 Tide season. That is intentional: there is always a next purchase.

## 5.4 Loot items (V2)

Three **trinket** slots. Trinkets drop from exploration and NPC wins (about 15% of the time).

| Rarity | Bonus | Example |
|-|-|-|
| Common | +3% to one stat | *Lucky Barnacle* |
| Fine | +6% to one stat | *Grandma's Spyglass* |
| Rare | +10% and a quirk | *Parrot of Questionable Loyalty*: +10% Board, but 1 time in 10 it shouts your first maneuver to the enemy |
| Cursed | +15% with a real downside | *The Damp Doubloon*: +15% loot, your ship is always visible to hunters |

Total trinket bonus caps at +30%, so items add flavour and choices without breaking the PR curve.

## 5.5 Pacing for the first 20 Tides

These numbers come from a simulation of the formulas in section 14 (300 runs per archetype, greedy spending, 70% of income into the Shipwright once saving starts). They are averages; luck moves individual players a little either way. Season 0 uses the same formulas with progression costs at 0.67 times (section 3.5).

| Tide | Solo trader: income | levels | PR | hull | Fleet of 3: income | levels | PR | hull |
|-|-|-|-|-|-|-|-|-|
| 1 | 97 | 3.0 | 10.6 | Sloop | 116 | 3.4 | 10.7 | Sloop |
| 2 | 113 | 5.0 | 11.2 | Sloop | 136 | 5.3 | 11.2 | Sloop |
| 3 | 118 | 6.2 | 11.3 | Sloop | 146 | 7.2 | 11.6 | Sloop |
| 4 | 134 | 8.0 | 11.8 | Sloop | 161 | 9.2 | 12.1 | Sloop |
| 5 | 139 | 9.8 | 12.3 | Sloop | 167 | 10.6 | 12.4 | Sloop |
| 6 | 145 | 10.2 | 12.4 | Sloop | 184 | 11.1 | 12.4 | Sloop |
| 7 | 152 | 10.7 | 12.4 | Sloop | 749 (galleon) | 13.8 | 17.9 | Brigantine |
| 8 | 162 | 11.2 | 12.5 | Sloop | 321 | 16.1 | 18.4 | Brigantine |
| 9 | 175 | 11.6 | 12.6 | Sloop | 364 | 18.7 | 19.4 | Brigantine |
| 10 | 180 | 12.2 | 13.1 | Sloop | 376 | 20.8 | 20.0 | Brigantine |
| 11 | 188 | 13.3 | 17.1 | Brigantine | 401 | 21.3 | 20.1 | Brigantine |
| 12 | 288 | 15.6 | 18.4 | Brigantine | 426 | 21.9 | 20.4 | Brigantine |
| 13 | 324 | 17.8 | 19.1 | Brigantine | 434 | 22.7 | 20.7 | Brigantine |
| 14 | 345 | 19.9 | 19.9 | Brigantine | 1,123 (galleon) | 24.3 | 21.3 | Brigantine |
| 15 | 359 | 20.8 | 20.0 | Brigantine | 462 | 24.9 | 21.6 | Brigantine |
| 16 | 384 | 21.3 | 20.1 | Brigantine | 471 | 25.4 | 22.4 | Brigantine |
| 17 | 400 | 21.9 | 20.3 | Brigantine | 525 | 27.1 | 29.4 | Frigate |
| 18 | 409 | 22.6 | 20.6 | Brigantine | 791 | 29.9 | 30.8 | Frigate |
| 19 | 422 | 23.2 | 20.9 | Brigantine | 823 | 32.2 | 31.6 | Frigate |
| 20 | 428 | 23.8 | 21.1 | Brigantine | 886 | 34.5 | 32.8 | Frigate |

What the simulation says, in plain words:

* **Tide 1 feels good:** the starting 120 doubloons plus the first haul buy three upgrades immediately.
* **Something to buy almost every Tide:** the longest stretch without an upgrade is about 2 Tides (median), and the Shipwright bar moves even then.
* **Hull milestones:** solo captains reach the Brigantine around Tide 11 and the Frigate around Tide 23. A fleet of two reaches them around Tides 8 and 18; a fleet of three around Tides 7 and 17.
* **Co op pays:** over 28 Tides a solo trader earns about 10,400 doubloons, a fleet of two about 16,600 each (1.6 times), a fleet of three about 19,600 each (1.9 times). The simulation pays every fleet the full weekly galleon prize; real two ship fleets will sometimes only win half, so expect them a little lower.
* **Power stays close enough:** the biggest gap between a fleet member and a solo captain is about 1.6 times PR (Tides 20 to 22), and it narrows again as solo captains reach their Frigate. Wealth and Legend diverge much more than power, which is the point: co op makes you richer and more famous, not unbeatable.
* **Raiders are viable:** a captain who mostly hunts merchants ends the season at about 90% of a trader's earnings with more variance, before counting PvP loot and bounties.
* **Missing days is not fatal:** a captain who missed Tides 6 to 8 ends the season at about 93% of an unbroken solo captain's earnings, thanks to Shore Leave (section 12).

# 6. Economy

## 6.1 Currencies

| Currency | Where it lives | At risk? | Used for |
|-|-|-|-|
| Doubloons in the **Chest** | Banked, usable at any port | Never | Upgrades, Shipwright, repairs, cargo |
| **Plunder** | On your ship | Yes, until you dock | Becomes Chest gold when you dock |
| **Cargo** (Rum, Sugar, Spice) | In your hold | Yes | Sold at ports for profit |
| **Legend** | Your score | Never | Ranking, titles, Hall of Legends |
| Map fragments (V2) | Your ship | Yes, on a decisive defeat | Digging up the season's great hoard |

Two currencies the player spends (doubloons and cargo) and one score. Everything else waits for V2. One good game beats two great ones (R1.3).

## 6.2 Sources and sinks

| Sources | Sinks |
|-|-|
| Trade profit | Upgrades (the main sink) |
| Merchant prizes | Shipwright instalments |
| Exploration events | Repairs |
| Weekly galleon (co op) | Parley tribute |
| PvP plunder and bounties | Bell donations in the finale |
| Weekly awards | Market impact (selling a lot lowers your own price) |

The **Boom** multiplier raises all prices and prizes by 4% per Tide (about 2.1 times by Tide 28), so income keeps pace with rising upgrade costs and the late season feels like a gold rush. Because every sink is a purchase that ends at season reset, inflation cannot build up across seasons (the problem that hurt Puzzle Pirates, R1.1).

## 6.3 Trade

* Base price 20 doubloons per unit, times the Boom.
* A port's made good sells at 0.6 times base; its wanted good buys at 1.6 times base; the third good trades at base.
* Every unit sold at a port lowers that port's price for that good by 1.5% until the next Tide; each Tide prices drift halfway back to normal. Buyers always pay the normal price, so selling a lot and buying it back cheaper never pays. Two captains dumping rum on the same port both earn less, which gives friends a reason to coordinate routes or race each other.
* The Trade Winds beat (week start) gives one random port a boom (its wanted good at 2 times base for that week).
* Typical profit is 8 to 15 doubloons per unit per leg, more for long or dangerous routes.

## 6.4 Legend (the score)

* 1 Legend per 10 doubloons of profit banked (trade margin and plunder, not gross sales).
* 10 Legend per NPC battle won, 25 per PvP battle won (scaled by the fairness factor in section 9).
* 40 Legend for taking part in a co op prize (galleon, Kraken).
* 30 Legend for each weekly award.
* Donations to the finale Bell count as banked profit, so helping the group never costs you score.

# 7. Combat and PvP

## 7.1 Battle plans

**Decision: battles are three rounds. Each captain secretly locks in a plan of three maneuvers before the Tide. The server resolves both plans at once and the client plays the result back as a short animation.**

* Evidence: Frozen Synapse's plan, commit and watch loop (R2.7); Sirlin's point that double blind commitment creates real reads and keeps weaker options useful (R5.3); Subterfuge's deterministic, previewable outcomes (R2.2); the BBS rule that absent players still defend (R2.4), here through a standing plan.
* Alternative: real time cannon aiming like Black Flag or the Plunder browser game. More visceral, but it needs everyone online, rewards reflexes and ping, and is far harder to build. It could return as an optional live mode in the Dream tier.

The three maneuvers form a triangle:

| Maneuver | Uses stat | Beats | Flavour |
|-|-|-|-|
| **Broadside** | Cannons | Board | You blast them as they try to close. |
| **Board** | Crew | Outmaneuver | Grappling hooks snag the fancy sailor at close range. |
| **Outmaneuver** | Sails | Broadside | You slip their broadside and rake their stern. |

Rules that keep it interesting rather than a coin flip:

* **Builds create tells.** A ship with big cannons wants to Broadside, so opponents expect it, which makes Outmaneuver tempting, which makes Board tempting. These are Sirlin's yomi layers.
* **Repetition is punished.** Using the same maneuver as the previous round does 20% less damage (move staling, R5.3).
* **Information exists.** Every battle replay is public, so everyone can study a captain's habits. NPC habits are printed in the bestiary. Weather and V2 scouting add more.
* **No round decides everything.** A won round doubles your damage and halves theirs; it never ends the fight on its own.
* **Standing plan.** Each captain has a default plan used whenever they do not set one, so absent captains still defend themselves.

## 7.2 Resolving a battle

Each round both ships hit at the same time:

`damage = 22 * (stat / 10) ** 0.6 * matchup * staleness * luck`

* `stat` is the stat for the maneuver used (Cannons, Sails or Crew).
* `matchup` is 2.0 if your maneuver beats theirs, 1.0 on a tie, 0.5 if it loses.
* `staleness` is 0.8 if you repeated last round's maneuver, otherwise 1.0.
* `luck` is a seeded random number between 0.9 and 1.1.
* The 0.6 exponent softens raw stat advantages so reads matter. Hull still scales fully with upgrades.

After any round in which a hull reaches zero, the battle ends. Outcomes:

| Outcome | Condition | Loser gives up |
|-|-|-|
| Decisive | A ship's hull reached zero (it Strikes its Colours) | 40% of plunder and cargo |
| Victory | After 3 rounds, one side dealt at least 10 percentage points more damage (as a share of the other's max hull) | 20% of plunder and cargo |
| Draw | Otherwise | Nothing |

Loot is then multiplied by the fairness factor (section 9) and capped at 600 times the Boom per battle. What the loser gives up is exactly what the winner takes; nothing is destroyed.

A ship that Strikes its Colours is towed to the nearest friendly port, arrives docked at the next Tide with its hull half patched for free, and is **never** out for more than one Tide. Its upgrades, hull and Chest are untouched.

## 7.3 What the numbers do (simulated)

6,000 simulated battles per row with random plans:

| Power ratio | Stronger ship wins | Decisive results |
|-|-|-|
| Equal | 40% each, 20% draws | about 30% |
| 1.25 to 1 | 64% | about 30% |
| 1.5 to 1 | 79% | about 40% |
| 2 to 1 | 92% | about 60% |

A weaker ship (1 to 1.25) that correctly reads an opponent who favours one maneuver wins about 60% of the time. Power matters, reads matter, and nothing is certain until two captains are twice apart.

## 7.4 Worked example

The *Salty Gull* (Cannons level 1, so Cannons 11.2; everything else at 10; hull 100) is Hunting at Gullrock Shoals and meets the *Wet Sock*, a fresh sloop. Luck is ignored here.

| Round | Gull plays | Sock plays | Gull deals | Sock deals |
|-|-|-|-|-|
| 1 | Broadside | Board | 22 x 1.07 x 2.0 = 47.1 | 22 x 1.0 x 0.5 = 11.0 |
| 2 | Outmaneuver | Board (repeated) | 22 x 1.0 x 0.5 = 11.0 | 22 x 1.0 x 2.0 x 0.8 = 35.2 |
| 3 | Board | Broadside | 22 x 1.0 x 0.5 = 11.0 | 22 x 1.0 x 2.0 = 44.0 |
| Total | | | 69.1 (69% of Sock's hull) | 90.2 (90% of Gull's hull) |

The Sock dealt 21 points more, so it wins a **Victory**. The Gull carried 150 doubloons of plunder; the Sock takes 20%, times an underdog factor of 1.03 (the Sock was slightly weaker), which is 31 doubloons. The replay shows the plans revealed one round at a time, and the Sock's Parting Shot appears over the Gull's smoking deck.

## 7.5 Fleet battles

* Each side has a **flagship**: its highest PR ship (ties go to whoever started the hunt).
* Every captain still uses their own plan. Each round, your ship's matchup is judged against the enemy flagship's maneuver, and vice versa. Talking through plans with your fleet helps, but no one can play your ship for you, which limits quarterbacking (R4.3).
* A side's damage is the sum of its ships' damage, times the **fleet bonus** (+10% per extra ship, up to +30%).
* Damage a side receives is split across its ships in proportion to their max hull.
* An outnumbered side of player ships gets **Desperate Defence**: +25% damage per extra enemy ship, up to +75%. NPC bosses built for fleets (galleon, Kraken) do not get it.

## 7.6 Parley

Every captain sets a parley threshold in their orders: off, "if they are 25% stronger", or "if they are 50% stronger". When a hunter that strong catches you, you pay 10% of your plunder and cargo as tribute and sail on. Hunters accept automatically unless they set **No Quarter**, and refusing parley against a weaker ship earns a bounty. Parley gives cautious players a cheap way out and gives hunters a reason not to waste a Tide.

## 7.7 Previews

The orders screen runs the shared engine 200 times in the browser to show a forecast: *"Against a typical Fat Merchant this plan wins about 6 times in 10."* Against players, the preview uses their last three public plans. This is Subterfuge's time machine and Frozen Synapse's simulate button (R2.2, R2.7), and it teaches the triangle better than any tutorial.

# 8. Co op

**Decision: solo always works, fleets of 2 or 3 earn far more through a fleet bonus, superlinear shared prizes and (in V2) overlapping roles.**

* Evidence: Koster's survey ranks cooperating with friends at the top, finds 3 to 4 the sweet spot, and warns against designs where low trust players have nothing to do (R4.2); Cook's patterns for roles, recurring events and escalating reciprocity (R4.1); Windward's "own ship, sail together" model (R1.6); Elite Dangerous Community Goals (R4.4); Travian's lesson that alliances must matter (R2.6).
* Alternative: shared crews, where several friends run one ship like Puzzle Pirates or Sea of Thieves. Very strong teamwork, but in an async game it means one player's absence stalls the others, and it creates quarterbacking.

## 8.1 Fleets

* 2 to 3 captains in a six player game (cap: half the players, at least 2, at most 4).
* A fleet has a name, a flag and a colour that appears on its ships' sails.
* Fleet mates see each other's orders before the Tide (nobody else does).
* Fleet mates cannot hunt each other.
* Leaving a fleet takes effect at the next Tide and is announced publicly. Betrayal is possible, but the knife is visible for one Tide. Groups that want more drama can switch on **Mutiny Rules** (instant betrayal) in season settings.

## 8.2 How combined effort multiplies results

1. **Convoy bonus.** +10% to trade profit and prizes for each fleet mate who ends the Tide on the same or an adjacent node.
2. **Fleet bonus in battle.** +10% damage per extra fleet ship in the fight, up to +30%.
3. **Superlinear prizes.** Co op prizes pay `base * boom * N ** 1.5` in total, split evenly. Each captain's share compared with going alone:

| Captains sharing | Each captain's share |
|-|-|
| 1 | 1.00 times |
| 2 | 1.41 times |
| 3 | 1.73 times |

4. **Prizes that need a fleet.** The Treasure Galleon's PR is 2.8 times the median captain's PR, so it stays a fleet sized target all season. In simulation (20,000 fights each at Tides 7, 14 and 21) a lone ship never wins. Two ships that play against the galleon's printed habit win 75 to 87% of the time, but only 22 to 32% with careless plans. Three ships win 99% with good reads and about 80% without. A decisive sinking pays the full prize, a Victory pays half.
5. **Carrying it home.** Galleon loot is plunder, so the fleet must sail it back to port while rivals lurk. Co op success creates the next PvP story.

## 8.3 Roles (V2)

When a captain buys a Brigantine they choose a **rig**. Rigs overlap, so nobody is useless alone, but each adds something the fleet wants:

| Rig | Personal bonus | Fleet aura |
|-|-|-|
| Man o' War | +15% Cannons | Fleet Broadside +5% |
| Runner | +15% Sails | Fleet escape chance +10%; sees the first maneuver of hunters within 1 hop |
| Merchantman | +25% Hold | Fleet repairs 10% hull per Tide at sea; galleon loot is capped by fleet Hold, so this ship decides how much gets home |
| Boarder | +15% Crew | Decisive wins can also take a map fragment or trinket |

## 8.4 Shared projects (V2)

* **Fleet Cove.** A hidden island base. Members donate doubloons to tiered buildings: Dock (repairs 25% cheaper), Lookout (see intents of ships within 2 hops), Tavern (Shore Leave doubled), Vault (the Cove works as a safe port for the fleet), Shipwright (hull instalments 10% cheaper).
* **Contracts.** Weekly fleet tasks such as "deliver 40 Spice to Saint Brine and take 2 Fat Merchants within 3 Tides", paying Legend.
* **Gifts.** One gift of doubloons or cargo per Tide to a fleet mate, capped at 20% of the median Chest, to keep reciprocity without letting anyone funnel a friend to the top.

# 9. Anti snowball and anti bullying

**Decision: make bullying unprofitable rather than impossible, and make every loss recoverable.**

* Evidence: Clash of Clans shields (R5.1), Albion's risk zones (R5.2), Sea of Thieves' "only what you carry" (R1.2), the Travian critique of offline attacks (R2.6), Jaffe's gates and carrots for kingmaking (R5.4), and the rule that negative feedback must be recoverable (R5.5).
* Alternative: no rules, let the friend group police itself. Works for a few weeks in a close group; fails the moment one player is much more active or competitive than the rest, and it does not scale to strangers.

The rules:

1. **Fairness factor.** Loot and Legend from a PvP win are multiplied by `(loser PR / winner side PR) ** 2`, floored at 0.25, when the winner side is stronger. When the winner is weaker, the factor is `loser PR / winner PR`, capped at 1.5 (David's Due).
2. **Bounties.** Hunting a ship with less than two thirds of your side's PR, refusing parley against a weaker ship, or hunting in Crown Waters puts a bounty on you equal to the loot you took. Anyone who beats you collects it, paid by the Admiralty (new money, not taken from you). Bounties shrink 10% per Tide.
3. **Shields.** After you lose a PvP battle, players cannot hunt you for 2 Tides. Hunting a player yourself ends your shield early.
4. **Desperate Defence and loot splitting.** Ganging up still usually wins (three equal ships beat one about 96% of the time in simulation), but the loot is cut by the fairness factor and split three ways: each attacker takes about 3% of the victim's plunder instead of the 40% a fair one on one decisive win would pay, and all three collect bounties.
5. **Safe ports.** Docked ships cannot be attacked. Absent captains' standing orders keep them docked, so nobody is farmed while asleep.
6. **Only carried value is at risk.** Never upgrades, hulls or the Chest. Loot per battle is capped.
7. **Most Wanted.** The Legend leader is marked on everyone's map, Navy patrols prefer them from week 3, and beating the Most Wanted pays 50% more Legend. Being on top is fun and a little dangerous, like a Sea of Thieves emissary (R1.2).
8. **Fair Winds.** Captains below 70% of the median Legend get +20% income, shown as a friendly buff, never as pity.
9. **Diminishing returns by design.** Exponential costs mean leaders' progress slows naturally (section 5).
10. **Calm Seas week.** PvP loot is halved in week 1 while friendships and fleets form.
11. **Fog of Legend.** Exact scores are hidden for the last 3 Tides (ranks stay visible), which blunts kingmaking and last minute dogpiles.
12. **Many ways to shine.** Weekly awards: Most Feared, Merchant Prince, Best Shipmate, Sea Dog (exploration), and the Soggy Boot for the biggest blunder.
13. **Seasons end.** Any runaway leader is gone in at most four weeks.

# 10. World, events and story

## 10.1 Exploration events (MVP deck of 12)

Drawn when a ship ends on an island or wreck with the Explore intent. Weights shift by node type; the Maw multiplies rewards by 1.5.

| Event | Effect |
|-|-|
| Buried Chest | +80 to 160 plunder, times the Boom |
| Castaway | +10% Crew for your next battle |
| Monkey Thief | Lose 10% plunder, gain a monkey (cosmetic, it sits on your deck in replays) |
| Turtle Soup | Repair 30% hull |
| Rum Cache | +5 Rum in your hold |
| Cursed Coin | +120 plunder, but your luck range drops to 0.8 to 1.0 next battle |
| Message in a Bottle | Learn where next week's galleon appears |
| Old Wreck | +60 plunder and a 25% chance of a trinket (V2) |
| Reef Scrape | Lose 15% hull |
| Hermit Cartographer | Your next course may be one hop longer |
| Mermaid's Song | Your next Tide's escape chance +20% |
| Ghost Lantern | Nothing happens. Your crew will not stop talking about it. |

## 10.2 Weather (V2)

Forecast one Tide ahead for each zone: Fair; Fog (escape +20%); Storm (ships at sea lose 10% hull); Doldrums (speed 1 lower). The Maw is always stormy. Forecasts give planners an edge without needing more time online.

## 10.3 Season one story: the Last Voyage of Old Grimbeard

* **Hook.** The legendary pirate Old Grimbeard has died, and his hoard map was torn into six pieces. In V2 every captain starts the season holding one piece. Four pieces reveal the dig site.
* **Week 3.** The Admiralty arrives to claim the hoard, bringing Navy patrols and a fort.
* **Week 4.** The hoard turns out to be inside the Kraken's nest. Digging it up wakes the Kraken.
* **Finale.** Everyone rings the Bell at any port (donating doubloons, tiered at about 3,000, 6,000 and 10,000 total for six players). The tier reached weakens the Kraken and raises the reward. On Tide 28 every captain who ends at the Kraken's node fights it together under a truce. Each participant earns Legend by tier and by contribution bracket.
* **Map fragments** can be traded, gifted or taken on a decisive win (Boarder rig), which turns the whole season into a quiet tug of war of deals and betrayals.

Later seasons are new chapters with a new map and twist: *The Ghost Fleet*, *The Admiralty's Revenge*, *The Frozen North*.

## 10.4 Game master tools

One player (probably you) can act as game master from an admin page:

* Post a **Riddle Map**: a riddle whose answer is a node name. The first captain to Explore that node gets a chest. Ten minutes to write, a day of group chat buzz.
* Trigger a special event, adjust a balance value between Tides, compensate a player after a bug.
* Every admin action is logged and announced, so nobody suspects favouritism.

# 11. Async or real time?

## 11.1 Comparison for your group

| Question | Async daily Tide | Real time sessions |
|-|-|-|
| Fits six busy students on different schedules? | Yes. Play whenever, 2 to 5 minutes. | Only if all six are free at the same hour. Scheduling is the number one killer of friend group games. |
| Works on a phone on the bus? | Yes. Tap through menus. | Poorly. Steering and aiming on a touchscreen over mobile data. |
| PvP fairness | Secret simultaneous plans; no reflex or ping advantage; no 3am attacks. | Reflexes, ping and hours online decide fights; the most available player dominates. |
| How hard to build with Claude Code? | Low. Request and response, one scheduled job, a deterministic engine you can unit test. | High. Netcode, interpolation, lag compensation, desync bugs. Supabase has no authoritative game loop, so you would need another server (for example Colyseus) and somewhere to host it. |
| Hosting cost | Fits the Supabase free plan comfortably. | Needs an always on game server; free hosts sleep or cap hours. |
| Cheating | The server validates every intent. | Speed and aim hacks; much harder to police. |
| Growing to many players | Add more oceans of 6 to 12 captains each; cheap. | Matchmaking and concurrency become the main engineering problem. |
| Excitement | Daily anticipation, replays, chat drama. Lower adrenaline. | High adrenaline, great on voice chat. |
| When someone is away | Standing orders keep their ship safe. | The crew is one short; the session may not happen. |

## 11.2 Recommendation

**Decision: async, with one Tide per day at 21:00 Europe/Bucharest, resolving early when every active captain is Ready (at most once a day).**

* Evidence: Subterfuge was designed for busy people and two minute sessions (R2.2); Neptune's Pride's own turn based mode resolves when everyone submits or a deadline passes (R2.1); BBS door games ran on daily turns for years (R2.4); Edery's Travian critique shows real time pressure punishing people for sleeping (R2.6); Supabase's limits fit request and response play, not a 60 ticks per second loop (R7).
* Alternative: a weekly scheduled real time "Raid Night". Keep this as a Dream tier mode that reuses the same engine with Tides every 2 minutes instead of every day (Neptune's Pride notes that short deadlines let friends finish a whole game in an afternoon). Because the engine only cares about "resolve orders now", the same code supports both.

Why 21:00: late enough that everyone is home, early enough to watch replays and banter before bed. Make it a season setting.

# 12. Social glue

## 12.1 Where the group talks

**Decision: use the group's existing chat for the MVP, with a bot that posts the Tide Report and reminders. Build in game chat in V2.**

* Evidence: Travian players had to coordinate on outside forums, which Edery calls a weakness (R2.6), but for six friends who already share a chat, building chat first is wasted effort. Discord webhooks are free and need no bot hosting. WhatsApp has no free way for a bot to post into a group, so if your group lives on WhatsApp, a Telegram or Discord channel just for the game is the practical choice.
* Alternative: in game chat from day one (Supabase Realtime can do it within the free plan's 200 concurrent connections). Better for strangers later; not worth it for the first season.

## 12.2 Notifications and reminders

| When | Message | Channel |
|-|-|-|
| Tide resolves | Headlines plus a link, with the Tide jingle | Discord post, web push (V2) |
| 18:00 | "The tide turns in 3 hours. Anna and Mihai still have no orders." | Discord post (names only those not Ready) |
| 20:30 | "Last call." | Web push to those not Ready (V2) |
| You were attacked | "The Wet Sock was boarded!" | Web push (V2) |
| A fleet mate asks for an escort | "Mihai wants an escort to Gullrock." | Web push (V2) |

Notifications fire only for things that matter (R2.2). On iPhones, web push works only after the game is added to the home screen, so the onboarding screen should ask for that once with a picture of how.

## 12.3 Daily and weekly rituals

* **The Tide Report** is written like a pirate newspaper, the *Brine Gazette*: three headlines, the day's best battle, market news, a weather line, and one silly rumour.
* **Weekly awards** on Tide 7, 14, 21 and 28 with small cosmetic badges.
* **Parting Shots** in replays and **ship naming** give everyone a voice.
* **Hall of Legends** at season end: a permanent page with every season's winners, fleets, best battle replay and funniest event.

## 12.4 Catch up for missed Tides

* **Standing orders.** If you do not submit orders, your ship repeats a safe default: stay docked if in port; if at sea, sail Quietly to the nearest port. Your standing battle plan defends you.
* **Shore Leave.** Each Tide you miss stores one Tide of +50% income, up to 3, used automatically when you return. This is WoW's rested bonus framing (R3.2): coming back is rewarded, nobody is punished for having a life.
* **Fair Winds.** Captains below 70% of the median Legend get +20% income.
* **Late joiners.** A friend who joins mid season starts with doubloons equal to 60% of the median lifetime earnings and one hull below the median, so they can contribute to a fleet immediately.
* **Nothing decays.** No crew wages, no food, no rotting cargo. The Pixel Piracy lesson (R1.6).
* **Caretaker.** A captain absent for 5 Tides is marked "Ashore": their ship stays docked and they drop out of the Ready count so the group can still trigger early Tides.

# 13. Game length, end and reset

**Decision: 28 Tide seasons (four weeks), then a reset with persistent cosmetics and a Hall of Legends. Season 0, the beta, is 14 Tides (two weeks, section 3.5).**

* Evidence: Neptune's Pride games run about a month and exhaust some players by the end (R2.1); Subterfuge chose six to nine days so games neither end too fast nor exhaust (R2.2); Kingdom of Loathing's ascension shows resets with small meta rewards keep veterans coming back (R2.5); seasons cap any runaway leader (R5.4).
* Alternative: an endless persistent world with soft decay. Better for a large public game later; worse for six friends, because without an ending there are no stakes, no finale and no clean moment for new friends to join.

How a full season ends (Season 0 ends on the Tide 14 galleon instead, section 3.5):

1. Tide 28 is the Kraken fight. All PvP pauses at the Kraken's node.
2. Final Legend ranks are revealed with a dramatic reveal screen (scores were fogged for 3 Tides).
3. Titles: Pirate King or Queen (first), Admiral of the Fleet (best fleet total), plus the weekly award winners.
4. **What persists:** titles, cosmetic flags and sail colours earned, ship names, and Hall of Legends entries.
5. **What resets:** doubloons, upgrades, hulls, fleets and the map.
6. A one week **Shore Leave** break between seasons (optional), with a vote on next season's map and settings.

To continue rather than reset, a group can choose **Long Voyage** settings in V2: 56 Tide seasons with a mid season "storm" that halves everyone's levels above 5. It exists for groups that love their ships too much to sink them.

# 14. Economy and balance formulas

All tunable numbers live in one file, `balance.ts`, inside the engine. Nothing else in the codebase may contain a gameplay number. When you tune, follow Sid Meier's advice (R1.3): double or halve, never nudge by 5%.

```ts
// supabase/functions/_shared/engine/balance.ts
// Every gameplay number lives here. Change values, rerun tools/sim, then playtest.

export const B = {
  startGold: 120,

  movement: { steps: 3 },   // section 4.4: hops happen in up to this many steps per Tide

  upgrade: { baseCost: 60, growth: 1.35, statPerLevel: 0.12, maxLevel: 10 },
  baseStat: 10,     // Cannons, Sails and Crew on a level 0 sloop
  baseHull: 100,    // Hull points on a level 0 sloop
  hulls: {
    sloop:      { mult: 1.0,  hold: 10, speed: 2, cost: 0 },
    brigantine: { mult: 1.35, hold: 16, speed: 2, cost: 600 },
    frigate:    { mult: 1.8,  hold: 24, speed: 3, cost: 2400 },
  },
  sailsSpeedBonusAtLevel: 5,  // +1 speed, never above 3
  shipwrightShareHint: 0.7,   // UI suggestion only: put 70% of income into the next hull

  boomPerTide: 0.04,
  weekTides: 7,   // Tides per week: Calm Seas, the Trade Winds boom and the weekly galleon follow it

  combat: { k: 22, exponent: 0.6, win: 2.0, tie: 1.0, lose: 0.5, stale: 0.8,
            luckMin: 0.9, luckMax: 1.1, rounds: 3, victoryMargin: 0.10 },
  loot: { decisive: 0.40, victory: 0.20, capPerBattle: 600,
          crownWaters: 0.5, maw: 1.5, calmSeasWeek: 0.5,
          calmSeasLastTide: 7 },  // week 1 (Tides 1 to 7) halves PvP loot, section 9 rule 10
  fairness: { floor: 0.25, underdogCap: 1.5, bountyBelowRatio: 2 / 3, bountyKeepPerTide: 0.9 },
  fleet: { battleBonusPerExtraShip: 0.10, battleBonusCap: 0.30,
           desperatePerExtraEnemy: 0.25, desperateCap: 0.75,
           convoyPerMate: 0.10, coopExponent: 1.5 },
  escape: { quietMult: 1.3, min: 0.05, max: 0.75 },
  parley: { tribute: 0.10, thresholds: [1.25, 1.5] },
  shieldTidesAfterPvpLoss: 2,

  trade: { basePrice: 20, madeMult: 0.6, wantedMult: 1.6,
           priceKeptPerUnitSold: 0.985, weeklyBoomMult: 2.0,
           weeklyBoomFromWeek: 1 + 1,        // Trade Winds, from week 2 (section 3.5)
           lastLanternMult: 1.8 },           // "wants everything, at a premium" (section 4.2)
  repair: { costPerHullPoint: 0.3, crewPatchAtSea: 0.10, strikeFreePatch: 0.5 },

  npc: { merchantsPerPlayer: 0.75, prizeUnitValue: 19,
         fatMerchantShare: 1 / 3,            // of the merchants spawned each Tide
         merchantVictoryPays: 0.5,           // a Victory over a merchant pays this share of the cargo
         smallTrader: { prVsMedian: 0.8, cargo: 10, favourite: "outmaneuver", favouriteShare: 0.6 },
         fatMerchant: { prVsMedian: 1.3, cargo: 30, plan: ["outmaneuver", "board", "board"] },
         galleon: { prVsMedian: 2.8, basePrize: 250, victoryPays: 0.5,
                    plan: ["broadside", "board", "broadside"] } },

  catchUp: { shoreLeaveBonus: 0.5, shoreLeaveCap: 3,
             fairWindsBelowMedian: 0.7, fairWindsBonus: 0.2,
             lateJoinGoldShare: 0.6, ashoreAfterMissed: 5 },

  legend: { perGoldProfit: 0.1, npcWin: 10, pvpWin: 25, coopPrize: 40,
            weeklyAward: 30, mostWantedMult: 1.5 },
} as const;

// What differs between Season 0 (the beta) and a full season. Nothing else may hardcode these.
export const SEASON_PRESETS = {
  season0: { lengthTides: 14, progressionCostMult: 0.67, hullsEnabled: ["sloop", "brigantine"],
             galleonTides: [7, 14], fogOfLegendTides: 0, mawOpens: false, mutinyRules: false },
  full:    { lengthTides: 28, progressionCostMult: 1.0,  hullsEnabled: ["sloop", "brigantine", "frigate"],
             galleonTides: [7, 14, 21], fogOfLegendTides: 3, mawOpens: true, mutinyRules: false },
} as const;
```

The formulas, written so they can be copied into the engine:

```ts
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export const boom = (tide: number) => 1 + B.boomPerTide * tide;

// costMult comes from the season preset (0.67 in Season 0, 1.0 in a full season).
export const upgradeCost = (currentLevel: number, costMult = 1) =>
  Math.round(B.upgrade.baseCost * B.upgrade.growth ** currentLevel * costMult);

export const hullCost = (hull: HullId, costMult = 1) =>
  Math.round(B.hulls[hull].cost * costMult);

export const statValue = (hull: HullId, level: number) =>
  B.baseStat * B.hulls[hull].mult * (1 + B.upgrade.statPerLevel * level);

export const maxHullPoints = (hull: HullId, level: number) =>
  B.baseHull * B.hulls[hull].mult * (1 + B.upgrade.statPerLevel * level);

// Cargo units are whole, so the Hold a captain can fill rounds down.
export const holdUnits = (hull: HullId, level: number) =>
  Math.floor(B.hulls[hull].hold * (1 + B.upgrade.statPerLevel * level));

// What a cargo unit is worth to a looter (PvP loot and merchant prizes), with the Boom.
export const cargoValue = (units: number, tide: number) => units * B.npc.prizeUnitValue * boom(tide);

export const speed = (hull: HullId, sailsLevel: number) =>
  Math.min(3, B.hulls[hull].speed + (sailsLevel >= B.sailsSpeedBonusAtLevel ? 1 : 0));

// A fresh sloop has PR 10.
export const powerRating = (s: { hull: number; cannons: number; sails: number; crew: number }) =>
  (s.hull / 10 + s.cannons + s.sails + s.crew) / 4;

export const roundDamage = (stat: number, matchup: number, stale: boolean, luck: number) =>
  B.combat.k * (stat / 10) ** B.combat.exponent * matchup * (stale ? B.combat.stale : 1) * luck;

export const escapeChance = (targetSails: number, hunterSails: number, quiet: boolean) =>
  clamp((targetSails / (targetSails + hunterSails)) * (quiet ? B.escape.quietMult : 1),
        B.escape.min, B.escape.max);

export const fairnessFactor = (loserPR: number, winnerSidePR: number) => {
  const r = loserPR / winnerSidePR;
  return r < 1 ? Math.max(B.fairness.floor, r ** 2) : Math.min(B.fairness.underdogCap, r);
};

export const lootTaken = (carriedValue: number, outcome: "decisive" | "victory",
                          fairness: number, zoneMult: number, tide: number) =>
  Math.min(carriedValue * B.loot[outcome] * fairness * zoneMult, B.loot.capPerBattle * boom(tide));

export const fleetBattleBonus = (extraShips: number) =>
  1 + Math.min(B.fleet.battleBonusCap, B.fleet.battleBonusPerExtraShip * extraShips);

export const desperateDefence = (extraEnemyShips: number) =>
  1 + Math.min(B.fleet.desperateCap, B.fleet.desperatePerExtraEnemy * extraEnemyShips);

export const coopShare = (basePrize: number, tide: number, captains: number) =>
  (basePrize * boom(tide) * captains ** B.fleet.coopExponent) / captains;

export const price = (good: Good, port: Port, tide: number, drift: number) =>
  B.trade.basePrice * portMult(good, port) * boom(tide) * drift;
// After selling n units: drift = drift * B.trade.priceKeptPerUnitSold ** n
// Each Tide:             drift = (drift + 1) / 2   (halfway back to normal)
// A buyer always pays the price with drift = 1. Only sellers feel the drift (see docs/DECISIONS.md).

export const npcPR = (kind: "smallTrader" | "fatMerchant" | "galleon", medianCaptainPR: number) =>
  B.npc[kind].prVsMedian * medianCaptainPR;  // NPC stats all equal PR, hull = 10 * PR
```

**Tuning guide**

| If playtests show | Change first | Then check |
|-|-|-|
| Upgrades feel slow in week 1 | `startGold` to 200, or `upgrade.baseCost` to 45 | Tide 1 still buys 3 or 4 upgrades, not 6 |
| Season 0 milestones arrive too late | `progressionCostMult` to 0.5 in the Season 0 preset | Brigantine around Tide 6 solo; the Frigate becomes reachable around Tide 12 to 13, so enable it |
| One captain runs away with PR | `upgrade.growth` to 1.45 | Longest stretch without a purchase stays under 3 Tides |
| Fights feel random | `combat.win` to 2.5 (reads matter more) | Equal ships still draw about 20% |
| Fights feel decided by stats | `combat.exponent` to 0.4 | A 2 to 1 ship still wins about 85% |
| Too many ships sunk | `combat.k` to 18 | Decisive results 20 to 35% |
| Nobody bothers with fleets | `fleet.coopExponent` to 1.7 or `convoyPerMate` to 0.2 | Solo still earns at least half a fleet captain's income |
| Traders never get hunted | `npc.prizeUnitValue` up, `loot.decisive` to 0.5 | Victims never lose more than half their plunder |
| Ganging still happens | `fairness.floor` to 0.1 | Fair one on one fights are unaffected |

# 15. Technical architecture and data model

## 15.1 Stack decision

**Decision: keep Phaser 4, TypeScript, Supabase and static hosting, with four adjustments.**

1. **Phaser only for the map and battle replays.** Menus, forms, the Gazette and chat are HTML built with **Preact** (React compatible, about 3 KB, and Claude knows React patterns very well). Building forms and scrolling text inside a canvas engine is slow to code and awkward on phones.
2. **A shared, pure TypeScript rules engine** used by both the server (authoritative) and the browser (previews). Zero dependencies, no clock, no `Math.random`, deterministic from a seed. This is the heart of the game and the part with the most tests.
3. **All game writes go through Supabase Edge Functions**, never direct table writes from the client.
4. **pg_cron calls the Tide resolver every 5 minutes**; the resolver decides whether a Tide is due (scheduled time reached, or everyone Ready). This handles daylight saving and early Tides with one code path.

* Evidence: Supabase's free plan gives 500,000 function calls a month, 2 seconds of CPU per call and scheduled jobs through pg_cron and pg_net (R7), which is far more than six players need (the 5 minute cron adds about 8,600 calls a month, and six players add a few thousand more, so under 5% of the allowance). Phaser 4 is a released line (v4.2.1, July 2026).
* Alternative: Phaser 3. It has far more tutorials and far more code in AI training data, so Claude Code will make fewer API mistakes. If Phaser 4 fights you in week one, switching is cheap because Phaser only renders two scenes.

Watch outs:

* Claude Code may suggest Phaser 3 APIs. Pin the exact Phaser version in `package.json` and put a link to the Phaser 4 docs in `CLAUDE.md`.
* Free Supabase projects pause after a week of inactivity. Daily play keeps it busy during a season; between seasons, add a weekly scheduled ping (a GitHub Action) or accept a manual restore. I could not confirm whether pg_cron activity alone counts as activity.
* Static hosting: **Cloudflare Pages** (free, and it gives every branch its own preview link, which is handy for testing a change before your friends see it, and later for two developers testing each other's work). GitHub Pages is the simpler alternative.

## 15.2 Repository layout

```
rumtide/
  CLAUDE.md                 rules both developers' Claude Code sessions must follow
  docs/                     GAME_DESIGN.md, RESEARCH.md, DECISIONS.md
  supabase/
    migrations/             schema, row level security, public views, apply_tide_result()
    functions/
      _shared/engine/       pure rules engine and balance.ts, zero dependencies
      _shared/maps/         map JSON files (nodes, lanes, ports)
      submit_orders/
      port_action/
      fleet_action/
      resolve_tide/
      admin/
  client/
    src/ui/                 Preact screens: Gazette, Port, Orders, Fleet, Admin
    src/scenes/             Phaser scenes: MapScene, ReplayScene
    src/net/                typed wrappers around the Edge Functions
    public/assets/          recoloured sprites, fonts, audio
  tools/
    sim/                    balance simulation that imports the real engine
    bots/                   scripted fake captains to play whole test seasons
```

The client imports the engine through a path alias (`@engine`) pointing at `supabase/functions/_shared/engine`, so there is exactly one copy of the rules.

## 15.3 Main entities

```ts
type Stat = "hull" | "cannons" | "sails" | "crew" | "hold";
type Good = "rum" | "sugar" | "spice";
type HullId = "sloop" | "brigantine" | "frigate";
type Maneuver = "broadside" | "outmaneuver" | "board";
type Intent = "trade" | "quiet" | "hunt" | "explore" | "escort";
type NpcKind = "smallTrader" | "fatMerchant" | "galleon";   // Season 0 NPCs only, see DECISIONS.md

interface Season {
  id: string; name: string; status: "draft" | "active" | "ended";
  mapId: string; timezone: string; tideTimeLocal: string;   // "Europe/Bucharest", "21:00"
  lengthTides: number; currentTide: number; settings: SeasonSettings;
}

interface SeasonSettings {
  preset: "season0" | "full";            // copied from SEASON_PRESETS when the season is created
  progressionCostMult: number; hullsEnabled: HullId[]; galleonTides: number[];
  fogOfLegendTides: number; mawOpens: boolean; mutinyRules: boolean;
}

interface Captain {
  id: string; seasonId: string; userId: string;
  shipName: string; flag: string; partingShot: string;
  legend: number; chestGold: number; bounty: number;
  shieldUntilTide: number | null; fleetId: string | null;
  standingPlan: [Maneuver, Maneuver, Maneuver]; standingParley: "off" | 1.25 | 1.5;
  shoreLeaveTides: number; lastOrdersTide: number; status: "active" | "ashore";
}

interface Ship {
  captainId: string; hull: HullId; nodeId: string; docked: boolean;
  hullPoints: number; levels: Record<Stat, number>;
  plunderGold: number; cargo: Record<Good, number>; cargoCostBasis: Record<Good, number>;
  shipwrightProgress: number;
}

interface Orders {
  tide: number; captainId: string;
  course: string[];                          // node ids, length at most speed
  intent: Intent;
  huntFilter?: "merchants" | "players" | "anyone" | { captainId: string };
  escortCaptainId?: string;
  plan: [Maneuver, Maneuver, Maneuver];
  parley: "off" | 1.25 | 1.5; noQuarter: boolean;
  ready: boolean;
}

interface Tide {
  seasonId: string; number: number; status: "open" | "resolving" | "resolved" | "failed";
  dueAt: string; resolvedAt: string | null; seed: number; gazette: Gazette | null;
}

interface Battle {
  id: string; tide: number; nodeId: string;
  sides: BattleSide[]; rounds: RoundRecord[];      // everything the replay needs
  outcome: "decisive" | "victory" | "draw";
  winner: 0 | 1 | null;                            // index into sides, null on a draw
  loot: LootRecord[]; bountiesAdded: BountyRecord[];
}

interface Npc { id: string; seasonId: string; kind: NpcKind; nodeId: string; pr: number;
  habit: Maneuver[]; cargoUnits: number; spawnedTide: number; status: "active" | "taken" | "gone"; }

interface Fleet { id: string; seasonId: string; name: string; flag: string; colour: string; createdTide: number; }
interface FleetMember { fleetId: string; captainId: string; joinedTide: number; leavingAtTide: number | null; }
interface MarketRow { seasonId: string; portId: string; good: Good; drift: number; soldThisTide: number; }
interface LogEvent { id: string; tide: number; captainId: string | null;
  visibility: "public" | "fleet" | "private"; kind: string; text: string; data: unknown; }
interface Transaction { id: string; captainId: string; tide: number; kind: string;
  amount: number; balanceAfter: number; data: unknown; }   // audit trail for debugging and charts
```

Maps are static JSON in the repo, not database rows. In Postgres each interface becomes a table with snake case columns.

## 15.4 What the server owns and what the client may send

**The server owns everything:** positions, stats, gold, cargo, outcomes, random seeds, NPCs, prices, Legend, timestamps.

**The client may send only intents**, each validated first by a schema (Zod) and then by the engine:

| Call | Payload | Server checks |
|-|-|-|
| `submit_orders` | tide number, course, intent, hunt filter, escort target, plan, parley, no quarter, ready | Tide is open; course is connected and within speed; targets exist; plan has 3 valid maneuvers |
| `port_action` | buy or sell (good, quantity), upgrade (stat), repair, shipwright (amount) | Ship is docked; enough Chest gold; hold space; level below max |
| `fleet_action` | create (name, flag), invite (captain), accept, leave | Size cap; not already in a fleet; leaving takes effect next Tide |
| `profile` | ship name, flag choice, parting shot | Length limits, profanity filter optional |
| `admin` | trigger Tide, adjust a balance value, post a Riddle Map, compensate | Caller is the season admin; every action logged publicly |

The client never sends gold amounts it wants to have, results, positions it claims to be at, damage, or times.

**Reading data.** Row level security denies all client writes to game tables. Clients read through **public views** that leave out private columns (another captain's Chest, plunder, cargo and orders are never visible). Each captain can read their own private rows; fleet mates can read each other's orders for the open Tide. Orders become public in replays after the Tide resolves.

## 15.5 Resolving a Tide

1. pg_cron calls `resolve_tide` every 5 minutes.
2. The function asks Postgres to **claim** the open Tide if it is due (time reached, or every active captain Ready and no early Tide yet today). The claim is a single update from "open" to "resolving", so two calls can never resolve the same Tide.
3. It loads one JSON snapshot of the season, runs `engine.resolveTide(snapshot, orders, seed)`, and gets back the new state, battles, log events and the Gazette.
4. It sends the whole result to a Postgres function, `apply_tide_result`, which writes everything in one transaction and opens the next Tide with its due time computed in the season's timezone.
5. It posts the Gazette headlines to the Discord webhook.
6. If anything fails, the Tide is marked "failed" and the admin page shows a Retry button. Because the engine is deterministic from snapshot and seed, retrying is safe and gives the same result.

Six to fifty captains resolve in milliseconds, far inside the 2 second CPU limit.

## 15.6 Testing

* **Engine unit tests** (Vitest) for movement, meetings, combat, loot, fairness and the economy.
* **Golden tests:** a saved snapshot plus orders plus seed must always produce the same saved result. Any change to that output must be intentional.
* **Bots:** `tools/bots` plays a whole 28 Tide season with six scripted captains (trader, raider, explorer, fleet pairs) in seconds. Run it before every merge to main.
* **Balance sim:** `tools/sim` reruns the pacing tables in section 5.5 using the real engine. If the tables drift, the change was not neutral.

# 16. Scope tiers

## 16.1 MVP: Season 0, a two week beta built solo

Goal: Season 0, a two week beta of 14 Tides that is fun, fair and stable, built by one developer (details in section 3.5). Everything else waits.

| Priority | Feature |
|-|-|
| Must | Login (Supabase Auth with Discord or email magic link), one season, six captains |
| Must | The Brine map (36 nodes, JSON), Crown and Free zones |
| Must | Sloop and Brigantine, five stats, upgrades, Shipwright instalments |
| Must | Ports: buy and sell three goods, repair, automatic banking of plunder |
| Must | Orders: course, intent (trade, quiet, hunt, explore), plan, parley, Ready |
| Must | Tide resolver: movement, meetings, escape, one on one and fleet battles, loot, fairness factor, bounties, shields; early Tide when everyone is Ready |
| Must | Small Traders and Fat Merchants; the Treasure Galleon on Tides 7 and 14 |
| Must | Fleets: create, invite, accept, leave next Tide; convoy and battle bonuses; fleet mates see each other's orders |
| Must | Standing orders and Shore Leave |
| Must | Legend and a leaderboard |
| Must | Tide Gazette (text) and a simple replay: two sprites, plans revealed round by round, damage numbers, smoke |
| Must | Discord webhook: Gazette at each Tide, reminder at 18:00 |
| Must | Admin page: resolve now, retry a failed Tide, read the logs |
| Should | Explore deck of 12 events |
| Should | Escort intent |
| Should | Battle preview (200 simulated fights in the browser) |
| Should | Calm Seas week, Most Wanted marker, Parting Shots, weekly awards |
| Should | One music loop and the Tide jingle; coin, cannon and splash sounds |

**If the beta date is at risk,** cut in this order and keep the rest: music first, then the Escort intent, then battle previews, then the animated replay (keep the text replay), then weekly awards. Do not cut fleets, standing orders, Shore Leave, the Discord webhook or the admin Retry button, because those decide whether the beta works at all.

Design rules from day one, even in the MVP: colour blind safe maneuver icons (shape and colour), phone first layouts, and no gameplay numbers outside `balance.ts`.

**Definition of done:** six real friends can play 14 Tides without the admin fixing data by hand, every Tide resolves on time, and at least four of the six say they want a longer season. Section 3.5 lists the other checks.

## 16.2 Version 2: after Season 0, with the second developer

* Balance and usability fixes from Season 0 feedback, before any new feature.
* Frigate hull and rigs (Man o' War, Runner, Merchantman, Boarder).
* Trinkets with rarities and quirks.
* The Maw, storms, Sea Serpents, Navy patrols, the Admiralty fort as a co op raid.
* The Old Grimbeard story: map fragments, the hoard, the Bell and the Kraken finale.
* Full 28 Tide seasons, the Fog of Legend, the Hall of Legends.
* Fleet Cove, contracts and gifts.
* Weather forecasts and fog of war (you see ships within a range set by your Sails).
* In game chat: Tavern, fleet channel, and private Parley messages.
* Web push as an installable PWA.
* Riddle Maps and special events from the admin page.
* Cosmetics earned through play (sail colours, flags, figureheads, the deck monkey).

## 16.3 Dream version

* **Deck Duties:** a 30 second Puzzle Pirates style minigame once per day (knots, cannon loading, patching) that gives up to +10% on your next Tide. Capped low so it is a treat, not a chore (R1.1).
* **Live Raid Night:** an optional weekly real time event that reuses the engine with 2 minute Tides, played on voice chat.
* **Procedural maps** that scale with player count, and **multiple oceans** of 6 to 12 captains for 50 to 500 players, grouped by timezone so everyone's Tide lands in their evening.
* **Prize ships:** capture an NPC galleon and sail it as your own for the rest of the season.
* **Ship painter:** a tiny pixel editor for sails and flags within the palette.
* **Discord bot commands** to check your ship or set orders from chat.
* **Spectator links** for friends who want to watch the drama without playing.
* **Branching season stories** where the community's choices decide the next season's world.
* Romanian localisation (if the group wants it).

# 17. Risks and how to reduce them

| Risk | Likelihood | Impact | Mitigation |
|-|-|-|-|
| Scope creep: the MVP never ships | High | Fatal | The MVP table is the contract. New ideas go into `docs/IDEAS.md`, not the code. Fix a start date for Season 0 and cut Should items to hit it. |
| Solo build runs long | High | High | Build the engine and bots first, since a bot season proves the game works without friends. Cut Should items in the order given in section 16.1. Announce the Season 0 start date only after a full bot season has run through the real Edge Functions. |
| The second developer joins and the code tangles | Medium | Medium | The shared engine, its tests and the golden files are the contract. Write DECISIONS.md and CLAUDE.md before they start, split ownership between `supabase/` and `client/`, keep branches small, and start them on a small, isolated task. |
| Claude Code invents Phaser 3 APIs for Phaser 4 | Medium | Medium | Keep Phaser to two scenes; pin the version; link the Phaser 4 docs in `CLAUDE.md`; fall back to Phaser 3 if it costs more than a day. |
| Balance breaks (runaway leader, useless strategy) | Medium | High | The simulation in `tools/sim`; every number in `balance.ts`; admin can change values between Tides; seasons end. |
| Friends drift away after week one | High | High | Two minute sessions, the 21:00 ritual, Discord reminders that name names gently, Shore Leave, weekly beats, short seasons, and asking the group after Season 0 what to change. |
| PvP sours a friendship | Medium | High | Calm Seas week, shields, bounties, parley, safe ports, telegraphed betrayal, and peaceful play that is fully rewarded. Talk about the "pirate code" before Season 0. |
| Async feels too slow | Medium | Medium | Instant port actions, a lively Gazette, replays, early Tides when all are Ready, weekly galleon. If still slow, move to two Tides a day (09:00 and 21:00) with one setting. |
| A friend who codes finds an exploit | Medium | Medium | Server authority for everything, no client writes, schema validation, rate limits, and an audit trail of every transaction. Reward reported exploits with a cosmetic. |
| Supabase free plan pauses or hits a limit | Low | Medium | Daily activity during seasons, a weekly ping between seasons, usage far below limits. Export the database weekly. |
| Tide resolution fails at 21:00 | Low | High | Claim, compute, apply in one transaction; deterministic retry; admin Retry button; Discord alert on failure. |
| Art looks inconsistent or cheap | Medium | Medium | One palette, one recolour script, two asset packs only, integer scaling. |
| iPhone players miss notifications | Medium | Low | Discord carries the essentials; web push is a bonus once the game is on the home screen. |

# 18. Open questions only you can answer

1. **Where does your group chat live?** Discord, WhatsApp or something else? This decides the notification bot and possibly the login method.
2. **What time should the Tide turn,** and is everyone in the same timezone?
3. **How cutthroat is the group?** Should betrayal be telegraphed (default) or instant (Mutiny Rules)? Is anyone likely to feel picked on?
4. **When the second developer joins (after Season 0), who are they,** how much do they code without Claude, and which half (server or client) do they want?
5. **Can anyone in the group draw pixel art or make music,** or is it asset packs and BeepBox all the way?
6. **English or Romanian** for the game's text?
7. **Phone or computer:** how will most of your friends actually play?
8. **Season length:** will your group commit to 4 weeks, or should seasons be 2 weeks with more resets?
9. **The name.** Is *Rumtide* a keeper?
10. **Do you want to be the game master,** running Riddle Maps and live events by hand, or should the game run itself?
11. **How many hours a week can you give the solo build?** This sets the Season 0 start date (section 19.1 assumes 15 to 20).

# 19. Building it: solo first, then a second developer

## 19.1 Plan for the solo beta

Order of work: engine first, plain client second, polish last. A deterministic engine with scripted bots lets you test a whole season in seconds without needing friends, and it is the kind of pure logic Claude Code handles well. Version 0.1 of this plan assumed two developers working in parallel. Alone you do both halves, so my estimate (a guess, not evidence) is about double: if you can give roughly 15 to 20 hours a week, plan 3 to 4 weeks until Season 0 starts. Season 0 then runs for 2 weeks.

**First week**

| Day | Do | Done when |
|-|-|-|
| 1 | Create the repo, `CLAUDE.md`, Vite with TypeScript, Preact and a pinned Phaser 4, the Supabase project, Auth and a Cloudflare Pages deploy. Write `engine/types.ts` and `SEASON_PRESETS`. | A blank page deploys and you can log in |
| 2 | Seeded random generator, map loader, the 36 node map JSON, movement in steps, meetings. Unit tests. | A test moves 6 ships around the map and finds the right meetings |
| 3 | Combat, loot, fairness factor, bounties, shields. Port the balance simulation to `tools/sim`. | `tools/sim` reproduces the tables in sections 3.5, 5.5 and 7.3 |
| 4 | Ports, trade, upgrades, Shipwright, NPC merchants, the galleon. Economy tests. | A bot trader earns roughly the income shown in section 3.5 |
| 5 | `tools/bots`: six scripted captains play all 14 Tides of Season 0 in seconds. Fix what breaks. | A full bot season runs with no errors and sane results |
| 6 | Migrations, row level security, public views, `submit_orders` and `port_action`. `resolve_tide`, `apply_tide_result`, pg_cron, the Discord webhook. | Bots can play a season through the real Edge Functions |
| 7 | Admin page: resolve now, retry a failed Tide, read the logs. Then review the week against this document. | You can run a Tide by hand and see the Gazette text arrive in Discord |

**Weeks 2 and 3 (client, in this order)**

1. Login and map: `MapScene` draws nodes, lanes and ships, with pan and zoom on a phone.
2. Orders screen and Port screen, wired to the real functions.
3. Gazette screen with text results, plus a text replay of each battle (rounds listed one by one).
4. Fleets: create, invite, accept, leave, and fleet mates seeing each other's orders.
5. `ReplayScene` v0: two ships, plans revealed round by round, damage numbers, smoke.
6. Exploration events, standing orders, Shore Leave and the Legend leaderboard.
7. Recolour the assets into Endesga 32, polish the phone layout, add coin and cannon sounds and the Tide jingle.
8. Internal playtest: one friend and you trigger Tides by hand every hour for 3 to 4 Tides. Fix the worst three problems, write a one page "How to play", then announce the Season 0 start date.

If time runs short, cut in the order given in section 16.1.

## 19.2 When the second developer joins

Season 0 runs for two weeks while you wait for feedback. Use that time to prepare:

* Write `docs/DECISIONS.md` (what was decided and why), refresh `CLAUDE.md`, and make sure the tests and bots run with one command.
* Add a README quickstart: local Supabase, environment variables, and how to run a bot season.
* Split ownership: one person owns `supabase/` and the engine, the other owns `client/` and the art. Engine changes need both.
* Give the newcomer a small, visible first task from Version 2, for example weather forecasts on the map, the Riddle Map admin tool or the music loops, not a refactor.
* Each developer uses their own Claude subscription and their own branch. Merge to main at least daily, and use the Cloudflare preview link for each branch.
* Choose the Version 2 order from Season 0 feedback, not from this document.

# Appendix A: starter rules for `CLAUDE.md`

```
# Rules for Claude Code in this repo
* Read docs/GAME_DESIGN.md before starting any feature. If a request conflicts with it, say so.
* The engine (supabase/functions/_shared/engine) is pure TypeScript: no network, no database,
  no Date.now, no Math.random. Randomness comes only from the Rng passed in.
* Every gameplay number lives in balance.ts. Never hardcode one anywhere else.
* The client never writes game tables. All game writes go through Edge Functions,
  which validate with Zod and then with the engine.
* Every engine change needs a unit test. Run the tests and the bots before committing.
* Iterate collections in sorted id order inside the engine so Tides are reproducible.
* Phaser is pinned to version 4.x.y. Check the Phaser 4 docs; do not assume Phaser 3 APIs.
* Keep Phaser to MapScene and ReplayScene. All menus are Preact.
* Keep supabase/ and client/ cleanly separate. When a second developer joins, one owns supabase/ and
  the other owns client/, and engine changes need both to review.
* Season differences (length, cost multiplier, hulls, galleon Tides) come from SEASON_PRESETS in
  balance.ts. Never hardcode Season 0 values anywhere else.
* When a design decision changes, update docs/DECISIONS.md in the same commit.
```

# Appendix B: glossary

| Term | Meaning |
|-|-|
| Tide | The daily moment when all orders resolve at once. |
| Chest | Banked doubloons. Safe. Spent in port. |
| Plunder | Doubloons on your ship. At risk until you dock. |
| Boom | The world's wealth multiplier, rising 4% per Tide. |
| PR | Power Rating. A fresh sloop is 10. |
| Plan | Your three secret maneuvers for a battle. |
| Strike your Colours | Lose a battle decisively. Your ship is towed to port, nothing permanent is lost. |
| Parley | Pay a small tribute to avoid a fight you would lose. |
| Shield | Two Tides of protection from players after a PvP loss. |
| Bounty | A reward on your head for bullying. Paid to whoever beats you. |
| Shore Leave | Bonus income after missed Tides. |
| Fair Winds | Bonus income for captains well behind the median. |
| Fleet | Two to four allied captains who share bonuses and prizes. |
| Gazette | The Tide Report, written as a pirate newspaper. |
| Legend | Your score for the season. |

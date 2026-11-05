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

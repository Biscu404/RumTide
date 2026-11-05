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

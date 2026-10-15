# Decisions

What was decided, when and why. Newest first. When a design decision changes, add an entry here in the same commit.

## 2026-10-14: Client step 1, login and MapScene

* **Email and password sign in** through Supabase Auth, with a Create account button. Nothing else is asked.
* **The client reads `seasons`, `public_captains`, `public_ships` and the player's own `captains` row,** never the private tables, and writes nothing.
* **Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (client/.env.local) the app shows a preview:** the Brine with three made up ships, so the map can be tried with no server. With them set, it shows the login.
* **Maps are looked up by the season's `map_id`** in `client/src/scenes/maps.ts`. Season 0 has only `brine`.
* **`@supabase/supabase-js` stays in `devDependencies`** for now (it is bundled by Vite either way). Move it when the client is deployed.
* **Not run against a real project yet:** the sign in and the reads need a Supabase project with a running season.

## 2026-10-14: Day 6 Edge Function handlers, the database and the Discord webhook

Section 15.4 and 15.5 leave these open. The logic of each function lives in `supabase/functions/_shared/api` as plain TypeScript over a `GameStore` interface, so it runs against memory in the tests and bots and against Postgres in production. The files in `submit_orders/`, `port_action/` and `resolve_tide/` only wire a request to a handler.

**Early and late Tides**
* **An early Tide needs every active captain Ready and no Tide resolved yet on today's local date.** "At most once a day" (section 11.2) is read as one resolve per calendar day in the season's timezone. Ashore captains do not count.
* **An early or forced Tide uses up the day:** the next Tide is due at the next 21:00 on a later date. A scheduled Tide that runs late (cron was down) gets the next 21:00 after now, so a late Tide never doubles up with the following one.
* **21:00 stays 21:00 on the clock** across daylight saving. The due time is worked out from the season's timezone each time (`schedule.ts`), not by adding 24 hours.
* **Orders and port actions close the moment a Tide is due,** even before the cron claims it (up to 5 minutes later), so nobody gets a few free minutes. They also close while a Tide is resolving or failed.

**Writes and races**
* **Each captain row has a `version`.** A port action carries the version it was worked out from and fails with a 409 if the captain changed since, so two taps on Buy cannot spend the same gold twice. A market row is compared on its drift and units sold. A 409 means "look again and retry".
* **Orders and port actions lock the open Tide row "for share";** claiming a Tide for resolving needs the row exclusively, so the two cannot interleave.
* **The seed of a Tide is fixed when it opens** (random, from the Edge Function) and stored in `tides`, where clients cannot read it. A retry reuses it, so a failed Tide resolves the same way the second time.
* **A failed Tide stays failed** until the admin retries it (day 7). The cron skips it.

**What clients can read**
* **Other captains' Chest, plunder, cargo, Hold level, orders and user ids are hidden;** `public_captains` and `public_ships` show the rest (Legend, bounty, shield, fleet, hull, place, hull points and the other four levels). A ship's Power Rating can be worked out from what is public, as section 4 expects.
* **Orders are readable by fleet mates for the open Tide and by everyone once it has resolved,** for replays (section 15.4).
* **Only the Treasure Galleon's habit is public;** the merchants' habits are not, so a hunter cannot read a merchant's plan.
* **`create_season` can start a draft season,** so fleets can be set up first (a captain's fleet must exist). With no draft it just creates the season.

**The end of a season**
* **After Tide 14 there is no Tide 15 row.** The season is `ended` and the final standings are the last snapshot. The database shows Tide 14's NPCs and boom port, not the ones the engine prepared for a Tide that never opens.

**Not built yet (open)**
* **Shore Leave (+50%), Fair Winds (+20%) and the convoy bonus (+10% per fleet mate) are still not applied to income.** Day 5 expected them to arrive with `port_action`, but the design does not say which income they boost (sale profit, prizes, or both) or on which Tide a stored Shore Leave is spent. Stored Shore Leave rises to 3 and is never used. Needs a decision before Season 0, because Shore Leave is a Must in section 16.1.
* **The 18:00 Discord reminder, the `profile` function and `fleet_action`** are not built. The reminder needs a "sent today" marker; fleets and profile are week 2.
* **The admin function** (resolve now, retry, logs) is day 7. `resolveDueTide` already takes `force`.

**How this was checked**
* `npm test` covers the handlers, the schedule (including the 25 October clock change), the HTTP shell and the Discord message. `npm run bots` now also plays every seed through `submit_orders`, `port_action` and `resolve_tide` and requires the season to end exactly as the direct one.
* The migrations, `SupabaseStore` and the row level security were run once on a throwaway in process Postgres (PGlite, not a project dependency): five bot seasons through the real SQL ended identically to the direct engine, and 23 access checks passed as a signed in player.
* **Not run anywhere yet:** the Deno entry files, `config.toml`, the cron migration (pg_cron, pg_net and Vault are not in PGlite) and `auth.getUser`. They need a real Supabase project.

## 2026-10-14: Day 5 Tide resolver and the bot season

Section 4.4, 12.4 and 15.5 leave these open. `engine/resolve.ts` (`resolveTide(map, snapshot, orders, seed)`) and `engine/season.ts` (`TideSnapshot`, `startSeason`) are new, and `tools/bots` plays whole seasons on them. Change a line here and the matching test in the same commit.

**Encounters in the resolver**
* **Meetings at one node form one group.** Everyone on a node is looked at together, so two hunters reaching the same merchant fight it as one side and share the prize by damage (section 4.6). Otherwise whoever sorted first would take it all. A side also gets the fleet battle bonus when unrelated hunters share a merchant, because `combat.ts` counts ships, not fleets.
* **Target choice:** a hunter picks players before merchants, in id order. A ship that fought a battle is out of every other encounter that Tide, which also stops a struck ship from fighting again. A pair that escaped, or settled by tribute, does not meet again that Tide.
* **No combat in a port.** Any ship on a port node counts as docked, even one passing through, because section 4.2 says ports have no combat ever.
* **Merchants roll to escape like any hunted ship; the Treasure Galleon never flees.** A boss built for fleets that ran away 3 times in 4 (its PR is 2.8 times the median) would make the section 8.2 odds meaningless. The Small Trader escapes about 45% of the time against a sloop, so a Hunt on merchants needs about two tries, which is a balance knob.
* **Tribute goes to the hunter as plunder:** the plunder lost plus the cargo lost at prize value. The hunted ship sails on and no battle is recorded.
* **A loss to an NPC costs hull only.** NPCs take no loot, because loot is never destroyed. A hull at zero still means being towed.
* **Bounties collected are paid into plunder,** not the Chest, so they are at risk until the winner docks. A bounty earned this Tide does not shrink at the end of it; older ones shrink by 10%.
* **A struck ship is towed to the nearest port** (fewest hops from where it fought, ties to the lowest id), half patched, and docks and banks what it has left. All of this happens when the Tide ends.
* **Ships at sea at the end of a Tide patch 10% of their hull;** ships in port repair as a paid port action.

**Standing orders, Shore Leave, Ashore**
* **No valid orders means standing orders:** stay in port, or at sea sail Quietly towards the nearest port as far as speed allows. Orders with a bad course or plan are replaced the same way and a private log line says why.
* **A missed Tide stores one Tide of Shore Leave (cap 3).** A captain whose last orders were 5 Tides ago is marked Ashore. Submitting orders makes them active again.
* **Not built yet: the income side.** Shore Leave (+50%), Fair Winds (+20%) and the convoy bonus (+10% per fleet mate) multiply income, which is earned in port actions, so they arrive with `port_action` on day 6. Until then a trader who misses Tides 5 to 7 earns about 40% less than one who does not, against the doc's 15% (section 3.5). Also not built: exploration events (rule 7) and the Escort intent's course copy (an Escort still joins fleet mates' fights). Both are `Should` in section 16.1.

**Data**
* **`Battle` gained `winner`** (0 or 1, an index into `sides`, or null for a draw), because the record did not say who won. Section 15.3 is updated.
* **`resolveTide` takes the map as an argument,** a `GameMap` is not part of a snapshot. It returns the next `TideSnapshot` (tide + 1, prices drifted, NPCs spawned for it, the Trade Winds port picked on Tide 8), this Tide's NPCs as `taken` or `gone`, battles, log and Gazette. After the last Tide it spawns no NPCs.
* **`startSeason` hands out ports in id order,** one per captain, so six captains use six ports.
* **`boomPortForTide`, `shipPowerRating`, `seasonSettings` and `median` moved into the engine** from `tools/sim`, so the sim and the bots use the same code. `tools/sim/trader.ts` now exports `visitPort` (a trader's whole stop in port). The sim output is unchanged to the digit.

**What the bot season showed** (`npm run bots`, 30 seeds of each roster)
* **No crashes and no impossible states** in 60 seasons, and a season replays exactly from its seed.
* **The real resolver agrees with the economy sim.** A lone bot trader starting at Driftwood Key ends with 26.8 upgrade levels after Tide 14, the sim gets 27.0 at the same point (casual: 13.2 and 12.6). The difference to section 3.5 comes from the start port and from the sim's closing port visit after Tide 14, which the bots do not make.
* **A convoy of two sinks the galleon in about 40% of seasons without trying,** by happening to be within 2 hops on Tide 7. It nearly always wins a Victory, which is the half prize (Day 4: 5% of counter plays are Decisive). Expect players to plan for it, so the real rate will be higher.
* **The six raider brawl strikes about 9 ships a season** and fleet battles are most of its fights. Bounties are rare (0.4 a season), because equal ships rarely meet the "hunted a weaker ship" rule.
* **Raiders earn less Legend than traders** (67 and 82 against 246 for the careful solo trader). That is the Day 4 trade pacing plus no Shore Leave, not a verdict on raiding.
* **Tribute is never taken in a bot season** (nobody catches a trader that has set a parley), so it is covered by unit tests only.

 trade, upgrades, Shipwright, NPCs and the galleon

Section 4.2, 5, 6 and 8 leave these open. The engine now does the following (`market.ts`, `port.ts`, `npc.ts`, `state.ts`, plus the Hold cap in `loot.ts`). Change a line here and the matching test in the same commit.

**Market and trade**
* **Buyers always pay the normal price; only sellers feel the drift.** With one price for both, a captain could sell 10 rum, buy it back at the lowered price and repeat. The probe made 195 doubloons in 20 loops without leaving port. Section 6.3 only says units *sold* lower the price, so this keeps its wording. Test: `gives no free gold for selling at a port and buying the same goods back`.
* **Each unit sells a little cheaper than the one before** (1.5% per unit), so a lot of `n` units pays `price * (1 - 0.985^n) / 0.015`. Selling in two lots pays the same as one. Gold is whole doubloons, rounded to nearest.
* **Port goods live in the map JSON** (`trade` on every port, checked by `loadMap`), because they are part of the map, not the rules. Section 4.2's table is the source.
* **Last Lantern buys and sells every good at 1.8 times base** (`B.trade.lastLanternMult`). The doc only says "a premium", so the number is mine. It is above the 1.6 of a wanted good, so a long haul to the edge pays slightly more than a normal leg but is not the best route.
* **The Trade Winds boom starts in week 2** (`B.trade.weeklyBoomFromWeek`), matching section 3.5, where week 1 is Calm Seas. `pickBoomPort` picks one port other than Last Lantern. The doc says "a random port", this is also my reading of "its wanted good at 2 times".
* **Hold units round down** (`holdUnits`): 11.2 is 11 units. Section 14 gave the unrounded value.
* **Legend from trade is fractional** (profit banked / 10, and a sale at a loss earns nothing and costs nothing). Rounding every sale would lose small ones.

**Carrying, loot and the Hold cap**
* **A cargo unit is worth `prizeUnitValue * boom` to a looter,** the same 19 as an NPC prize, so PvP loot of cargo and merchant prizes agree (`cargoValue`, `carriedValue`).
* **The Hold cap of section 5.1 is now applied, to PvP loot and merchant prizes** (Day 3 left it open). A winner carries off at most a full Hold of cargo at prize value per battle (`holdLootCap`). What does not fit stays with the loser and nothing is created. The galleon prize has no cap in Season 0; section 8.3 puts that cap in a V2 rig.
* **The loser's cargo shrinks like their plunder** (`applyLoss`), whole units rounded to nearest, cost basis shrinking with it.

**Repairs, upgrades, Shipwright**
* **Repairs cost 0.3 per hull point, rounded up, and the Boom does not apply.** Section 6.2 only says the Boom raises "prices and prizes".
* **Buying a Hull level adds the extra hull points,** so it does not leave the ship looking damaged. A new hull from the Shipwright arrives fully repaired. Levels carry over.
* **The last Shipwright instalment is trimmed to what is still owed,** and there is no refund of progress.
* Sea patching (10% a Tide) and the free patch after a strike (50%) are in `port.ts` as small helpers for the Tide resolver.

**NPCs and the galleon**
* **Merchants are created while the Tide before resolves,** sit on one node for the one Tide they exist, and are met there. That is "visible one Tide ahead" without any NPC movement. Position: a random node strictly between two ports on a random shortest path, never a port.
* **One merchant in three is a Fat Merchant** (`B.npc.fatMerchantShare`). The doc gives no mix, so the number is mine. Count is `0.75 * players`, rounded up or down by a roll (6 players give 4 or 5).
* **Habits:** Small Trader plays its favourite maneuver (Outmaneuver) 60% of the time and the other two 20% each. Fat Merchant plays Outmaneuver, Board, Board ("outmaneuvers, then boards"). Galleon plays Broadside, Board, Broadside. The Fat Merchant's plan is my reading of one line.
* **Prizes:** a Decisive win over a merchant pays all its cargo, a Victory half (`B.npc.merchantVictoryPays`, mirroring the galleon). Winners split by damage dealt. Each winner gets the NPC Legend. The galleon pays `coopShare` to each of the N winning captains, half on a Victory, plus the co op Legend.
* **The `merchants` hunt filter still matches the galleon** (Day 3 said Day 4 may split it). I left it, so a Hunt with the default filter will go after the galleon. A lone ship cannot win, so this only costs it a fight.

**Pacing results** (`npm run sim`, details in the sim output)
* **Section 3.5 and 5.5 cannot be reproduced to the doubloon:** they came from a simulation we do not have. Two bots bracket them. The *careful* trader plans a loop (a leg and the best leg back). The *casual* trader looks one leg ahead and can be left in a port with nothing good to carry away.

| Season 0, solo trader | Careful bot | Doc (section 3.5) | Casual bot |
|-|-|-|-|
| Earned by Tide 14 | about 3,950 | about 3,100 | about 2,240 |
| Brigantine, median Tide | 7 | 8 | 9 |
| Full costs, 28 Tides: earned | about 11,250 | about 10,400 | about 5,800 |
| Full costs: Brigantine, median Tide | 9 | 11 | 13 |

* **Read this as:** the documented trader sits between the two bots, so Day 4's "done when" holds. A player who plans loops will earn about 25% more than section 3.5 and reach the Brigantine a Tide early, so if the beta feels fast, raise `upgrade.growth` or `progressionCostMult` before touching income.
* **Income comes in lumps** on two Tide legs (a sale every second Tide), where the doc tables are smooth averages. Compare running totals, not single Tides.
* **Not modelled:** Shore Leave, Fair Winds, the convoy bonus, hunters, exploration and standing orders. They arrive with Tide resolution and the bot season (Days 5 and 6).

**Galleon odds (section 8.2), real engine:** a lone ship never wins; two ships with random plans win 23.8% (doc 22 to 32%); three ships with random plans win 90% (doc about 80%). A pair that plays the perfect counter to the printed habit wins 100% (doc 75 to 87%), but only 5% of those are Decisive, so a pair usually takes the **half** prize. Three ships with perfect reads win 100% Decisive.

**Open questions for the design doc (not decided here)**
* **Should merchant prizes be Hold capped?** I applied section 5.1 literally. At Hold 10 a Fat Merchant (30 units) then pays no more than a Small Trader (10 units), so it is only a better target for a bigger Hold. If you want Fat Merchants to be a prize in themselves, drop the cap for merchants in `settleMerchantBattle` callers (do not pass `holdCap`).
* **Section 9 rule 4 (ganging 96%) is still 100%,** unchanged from Day 3.
* **How good are the friends at routes?** The careful and casual bots differ by a factor of 1.7 in earnings. Season 0 will tell you which one your group is.

## 2026-10-14: Day 3 combat, loot, bounty and shield choices

Section 7, 9 and 4.4 leave these open. The engine now does the following (`combat.ts`, `loot.ts`, `encounter.ts`). Change a line here and the matching test in the same commit.

**Encounters**
* **A pair that escaped does not meet again that Tide.** This settles the question Day 2 left open. Without it a stationary pair would roll the escape chance up to three times and the numbers in section 14 would mean something else. The resolver keeps a set of escaped pairs (`pairKey`).
* **The order is: meeting, encounter check, escape roll, parley, battle.** Parley (section 7.6) runs after a failed escape roll. A hunter with No Quarter refuses it, and that refusal feeds the bounty.
* **Two ships hunting each other have no escape roll.** Nobody is fleeing.
* **A Hunt with no filter means merchants only,** and the `merchants` filter matches every NPC, the galleon included. Day 4 may split the galleon out.
* **Shield:** a player who loses a PvP battle (Decisive or Victory, not a Draw) on Tide `t` cannot be hunted on Tides `t+1` and `t+2`. Hunting players (players, anyone, a named captain) voids your own shield for that Tide, so you can be caught as soon as you go hunting. Hunting merchants keeps it.

**Battles**
* **Any ship at zero hull ends a fleet battle.** That is section 7.2 read literally. It also means a lone ship can never beat three equal ships (see the open question below).
* **If both sides lose a ship in the same round,** whoever dealt more damage wins a Decisive result. Exactly equal damage is a Draw.
* **Damage dealt is raw damage,** so an overkill hit still counts for the margin. Victory needs 10 points or more, and exactly 10 counts.

**Loot**
* **Fairness compares whole sides:** the sum of the losers' PR against the sum of the winners' PR. A 1 on 1 fight is unchanged, three equal ships against one is judged 3 to 1 and hits the 0.25 floor (about 3% each, as section 9 says), and an even fleet against fleet fight is judged 1 to 1 instead of being crushed by a per ship comparison.
* **Winners split the gold by damage dealt** (the same rule as section 4.6 uses for merchants). Losers pay in proportion to what they carried. Amounts are whole doubloons by largest remainder, so nothing is created or lost. The worked example of section 7.4 gives 31.
* **The loser's cargo shrinks by the same fraction as their plunder** (`lossFraction`). Looted cargo is paid out as plunder gold at a value the caller supplies, because prices arrive on Day 4. **The Hold cap on loot (section 5.1) is not applied yet** for the same reason.
* **Legend:** each winning ship gets the full `25 x fairness`, rounded to whole points (not split), times 1.5 for beating the Most Wanted.
* **Calm Seas ends after Tide 7** (`B.loot.calmSeasLastTide`, new in `balance.ts` and in section 14). It halves PvP loot only.

**Bounties**
* **A bounty lands on every ship of a winning side that started the hunt,** equal to the gold that ship took. The reasons are the three in section 9 rule 2, and they stack in the record but not in the amount. I read "all three collect bounties" in rule 4 as "all three get a bounty on their heads".
* **A bounty you beat is paid from the Admiralty (new money) and split by damage dealt,** then cleared. If you want every ganging ship to collect the full amount instead, change `bountiesPaid` in `loot.ts`.
* **Bounties shrink by `floor(amount * 0.9)` each Tide,** so they end at 0.

**Open questions for the design doc (not decided here)**
* **Section 9 rule 4 says three equal ships beat one about 96% of the time. The engine gives 100%.** With damage split across ships (7.5) and the battle ending when one hull hits zero, the lone ship can only win by dealing 300 damage in three rounds, which it never can. So the 4% in the doc must come from a different damage rule (for example, damage landing on one ship). Pick one: keep the engine (ganging is a sure win, made unprofitable by loot and bounties), or change 7.5.
* **Section 7.3, ratio 1.25:** the engine gives 61 to 63% for the stronger ship, the doc says 64%. Inside the 3 point tolerance of `tools/sim`, but consistently a little low. Every other row is within 1.5 points.
* **Sections 3.5 and 5.5 cannot be reproduced yet.** They need income from trade, upgrades and the Shipwright, which are Day 4. `npm run sim` reproduces 7.3 now and gets the pacing tables then.

**Tooling:** `tools/register.mjs` lets plain Node (which strips types itself) import `@engine/...`, so `npm run sim` and the Day 5 bots run without a new dependency.

## 2026-10-14: Day 2 movement and map choices

* **`B.movement.steps = 3`.** Section 4.4 says "up to 3 steps" but gave the number no home. It is now in `balance.ts` and in the section 14 table. `B` is copied in full from section 14, plus the `speed` formula.
* **Meetings are checked literally after every step.** Two ships on the same node meet at every step they share it, even if neither moved. Day 3 must decide whether a pair that escaped (rule 5) can meet again at the next step on the same node. Flag it there before writing the escape roll.
* **A swap needs both ships to have moved** along the same lane in opposite directions in that step. A ship that follows another one hop behind does not meet it.
* **Last Lantern has zone `maw`.** Rules treat `maw` as Free while `mawOpens` is false (section 4.3). The Day 3 zone multipliers must do that check.
* **The Brine layout is mine.** The doc fixes the node counts, zones, ports and goods, not the lanes. `maps/brine.json` is a first layout: every node has 2 to 6 lanes and every port is 2 to 4 hops from its nearest port, both checked by tests. Expect to move lanes after the bot season and playtests.
* **Seeded random numbers use mulberry32** (`engine/rng.ts`), pinned to the published reference values.

## 2026-10-14: Both presets set `mutinyRules: false`

`SeasonSettings` (section 15.3) has a `mutinyRules` field, but neither preset in section 14 set it. Both presets now set it to `false`. Section 8.1 makes the telegraphed betrayal the default (leaving a fleet takes effect at the next Tide), and Mutiny Rules an opt in that a group switches on in season settings. Section 14 is updated to match.

## 2026-10-14: `NpcKind` covers only the Season 0 NPCs

Section 15.3 used `NpcKind` without defining it. It is now `"smallTrader" | "fatMerchant" | "galleon"`, matching the NPC keys in `balance.ts` and the MVP list in section 16.1. Navy Patrol and Sea Serpent appear from week 3 (section 4.6), after Season 0 ends. Add them when a full season is built.

## 2026-10-14: Placeholder record types in `engine/types.ts`

Section 15.3 also uses `BattleSide`, `RoundRecord`, `LootRecord`, `BountyRecord` and `Gazette` without defining them. `engine/types.ts` has minimal placeholders. They get their real fields when the engine first produces them: battles and loot on day 3, the Gazette when Tide resolution is built.

## 2026-10-14: Engine imports use the `.ts` extension

The engine runs in Deno (Edge Functions) and in Vite and Vitest (client, tests, bots). Deno needs the file extension on relative imports, so engine files import `./types.ts`, and `tsconfig.json` sets `allowImportingTsExtensions`.

## 2026-10-14: One `package.json` at the repo root

A single install and a single `npm test` cover the client, the engine tests and the tools. Edge Functions run on Deno and need no npm packages. If the client ever needs its own package for the second developer, split it out then.

## 2026-10-14: The admin page (Day 7)

* **Game masters are a table, not a setting.** `admins` lists user ids, and you add yourself once in the SQL editor. Nothing in the app grants admin, so a player cannot promote themselves.
* **Every admin resolve or retry is logged** to `admin_log` with the admin, the Tide and the outcome, and the page shows the log (section 10.4: every admin action is logged).
* **The page acts on the Tide it shows.** A resolve names its Tide number, and the server refuses it with a 409 if the open Tide has moved on, so a stale tab cannot resolve the wrong Tide.
* **Only the admin retries a failed Tide.** `claim_tide` now takes the status it claims from. The cron still claims only open Tides, so a failed Tide waits for a person to look at it, as section 15.5 says. A retry uses the Tide's stored seed, so it gives the same result as the first attempt would have.
* **Known gap:** a Tide stuck in `resolving` (the function was killed between claiming and writing) is not retried by the page yet. It needs a check on how old the claim is before it can be taken over safely.

## 2026-10-15: The live project grants its own privileges

* **The Supabase project was created with "Automatically expose new tables" turned off**, so no role gets table privileges by default. The Edge Functions failed with "permission denied for table seasons" until `service_role` was granted access in the SQL editor. Migration `20261015000001_service_role_grants.sql` records exactly that fix (usage on `public`, all on its tables, sequences and functions, and the same as default privileges for later objects). It can run twice.
* **Clients still get nothing by default.** `anon` has no grants. `authenticated` gets only the selects and row policies in `20261014000003_security.sql`, plus schema usage on `public` from `20261015000002_client_read_access.sql`. Game tables stay unreadable except through those policies and the `public_*` views. Any future table needs its own grant lines in its own migration.
* **Migrations on the live project are additive only.** No dropping or renaming columns, no destructive SQL, no resets.
* **`B.hullPerPR` is 10.** The hull to PR ratio (an NPC's hull is 10 times its PR, and PR counts hull divided by 10) was hardcoded in `npc.ts` and `balance.ts`. It now lives in `balance.ts` as `hullPerPR`, with a test that ties it to `baseHull` and `baseStat`. The parley options the API accepts now come from `B.parley.thresholds` too. Play is unchanged.

## 2026-10-15: Orders and Port screens (client step 2)

* **The screens reuse the engine, not copies of it.** The Port screen shows prices, repair costs, upgrade costs and Shipwright costs worked out by the same engine functions `port_action` uses (`unitPrice`, `saleRevenue`, `repairShip`, `nextUpgradeCost`, `hullCost`). The Orders screen builds its course with `shortestPath` and checks it with `courseError`. `client/src/ui/models.test.ts` runs both models against the real handlers on the memory store, so a screen that offers something the server refuses, or quotes a price the server does not charge, fails a test.
* **The client reads only what row level security allows:** its own `captains` and `ships` rows, `market`, its own and fleet mates' `orders`, `public_tides` and `public_captains`. It never reads `tides` (that table holds the seed). After every write it reloads from the server instead of guessing the new state.
* **Courses are picked from a list, not on the map yet.** The Orders screen has a "Sail to" list of every place within the ship's speed, with the route written out. Tapping a node on the map to set the course is a later polish task.
* **Save and Ready are separate buttons.** Saving after an edit always sends `ready: false`, so changing your orders after pressing Ready takes you back to not Ready. This avoids a Ready captain whose orders changed without them noticing.
* **Fields an intent does not use are not sent.** A hunt filter and No Quarter only go with Hunt, and an escort target only with Escort. The Escort intent is only offered to captains who have fleet mates.
* **The maneuver hint is derived from `matchup` in `combat.ts`,** so the triangle is not written down twice.
* **Not done on purpose:** the 200 fight forecast of section 7.7 (a Should in section 16.1) and showing the planned route on the map.

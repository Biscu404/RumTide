# Decisions

What was decided, when and why. Newest first. When a design decision changes, add an entry here in the same commit.

## 2026-10-15: Palette, phone layout and sound (client step 7, without the sprites)

Step 7 of section 19.1 is "recolour the assets into Endesga 32, polish the phone layout, add coin and cannon sounds and the Tide jingle". Two of the three are done. The recolour is not, because there are no sprites yet: everything is still drawn shapes. See "Not done" below.

**The palette is locked in code**
* `client/src/palette.ts` holds the 32 Endesga 32 colours, checked against Lospec, and the role names of section 2.1 (`C.deepSea`, `C.gold` and so on). Phaser scenes, the replay model and the sail colours all use it. `style.css` repeats the UI roles in its `:root` block, because CSS cannot import TypeScript.
* `palette.test.ts` is the guard. It fails if a hex or `0x` colour turns up in client code outside `palette.ts`, if `style.css` uses anything but its variables, if the CSS variables drift from `UI`, or if a fleet colour is not in the palette. It also checks that every pair of text and background colours has a contrast of at least 4.5 to 1, for small text on a phone in sunlight.
* **Free sail colours never match a fleet colour or your own gold,** so a fleet's colour on the map always means that fleet. The map and replay colours moved onto the palette, which changes how they look but not what they say. The map's zone colours are now cyan (Crown), sand (Free) and red (the Maw), and zones are still named in words on the Orders screen.
* The page is dark night blue and parchment text on dark wood frames, with square corners and buttons that press down. The design's "parchment panels" are not done: that is a redesign, and it is better judged on the real screens than guessed.

**Phone layout**
* **Marks grow when the map is zoomed far out** (`markerBoost` in `layout.ts`, up to 2.5 times). The whole Brine fits a 375 pixel screen only at about a third of its size, where names and ships were unreadable. Nodes, lanes, ship sprites and names are redrawn larger below a zoom of 0.8, and are unchanged above it. `WORLD_MARGIN` went from 80 to 110 so the bigger names at the edges are not cut off.
* Buttons, selects and inputs are at least 44 pixels tall. The tab row scrolls sideways instead of wrapping, the stats line gets its own row on a phone, the desk takes at most half the screen, and the three maneuver pickers stack in one column. The page uses `100dvh` so a phone's address bar does not hide the bottom, respects the notch (`viewport-fit=cover`), and a pull down on the map does not reload the game.
* Checked in the browser at 375 by 812 on a made up captain with real components. **Not checked on a real phone**, and the desk screens were not looked at with the live server (login is needed).

**Sound** (section 2.3, "Should" in section 16.1)
* **The sounds are made in the browser with Web Audio, not recorded.** `audio/recipes.ts` describes each sound as a few oscillator and noise voices, and `audio/sound.ts` plays them. There are no files to download or license and no new dependency. The cost is that they sound like chiptune blips, which suits the design. Real recordings can replace a recipe later without touching the callers.
* Sounds: coin (every successful Port action), cannon, splash and the sad trombone (a ship strikes its colours), a drum roll before each round's plans are revealed, a brass hit for a round won, and the Tide jingle (a bell, a rising fanfare, then a held chord, about 3 seconds).
* **A round is won by the side that dealt more damage,** stored on each `ReplayRound` as `winner`. It cannot be read from the hull lost, because a ship on its last hull points loses less than the blow that sank it.
* **Nothing plays before the first tap,** because browsers forbid it. The first pointer press or key press makes the audio context. The Sound on and Sound off button in the top bar remembers its choice in localStorage (default on). Skipping to the end of a replay is silent.
* **The jingle plays at the first tap after you open the game on a later Tide than this device last saw** (`tideNews.ts`, per season, in localStorage). A first visit is not news. This is a convenience on the device and never game state. Discord and push notifications are separate and not part of step 7.

**Not done on purpose**
* **Recolouring real assets.** It needs a CC0 pack (Pixel Frog's Treasure Hunters or Kenney's Pirate Pack, section 2.1) downloaded into the repo, and a small script that maps every pixel to the nearest palette colour, which needs a PNG library (a new dependency) or a hand written PNG reader. Both need a decision first.
* The pixel font (section 2.2) for the same reason: a font file has to be added. Text is still the system monospace font.
* Music loops. They are a "Should" in section 16.1 and not named in step 7.

## 2026-10-15: Exploration events (the rest of client step 6)

Builds the deck of 12 from section 10.1, the one part of step 6 left out of the entry below. The engine side is `engine/explore.ts`, a pure module, and every number is in `balance.ts` under `explore`.

**When an event is drawn**
* **The ship must arrive.** It sails to an island or a wreck with the Explore intent, ends its course there and did not fight. A ship that already lies on a wreck and stays draws nothing (section 4.4 rule 7 says "ends its course"; this is my reading of it, so that one spot cannot be farmed every Tide). Section 4.4 rule 7 and the Explore row of 4.5 now say so.
* **When in the Tide:** after movement, battles and the prize bonuses, before docking, in captain id order, so a ship that fought or was towed never draws. A draw takes one random number, and the Buried Chest one more.
* **Weights lean on the node.** `explore.weights` gives [island, wreck] for each event: the Old Wreck only on wrecks, the Hermit only on islands, Rum Cache, Cursed Coin, Reef Scrape and Ghost Lantern lean to wrecks, Castaway and Turtle Soup to islands.
* **An event that could do nothing is left out of the draw:** Turtle Soup at full hull, Rum Cache with a full Hold, the Hermit for a ship already at three hops (a Tide has three steps), and the Bottle when no galleon is two or more Tides away.

**What the events do**
* **Gold is plunder, not Chest gold.** The Buried Chest, Cursed Coin and Old Wreck pay times the Boom, and times 1.5 in the Maw once it is open (`explore.mawRewardMult`; Season 0 has no Maw wreck). Found gold gets no Shore Leave, Fair Winds or convoy bonus (those are for trade profit and prizes), but it earns Legend when it is banked, like all plunder.
* **Rum from a cache costs nothing,** so selling it is all profit.
* **The Reef Scrape cannot sink a ship:** it leaves at least 1 hull point. **The Monkey Thief** rounds the loss down. **The monkey itself and the Old Wreck's trinket are not built:** they belong to cosmetics and trinkets in V2 (section 16.2), so today they are words in the log.
* **The Gazette line names no amounts,** the captain's own log line does. Both are log kind `explore` with `data.event`. Anyone can read what happened in the Gazette ("heard a mermaid sing"), so the effects are no secret, only the numbers.

**Omens** (`Captain.omens`, a sorted list with no repeats)
* **Castaway:** +10% Crew (the stat value) in your next battle. **Cursed Coin:** your luck in your next battle runs 0.8 to 1.0 instead of 0.9 to 1.1. Both wait for a battle of any kind (a merchant, the galleon or a captain, won or lost), however many Tides that takes, and a battle spends them.
* **Mermaid's Song:** the hunted ship's escape chance times 1.2, before the 5% to 75% limits. **The Hermit's chart:** a course may be one hop longer, never above the 3 steps of a Tide. Both last for the next Tide only, used or not.
* **An Omen is earned for the Tide after the one that drew it,** so it cannot help the Tide that earned it. `resolveTide` reads them as a Tide opens (`held`), keeps what is still owed and adds what was drawn.
* **One rule for the course limit** (`courseLimit` in `explore.ts`) is used by the resolver, `submit_orders` and the Orders screen, so what the screen offers is what the server accepts. A test checks every place the screen lists under a chart is accepted by the handler.
* **Who can see them:** the captain, through their own row. `public_captains` leaves the column out.

**The Message in a Bottle** needed the galleon's place to be known before the galleon spawns. `galleonNodeFor(map, seasonId, tide)` now picks it from the season id and the Tide, not from the Tide's random numbers, and `spawnNpcs` uses the same function, so the galleon turns up exactly where the bottle said.
* **A caveat:** the season id is public and the engine ships to the browser, so a captain who reads the code could work the places out in advance. Fine for six friends. Before a larger group, derive it from a secret the server holds.
* **It reshuffles the random numbers** after a galleon Tide, so every seeded result for those Tides differs from before. The bot seasons now give each season its own id (`bots-1`, `bots-2`, ...): with one id the galleon sat on the same node in all of them and nobody ever reached it on Tide 7.

**Database:** migration `20261015000006_exploration.sql` is additive, `captains.omens jsonb` with a default of `[]` and `private.write_captain` replaced with the column added.

**The bots:** `explorerBot` sails from island to wreck to island, uses a chart's longer course and banks its finds. A third roster, `voyage` (four explorers, a raider, a trader), runs next to the six captains and the brawl, in `npm run bots`, through the handlers too. Its check wants all 12 events to come up, a longer course to be used, and at least 15 events a season. `checkState` now also rejects an unsorted, repeated or unknown Omen.

**What it did to the numbers** (`npm run bots`, 30 seeds)
* **The six captains** are where they were, apart from the galleon moving: ann 243 Legend (243 before), bob 167, eve 181 (178), fay 134 (138), cat and dan 67 and 80 (71 and 82). With the old random draw put back for a test, the week away was 77%, 78% and 84% again; with the galleon in its new places it is 77%, 77% and 71%. So that is the galleon's place, not the events. `npm run sim` is unchanged (3,950 and 2,244 earned by Tide 14).
* **A voyage draws about 44 events a season** for four explorers. **Exploring on its own pays about a tenth of trading:** the explorers average 38 Legend and a Chest of 63, the trader beside them 324 Legend. That fits the design (the events are a bonus on a voyage, and a trade route that stops on an island on its way gets one for free), but it is the number to watch in the internal playtest. If exploring turns out to be a trap, the amounts are in `explore` in `balance.ts`.

**How this was checked, and what was not**
* `npm test` (573 tests), `npm run typecheck`, `npm run sim`, `npm run bots` and `npm run build` pass. A real bug showed up in the tests and is fixed: the resolver tracks positions in its own map during a Tide, so the draw must be given the ship's arrival node, not its start.
* The Orders screen was looked at in a browser with a throwaway page (deleted again) at phone width: the Omen lines, a three hop list under a chart, the Explore hint and the stats bar. Screenshots timed out, so it was read from the page text.
* **Not run anywhere:** migration 20261015000006 against Postgres (the earlier PGlite script was not kept), `SupabaseStore` reading `omens`, and the whole game against a real project.
* **Still not built from the `Should` list (section 16.1):** the Escort intent, battle previews, weekly awards, and the sounds and music.

## 2026-10-15: Income bonuses, standing orders and the Legend screen (client step 6)

Step 6 of section 19.1 minus the exploration events (a `Should`, built afterwards, see the entry above). It closes the open item under Day 6 below: Shore Leave, Fair Winds and the convoy bonus now pay out. Two of the rules were the game owner's call, asked on 2026-10-15.

**Income bonuses** (`engine/income.ts`, pure and tested)
* **Which income (owner's call):** the profit on goods sold, and merchant and galleon prizes. A sale at a loss earns nothing and spends nothing. PvP loot, tribute and bounties only move gold between captains, so they get no bonus, otherwise a fight would create gold.
* **They add together:** 1 + 0.5 Shore Leave + 0.2 Fair Winds + 0.1 for each fleet mate nearby. They never multiply. The extra is rounded to a whole doubloon, and it counts as profit banked, so it earns Legend (1 per 10 doubloons).
* **When a stored Shore Leave Tide is spent (owner's call):** on the first Tide in which the captain banks any bonus income, and then every sale profit and prize in that Tide pays the +50%. A Tide with no income spends nothing, so a trade route with a sale every second Tide does not waste it. `Captain.shoreLeaveUsedTide` records the Tide it was spent in (0 for never), so a second sale in the same Tide is paid without spending another. A Tide missed after one was spent still stores one, so the pair is neutral.
* **Fair Winds is set once, as a Tide opens.** `resolveTide` sets `Captain.fairWinds` for the next Tide: Legend below 70% of the median Legend of the active captains, strictly below, and never while the median is 0. It holds for the whole Tide, so it does not flicker as scores move, the screen can show it as a steady buff, and the bots and the handlers agree exactly. An Ashore captain does not count in the median but can get the flag, so one who returns is helped.
* **The convoy is judged where the mates are.** For a sale: the fleet mates' ships as they lie now (`CaptainView.roster` gained `nodeId`). For a prize: where they ended the Tide's movement, before towing. A captain who has given notice to leave is still a mate while that Tide resolves (see the Fleets entry below).
* **Where it is applied.** `sellGood` takes it from `PortContext.income`, which is optional, so the economy sim's lone trader earns none. `resolveTide` adds a pass before docking: the extra rides in plunder with the prize and a private log line names the sources. `port_action` says it in the message: "Sold 10 sugar for 300 doubloons, and Shore Leave and Fair Winds added 90."
* **Migration `20261015000005_income_bonus.sql` is additive:** `captains.shore_leave_used_tide` and `captains.fair_winds`, `private.write_captain` replaced with both columns added, and `save_standing_orders`.

**What it did to the numbers** (`npm run bots`, 30 seeds, before and after)

| Captain | Legend | Upgrade levels | Brigantine by the end |
|-|-|-|-|
| ann, careful solo trader | 246 to 243 | 20.1 to 20.3 | 100% to 100% |
| bob, away for Tides 5 to 7 | 143 to 167 | 12.7 to 14.5 | 73% to 97% |
| eve, convoy trader | 162 to 178 | 12.7 to 14.2 | 60% to 67% |
| fay, convoy trader | 121 to 138 | 10.9 to 11.8 | 17% to 33% |
| cat (raider), dan (reaver) | 67 and 82 to 71 and 82 | 6.7 and 8.9 to 6.9 and 9.0 | 0% |

* **A week away does not reach the doc's 85% or 93% yet.** The same careful trader at his desk and away for Tides 5 to 7 (`tools/bots/away.ts`, printed by `npm run bots`): without the bonuses the away trader ends with 65% of the Legend, 68% of the levels and 76% of the Chest of the one at his desk. With Shore Leave at +50% it is 77%, 78% and 84%. Section 3.5 says about 85% and section 5.5 about 93%. The gap is bigger than the three lost Tides because the standing orders sail an away ship to the nearest port instead of along its trade loop. `balance.ts` is unchanged, +50% is the design. If you want the doc's figure, `catchUp.shoreLeaveBonus` at 0.75 gives 84%, 85% and 88%, and at 1.0 gives 91%, 91% and 81%.
* **The solo trader rows of sections 3.5 and 5.5 do not move,** because a captain at his desk alone has no Shore Leave, is not behind the median and has no mates. `npm run sim` still gives earned by Tide 14 about 3,950 (careful) and 2,240 (casual) against the doc's 3,100, Brigantine on Tide 7 and 9 against 8, and for 28 Tides at full costs about 11,250 and 5,800 against 10,400, Brigantine on Tide 9 and 13 against 11. What moves are the missed week claims above and the fleet rows, which `tools/sim` does not model. The convoy adds 10% of a fleet captain's trade profit and prizes for each mate nearby, which is rule 1 of section 8.2 at last.
* **The handlers still play exactly like the engine:** every bot season is played twice, directly and through the handlers, and the two end identically, now with the bonuses in.

**Standing orders** (section 12.4)
* **A new call, `standing_orders`,** with the plan (3 maneuvers) and the parley. `profile` (ship name, flag, parting shot) is not built and is not in the MVP, so this is a call of its own with its own row in section 15.4. Handler `standingOrders` over `GameStore.saveStandingOrders`, SQL `save_standing_orders`, Edge Function `supabase/functions/standing_orders` and its entry in `config.toml`.
* **Like orders, only while the Tide is open,** and the SQL locks the open Tide row "for share" so a change cannot slip in while the Tide resolves.
* **It bumps the captain's `version`.** A port action worked out before it fails with a 409, instead of writing the old standing plan back over the new one (`write_captain` replaces the whole row).
* **The engine already used them** (`standingOrders` in `resolve.ts`: stay docked, or sail Quietly to the nearest port, defended by the standing plan and parley). Two tests now say so, which nothing did before.
* **The form** is a section in the Orders tab ("Standing orders and Shore Leave") with the plan, the parley, one sentence in the same words as the Orders screen, and a note on how much Shore Leave is stored.

**The Legend screen** (section 6.4)
* **A tab with the leaderboard:** rank, captain, fleet (the name next to the colour), Legend, bounty, and the marks Most Wanted and Ashore as words. Pure model `legendModel.ts`, tested against a real season.
* **Equal scores share a rank** (1, 2, 2, 4). While nobody has Legend yet there is no ranking, only the list in a steady order.
* **Most Wanted** is marked with the engine's own rule (the leader, lowest id among equals).
* **Fog of Legend** (section 9 rule 11) covers the last `fogOfLegendTides` Tides: scores show as hidden, ranks stay, and a captain still sees their own score. Season 0 has none. **It is a display rule only:** `public_captains` still carries the raw Legend, so before a season with fog (not Season 0) that view must stop showing it.

**The rest of the client**
* **The Port screen** says which bonuses are paying out, with their size from `balance.ts`, and the Sell button shows the bonus it expects: "Sell 5 for 120 (+22 bonus)". `incomeModel.ts` uses the same engine functions as the server, and a test checks the promised amount equals what `port_action` pays for every mix of bonuses. The desk's stats line shows Shore Leave and Fair Winds when they apply.
* **Checked in a browser** with a throwaway page (deleted again) at phone width: the Legend table with and without fog, the bonus lines, the sale preview and the standing orders form.

**How this was checked, and what was not**
* `npm test`, `npm run typecheck`, `npm run sim` and `npm run bots` pass.
* The migrations including this one, `SupabaseStore` and the row level security were run again on a throwaway in process Postgres (PGlite, not a project dependency). Six bot seasons through the real SQL end exactly as the direct seasons, with the bonuses in. New checks: `save_standing_orders` writes, bumps the version and is out of a client's reach, and a missed Tide, a sale at a loss and a profitable sale write the new columns correctly. The throwaway script had to give its fleets `fleet_members` rows, because `apply_tide_result` from the fleets migration drops fleets with no members.
* **Not run anywhere yet:** the `standing_orders` Deno entry file, and migrations 20261015000003, 4 and 5 against a real project. The new panels were not run against a real project either.
* **Not built then:** exploration events (a `Should`), which the entry above adds.

## 2026-10-15: ReplayScene v0 (client step 5)

Section 16.1 asks for "two sprites, plans revealed round by round, damage numbers, smoke". Each battle in the Gazette now has a Watch the replay button under its text replay. The text replay stays, and says the same things in words.

* **The replay is built from the saved `Battle` record only** (`replayModel.ts`), so it can only show what happened. A `Timeline` (`scenes/timeline.ts`, pure and tested) holds every beat; `ReplayScene` draws it. Pausing is not moving the clock, skipping is moving it to the end in one step, and watching again builds a new one.
* **`Battle` gained `ships`:** each ship's `hullBefore` and `maxHull` when the fight began. The record had only the hull left after each round, so a hull bar had nothing to start from. Section 15.3 calls the record "everything the replay needs", so this is that, and it changes nothing about how a battle is fought (a test checks the rounds are identical). It is stored in a new `battles.ships` column (migration `20261015000004_battle_ships.sql`, additive, replacing `apply_tide_result` again). Battles saved before it have no `ships`; the replay then works the start hull out from round 1 (exact for one ship a side, an even split for a fleet).
* **Fleet battles show every ship, not two.** Each side lines up with its flagship nearest the middle, up to 3 or 4 a side. Names and maneuver words shorten when it is crowded.
* **Internal resolution is 320 by 180, scaled by whole numbers only** (section 2.1): the host works out the largest whole zoom that fits and the canvas is drawn with nearest neighbour. On a phone that is 1, so the canvas is 320 pixels wide.
* **Maneuvers have a shape as well as a colour** in the replay (`MANEUVER_STYLE`): Broadside a red circle, Outmaneuver a blue triangle, Board an amber diamond. Who had the edge is written as EDGE, EVEN or WEAK, and a repeated maneuver is marked REPEAT. Nothing relies on colour alone (section 16.1). The Orders screen still shows words only; giving it the same icons is a polish task.
* **A Parting Shot shows over the winning side's deck** if its captain wrote one (the first on the winning side, flagship first). The `profile` function is not built, so nobody can write one yet, and the line never appears for a merchant or a loser.
* **Reduced motion:** a player whose device asks for less motion sees the fight already finished, and Watch again plays it. The replay also has Pause and Skip to the end.
* **Luck rolls are not shown,** as in the text replay. The numbers on screen are hull points actually lost, so a ship that sinks shows what it really lost, not the overkill.
* **Placeholders until the art pass:** ships, smoke and icons are drawn shapes in Endesga 32 colours, and the text is a system monospace font. Sounds (the drum roll, the brass hit) are not built; they are in the `Should` row of section 16.1.
* **Checked in a browser** with a throwaway page (deleted again) at desktop and phone width: the sail in, the reveal, smoke and damage numbers, the sinking, the headline and the Parting Shot bubble, a fleet against the galleon, and the buttons. The throwaway page found one bug (a Phaser scene has no `events` until it is booted, so the host uses a plain callback). **Not checked:** against a real project, since the replay needs a season with a battle in it.

## 2026-10-15: Fleets (client step 4)

Section 8.1 and 15.4 give the rules in one line each. The rules live in `engine/fleet.ts` (pure, tested), the `fleet_action` function runs them through `handlers.fleetAction`, and the Fleet tab in the captain's desk is the screen.

* **Size cap is `fleetCap(players)`:** half the captains, at least 2, at most 4 (`B.fleet.capShare`, `minCap`, `maxCap`). Six captains give 3. Section 14 is updated to match.
* **Joining is immediate, leaving is not.** Giving notice in Tide N sets `leaving_at_tide` to N+1. The captain is a fleet mate for the whole resolution of Tide N (cannot hunt mates, fights beside them) and is out when Tide N+1 opens. That is how I read "takes effect at the next Tide" and "the knife is visible for one Tide".
* **Leaving is announced twice:** the Discord webhook posts a line at once, and `fleet_members` is readable by every player, so the Fleet tab shows "leaving when Tide N opens" next to the name. Failing to post never fails the action.
* **A captain alone in a fleet who leaves disbands it at once,** with no notice, because there is nobody to warn. Nothing is posted.
* **Added to the table in 15.4: `decline`.** Without it an invitation can only be ignored. It is one line in the engine and does nothing else.
* **Fleet names:** 2 to 24 characters, trimmed, no control characters, unique in the season ignoring case (also a unique index). **Flags** are six ids (`skull`, `anchor`, `cutlass`, `kraken`, `gull`, `star`), shown as words until there is art. **The colour is the server's to give:** the first of six Endesga 32 colours no fleet uses. The client never sends one. Ships in a fleet fly its colour on the map, and the name always appears next to the colour swatch, so colour is never the only signal.
* **Invitations are private to the captain asked and to the fleet that asked.** Fleets and members are public. A fleet that fills up cannot be joined even with an invitation in hand (the first to accept wins). Accepting drops every other invitation to that captain.
* **Fleet changes need an open Tide,** like orders and port actions, and lock the open Tide row "for share". Two changes made from one reading cannot both land: `seasons.fleet_rev` is a compare and swap (`apply_fleet_change`), and a captain whose fleet changes gets a new `version`, so a port action started earlier cannot write the old fleet back over it.
* **Fleet mates' orders** were already readable by fleet mates through row level security. The Fleet tab now shows them as the same one sentence the Orders tab writes, plus Ready or Not Ready.
* **Migration `20261015000003_fleets.sql` is additive:** `fleet_invites`, `seasons.fleet_rev`, a unique index on `fleet_members (captain_id)` and on fleet names, `apply_fleet_change`, and a replacement `apply_tide_result` that also takes departing captains out of their fleet when the new Tide opens. It was run on an in process Postgres (PGlite, not a project dependency) with the other migrations: the compare and swap, the unique indexes, the row level security of invitations and orders, and a real Tide with a departing captain all behaved.
* **Not built:** Mutiny Rules (instant betrayal, `mutinyRules` stays false and unused). The convoy bonus, which waited for a decision on income, is built (see 2026-10-15, client step 6).
* **Not run against a real project yet:** the `fleet_action` Deno entry file and the new `SupabaseStore` reads (`loadFleets`).

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
* **Shore Leave (+50%), Fair Winds (+20%) and the convoy bonus (+10% per fleet mate) were not applied to income when this was written.** The design did not say which income they boost or when a stored Shore Leave is spent. Decided and built on 2026-10-15, see the entry for client step 6 at the top.
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
* **The income side was built later,** on 2026-10-15 (see the entry for client step 6 at the top). Until then a trader who missed Tides 5 to 7 earned about 40% less than one who did not, against the doc's 15% (section 3.5). Still not built: exploration events (rule 7) and the Escort intent's course copy (an Escort still joins fleet mates' fights). Both are `Should` in section 16.1.

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
* **Not modelled:** Shore Leave, Fair Winds, the convoy bonus, hunters, exploration and standing orders. The bot season models hunters and standing orders (Day 5), and the bonuses are in the engine from 2026-10-15, but the economy sim's lone trader still has none of them.

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

## 2026-10-15: Gazette screen and text replay (client step 3)

* **The Gazette is a third tab in the captain's desk.** It lists the resolved Tides, newest first, and shows the headlines the engine printed, the captain's own log lines (private and fleet lines that row level security lets them read) and every battle of that Tide.
* **The text replay is built only from the saved `Battle` record** (`gazetteModel.ts`). Each round lists what every ship chose, whether it had the edge, whether it repeated its last move, the damage it dealt, the damage each side dealt and the hull left. It adds the result, gold that changed hands and bounties put on heads. Luck rolls are left out on purpose, so the screen does not invite players to read the dice.
* **Names come from `public_captains` and `public_npcs`.** Merchants are shown by kind, as in the Gazette text. The client still never reads `tides`, so the seed stays hidden.
* **Not done on purpose:** the 200 fight forecast, and reading the Gazette without a ship in the season (the Gazette tab sits in the captain's desk, which needs a captain).

## 2026-10-15: The game master can start a season

* **Not in the plan, added so the features can be tried.** The admin function has a `start` action and the Admin page shows a "Start a season" form while no season is running. Section 19.1 had seasons started from the SQL editor or the bots only.
* **Only an admin can start one, and only when no season is running** (409 otherwise). The one active season index in the database stays the final guard.
* **Captains are the accounts that have signed up, or only the caller.** "Only me" is the debug mode: a one captain season to look at the screens alone. Ship names come from a fixed list, never from account emails, so nobody's email shows on the map.
* **The map is Brine, the time zone is Europe/Bucharest, and the Tide time defaults to 21:00** (changeable in the form). The first Tide is due at the next Tide time, and the admin can always resolve it now.
* **The start is written to the admin log** with the number of captains and the preset.

## 2026-10-15: Preparing the internal playtest (client step 8)

* **Step 8 is a human job, so this entry covers what can be built before it.** Two people playing 3 to 4 Tides by hand cannot be run by the engine. What was missing: a way to end the playtest season, the one page How to play, and a runbook. `docs/PLAYTEST.md` is the runbook (setup, a 4 Tide script, what to watch, a problem log, the steps after). `docs/HOW_TO_PLAY.md` is the one page for players. The three fixes of step 8 wait for the playtest, because nobody knows yet which three they are.
* **The game master can end the running season.** Without it, the playtest season would block Season 0: a start is refused while any season is active, and the database allows only one. The new admin action `end` sets the season to `ended`, takes the Tide number like `resolve` does (a stale tab gets a 409), refuses while a Tide is `resolving`, and is written to the admin log. It needs no migration, because the store updates `seasons.status` with the service role.
* **Ending deletes nothing, but hides the season.** The client loads only the season with status `active`, so an ended season is not readable in the app. The same is true when a season finishes at Tide 14 by itself.
* **Known gap, to decide before Tide 14 of Season 0:** the final Gazette and the Legend reveal of the finale are not readable in the app once the season has ended. The Discord message is the only record. The fix is a read only view of the last season (the client reads the latest season whatever its status, with orders closed), which is not built.
* **Not built on purpose:** a Discord note when the game master ends a season, a retry for a Tide stuck in `resolving`, and joining a season after it has started.

## 2026-10-15: An ended season stays readable (client)

* **The client shows the latest season whatever its status, so the Tide 14 finale is readable.** `loadWorld` used to ask for the season with status `active` only, so a season that finished at Tide 14, or that the game master ended, vanished and the app said "No season is running yet". It now reads seasons that are `active` or `ended` and picks the running one if there is one, otherwise the most recently created ended one (`pickSeason`). A draft is never shown. This closes the known gap recorded under 2026-10-15, Preparing the internal playtest.
* **No migration was needed.** The read policies never look at a season's status: `seasons`, `battles`, `fleets` and `market` are readable to any signed in player, `public_tides`, `public_captains`, `public_ships` and `public_npcs` are views with no status filter, and a captain's own rows, orders of a resolved Tide and the log follow the captain, not the season. So an ended season reads exactly like a running one.
* **Read only means the tabs go, not the data.** For an ended season the desk offers Legend and Gazette only (`deskTabs` in `seasonModel.ts`). Orders, Port and Fleet are not shown, because the server would refuse them anyway (every game function plays "the active season"). A player who had Orders open sees the Legend after a refresh. The stats line shows the final Chest only.
* **The header says why the season is over.** A season whose last Tide resolved reads "season over after Tide 14 of 14". A season stopped before that, including one stopped during the last Tide, reads "season ended early at Tide N of 14", because it has no final Gazette. The client tells the two apart from the status of the current Tide (`public_tides`), so `SeasonInfo` now carries `status` and `tideStatus`.
* **The Legend screen becomes the final ranking.** Once the season has ended the Fog of Legend is down whatever the Tide and the preset, so every score shows (Season 0 has no fog, a full season would have hidden the last 3 Tides). The Legend leader is named champion, with ties sharing first place, and the Most Wanted mark and the Fair Winds line are dropped, since they only matter while the season runs. This is still a display rule: `public_captains` carries the raw Legend all along, see the Fog of Legend entry.
* **Only the latest season is shown.** Once a new season starts, the previous one is no longer in the app. A list of past seasons is the Hall of Legends, which is out of the MVP (section 16.2). The Discord message and the database keep the rest.
* **Not built on purpose:** a read only view for an account that was not a captain in the ended season (it sees the map and the header, as it does in a running season), and a Gazette message for a season that ended before its first Tide resolved (it still says the first Gazette is printed after the first Tide).

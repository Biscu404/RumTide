# Decisions

What was decided, when and why. Newest first. When a design decision changes, add an entry here in the same commit.

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

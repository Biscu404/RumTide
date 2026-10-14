# Decisions

What was decided, when and why. Newest first. When a design decision changes, add an entry here in the same commit.

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

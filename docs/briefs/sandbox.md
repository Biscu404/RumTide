# Brief: the sandbox

Asked for by Biscu on 16 November 2026. Nothing has been on a screen since 15 October, so before more engine or balance work Biscu wants a page to open in a browser and click, to judge whether the v0.3 game is any good. Combat tuning (P3.2b, P3.2d) is paused until Biscu says otherwise.

## Three stages

1. **A battle viewer.** Pick two ships, press Fight, step through the battle round by round.
2. **One Tide in the Cradle.** Biscu and a few bot captains. Biscu plans a voyage, presses Ready and sees what happened.
3. **A short solo run.** Several Tides in a row that end at Old Shellback.

Each stage ends with Biscu trying it. The next stage does not start until Biscu says so.

## Rules for every stage

* It runs the real `engine_v3` in the browser. No server, no Supabase, no login.
* It is its own page with its own Vite entry (the `sandbox/` folder, `vite.sandbox.config.ts`, `npm run sandbox`), separate from the v0.2 client, so nothing that exists breaks.
* Preact and plain SVG or HTML only. No Phaser, no new dependencies, no art files, no sound. Simple shapes in Endesga 32 colours (from `client/src/palette.ts`).
* No changes to engine rules or `balance.ts`. The golden Tide must not change. If the sandbox needs something the engine does not expose, add a small read only helper with a test and nothing more.
* Every word on screen is plain enough for someone who never read the docs.

## Stage 1: the battle viewer

* Two sides. Each picks a Fighting Style (the six and the Smuggler), which loads that style's template doctrine and a fresh sloop of that style. The right side can also be Old Shellback.
* Fight runs one battle with `runBattle`. Fight again uses a new seed. The seed is shown and can be typed in, so a battle can be watched again.
* A picture: the six distances from Far to Grappled as a track, both ships as simple shapes at the current distance, and Hull, Rigging and Hands bars for each ship.
* Next round and Play step through the battle.
* A short log for each round in normal words: the doctrine rule that fired for each side, the Helm move and Guns order it gave, and what that did.
* At the end: who won, how (Sunk, Captured, Escaped, Surrendered, and the two the engine also has, Won on points and Draw) and one line on why.
* Each side's doctrine as a readable list of if then rules.
* It works at phone width.

Files: `sandbox/index.html`, `sandbox/src/setup.ts` (builds the ships and runs the battle), `sandbox/src/words.ts` (turns the battle record into plain words), `sandbox/src/main.tsx` (the page), and tests next to them.

## The simple versions built in stage 1

* Every battle is in open water in a Breeze on Tide 6. No terrain, wind, ambush, Charted water or cargo choices.
* The ships are fresh sloops with no upgrades, full of Hull, Rigging, Hands and Powder, as the simulator builds them. Old Shellback is whole (Hull 300).
* The left ship is always the engine's hunter side. In the real game Old Shellback lies in wait and springs the fight himself.
* One ship a side. No fleets.
* The doctrines are the templates and cannot be edited yet.
* The log has its own plain wording in `words.ts`. It does not use the Gazette lines of `describe.ts`, which need loot and a whole Tide around the battle.
* No loot, towing or bounty is shown: the viewer stops when the battle ends.

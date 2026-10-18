# Rumtide status

**Date:** 2026-10-19. Authority order: `docs/DECISIONS.md`, then `docs/GAMEPLAY.md`, then `docs/GAME_DESIGN.md`.

## Next task

**P2.4** (engineer): `combat/encounter.ts`. Parley, the escape roll, the starting range and wind gauge, building a `BattleShip` from a `Ship` and `Captain`, applying a battle to the world (damage, loot, towing, shields, bounties, Wrecks and Flotsam in `SeasonState`), the `battle`, `parley`, `escape` and `towed` replay events, and the `Captain` and `Step` additions that D72 lists. It makes `combatEncounter` the default resolver in `resolveTide`, so the golden Tide changes on purpose. Brief: `docs/briefs/P2-combat.md`. It is done when the Definition of done in `CLAUDE.md` is met.

## Waiting on Biscu

Confirm these rule calls, all in `docs/DECISIONS.md`:
* **D64** (P2.3): the Otherwise rule of a doctrine is free, and slots count only the rules with conditions. A new captain has 3 rules and an Otherwise. GAMEPLAY 8.8 does not say.
* **D65** (P2.3): a Jettison round plays Hold and Hold Fire, and a Jettison rule fires once per battle.
* **D57** (P2.2): the fairness factor and the Cradle halving apply to PvP only, and a Sunk ship gives up at most the multiplier's share. GAMEPLAY 8.7 read literally strips the loser of everything whatever the factor.
* **D35** (P2.1): ships only grapple when both play Close In while already at Close, or through Board. Every other shrink stops at Close.
* **D36** (P2.1): any growth past Long ends the battle as Escaped.
* **D42** (P2.1): the Shallows. A Brigantine or Frigate without Local Knowledge must win a Helm contest to reach Close, or the range stops at Medium.

Answer these open questions:
* **v0.2 playtest:** does the internal playtest in `docs/PLAYTEST.md` still happen now that Season 0 is the v0.3 column?
* **P0.3 defaults:** only default #6 of the P0.3 table was Biscu's call. #1 and #2 start to matter at P6.3 and P5.
* **Streak breaker:** GAMEPLAY 19.1 is unbuilt (D34) and no task owns it.

## Top risks

| # | Risk | Evidence | Impact | Next step |
|-|-|-|-|-|
| 1 | Scope and schedule | GAMEPLAY 21 says the Season 0 column is several times the v0.2 MVP, "2 to 3 months of evenings". Biscu chose all of it. The roadmap runs to at least P13, and P2.4 to P2.6 are not started. No Season 0 date is recorded. | The date slips and friends drift before launch. | Agree the lite fallback trigger and a review date now. |
| 2 | Fairness and balance unmeasured | The brief defers all tuning to P3. No v0.3 sim or bots exist (`tools/sim` and `tools/bots` run v0.2). P2.1 to P2.3 made 46 rule calls (D27 to D72) and only D27 was Biscu's. GAMEPLAY 8.9 and 20 have no tool behind them. | A dominant doctrine or a harsh loss hits friends first. This damages the pillar "fair fights and soft falls". | Build the P3 simulator right after P2.4. Confirm D35, D36, D42 and D57. |
| 3 | Nothing playable on v0.3 until P12 and P13, and the live stack is unproven | Only the engine tests and `tools/v3` use `engine_v3`. DECISIONS lists items "not run anywhere": Deno entry files, the cron migration, migrations 3 to 5 on a real project. `docs/PLAYTEST.md` is all unticked. The server assumes one Tide a day. | A failed Tide on a live project is the worst day. Two Tides a day doubles the exposure. | Run one live rehearsal Tide before P12. Have qa-tester gate P12. |
| 4 | Content and art gap | `client/public/assets/` holds only `.gitkeep` and an empty `sprites/`. `art/`, `docs/text/`, `docs/audio/`, `docs/qa/` and `docs/specs/` are empty, and `docs/LORE.md` does not exist. GAMEPLAY 12.6 needs 30 Squalls, 8 Tales, 6 Sagas and 4 trait Tales. | A working engine with no nightly story. This hurts the pillar "a story every night". | Start `docs/CREW.md` C2 to C5 alongside P2. |
| 5 | Doc drift | GAME_DESIGN 16.1 still says 14 Tides while GAMEPLAY says 28. | Confusion when a second developer joins. | Fix 16.1 to match GAMEPLAY the next time a task touches Tide counts. |

# Decisions

What was decided, when and why. Newest first. When a design decision changes, add an entry here in the same commit.


## 2026-10-18: Phase 2, combat (P2)

Combat for the v0.3 engine, in `supabase/functions/_shared/engine_v3/combat/`. Section numbers point at GAMEPLAY.md. Where GAMEPLAY.md is ambiguous the simplest reading that fits was taken and is written here.

### Helm and guns (P2.1)

| Id | Decision | Why | Task |
|-|-|-|-|
| D27 | A ship out of Powder still fires, at half damage (`B.combat.outOfPowder`), and burns no Powder | GAMEPLAY 8.5 says "powder: 0.5 if out of Powder". The task text said "no damage"; Biscu chose the GAMEPLAY reading on 18 October 2026 | P2.1 |
| D28 | A ship that fires burns its hull's `powderPerRound`, or whatever is left if that is less. It is out of Powder only at 0, so no Powder is ever stranded. Hold Fire, Board and Repel burn none | 8.5 never says how much a round burns; `B.hulls` already holds the number | P2.1 |
| D29 | Board and Repel fire no guns. Board's grapple attempt and Repel's boarding bonus are P2.2 | The 8.5 table lists them as Guns orders, but they hit nothing | P2.1 |
| D30 | Damage is rounded to whole points, then capped at what the target has left on that track, so a track never goes below 0. Grapeshot removes round(damage ÷ 3) Hands. Chain shot against a ship with no Rigging does 0 | Whole points read well in a replay; the cap keeps the records honest | P2.1 |
| D31 | Staleness: the third round in a row with the same Guns order, and every round after it, does 20% less (`staleAfterRepeats` is 3). Any other order resets the count, Hold Fire included | 8.5 says "the same Guns order three rounds in a row"; this reads it as the round that makes three | P2.1 |
| D32 | Hold Fire's bonus (1.5 times) applies to the next round only. It does not stack when Hold Fire is played twice, and it is lost if the next round fires nothing (Hold Fire, Board, Repel) | "Next round's guns" | P2.1 |
| D33 | A ship's `guns` memory (last order, streak, Hold Fire charge) lives on the `BattleShip`. Both ships fire from the state they had when the round began, then the results are applied with `applyDamage` and `recordFiring`, which return new ships | 8.3 says guns fire at the same time; pure functions make that easy to test | P2.1 |
| D34 | Every roll is drawn from a labelled child of the round's stream `rngFor(tideSeed, "battle", hunterId, targetId, round)`: `helm/chase`, `helm/shallows/<side>` and `guns/<ship id>`. Luck is one draw per firing ship. The streak breaker of 19.1 is not built: it needs per captain luck history that `Captain` does not have yet | Adding a roll never shifts another roll, as D16 asks | P2.1 |
| D35 | The pair table only grapples when both ships play Close In while already at Close, or through the Board order (P2.2). Every other shrink stops at Close, so Close In against Hold at Close stays at Close. Close In against Close In from Long or Medium ends at Close | 8.4 says "both at Close means Grappled"; if any one band shrink from Close grappled, Board would be pointless | P2.1 |
| D36 | Any growth past Long ends the battle as Escaped: Open against Open, Hold against Open, an Open that wins the chase, and a failed Cross against Open, all counted from where the ships are. `resolveHelm` reports `escaped: true` and leaves the range at Long. The guns of an escaped round are for `runBattle` (P2.2) to skip | 8.7: "range goes past Long" | P2.1 |
| D37 | While Grappled the Helm table is skipped and the range stays Grappled. Cut Free belongs to boarding | 8.6 and the P2 brief give Cut Free to P2.2 | P2.1 |
| D38 | The wind gauge goes to the strictly higher Helm score and to nobody on a tie or in a Calm. The check uses the Helm score without the gauge bonus, with terrain and Local Knowledge included. A Lurker gets the 1.2 bonus on the check only, not in later Helm scores | Equal ships must not favour the hunter (8.9) | P2.1 |
| D39 | Starting range is Long, Medium in Fog, and a Lurker's chosen range wins over Fog. Kelp caps the start at Medium. The default Medium for a Lurker with no choice is P2.4's | 8.1 and 8.4 | P2.1 |
| D40 | Local Knowledge means the water was Charted for this captain when the Tide began (D12) and not for the opponent. It gives 1.15 Helm and waives the Shallows contest. The Reef scrape uses "Charted for you" alone (8.4), so two Charted captains both avoid it. `BattleShip.charted` is the input; P2.4 also sets it for NPC locals in their home archipelago | 4.2 and 8.4 word the two cases differently | P2.1 |
| D41 | "Moving with a Strong Current" is an input flag on the `BattleShip` (`withCurrent`, 1.15 Helm). P2.4 decides who counts as moving with it when it builds the battle | A water has no direction, a lane does, and the Narrows is Shallows terrain with a strong lane | P2.1 |
| D42 | Shallows: when the range would reach Close from a wider band, every Brigantine or Frigate in the battle without Local Knowledge rolls its own Helm contest against its opponent and must win it. If any loses, the range stops at Medium. This holds even when the opponent is the one closing, and two big ships must both win. The hunter's contest is rolled first. Nothing is rolled once the ships are already at Close | 8.4: "must win a Helm contest to reach Close, even against Close In" | P2.1 |
| D43 | Kelp: the range never goes beyond Medium, so nobody can escape by range in Kelp | 8.4 | P2.1 |
| D44 | Reef: each ship that plays Close In or Cross Their Bow, after the Crippled rule, loses `reefScrape` Hull that round whatever the pair result, unless the water is Charted for its captain. Nothing is charged while Grappled. `resolveHelm` reports the scrape; applying it is `runBattle`'s job | 8.4 | P2.1 |
| D45 | Crippled means Rigging at 0 with some max Rigging. A Crippled ship's Open Range and Cross Their Bow count as Hold. A monster with no Rigging at all is never Crippled, but its Helm score is 0 until P2.6 gives Old Shellback its fixed number | 6.3 | P2.1 |
| D46 | A Helm contest between two scores of 0 is even | A÷(A+B) is undefined there; it needs two Crippled ships | P2.1 |
| D47 | New number: `B.combat.bands`, the band count of each pair table row (1 or 2 bands). No existing number changed | The rule is no number in the combat files, and these are table values P3 may tune | P2.1 |
| D48 | The combat types are shapes only. Otherwise is a rule with no conditions. An `ability` action lets evaluation continue below it; `surrender` and `jettison` are special actions, and what a Jettison round does for Helm and Guns is P2.3's call. `crippled` is one of the seven outcome kinds of 8.7 although it does not end a battle, and P2.2 decides how a record carries it. `RoundRecord` has no boarding melee until P2.2 | Complete as the spec allows, without guessing at P2.2 and P2.3 | P2.1 |
| D49 | `combat/testing.ts` holds test helpers: `battleShipFrom`, `ScriptedRng` and `deepFreeze`. P2.4 needs a real builder from a `Ship` and `Captain`, and `battleShipFrom` is the starting point | Keeps P2.1 to its three files plus tests | P2.1 |

### Boarding, battle and loot (P2.2)

Files: `combat/boarding.ts`, `combat/battle.ts`, `combat/loot.ts`, each with tests. No new number in `balance.ts`: every number was already there. D35, D36, D37, D44 and D48 are the seams this task picks up.

| Id | Decision | Why | Task |
|-|-|-|-|
| D50 | `runBattle` takes a **Chooser** per side, a function from what the ship sees (`RoundView`: round, range, terrain, wind, gauge, both ships, what each played last) to a `RoundChoice` (the rule index, the ability rules above it, a Helm move and Guns order, or Surrender, with an optional Jettison flag). P2.3 builds Choosers from Doctrines. It does not resolve crew abilities (8.3 step 2): it only records the ability rules a Chooser says fired. One ship a side; P2.5 widens the sides | Keeps `battle.ts` free of rule evaluation, so P2.2 can be tested with scripted captains and P2.3 plugs in without touching it | P2.2 |
| D51 | Repel multiplies boarding strength by 1.3, as 8.6 writes it. Since each side removes 20% of its own strength, a Repelling ship also kills 30% more. The 8.5 table's "+30% boarding defence" is read as that same factor. A ship that plays Repel fires no guns (D29). Kelp's +15% (2.2) applies to both ships | 8.6 gives the formula and 8.5 gives only a name for it | P2.2 |
| D52 | Crippled is recorded in `RoundRecord.crippled` the round a ship's Rigging first reaches 0, and stays true in the final state. `runBattle` never ends a battle as `crippled`: the kind stays in `OutcomeKind` as the seventh row of 8.7, but the table says "battle goes on". The tests show the six that end a battle and that Crippled happens, stops Open Range and Cross, and does not end the fight | The table says the battle goes on, and D48 asked P2.2 to decide | P2.2 |
| D53 | Surrender is settled at the top of the round, before Helm, guns or melee: the colours come down and nothing else happens that round. The round is written down with `struck` set, the rule that said Surrender, and a placeholder `hold` and `holdFire` for both ships. If both sides strike in the same round it is a Draw | 8.7: "Ship stops taking damage". The end check list of 8.3 would have it fall after a round of shooting | P2.2 |
| D54 | End checks run in the order Sunk, Captured, Escaped. If both ships reach 0 Hull in the same round, the side that dealt more damage in the battle (D56) wins Sunk, and equal damage is a Draw. A Reef scrape (D44) can sink a ship, and the scrape is taken before the guns fire | The v0.2 rule for this (DECISIONS, 14 Oct) carried over | P2.2 |
| D55 | A ship is Captured only by boarding: the 40% and 20% line (8.6) is checked after a melee, never because Grapeshot thinned a crew. If both sides fall below the line, the side with fewer Hands is Captured and equal Hands is a Draw | 8.6 says "wins the boarding" | P2.2 |
| D56 | Victory on points compares **damage share**. A hit counts as the share of the victim's max on that track (Hull, Rigging or Hands), averaged over the victim's tracks (three, or two for a ship with no Rigging). Guns and melee Hands count; a Reef scrape does not. A lead of exactly 10 points counts, with a 1e-9 tolerance so floating point cannot take it away. `BattleRecord.dealt` holds each side's total | 8.7 says "10 points of damage share" and does not say which tracks. Hull alone would make Chain and Grapeshot doctrines unable to win on points | P2.2 |
| D57 | The fairness factor and the Cradle halving apply to **PvP only**. Loot is the table share times that multiplier. A Sunk ship gives up `min(1, multiplier)` of what it carries, so a bully's sinking does not strip a weaker captain, nor a Cradle sinking a newcomer. The winner grabs 25% times the multiplier (then the cap), and the rest of what the loser gives up becomes the Wreck. The other paying outcomes take exactly what the winner gets | 8.7 says "the rest of its cargo becomes a Wreck" and "all loot is multiplied by the fairness factor". Read literally, the loser would lose everything whatever the factor, and the Cradle halving would protect nobody. **Biscu to confirm** | P2.2 |
| D58 | The per battle cap counts value: plunder at face value, cargo at a price per unit the caller supplies (B.economy.basePrice for each good until P5 brings markets) times the Boom (1 until P5). Over the cap, the winner takes the same smaller share of every item. All amounts are whole units rounded down. The winner's Hold limit is P5.1's (D25) | The cap is in doubloons and cargo has no price yet | P2.2 |
| D59 | The Capture pick is always gold, and gold adds nothing beyond the 40%. `CapturePick` is a union with one member and `capturePick()` is the seam where P7.3 (intel) and P8 (prisoners) add the others. Volunteers (6.4) are not built; they need the winner's Berth room and belong with applying results (P2.4) | The brief says the pick is gold until intel and crew exist | P2.2 |
| D60 | Jettison throws every cargo good overboard and keeps the plunder aboard. It becomes Flotsam in that water for 2 Tides (`jettison()` in `loot.ts`), and is applied before `settleLoot`, so the winner finds nothing to take. `runBattle` only records who jettisoned (`BattleRecord.jettisoned`, `RoundShipRecord.jettison`). What a Jettison round plays for Helm and Guns is still P2.3's call (D48) | 8.7: "cargo thrown overboard" | P2.2 |
| D61 | Board is tried after the Helm step at the range the Helm left, once per ship that plays it, at Close only. "They Hold" means the other ship's Helm move is Hold, "they Board" its Guns order. A failed Board does nothing, and Board fires no guns. Cut Free: while Grappled, each ship that plays Open Range (after the Crippled rule) rolls its own Helm contest from the child stream `helm/cutFree/<side>`; if any wins the range returns to Close, and there is no melee that round. A ship that plays Board in the same round may grapple again | 8.5 and 8.6 give the rules but not their order | P2.2 |
| D62 | Wrecks and Flotsam are `SalvagePile` records (`{ id, water, goods, plunder, untilTide }`, from `loot.ts`) with ids `wreck_t<tide>_<ship>` and `flotsam_t<tide>_<ship>`. `untilTide` is the last Tide it can be salvaged: the battle Tide plus 4 for a Wreck, plus 2 for Flotsam. A Wreck holds plunder as well as goods. P2.4 adds them to `SeasonState`; this task only makes them | Same convention as the shield (D23) | P2.2 |
| D63 | Types grew, additively: `BattleShip.boardingBonus` (0 until crew), `ContestRecord` kind `cutFree`, `RoundRecord` `grapples`, `melee`, `crippled` and `struck`, `RoundShipRecord.jettison`, and `BattleRecord` `final`, `dealt` and `jettisoned`. `contestRecord` is now exported from `helm.ts`. Test helpers `always`, `scripted`, `surrendersAt` and `battleOf` joined `testing.ts`. The golden Tide is unchanged: nothing in P2.2 is called by `resolveTide` yet | P2.4 needs the whole result of a battle in one record | P2.2 |

### Doctrines (P2.3)

Files: `combat/doctrine.ts` and its tests. It builds the Choosers that `runBattle` takes (D50). New numbers in `balance.ts` under `B.combat.doctrine`: `slotRanks`, `maxConditions` and the four template thresholds. `battle.ts` grew two small seams (D66, D67). Nothing here is called by `resolveTide` yet, so the golden Tide is unchanged. The templates are not tuned: P3 does that.

| Id | Decision | Why | Task |
|-|-|-|-|
| D64 | **Slots count the rules that have conditions. The Otherwise rule is free** and always there, so a captain with the base 3 slots has 3 rules and an Otherwise. Slots are 3, plus 1 at Command rank 1, plus 1 at rank 4, plus 1 for each `doctrine.slot` perk (a Helmsman, the Navy Deserter background; crew and Background grant it in P8), cap 7. The slot limit is checked when a doctrine is saved (`validateDoctrine`), never when it is played, so a captain who loses a slot keeps fighting with the doctrine they had. A rule has 1 or 2 conditions; only the last rule has none, and it must give a Helm move and Guns order or Surrender, so every round has a play. A captain keeps at most 3 doctrines with different names | 8.8 says "Slots: 3" and "The last rule is always Otherwise" without saying whether Otherwise takes a slot. If it did, a new captain would have 2 real rules, and the GAMEPLAY 8.8 Boarders example (4 rules and an Otherwise) would need 5 slots. Biscu confirmed this on 19 October 2026 | P2.3 |
| D65 | **A Jettison round plays Hold and Hold Fire**, and throws every cargo good over the side (D60). A Jettison rule fires once per battle: once a ship has jettisoned, the rule is skipped like a used ability and evaluation goes on below it. The play is `JETTISON_PLAY` in `doctrine.ts` | 8.8 lists Jettison beside Surrender as something a rule does instead of a Helm move and Guns order, so the round needs a play. Hold and Hold Fire is the quiet one: the crew is busy, so the ship does not chase, flee or shoot, and it pays by being open to a Board (they Hold, D61) and by missing a round of damage, softened by Hold Fire's bonus on the next round. A second Jettison would only waste rounds. Biscu confirmed this on 19 October 2026 | P2.3 |
| D66 | `RoundView` gained `jettisoned: Record<BattleSide, boolean>`, true for a side that threw its cargo over in an earlier round. It is how a Chooser knows a Jettison rule is spent | A Chooser sees only the view, and this is battle state | P2.3 |
| D67 | **An ability a doctrine fired is used up at once.** `runBattle` takes it out of the ship's `abilities` right after the choices are made, so "ability unused" is false from the next round and in `final`. The round record keeps the fire. This holds for the round the colours come down too. Resolving what an ability does to the battle (8.3 step 2, "in order of Helm score") is crew work, P8.4, and hooks in where `runBattle` reads `choice.abilities` | Without it an ability rule would fire every round | P2.3 |
| D68 | **The ability slot is a registry** (`AbilityRegistry`, `ABILITIES`) passed to evaluation and validation, empty and frozen as the brief says. An ability rule fires only if the ability is registered and the ship still carries it unused, and a doctrine fires one ability once per round. The ability rule never gives the play, so evaluation goes on below it. The tests use a fake registry. A doctrine that gives no play, which only an invalid one can do, falls back to Hold and Round shot with rule index `-1` (`NO_RULE`), so a broken doctrine never crashes a Tide. Evaluation reads unknown conditions as false | The brief asks for a working slot with no abilities registered. A Tide must never fail on stored data | P2.3 |
| D69 | **Range conditions read the range as a distance.** Long is the farthest and Grappled the nearest, so "range at least Medium" is Medium or Long and "range at most Medium" is Medium, Close or Grappled | 8.8 says "at least X" and "at most X" about range. Distance is what the word means. The other reading, band order, reverses every test | P2.3 |
| D70 | A Hull, Rigging or Hands test on a track the ship does not have reads 0%. Old Shellback has no Rigging, so "their Rigging above 50%" never fires against it and "their Rigging below 30%" always does | 0 of 0 has to be something, and the Helm score of a ship with no Rigging is 0 as well (D45) | P2.3 |
| D71 | **The four templates** are `templateDoctrine(name)` copies, 3 rules at most so a new captain can keep any of them. **Brawler:** Close In; Grapeshot when Grappled, Board at Close, Board when their Hands are below half, else Round shot. **Skirmisher:** Cross Their Bow; Close In with Chain shot after they Open Range, Chain shot while their Rigging is above half, else Round shot. **Runner:** Open Range every round; Repel when Grappled to cut free, Chain shot while their Rigging is above half, else Round shot. **Coward:** Hold with Round shot, Surrender when its Hull is below half (8.8). Thresholds are in `B.combat.doctrine.templates`. A 200 seed matrix of equal sloops showed the cycle of 8.4 at work: Skirmisher sinks Brawler almost every time, Brawler captures Coward every time, Runner escapes nearly everything and Skirmisher cannot stop a Runner in round 1 because Open Range beats Cross. Nothing tuned | The brief gives only the four names and a one line description of each. The matrix is for P3 to start from, against the 8.9 checks | P2.3 |
| D72 | **What is left for P2.4.** The `Captain` fields (`doctrines`, `defaultDoctrine`, and the Brawler template in `newCaptain`), the `Step.doctrine` pick, and the mapping from a `Captain` to an `EnemyType` for the "enemy type" condition. Evaluation takes the enemy type from `DoctrineContext`, and `newCaptain` can call `templateDoctrine("Brawler")`. `EnemyType` has no value for the rookie and local NPC roles, so P2.4 decides what those count as | The brief puts the encounter and the data model in P2.4 | P2.3 |

## 2026-10-18: Version 0.3 engine core (roadmap P0 and P1)

The game moves to the v0.3 design in `docs/GAMEPLAY.md`: two Tides a day, archipelagos, Watches and the Wind and Current System, charting, programmed doctrines. The new engine lives in `supabase/functions/_shared/engine_v3/`, next to the v0.2 engine in `engine/`. The prototype (server, client, bots, sim) keeps running on v0.2 until the server and client move over in roadmap phases P12 and P13; then `engine_v3` replaces `engine`. Where GAMEPLAY.md and GAME_DESIGN.md disagree, GAMEPLAY.md wins for the v0.3 engine. Section numbers in this entry point at GAMEPLAY.md.

### Open decisions from GAMEPLAY 22 (defaults, P0.3)

These are defaults, chosen so the build can move. Biscu can overturn any of them.

| # | Decision | Default | Why |
|-|-|-|-|
| 1 | Season 1 length | 21 days, 42 Tides | Two Tides a day already gives half again as many resolutions as v0.2's 28 day season |
| 2 | Heritage when buying a new hull | Name (optionally with a numeral), flag, sail colours, figurehead and trophies move. Scars and ship traits stay with the old ship in the Old Moorings | Biscu's rule that scars stay with the ship that earned them, while identity stays with the captain |
| 3 | Medium Hotspots | The rarest, surprise tier: about 1 every 8 to 10 Tides, no warning | Matches Biscu's wording; Season 0 has none, so this can wait |
| 4 | Cradle Truce | No hunting players in the Cradle before Tide 5 | Gives everyone the tutorial and a First Mate before PvP |
| 5 | The Forger | One unique NPC, plus at most 2 Forger's Kits per season | Keeps forgery special, as Biscu asked |
| 6 | Season 0 shape | The full Season 0 column of GAMEPLAY 21 | Biscu decided this on 18 October 2026 |
| 7 | Working names | Keep all of them for now | Names can change at any time without code changes |
| 8 | Source of truth | GAMEPLAY.md for gameplay; GAME_DESIGN.md v0.2 for everything it covers that GAMEPLAY.md does not | Fold both into one doc once Season 0 is stable |

### Engine rules (P0 and P1)

| Id | Decision | Why | Task |
|-|-|-|-|
| D1 | Every map element id (archipelago, island, water, lane, site, strait) is unique across the whole map, lowercase with underscores. A captain's knowledge is one map from id to level | One lookup instead of five; the validator enforces it | P1.3 |
| D2 | Lane bearings are derived from water positions (x east, y south) and rounded to the nearest 45 degrees | Map files cannot get bearings wrong, and the client can draw the same positions | P1.3 |
| D3 | A lane into a hidden island must itself be hidden; islands with hidden lanes cannot be fully charted until those lanes are found | Hidden islands stay hidden, and finding secrets matters for the full chart bonus | P1.3, P1.4 |
| D4 | Time inside a Tide is a shared clock of ticks from 0 to 9, one tick per Watch. Ships with fewer Watches finish sooner and then sit still in their last water until the Tide ends | Makes Watches mean speed as well as reach, and keeps meetings exact | P1.8 |
| D5 | Two ships meet when they are in the same water on the same tick, or travel the same lane in opposite directions at overlapping times. The crossing time is solved exactly and rounded to 0.001 | The exact rule needed for head on interceptions | P1.8 |
| D6 | After an encounter on a lane, each ship returns to the water it left; the hop is abandoned and unused Watches are lost | Simple, and a ship never ends a Tide on a lane | P1.8 |
| D7 | In Phase 1 every encounter freezes both ships (`stubEncounter`). A ship has at most one encounter per Tide unless the resolver lets it keep sailing | Combat (P2.4) replaces the stub and decides escapes | P1.8 |
| D8 | A Hunt sail step hunts while sailing and on the tick it arrives. A Lurk hunts from when it starts until the Tide ends. Idle ships never hunt | Hunters catch ships at their destination; finished plans are passive | P1.8 |
| D9 | When two ships hunt each other, the lower ship id is recorded as the hunter and the encounter is marked mutual | Deterministic; P2 can treat mutual encounters differently | P1.8 |
| D10 | The Cradle Truce protects players from every hunter (players and NPCs) in the start archipelago before Tide 5. Shields only protect against player hunters | GAMEPLAY 2.4 says no hunting of players; shields exist to stop players bullying | P1.8 |
| D11 | Surveying or landing from a Harbour keeps a ship docked. Sailing, lurking and repairing cast off | Looking around the harbour should not cost you your safe berth | P1.8 |
| D12 | The reef penalty, and later Local Knowledge, use what the captain had Charted when the Tide began, not what they charted on arrival | Arriving charts the water at once, which would otherwise cancel every reef penalty | P1.6 |
| D13 | Provisions and Powder take half a Hold unit each. A fresh sloop starts with 4 Provisions and 6 Powder, 5 of its 10 units | Otherwise a sloop is overloaded before it carries any cargo | P1.5 |
| D14 | Watches: bonuses apply up to the cap of 9, then penalties apply, never below 1 | Penalties always bite, even for maxed ships | P1.5 |
| D15 | Wind is derived from the season seed, the archipelago and the Tide number, never from the Tide seed | Forecasts are exact, any number of Tides ahead, and players cannot change the weather | P1.6 |
| D16 | Every random roll comes from a named stream: `rngFor(seed, ...labels)` | Adding a roll in one system never shifts another system's results | P1.2 |
| D17 | Standing orders sail Quiet to the nearest known Harbour and Dock; ties go to the lower water id | v0.2 said sail quietly home; ties need a rule | P1.7 |
| D18 | Sight in Phase 1: your own water only. The `lookout` perk adds neighbouring waters, except Fog waters. Ships on lanes cannot be seen | Enough for "if in sight" conditions; Lookouts get their full rules in P8 | P1.8 |
| D19 | A Survey rolls once for a hidden passage, and only where one exists. A found passage is Charted, its far water Sketched and its island Rumoured | GAMEPLAY 3.2 and 4.3 | P1.4 |
| D20 | Landing on a site with an unlock key reveals every lane behind that key as Sketched and makes the waters and islands at both ends Rumoured | GAMEPLAY 2.4: Hermit's Reach becomes Rumoured after the Whispering Ruins | P1.4 |
| D21 | The planner can route only through lanes the captain has at least Sketched and waters at least Rumoured. A route is chosen at the start of its step and kept, even if a hop turns out dearer | Plans fail in exactly the way the captain's knowledge is wrong (Becalmed Short) | P1.7 |
| D22 | Steps that make no sense at run time (dock away from a Harbour, land on another island) are skipped with a reason instead of failing the Tide | A bad step must never break a Tide; submit_orders will reject them earlier | P1.8 |
| D23 | Shields after a PvP loss last 4 Tides (two days), doubled from v0.2 because there are now two Tides a day | Same real time protection as v0.2 | P0.4 |
| D24 | The Boom is a placeholder 2% per Tide, half of v0.2's 4% | Same growth per day; P6.3 retunes the whole economy | P0.4 |
| D25 | Not in Phase 1, with the task that adds it: Crossings (P5.6), going over Hold capacity (port actions, P5.1), the Fisher's Child Provisions perk (P8.1), Navigator current reading each Tide (P8.3), Storms (Season 1, the Maw) | Keeps Phase 1 to movement and knowledge | P1 |
| D26 | Power Rating, for parley, fairness and NPC scaling: PR = (max Hull ÷ 10 + Cannons + Sails + Hands ÷ 3) ÷ 4. A fresh sloop is 10 | Replaces v0.2's formula, which used the Crew stat that no longer exists | P2.0 |

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

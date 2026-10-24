# Fighting Styles prototype (scratch, not production)

This branch holds the scratch prototype that produced every number in `docs/specs/fighting-styles.md` (D121 to D141). It is a copy of `engine_v3` with the six Fighting Styles, six distances, Deck orders, fire and the reworked Old Shellback switched on through `B.proto`, plus the tools that tuned and checked it. It is not meant to be merged. P3.B2 builds the real thing on `main` from the two specs, and this branch is the reference for how each rule behaved.

## What changed in the engine

Seven files under `supabase/functions/_shared/engine_v3`: `balance.ts` (a `proto` block of switches and numbers, new range rows, `power.exponent`), `ship.ts` (`powerRating` with the exponent), and `combat/` `battle.ts`, `fleet.ts`, `guns.ts`, `helm.ts`, `types.ts`. Every prototype addition is marked `PROTOTYPE` in a comment. Set `LADDER=6` for the six distances (the default stays at four).

## The final numbers

* `tools/proto/tune_state_v7.json`: the style numbers (written as `B` paths, plus `tpl.*` for the template variants in `tune.py`).
* `tools/proto/boss_final2.json`: the Old Shellback numbers.

## Tools (run from the repo root, `LADDER=6 node tools/proto/<file>.ts '<json>'`)

* `styles.ts`: the six styles and the Smuggler, round robin, wheel numbers. `wheel.py` holds the designed wins and even pairs and prints the report.
* `tune.py`: coordinate search scored by the wheel. `boss_tune.py`, `boss_eval.py` and `bosssearch.ts`: the Old Shellback search per style.
* `checks.ts` and `run_checks.py`: check 3 (the seat) and check 4 (Power Rating).
* `situations.ts` with `run_sit.py` and `run_sit3.py`: check 2 (best plays), general and Grappled. `check2_all.sh` runs both.
* The rest (`measure.ts`, `deck.ts`, `trace.ts`, `roundrobin.ts`, `*_probe.py` and the other `run_*.py`) are one-off probes from the boarding and style work.

The logs and `o_*.json` outputs are not included, because they are large and can be rebuilt. The measured results are in the spec.

# Commands

The full help for every command. `CLAUDE.md` keeps one short line per command.

* Start the dev server: `npm run dev`
* Run the tests: `npm test`
* Check types: `npm run typecheck`
* Build for production: `npm run build` (output in `dist/`)
* Run the balance simulation: `npm run sim` (checks the combat table of section 7.3, a bot trader against the solo pacing of sections 3.5 and 5.5, and the galleon odds of section 8.2)
* Check everything before finishing a task: `npm run verify` (`check`, then `prose:check`, then `assets:check`; about 45 seconds; GitHub runs the same command on every pull request)
* Check types and all tests: `npm run check` (v0.2 and v0.3)
* Check the art palette: `npm run assets:check` (run it after touching assets; it finds Python itself through `tools/run-py.mjs`: `py`, `python3` or `python`)
* Check the prose rules: `npm run prose:check` (flags dashes in docs, client and supabase text; `docs/reference/` is third party text and is skipped)
* Resolve one v0.3 Tide and print it: `npm run tide:demo` (`npm run tide:demo -- --shellback` plays a challenge to Old Shellback instead)
* Rewrite the v0.3 golden Tide after an intentional rule change: `npm run golden:update`
* Tune the v0.3 combat numbers: `npm run sim:tune` (the quick run of every check except check 2, about 1 minute instead of 4; run the full set once at the end)
* Run the v0.3 combat simulator, ten checks: the five of GAMEPLAY 8.9 (1 field share, 2 best play, 3 seat split, 4 Power Rating, 5 Old Shellback) and five more (6 the wheel, 7 equal spending, 8 Drill, 9 Lashed fast, 10 the Smuggler escapes): `npm run sim:v3` (the full run takes 11 minutes on an idle machine and up to 20 on a busy one, most of it check 2; `-- --quick` takes about 3 minutes, for tuning loops; `-- --check 1,6` for some checks, 1 to 10; `-- --json file` to keep the numbers; `-- --set combat.rake=1.5` tries a number of `balance.ts` for one run without editing the file, and can be repeated; a bad flag exits 2, a failed check exits 1)
* Run a bot season: `npm run bots` (six scripted captains and a six raider brawl play Season 0 on the real engine over 30 seeds each, `npm run bots -- 100` for more; every season is played twice, directly and through the Edge Function handlers, and the two must end identically; fails on any impossible state, crash, non deterministic season or insane total)

The long runs (`npm run sim:v3` in full, long bot seasons) need a background command. The rules for them are under "Saving tokens" in `CLAUDE.md`.

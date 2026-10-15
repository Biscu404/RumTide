# Internal playtest (client step 8)

Section 19.1, step 8: one friend and you play 3 to 4 Tides, triggering each Tide by hand about once an hour. The aim is to find the worst three problems, fix them, finish the one page [How to play](HOW_TO_PLAY.md), and then announce the Season 0 start date.

The playtest runs on the real project, with a throwaway season called "Playtest". When it is over the game master ends it, and the real Season 0 starts on a clean slate.

## Before you start

* [ ] The live project has every migration (`supabase db push`) and every function deployed, including `admin` (`supabase/README.md`).
* [ ] The latest `npm run build` is live on Cloudflare Pages, and `npm test` and `npm run bots` pass.
* [ ] You are in the `admins` table, and the Game master button opens the page.
* [ ] Your friend has opened the site on their phone, created an account and confirmed the email. Only accounts that exist when a season starts become captains.
* [ ] Optional: `DISCORD_WEBHOOK_URL` is set, so you can check the Gazette message arrives.

## Starting it

1. Game master, Start a season. Name it "Playtest", length "Season 0", captains "Everyone who has signed up".
2. Set the Tide time to an hour when you will not be playing (03:00 works). The cron turns a Tide when it is due, so a Tide time in the middle of the session would turn one under you.
3. The first Tide can turn by itself within 5 minutes once you are both Ready (the early Tide rule, section 11.2). That is worth seeing once. After one Tide has turned today, early Tides are off for the rest of the day and you turn each Tide yourself.

## Each round

1. Both read the Gazette tab, visit the Port tab, set orders and press Ready.
2. The game master presses Resolve Tide N now on the Game master page (the Tide number is checked, so a stale tab cannot resolve the wrong one).
3. Both read the new Gazette and write the problems down straight away (table below). Do not wait until the end.

## What to try in 4 Tides

| Tide | Try this | Watch for |
|-|-|-|
| 1 | Both Trade Run to a port that wants a good you carry. Look at the Orders sentence before pressing Ready. | Is it clear what to do on the first screen? Do prices and profit match what the Port tab promised? |
| 2 | One of you creates a fleet, the other accepts. Sail together, one Escorts. | Invite flow, fleet mates' orders on the Fleet tab, and the income bonus for ending the Tide close together. |
| 3 | One Hunts the other at sea. Try a Parley, then try a docked ship. | The text replay and ReplayScene readable? Is a loss clear and fair? Does a docked ship stay safe? |
| 4 | One skips their orders. The other Explores an island or wreck. | Standing orders, Shore Leave, the exploration event text, Legend tab. |

Also use the phone for at least one round: reload mid Tide, rotate the screen, switch sound on and off, and read the Gazette in daylight.

## Numbers to watch

* Income per Tide against the Season 0 pacing table in section 3.5 (about 97 on Tide 1 for a solo trader).
* Exploring pays about a tenth of trading (`docs/DECISIONS.md`, the exploration entry). If it feels like a trap, the amounts are in `explore` in `balance.ts`.
* Whether anything needed an explanation you had to give out loud. That is a gap in the How to play page or the screens.

## Problem log

Copy this into a note and fill it in during the session.

| Tide | Who | What happened | How bad (1 to 3) | Fix idea |
|-|-|-|-|-|

Rank by how many players it hits and how much it spoils the Tide. The top three get fixed before Season 0. Everything else goes into `docs/IDEAS.md`.

## Afterwards

1. Game master, End this season. This is logged to the admin log. Nothing is deleted. The app keeps the Playtest as a read only record (header says the season ended early, orders are closed, Legend and the Gazette stay open) until the next season starts, because the app shows only the latest season. Copy anything you want to keep before you start Season 0.
2. Fix the worst three problems, one at a time, each with a test, as in `CLAUDE.md`.
3. Read [How to play](HOW_TO_PLAY.md) against what you saw. Anything a player had to ask you about goes in.
4. Make sure all six friends have signed up and confirmed their email. Then pick a start date, announce it with the How to play page, and start Season 0 from the Game master page with the real Tide time.
5. Update the focus line in `CLAUDE.md` and add the decisions to `docs/DECISIONS.md`.

## Known gaps going in

* **A Tide stuck in "resolving"** is not retried by the page yet (`docs/DECISIONS.md`, Day 7).
* **Captains are fixed when a season starts.** Someone who signs up later cannot join that season.

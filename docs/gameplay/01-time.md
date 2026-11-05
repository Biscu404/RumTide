# 1. Time

## 1.1 The two Tides

* Two Tides a day at **13:00 and 20:00, Europe/Bucharest**. Both work exactly the same way: same rules, same Gazette edition, same replays.
* Launch day: Tide 1 resolves at 20:00. After that they alternate 13:00, 20:00, 13:00 and so on.
* Windows between Tides: 20:00 to 13:00 is 17 hours (overnight); 13:00 to 20:00 is 7 hours (afternoon). The short afternoon window is why a voyage plan can cover two Tides (3.6).
* **Early Tide:** if every active captain is Ready, the Tide resolves at the next 5 minute cron tick. The Tide after it still waits for its scheduled time, so Tides never bunch up.
* **Reminders:** one ping 2 hours before each Tide, only to captains who are not Ready. At most 2 Tide posts and 2 reminders a day.

| Time | What happens |
|-|-|
| 11:00 | Reminder to captains not Ready |
| 13:00 | Tide resolves, Gazette edition, replays |
| 13:00 to 20:00 | Afternoon window (7 hours) |
| 18:00 | Reminder to captains not Ready |
| 20:00 | Tide resolves, Gazette edition, replays |
| 20:00 to 13:00 | Overnight window (17 hours) |

## 1.2 One session (2 to 5 minutes)

1. **Gazette** opens if a Tide resolved since your last visit.
2. **Port and ship** (instant, only when docked for port actions): trade, upgrades, repairs, hire Hands, buy supplies, crew skill points, recruit.
3. **Events:** answer pending choices.
4. **Diplomacy:** pacts, intel trades, wagers, Gazette services.
5. **Plan:** voyage plan for the next Tide (and optionally the one after), pick a doctrine.
6. **Ready.**

Rule: port actions happen instantly during your session. Everything at sea happens at the Tide.

## 1.3 Season shape

| | Season 0 (beta) | Season 1 |
|-|-|-|
| Length | 14 days, 28 Tides | 21 days, 42 Tides (recommended; 28 days and 56 Tides is the alternative, see 22) |
| Map | The Cradle plus 2 archipelagos | The Cradle plus 5 archipelagos plus 1 hidden |
| Act 1: The Cradle | Tides 1 to about 8 | Tides 1 to about 8 |
| Act 2 | Tides 9 to 28 | The Open Brine, Tides 9 to 30 |
| Act 3 | None; finale BHS on Tide 28 | Grimbeard's Rest, Tides 31 to 42; Kraken finale on Tide 42 |

Why 21 days for Season 1: v0.2 chose 28 days with one Tide a day. With two Tides a day, 21 days already means 42 resolutions, half again as many as v0.2's full season.

## 1.4 Season 1 story: The Last Voyage of Old Grimbeard

* Old Grimbeard, greatest pirate of the Brine, has died in his hometown of **Gullhaven**, in the **Cradle Isles**.
* His will leaves each of his young protégés (the players and a few NPC rookies) one sloop from his fleet and nothing else. That is why everyone starts equal, in the same place.
* His hoard lies somewhere beyond **the Narrows**, a strait guarded by **Old Shellback**, a giant hermit crab that wears a sunken galleon as its shell. Legend says only Grimbeard ever got past it.
* **Act 1:** learn to captain, recruit crew, find the hidden islands, beat Old Shellback.
* **Act 2:** the Open Brine. Grimbeard's torn map is scattered as fragments. Trade, fight, chart, scheme.
* **Act 3:** four fragments reveal **Grimbeard's Rest**, a hidden archipelago guarded by the Kraken. Finale.

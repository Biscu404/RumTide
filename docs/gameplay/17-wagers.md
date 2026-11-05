# 17. Tavern Wagers (betting)

## 17.1 Markets

The **Bookie** (an NPC in every tavern; the markets are shared everywhere) posts 3 to 6 markets each Tide, generated from public information:

* *"Will the Treasure Galleon be sunk or captured at Tide 15?"*
* *"Will the Wet Sock dock in Gullhaven next Tide?"* (generated from a public tell or sighting)
* *"Who wins the Feud fight between Anna and Mihai, if it happens?"*
* *"Most Fame gained this week: Anna, Mihai, or the field?"*
* *"Will anyone beat Old Shellback next Tide?"*

[S1] Captains can also propose a market (20 doubloons). It must be about a public outcome the engine can check.

## 17.2 How the odds work

* **Pool betting:** all stakes on all outcomes of a market go into one pool. When it resolves, the winning side splits the whole pool in proportion to their stakes, minus a 5% Bookie cut (a gold sink).
* The pool's current split is visible and shows the implied odds (*"72% of the money says the galleon falls"*).
* No odds to set and no house risk: the Bookie can never go broke, and it is fair by construction.

## 17.3 Rules

* Bets close when the Tide resolves (the same deadline as orders) and pay out in that Tide.
* Maximum stake per market: 15% of your Chest or 200 × the Boom, whichever is lower.
* You cannot bet on a market where you, a fleet mate, or someone you have an active pact with is a subject. You know your own orders.
* Winnings go to your Chest. A win of 5 times your stake or more makes the Gazette.
* **Wagers are tells:** the amount bet on each side is public, but not who bet. If a lot of money suddenly says the Wet Sock will not make port, its captain has just learned something.

## 17.4 Example

* Market: *"Will the Wet Sock dock in Gullhaven at Tide 12?"* The pool holds 300 on Yes and 100 on No.
* You put 50 on No. The pool is now 300 on Yes and 150 on No: 450 in total.
* The Wet Sock is ambushed and never docks. After the 5% cut the pool is 427. The No side (150) splits it, so your 50 returns 50 ÷ 150 × 427 = **142**.
* The Gazette: *"Someone knew. 150 doubloons said the Wet Sock would never make it."*

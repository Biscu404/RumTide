# Gazette headlines: the battle of the Tide

Written for P3.B2 piece 3 by the narrative writer. These are the headline templates for what the Fighting Styles, the deck fight and the reworked Old Shellback make happen in a battle. Polly Quillsworth (a working name) writes them, and her Favour score for the subject captain picks the tier.

## How to read this file

* Each template has three tiers for the same event: **adoring**, **neutral** and **hostile**. The hostile tier mocks the deed, never the captain.
* Each headline is 60 characters or fewer. Characters are counted as typed, with variables as written, and the file was also checked with a longer name in every variable (see "Needs from engineer").
* Headlines are printed in capitals. Write them here in capitals and let the engine capitalise the variables too, so `{captain}'S` becomes `BISCU'S`.
* The **subject** of a template is the captain whose Favour picks the tier. The template says who that is.
* One written line per tier, so there are no variants and no picks. If a tier repeats too often in play, the writer adds a second line for it.
* Running gags count real events only. Template G22 is the one running gag here: it counts the real battles a captain has fought against Old Shellback.

## Variables

| Variable | Meaning |
|-|-|
| `{captain}` | The subject captain's name |
| `{enemy}` | The name of the captain on the other side (the enemy flagship's captain) |
| `{ship}` | The subject's ship name |
| `{style}` | The subject's Fighting Style, as a word such as Rammer or Skirmisher |
| `{place}` | The water where the battle was, as a player would say it |
| `{hull}` | A whole number of Hull points |
| `{n}` | A whole number, explained in the template |

## The templates

### G01 ram.smash

Subject: the Rammer. `{enemy}` is the ship it rammed. `{hull}` is the Hull the ram took.

* adoring: {captain} SPLITS {enemy} WITH A MAGNIFICENT RAM
* neutral: {captain} RAMS {enemy} FOR {hull} HULL
* hostile: {captain} BUMPS INTO {enemy} AND CALLS IT A RAM

### G02 ram.miss

Subject: the Rammer whose ram missed.

* adoring: {captain}'S RAM MISSES {enemy} BY A WHISKER
* neutral: {captain}'S RAM MISSES {enemy}
* hostile: {captain} RAMS THE SEA, SEA UNHARMED

### G03 mortar.bombard

Subject: the Bombardier. Use when the Mortar did most of the damage, or the fight began at Far.

* adoring: {captain} SHELLS {enemy} FROM BEYOND THE HORIZON
* neutral: {captain} BOMBARDS {enemy} FROM FAR RANGE
* hostile: {captain} SHELLS {enemy} FROM A POLITE DISTANCE

### G04 fire.set

Subject: the captain whose shot, shell or pot set a ship alight. `{enemy}` is the ship that burned.

* adoring: {captain} SETS {enemy} BLAZING WITH PERFECT AIM
* neutral: {captain} SETS {enemy} ON FIRE
* hostile: {captain} STARTS A BONFIRE, {enemy} NOT AMUSED

### G05 fire.sink

Subject: the captain of the ship that was sunk by fire.

* adoring: {captain}'S {ship} FOUGHT THE FLAMES BRAVELY
* neutral: {captain}'S {ship} SINKS IN A FIRE
* hostile: {captain}'S {ship} HAS A VERY HOT EVENING

### G06 board.capture

Subject: the Boarder that captured a ship.

* adoring: {captain} GOES OVER THE RAIL AND TAKES {enemy}
* neutral: {captain} CAPTURES {enemy} AFTER A DECK FIGHT
* hostile: {captain} DROPS IN ON {enemy} UNINVITED

### G07 cutfree.win

Subject: the captain whose ship cut free of a boarder. `{enemy}` is the boarder.

* adoring: {captain} CUTS FREE OF {enemy} IN STYLE
* neutral: {captain} CUTS FREE OF {enemy}'S GRAPNELS
* hostile: {captain} SWINGS AN AXE AND CALLS IT SEAMANSHIP

### G08 cutfree.fail

Subject: the captain who tried to cut free and failed. `{enemy}` is the boarder.

* adoring: {captain} HACKS AT THE LINES, {enemy} HOLDS ON
* neutral: {captain} FAILS TO CUT FREE OF {enemy}
* hostile: {captain} TRIES TO LEAVE, {enemy} SAYS STAY

### G09 gunline.held

Subject: the Gunline that held its ground. Use when a ram or a rake against it did less because it Held.

* adoring: {captain} STANDS FIRM AND {enemy} BOUNCES OFF
* neutral: {captain} HOLDS GROUND AGAINST {enemy}
* hostile: {captain} PARKS {ship} AND CALLS IT A PLAN

### G10 skirmisher.cross

Subject: the Skirmisher that crossed a bow and raked.

* adoring: {captain} CROSSES {enemy}'S BOW WITH STYLE
* neutral: {captain} CROSSES THE BOW OF {enemy} AND RAKES
* hostile: {captain} SCURRIES ACROSS {enemy}'S BOW AND NIPS

### G11 smuggler.away

Subject: the Smuggler that escaped and kept its cargo.

* adoring: {captain} SLIPS AWAY FROM {enemy}, CARGO AND ALL
* neutral: {captain} ESCAPES {enemy} WITH THE CARGO
* hostile: {captain} FLEES {enemy}, CARGO CLUTCHED TIGHT

### G12 firepots

Subject: the Firebrand that threw Fire Pots.

* adoring: {captain}'S FIRE POTS LIGHT UP {enemy}'S DECK
* neutral: {captain} THROWS FIRE POTS ON {enemy}'S DECK
* hostile: {captain} LOBS POTS OF PITCH AND HOPES FOR THE BEST

### G13 drill.won

Subject: the captain of a drilled crew that won the deck fight.

* adoring: {captain}'S WELL DRILLED CREW SWEEPS THE DECK
* neutral: {captain}'S DRILLED CREW WINS ON {enemy}'S DECK
* hostile: {captain}'S CREW PRACTISED FOR THIS ONE SCRAP

### G14 overtime

Subject: the hunter. Use when a deck fight went into overtime (rounds 6 or 7).

* adoring: {captain} AND {enemy} FIGHT ON, NEITHER YIELDS
* neutral: {captain} AND {enemy} FIGHT INTO OVERTIME
* hostile: {captain} AND {enemy} CANNOT FINISH A DECK FIGHT

### G15 victory.points

Subject: the winner on points. `{style}` is the winner's style.

* adoring: {captain} OUTSHINES {enemy} AND WINS ON POINTS
* neutral: {captain}'S {style} BEATS {enemy} ON POINTS
* hostile: {captain} WINS ON POINTS, NOBODY SANK ANYTHING

### G16 draw

Subject: the hunter.

* adoring: {captain} AND {enemy} PART AS EQUALS
* neutral: {captain} AND {enemy} FIGHT TO A DRAW
* hostile: {captain} AND {enemy} TRADE SHOTS, PROVE NOTHING

### G17 fleet

Subject: the captain of the winning flagship in a fleet battle. `{n}` is the number of ships on the subject's side. `{place}` is the water.

* adoring: {captain} LEADS THE FLEET TO GLORY AT {place}
* neutral: FLEET BATTLE: {captain} V {enemy}
* hostile: {captain} BRINGS {n} SHIPS TO ONE FIGHT

### G18 shellback.beaten

Subject: the captain who beat Old Shellback (Sunk or Captured). When several captains won, the first in ship id order is the subject.

* adoring: {captain} BEATS OLD SHELLBACK, THE NARROWS ARE OPEN!
* neutral: {captain} BEATS OLD SHELLBACK AND PASSES THE GATE
* hostile: {captain} BEATS ONE CRAB, THE GAZETTE YAWNS

### G19 shellback.drivenOff

Subject: the captain whose ship lost to Old Shellback (Sunk, Captured, or driven off by his claws).

* adoring: {captain} TAKES ON OLD SHELLBACK, WILL RETURN
* neutral: {captain} DRIVEN OFF BY OLD SHELLBACK
* hostile: {captain} LOSES TO A CRAB WEARING A SHIP

### G20 shellback.snatch

Subject: the captain whose ship was snatched by his claw.

* adoring: {captain} STANDS TALL IN SHELLBACK'S CLAW
* neutral: OLD SHELLBACK SNATCHES {captain}'S {ship}
* hostile: {captain} CROSSES SHELLBACK'S BOW, GETS GRABBED

### G21 shellback.retreats

Subject: the captain who drove Old Shellback off into his shell.

* adoring: {captain} SENDS OLD SHELLBACK BACK INTO HIS SHELL
* neutral: OLD SHELLBACK RETREATS INTO HIS SHELL
* hostile: OLD SHELLBACK NAPS, {captain} CALLS IT A VICTORY

### G22 shellback.gate

The Tide's gossip about the gate. Subject: a captain who has fought Old Shellback more than once without beating him. `{n}` is the number of real battles that captain has fought against him, and is 2 or more.

* adoring: {captain} IS BACK AT THE GATE FOR TRY {n}, UNBOWED
* neutral: {captain} MEETS OLD SHELLBACK AGAIN, TRY {n}
* hostile: THE GATE STAYS SHUT: {captain} HAS TRIED {n} TIMES

### G23 board.grapnels

Subject: the Boarder that grappled from Short.

* adoring: {captain}'S GRAPNELS REACH {enemy} FROM SHORT
* neutral: {captain} BOARDS {enemy} FROM SHORT RANGE
* hostile: {captain} LASSOS {enemy} AND CALLS IT BOARDING

### G24 escape

Subject: the captain whose ship opened range past Far. `{style}` is that ship's style.

* adoring: {captain} OUTSAILS {enemy} WITH EASE
* neutral: {captain}'S {style} ESCAPES {enemy}
* hostile: {captain} LEAVES THE FIGHT EARLY, {enemy} WAVES

## Needs from engineer

* **Variables.** `{captain}`, `{enemy}`, `{ship}`, `{place}`, `{hull}`, `{n}` and `{style}`, as in the table. `{enemy}` is the captain of the enemy flagship. When that is Old Shellback, the templates already say OLD SHELLBACK in the text, so they never use `{enemy}` for him.
* **Name lengths.** I assumed a captain name up to 12 characters, a ship name up to 16, and a place up to 16, and kept every headline at 60 characters or fewer in that worst case. I could not find the real limits for captain and ship names (only the fleet name limit of 24 in `engine/fleet.ts`). If the limits are longer, headlines G05, G08, G10, G13, G16, G17 and G23 need a short fallback or a cut.
* **Capitals.** Upper case the whole headline after the variables are in, so a ship called "Wet Sock" reads WET SOCK.
* **Picking a template.** The Gazette shows one battle of the Tide and one headline for it. Suggested triggers, all found in the records:
  * G01 `RoundRecord.rams` with `hit` true, G02 `rams` with `hit` false.
  * G03 a Bombardier flagship and `startRange` Far, or Mortar damage above half of the winner's damage.
  * G04 any `RoundRecord.fires` entry. G05 a `fire` record and a ship at 0 Hull.
  * G06 outcome `captured`, with a Boarder winner. G23 a `GrappleRecord` from Short with `ok` true.
  * G07 and G08 a `cutFree` contest, winner and loser. G12 a `DeckRecord.thrown` by a Firebrand.
  * G09 a `ram` or a rake against a Gunline that played Hold. G10 a Skirmisher rake.
  * G11 and G24 outcome `escaped`, G11 when the escaper is a Smuggler.
  * G13 a winner with `BattleShip.drill` of 5 or more. G14 any `RoundRecord.overtime`.
  * G15 outcome `victory`, G16 outcome `draw`, G17 a fleet battle.
  * G18 to G22 a battle with Old Shellback. G22 needs a count per captain of the battles they have fought against him (D105 already records who has beaten him, but not how many tries).
* **A new record flag** for "driven off" and for the Old Shellback snatch, as listed under "Needs from engineer" in the replay lines file in `docs/text/`. G19, G20 and G21 use them.
* **Priority.** When several triggers fit one battle, a suggested order is G18, G21, G19, G20, G05, G06, G01, G03, G12, G13, G09, G10, G07, G08, G23, G14, G15, G16, G11, G24, G17, G02, G04, G22. The producer or the engineer may change it.

## Facts I invented (PROPOSED)

* "SHELLBACK" on its own is how Polly shortens Old Shellback in a headline, as in G20.
* Polly's paper can "YAWN" and a crab can "NAP" (G18, G21). These are jokes, not world facts.
* That captains "try" the gate and that Polly counts the tries in G22 as a running gag. It counts only real battles.
* That a Gazette headline can call Old Shellback "A CRAB WEARING A SHIP" (G19). GAMEPLAY 1.4 says he is a giant hermit crab that wears a sunken galleon as its shell, so this is the same fact in a joke.

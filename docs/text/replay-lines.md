# Replay lines: Fighting Styles, the deck fight and Old Shellback

Written for P3.B2 piece 3 by the narrative writer. These are the lines of the text replay (`describe.ts`) for everything the Fighting Styles spec and the boarding spec add, plus the reworked Old Shellback of D133 and D140.

## How to read this file

* Voice: clear first, cheeky second. At most one joke per line, and most lines are plain. No dashes, no pirate dialect, no cruelty.
* Every event has a key such as `ram.hit`. Under it, up to three variants, numbered, and a line `Pick: N`. The pick is the plain, clear default. The engineer may rotate through the other variants so a long fight does not repeat itself (see "Needs from engineer").
* Variables are in braces. Every line is 120 characters or fewer as typed. Badge and tooltip lines are 100 or fewer.
* No number that P3.2 may retune is typed into a line. Numbers come from the record or from `balance.ts` through a variable.
* Where an event has a condition, it is written as "Use when".

## Variables

| Variable | Meaning |
|-|-|
| `{ship}` | The name of the ship the line is about. In the Fire section it is the ship that burns |
| `{enemy}` | The name of the enemy flagship that ship is fighting |
| `{by}` | In the Fire section, the ship that lit the fire |
| `{boss}` | Old Shellback's ship name (`describe.ts` already looks it up) |
| `{captains}` | The ship names of the winning captains, joined as `listOf` does ("A", "A and B") |
| `{winner}` `{loser}` | Ship names, for the winner and the loser of a pairing or of the battle |
| `{hull}` `{self}` | Whole numbers of Hull. `{self}` is the Hull the Rammer lost |
| `{round}` | The round number, 1 to 7 |
| `{range}` `{from}` `{to}` | Range words: Far, Long, Medium, Short, Close, Grappled |
| `{style}` | A style name: Bombardier, Gunline, Skirmisher, Rammer, Boarder, Firebrand, Smuggler |
| `{rounds}` | Rounds a new fire burns. Always 2 or 3, so "rounds" is always right |
| `{bonus}` | Percent more, a whole number |
| `{factor}` | A multiplier from `balance.ts`, a whole number |
| `{lead}` | Points of damage share the winner led by, a whole number |
| `{stage}` | A Drill stage name: Deckhands, Cutthroats or Sea Wolves |

## 1. Style badges

The badge appears beside each ship in the battle preview and at the head of the replay. The label is the style name. The line is a tooltip (100 characters or fewer). A battle with a ship that has no style shows no badge.

* `badge.head`: "{ship} sails as a {style}."
* `badge.bombardier`: "Spotters start the fight at Far, where only its Mortar hits hard. Small crew, so boarders love it."
* `badge.gunline`: "Holds its ground. Braced against rakes and rams, with guns that hit harder while it Holds."
* `badge.skirmisher`: "Crosses the bow of a charging ship, then slips away. Its guns do not weaken when it turns away."
* `badge.rammer`: "Dashes two bands a round and rams the enemy Hull. Ramming a Firebrand sets the Rammer alight."
* `badge.boarder`: "Throws grapnel lines from Short, goes over the rail first and fights harder on deck."
* `badge.firebrand`: "Fires Hot Shot and throws Fire Pots from the start. Ships that ram it or lash to it burn too."
* `badge.smuggler`: "Not a fighter. Opens range with a better Helm and strikes its colours early to keep the cargo."

## 2. Distances

### Tooltips for the six distances (100 characters or fewer)

* `range.far` (new): "Far. Almost nothing reaches here but the Mortar. A ship that opens range past Far escapes."
* `range.long`: "Long. Chain shot is at its best. Round shot is weaker here."
* `range.medium`: "Medium. Round shot is at full strength, and Grapeshot starts to bite."
* `range.short` (new): "Short. Round shot and Grapeshot bite. A Boarder can throw grapnels from here."
* `range.close`: "Close. Grapeshot is at its best, and a Rammer can ram. Close In meets Close In here and grapples."
* `range.grappled`: "Grappled. The great guns are quiet and the crews fight on deck."

### A battle that starts at Far

Use when: a Bombardier is a flagship and the battle began at Far. `{ship}` is the Bombardier.

### start.far

1. "{ship}'s spotters see {enemy} first, so the battle starts at Far range."
2. "{ship} has the sharper lookouts. The battle opens at Far range, where its Mortar can reach."
3. "The spotters of {ship} call the range early. Both ships start at Far."

Pick: 1

### The range changes

Use when: the range after the round is not the range before. One band is one step of the six distances.

### range.closes (one band)

1. "The ships close from {from} to {to}."
2. "The range drops from {from} to {to}."
3. "They draw nearer: {from} becomes {to}."

Pick: 1

### range.closes2 (two bands in one round: a Dash, or both ships Close In)

1. "The ships close two bands at once, from {from} to {to}."
2. "Two bands in one round: {from} to {to}."
3. "The range collapses from {from} to {to}."

Pick: 1

### range.opens (one band)

1. "The ships draw apart, from {from} to {to}."
2. "The range grows from {from} to {to}."
3. "Open water between them: {from} becomes {to}."

Pick: 1

### range.opens2 (two bands in one round)

1. "The ships part two bands at once, from {from} to {to}."
2. "Two bands of open water in one round: {from} to {to}."
3. "Both ships turn away, and the range jumps from {from} to {to}."

Pick: 1

### range.stays

1. "The range stays {range}."
2. "Nobody gives ground. The range stays {range}."
3. "Still {range} range."

Pick: 1

## 3. The Ram

Use when: a Rammer played Close In at Close (`RoundRecord.rams`). `{ship}` is the Rammer, `{enemy}` the ship it rams.

### ram.hit

1. "{ship} drives its prow into {enemy}. {enemy} loses {hull} Hull and {ship} loses {self}."
2. "{ship} rams {enemy} at speed. {hull} Hull splinters off {enemy}, and {self} off {ship}."
3. "Prow meets planking. {enemy} loses {hull} Hull, and {ship} pays {self} Hull for the privilege."

Pick: 1

### ram.miss.crossed (the other ship crossed the bow)

1. "{enemy} crosses {ship}'s bow just in time, and the ram finds only water."
2. "{ship} lines up the ram, but {enemy} has crossed its bow. Splash."
3. "The ram never lands: {enemy} crossed the bow and {ship} sails through the gap."

Pick: 1

### ram.miss.outrun (the other ship won the chase)

1. "{enemy} wins the chase, and {ship} rams the spot where it used to be."
2. "{ship} is too slow. {enemy} outruns the ram."
3. "{enemy} slips away before the prow arrives. No ram this round."

Pick: 1

### ram.miss.contest (the Helm contest decided and the ram missed)

1. "{ship}'s ram glances off. {enemy} turns at the last moment and takes no damage."
2. "The prow of {ship} scrapes along {enemy}'s side and does no harm."
3. "{enemy} swings aside, and the ram only scrapes the paint."

Pick: 1

### ram.braced (a Gunline that Holds takes less)

Use when: the ram hit, and the ship struck is a Gunline that played Hold. Replaces `ram.hit`.

1. "{enemy} is braced and takes only {hull} Hull. {ship} still loses {self}."
2. "{enemy} braces for the blow. The ram does {hull} Hull, and {ship} loses {self} in the crash."
3. "A Gunline that holds its ground is hard to ram: {enemy} takes {hull} Hull and {ship} loses {self}."

Pick: 1

### ram.grapnels (a Boarder's grapnels catch the prow)

Use when: the ram hit, and the ship struck is a Boarder that played Board. Replaces `ram.hit`. `{ship}` is the Rammer.

1. "{enemy}'s grapnels are already on {ship}'s prow. The ram does only {hull} Hull."
2. "{enemy} is already throwing grapnels, and the ram lands as half a blow: {hull} Hull."
3. "The grapnel lines of {enemy} catch the bow of {ship}. Only {hull} Hull of the ram gets through."

Pick: 1

### ram.dash (Dash closes two bands)

Use when: a Rammer's Close In moved the range one band further. `{from}` and `{to}` are the range before and after the Helm step.

1. "{ship} dashes in, closing two bands at once."
2. "{ship} puts on a burst of speed and closes two bands in a single round."
3. "No time to think: {ship} dashes from {from} to {to}."

Pick: 1

### ram.dash.spoils (the dash spoils a rake)

Use when: the contest of kind `dash` was won by the Rammer. `{ship}` is the Rammer, `{enemy}` the ship that crossed its bow.

1. "{enemy} crosses {ship}'s bow, but the dash spoils the rake. It lands weaker, and {ship} is not weakened."
2. "The dash carries {ship} through {enemy}'s rake. The rake does less, and {ship}'s guns stay at full strength."
3. "{ship} dashes straight through the rake, and {enemy} gets less out of it."

Pick: 1

### ram.dash.fails (the Rammer loses the dash contest)

1. "{ship}'s dash is not enough, and {enemy}'s rake lands in full."
2. "{enemy} crosses the bow, and {ship} cannot spoil the rake."
3. "The dash comes up short. {enemy} rakes {ship} as planned."

Pick: 1

## 4. The Mortar

Use when: `RoundShipRecord.mortar` is present. `{ship}` is the Bombardier, `{enemy}` the ship it fired on. A shell that starts a fire uses `fire.lit.mortar` in section 6.

### mortar.hit

1. "{ship}'s Mortar shell drops onto {enemy} for {hull} Hull."
2. "The shell from {ship}'s Mortar lands on {enemy}'s deck and takes off {hull} Hull."
3. "{ship} lobs a shell over the horizon. {enemy} loses {hull} Hull."

Pick: 1

### mortar.miss

1. "{ship}'s Mortar shell misses {enemy} and splashes into the sea."
2. "The shell from {ship} lands in the water. The fish have opinions."
3. "{ship} misses with the Mortar. The shell does no harm."

Pick: 1

### mortar.zeroing (Zeroing In grows)

Use when: the Zeroing In factor is above 1. `{bonus}` is (zeroing minus 1) times 100, rounded.

1. "{ship}'s spotters have the range. Zeroing In: the Mortar does {bonus}% more."
2. "The range has not changed, so {ship}'s shells land closer. Mortar damage is up {bonus}%."
3. "Zeroing In: {ship} walks its shells onto the target. {bonus}% more damage."

Pick: 1

### mortar.zeroing.reset

Use when: a Bombardier had a Zeroing In streak and the range changed.

1. "The range changed, so {ship} must find its mark again. Zeroing In starts over."
2. "{ship} lost the range. Zeroing In starts again."
3. "New range, new aim. {ship}'s Mortar starts over."

Pick: 1

### mortar.refused (a ship that is not a Bombardier ordered the Mortar)

Use when: `RoundShipRecord.asked` is `mortar`.

1. "{ship} has no mortar, so it fires Round shot instead."
2. "{ship} was told to use the Mortar, but only a Bombardier has one. Round shot it is."
3. "No Mortar aboard {ship}. It fires Round shot."

Pick: 1

### mortar.dry (any gun out of Powder, the Mortar included)

Use when: a ship fires with no Powder left.

1. "{ship} is out of Powder, so its guns fire weakly."
2. "{ship}'s magazine is empty. The shot goes out at a poor strength."
3. "No Powder aboard {ship}. Whatever it fires now hardly stings."

Pick: 1

## 5. Hot Shot

Use when: `asked` or `guns` is `hotShot`. `{ship}` is the Firebrand. A shot that starts a fire uses `fire.lit.hotShot` in section 6.

### hotshot.hit

1. "{ship}'s Hot Shot, heated in the galley fire, hits {enemy} for {hull} Hull."
2. "A glowing ball from {ship} slams into {enemy}. {hull} Hull lost."
3. "{ship} fires Hot Shot at {enemy}: {hull} Hull, and a lot of smoke."

Pick: 1

### hotshot.toofar (the range factor is weak or zero)

Use when: a Hot Shot is fired at Far or Long.

1. "{ship}'s Hot Shot falls short at {range} range. Hot Shot is best at Short and Close."
2. "At {range} range the Hot Shot loses its bite. {ship} should save it for Short and Close."
3. "The Hot Shot of {ship} cools on the way. It is too far to do much."

Pick: 1

### hotshot.dry (Hot Shot out of Powder)

Use when: a Hot Shot was fired and it used the last Powder, or less Powder than a Hot Shot needs.

1. "{ship} puts the last of its Powder into a Hot Shot. The magazine is empty."
2. "Hot Shot eats Powder. {ship} fires it and has none left."
3. "{ship} has Powder for only part of a Hot Shot. It fires anyway, and the magazine is empty."

Pick: 1

### hotshot.refused (a ship that is not a Firebrand ordered Hot Shot)

Use when: `RoundShipRecord.asked` is `hotShot`.

1. "Only a Firebrand fires Hot Shot, so {ship} fires Round shot instead."
2. "{ship} has no way to heat its shot. Round shot it is."
3. "No Hot Shot for {ship}: it is not a Firebrand. It fires Round shot."

Pick: 1

## 6. Fire

Use when: `RoundRecord.fires` has an entry, or `RoundShipRecord.fire` is present. In this section `{ship}` is the ship that burns and `{by}` is the ship that lit it (`FireRecord.ship` and `by`). `{rounds}` is `FireRecord.rounds`.

### fire.lit.hotShot

1. "{by}'s Hot Shot lodges in {ship} and the pitch catches. {ship} is on fire for {rounds} rounds."
2. "The glowing shot from {by} sets {ship} alight. The fire will burn for {rounds} rounds."
3. "{ship} catches fire from {by}'s Hot Shot. Expect {rounds} rounds of flames."

Pick: 1

### fire.lit.mortar

1. "{by}'s shell bursts on {ship} and sets it alight. The fire burns for {rounds} rounds."
2. "A Mortar shell from {by} starts a fire on {ship}'s deck. It will burn for {rounds} rounds."
3. "{ship} is on fire. {by}'s shell burst on the deck, and the flames last {rounds} rounds."

Pick: 1

### fire.lit.firePots

1. "A Fire Pot from {by} breaks on {ship}'s deck. {ship} is on fire for {rounds} rounds."
2. "The pitch from {by}'s pot catches. {ship} burns for {rounds} rounds."
3. "{by}'s Fire Pot finds its mark, and {ship} goes up like a lantern for {rounds} rounds."

Pick: 1

### fire.lit.ram (Fireship: a ship that rams a Firebrand)

Use when: `FireRecord.source` is `ram`. `{ship}` is the Rammer, `{by}` the Firebrand.

1. "{ship} rams a ship full of pitch. The blaze jumps aboard and burns for {rounds} rounds."
2. "Ramming {by} was a hot idea. {ship} catches fire for {rounds} rounds."
3. "The pitch in {by}'s hold spills over {ship}'s prow. {ship} burns for {rounds} rounds."

Pick: 1

### fire.lit.embers (Fireship: Grappled with a Firebrand)

Use when: `FireRecord.source` is `embers`.

1. "Embers from {by} drift across the lashings, and {ship}'s deck catches fire for {rounds} rounds."
2. "Lashed to a Firebrand, {ship} catches the embers. It burns for {rounds} rounds."
3. "Sparks leap from {by} to {ship}. The fire burns for {rounds} rounds."

Pick: 1

### fire.burns (each round, at the end)

Use when: `RoundShipRecord.fire` is present and the fire has more rounds to burn.

1. "The fire on {ship} burns on. It loses {hull} Hull."
2. "{ship} is still burning and loses {hull} Hull."
3. "Flames climb {ship}'s masts. {hull} Hull lost to the fire."

Pick: 1

### fire.out (it burns out)

Use when: the burn record says no rounds are left. Shown after `fire.burns` or `fire.drill` or `fire.pitch` of the same round.

1. "The fire on {ship} burns out."
2. "{ship}'s crew beats out the last flames."
3. "The flames die down on {ship}. It is still afloat."

Pick: 1

### fire.sinks (a fire sinks a ship)

Use when: the fire took the ship to 0 Hull. Shown after the burn line, before the "sunk" outcome line.

1. "The fire is too much for {ship}. It sinks in round {round}."
2. "{ship} burns down to the waterline and sinks."
3. "{ship} is lost to the flames. It will be towed to a Harbour, as always."

Pick: 1

### fire.drill (a Gunline's fire drill)

Use when: a Gunline burns. Replaces `fire.burns`.

1. "{ship}'s crew has drilled for fire. The flames cost it only {hull} Hull."
2. "A ship of the line keeps its buckets ready. {ship} loses only {hull} Hull to the fire."
3. "{ship}'s fire drill pays off: only {hull} Hull instead of the full burn."

Pick: 1

### fire.pitch (a Firebrand burns worse)

Use when: a Firebrand burns. Replaces `fire.burns`.

1. "{ship} is full of pitch. The fire costs it {hull} Hull."
2. "The pitch in {ship}'s hold burns too. {hull} Hull lost to the fire."
3. "{ship} carries barrels of pitch below deck, and the fire loves them. {hull} Hull lost."

Pick: 2

## 7. The deck fight

### deck.quiet (the ships are Grappled)

Use when: the first Grappled round, and any round that began Grappled.

1. "The ships are Grappled. The great guns are quiet and the crews fight on deck."
2. "Too close for the guns. The crews fight on the decks."
3. "Grappled ships cannot fire their great guns. The deck fight decides."

Pick: 1

### What each crew does (the Deck orders)

Use when: `RoundShipRecord.deck.order` is set. `{ship}` is the ship whose crew it is.

### deck.charge

1. "{ship}'s crew charges with cutlasses."
2. "{ship}'s crew draws cutlasses and charges across the rail."
3. "Cutlasses out: {ship}'s crew charges."

Pick: 1

### deck.volley

1. "{ship}'s crew fires a volley of muskets and swivel guns."
2. "Muskets and swivel guns crackle from {ship}'s rail."
3. "{ship}'s musketeers line the rail and fire."

Pick: 1

### deck.repel

1. "{ship}'s crew sets pikes along the rail."
2. "Pikes bristle along {ship}'s rail."
3. "{ship}'s crew stands behind the pikes and holds the rail."

Pick: 1

### deck.firePots

1. "{ship}'s crew throws clay pots of lit pitch and rum."
2. "Clay pots of pitch and rum fly from {ship}."
3. "{ship}'s crew lights its pots and throws them across the rail."

Pick: 1

### deck.fists

1. "{ship}'s crew fights with fists and belaying pins."
2. "No clear order: {ship}'s crew brawls with whatever is to hand."
3. "{ship}'s crew has no plan and fights with fists and belaying pins."

Pick: 1

### Why a crew fought with Fists

Show one of these after `deck.fists` when the reason is known (see "Needs from engineer").

### deck.fists.guns (a rule gave a Guns order while Grappled)

1. "The guns are quiet while Grappled, so {ship}'s crew fights with fists."
2. "{ship} ordered the guns, but there is no room to fire them. The crew brawls."
3. "A Guns order means nothing on a Grappled deck. {ship}'s crew fights with fists."

Pick: 1

### deck.fists.powder (a Volley with no Powder)

1. "{ship} has no Powder for a Volley, so its crew fights with fists."
2. "The muskets of {ship} are dry. The crew fights with fists."
3. "No Powder, no Volley. {ship}'s crew fights with fists."

Pick: 1

### deck.fists.drill (Fire Pots without enough Drill)

1. "{ship}'s crew is not yet drilled to throw Fire Pots, so it fights with fists."
2. "{ship} has pots but its crew is not drilled to throw them. Fists it is."
3. "Fire Pots take a drilled crew. {ship}'s crew fights with fists."

Pick: 1

### deck.fists.surprise (the first round: the boarded crew chose its order before the grapple)

Use when: `MeleeRecord.firstOver` is set, for the crew that did not board.

1. "{ship}'s crew did not expect boarders and fights with fists."
2. "The boarders catch {ship}'s crew unready. It fights with fists."
3. "{ship}'s crew had chosen its order before the grapple, so it grabs belaying pins."

Pick: 1

### deck.fists.collide (Close In meets Close In)

Use when: the ships grappled by a Close In against Close In, and nobody boarded.

1. "Both ships Closed In. Neither boarded, so both crews fight with fists."
2. "The ships meet bow to bow. Nobody boarded, and both crews brawl."
3. "A collision, not a boarding. Both crews fight with fists."

Pick: 1

### The cycle: one order beats another

Use when: one side's `deck.pairing` is `won` and the other's is `lost`. `{winner}` and `{loser}` are the two ships. The engineer picks the key from the two orders.

### pair.chargeVolley (Charge beats Volley)

1. "{winner}'s charge reaches {loser}'s muskets before they reload. {loser}'s crew gives way."
2. "The charge of {winner} reaches the muskets before they reload. {loser} gives way."
3. "{loser}'s muskets are still reloading when {winner}'s cutlasses arrive."

Pick: 1

### pair.volleyRepel (Volley beats Repel)

1. "{winner}'s muskets find the crew massed at {loser}'s rail. {loser}'s crew gives way."
2. "The pikes of {loser} are no use against muskets. {winner}'s volley wins the exchange."
3. "{loser}'s crew is bunched at the rail, an easy target for {winner}'s muskets."

Pick: 1

### pair.repelCharge (Repel beats Charge)

1. "{loser}'s charge runs onto {winner}'s pikes and stops. {loser}'s crew gives way."
2. "The pikes hold the rail and the charge breaks. {winner} wins the exchange."
3. "{winner}'s pikes are exactly what a charge does not need."

Pick: 1

### pair.even

Use when: both pairings are `even`, and neither order is Fire Pots or Fists.

1. "Neither order has the edge. The crews trade blows evenly."
2. "Nothing wins the exchange: it is a plain scrap."
3. "The orders do not beat each other. The fight is even this round."

Pick: 1

### pair.pots (Fire Pots ignore Repel)

Use when: Fire Pots met Repel. `{winner}` threw the pots, `{loser}` held the rail.

1. "{winner}'s pots fly over the pikes. Pikes do not stop a pot."
2. "Repel is no use against Fire Pots. {loser}'s pikes cannot hold off the pitch."
3. "The pots of {winner} land behind {loser}'s pikes."

Pick: 1

### First over the rail

Use when: `MeleeRecord.firstOver` is set. `{ship}` is the boarder, `{enemy}` the boarded ship.

### edge.firstOver

1. "{ship} is over the rail first. Its Board fights as a Charge, and {enemy}'s crew is caught unready."
2. "{ship}'s crew goes over the rail first, and {enemy}'s crew has no time to form up."
3. "First over the rail: {ship}'s crew hits {enemy} before it can answer."

Pick: 2

### edge.bothBoard

Use when: both ships played Board and grappled.

1. "Both ships Board at once. Both crews charge, and nobody is first over the rail."
2. "Two boarders meet at the rail. Neither has the edge."
3. "Both ships throw grapnels together, and nobody gets there first."

Pick: 1

### Who holds the edge

Use when: `RoundRecord.edge` is set, in the first Grappled round (then at most every few rounds, not every round). `{ship}` is the boarder.

### edge.holds

1. "{ship} boarded, so it holds the edge. {enemy} will find it hard to cut free."
2. "{ship} holds the boarder's edge for as long as the ships are lashed together."
3. "The edge is {ship}'s. {enemy} is lashed fast and will struggle to break away."

Pick: 1

### edge.none

Use when: the ships grappled and `RoundRecord.edge` is absent.

1. "Nobody boarded, so nobody holds the edge."
2. "The ships came together without a boarder. Nobody holds the edge."
3. "Neither ship boarded the other. The edge is nobody's."

Pick: 1

### Cut Free

Use when: a Grappled ship plays Open Range. The existing line for the Helm contest ("Helm contest for cutting free: ...") stays.

### cutfree.hard (Lashed fast)

Use when: the other flagship holds the edge or has Grapnels.

1. "{ship} is lashed fast to {enemy}. Cutting free will be hard."
2. "{enemy}'s lines hold {ship} tight. Cutting free is hard."
3. "Lashed fast: {enemy}'s Helm score counts double while {ship} tries to cut free."

Pick: 1

### cutfree.win

1. "{ship} cuts the lines and drifts free. The range goes back to Close."
2. "The axes win: {ship} is free of {enemy}. No fighting this round."
3. "{ship}'s crew hacks through the grapnel lines. The ships are apart again."

Pick: 1

### cutfree.fail

1. "{ship} hacks at the lines, but they hold. The ships stay Grappled."
2. "The grapnel lines hold. {ship} stays lashed to {enemy}."
3. "{ship}'s axes bite, but {enemy}'s lines are too many. Still Grappled."

Pick: 1

### cutfree.quiet (the guns are quiet in the round a ship cuts free)

1. "Every hand is at the axes, so the guns of both ships stay quiet this round."
2. "The guns stay quiet in the round a ship cuts free: every hand is at the axes."
3. "Nobody is at the guns while the lines are cut."

Pick: 1

### Fire Pots thrown

Use when: `DeckRecord.thrown` is present. `{ship}` is the thrower and `{enemy}` the flagship it threw at.

### pots.caught (a Firebrand's pot sets the enemy alight)

Use when: `thrown.fire` is true and the thrower is a Firebrand. The fire itself also gets `fire.lit.firePots`; show only one of the two lines.

1. "{ship} throws a Fire Pot and the pitch catches. {enemy}'s deck is on fire."
2. "The pot from {ship} breaks and the pitch catches. {enemy} burns."
3. "{ship}'s Fire Pot lands true. The flames spread across {enemy}'s deck."

Pick: 1

### pots.flash (a pot from any other style catches)

Use when: `thrown.fire` is true and the thrower is not a Firebrand. `{hull}` is the Hull each ship loses.

1. "{ship}'s pot flashes. Both ships lose {hull} Hull before the crews beat it out."
2. "The pitch flares between the lashed ships. {ship} and {enemy} lose {hull} Hull each."
3. "A pot catches between the two ships. The crews put it out, but both lose {hull} Hull."

Pick: 1

### pots.noFire (the pitch does not catch)

Use when: `thrown.fire` is false.

1. "{ship}'s pot breaks on the deck, and the pitch does not catch."
2. "The pitch from {ship}'s pot fizzles out."
3. "{ship}'s Fire Pot splashes across the planks and goes out."

Pick: 1

### pots.last

Use when: a crew threw its last pot (`RoundShipRecord.firePots` is 0 after the round).

1. "{ship} throws its last Fire Pot."
2. "That was the last Fire Pot aboard {ship}."
3. "{ship}'s hold is out of pots after that throw."

Pick: 1

### pots.none

Use when: the order was Fire Pots and the crew has no pot, so it fights with fists. Use it as the reason line after `deck.fists`, in place of the Drill one.

1. "{ship} has no Fire Pots left, so its crew fights with fists."
2. "The pots of {ship} are all gone. Its crew picks up belaying pins."
3. "Nothing left to throw: {ship}'s crew fights with fists."

Pick: 1

### Tinderbox

Use when: a crew fights a side that has a Firebrand, once per battle on the first Grappled round. `{ship}` is the weakened crew, `{enemy}` the Firebrand.

### tinderbox

1. "{ship}'s crew fights a ship full of pitch and keeps glancing at the barrels. It fights weaker."
2. "{ship}'s crew is nervous about the pitch aboard {enemy} and fights weaker for it."
3. "Tinderbox: crews fighting {enemy} are shaken by the pitch, and {ship}'s crew is no exception."

Pick: 2

### Fighters

Use when: a Boarder's crew fights, once per battle on the first Grappled round. `{ship}` is the Boarder.

### fighters

1. "{ship}'s Boarders are Fighters: their crew fights with extra strength."
2. "Fighters: {ship}'s crew is picked for the rail and hits harder."
3. "{ship}'s crew has done this before. It fights with extra strength."

Pick: 1

### Drill and Second Wave

Use when: `BattleShip.drill` is above 0 (Drill), or is 15 or more (Second Wave). Once per battle on the first Grappled round for Drill; every melee round for Second Wave is too much, so once per battle as well.

### drill.stage

1. "{ship}'s {stage} are well drilled and fight harder for it."
2. "Drill pays off: {ship}'s {stage} hit harder than an untrained crew."
3. "{ship}'s crew has trained as {stage}, and the deck fight shows it."

Pick: 1

### drill.secondWave

1. "Second Wave: {ship}'s Sea Wolves strike again after the first exchange."
2. "{ship}'s Sea Wolves come on in a second wave."
3. "The Sea Wolves of {ship} do not stop after one blow."

Pick: 1

### Grapnel lines (Board from Short)

Use when: a Board was played at Short by a ship with Grapnels (a Boarder from the start, or any ship at Drill 10). `RoundRecord.grapples` has the entry. The existing "grapples the enemy" line is replaced by these.

### board.short.ok

1. "{ship} throws its grapnel lines from Short range and hauls {enemy} in. The ships are Grappled."
2. "From Short, {ship}'s grapnels reach {enemy}'s rail. The ships are Grappled."
3. "{ship} does not need to get closer. Its grapnel lines reach from Short, and {enemy} is caught."

Pick: 2

### board.grapnels.win (a Board that failed on Helm score, saved by the grapnels)

Use when: `GrappleRecord.why` is `grapnels`.

1. "{ship} cannot match {enemy}'s Helm, but the grapnels take hold anyway."
2. "{enemy} nearly slips away, but {ship}'s grapnels catch the rail."
3. "The Board fails on Helm, then the grapnels catch. {ship} hauls {enemy} in."

Pick: 2

### board.fail

Use when: `GrappleRecord.ok` is false.

1. "{ship} throws its grapnels, but they fall short."
2. "{ship}'s grapnel lines miss and splash into the sea."
3. "{ship} tries to board and fails."

Pick: 1

## 8. Overtime

Use when: `RoundRecord.overtime` is true. Round 6 is the first overtime round and round 7 the last.

### round.header.overtime (replaces the "Round N, at X range." line)

1. "Round {round}, overtime, at {range} range."

Pick: 1

### overtime.start (round 6)

1. "Overtime. The deck fight is not decided, so the crews fight on."
2. "Round {round}. The crews are still at it, and the battle goes into overtime."
3. "The deck fight goes on. Overtime, with the guns still quiet."

Pick: 1

### overtime.last (round 7)

1. "Last round of overtime. After this the battle ends, one way or another."
2. "Second and last round of overtime. The fight ends here."
3. "The crews fight on for one more round. Then it is over."

Pick: 1

## 9. Old Shellback

Use when: the battle has Old Shellback (the monster ship). `{boss}` is his ship name, `{ship}` the player ship.

### Preview and bestiary tooltips (100 characters or fewer)

* `shellback.tip.shell`: "His shell takes the sting out of every hit, except in the round he rears up."
* `shellback.tip.mortar`: "A Mortar shell falls on his shell from above and ignores it. A Bombardier hurts him most."
* `shellback.tip.snatch`: "Cross his bow while he closes in and a claw snatches your ship. Crossing his bow is no rake."
* `shellback.tip.rears`: "He rears up once a fight, and his shell opens. Watch for the tell the round before."
* `shellback.tip.beaten`: "Beaten when Sunk, Captured, or driven off. A Victory on points does not beat him."

### shellback.shell.intro (the first hit on him, once per battle)

1. "{boss} wears a sunken galleon for a shell. It takes the sting out of every hit, unless he rears up."
2. "The galleon on {boss}'s back soaks up part of every hit. It only opens when he rears up."
3. "Hits glance off the galleon on {boss}'s back. He is only fully open when he rears up."

Pick: 1

### shellback.shell (his shell takes the sting out of a hit)

Use when: a hit lands on him in a round he did not rear up. `{hull}` is the Hull that got through.

1. "{boss}'s shell takes the sting out of {ship}'s hit. It does {hull} Hull."
2. "The shell turns the worst of the blow. {ship}'s shot does {hull} Hull to {boss}."
3. "{ship}'s shot rings off the galleon on {boss}'s back. {hull} Hull gets through."

Pick: 1

### shellback.tell (the round before he rears up)

Use when: this is the round before his rear up (round 1, 2 or 3). It must be unmistakable, because the captain reads it and plans the next round. Variants are for flavour only. Pick the variant by something that is not the round number, so the wording does not give the round away (see "Needs from engineer").

1. "{boss} goes very still and the sea drains out of his shell. He is about to rear up."
2. "The old galleon on {boss}'s back creaks, and his claws lift. He is about to rear up."
3. "{boss} plants his legs and the water boils around him. Next round he rears up."

Pick: 1

### shellback.rears (he rears up and his shell opens)

Use when: `RoundShipRecord.exposed` is set on his record.

1. "{boss} rears up and his shell swings open. Every hit lands in full this round."
2. "{boss} rears up, and the galleon on his back opens like a door. Nothing takes the sting out of hits now."
3. "Up he comes! {boss} rears up with his shell wide open. Full damage this round."

Pick: 1

### shellback.snatch (the claw snatch)

Use when: a ship crossed his bow at Short or Close while he played Close In, and the ships are Grappled. `{ship}` is the ship that was caught.

1. "{ship} crosses {boss}'s bow and a claw closes on its rail. The ships are Grappled, and he holds the edge."
2. "{boss} snatches {ship} out of its turn. The ships are Grappled and he holds the edge."
3. "{ship} sails across {boss}'s bow, and a claw snaps shut. Grappled, with him holding the edge."

Pick: 2

### shellback.noRake (crossing his bow is no rake)

Use when: a ship plays Cross Their Bow against him and was not snatched. `{ship}` is the crosser.

1. "Crossing his bow does not rake {boss}. It only risks a snatch at Short and Close."
2. "{ship} crosses the bow, but a rake is no use against a shell this size."
3. "{boss} does not mind being crossed. A rake gets {ship} nothing here."

Pick: 1

### shellback.mortar (a Mortar shell cracks his shell)

Use when: a Mortar shell hits him. `{factor}` is `shellback.mortarFactor` from `balance.ts`, `{hull}` the Hull it did.

1. "{ship}'s Mortar shell falls on {boss}'s shell from above. It does {factor} times the damage and ignores the shell."
2. "A Mortar shell drops on the roof of {boss}'s shell. Much more damage: {hull} Hull."
3. "{ship}'s shell comes down from above and cracks his shell like a nut. {hull} Hull."

Pick: 2

### shellback.driven.hull (he is driven off, Hull low)

Use when: he retreats because his Hull fell below the line.

1. "{boss}'s shell is cracked. He has had enough and draws into it."
2. "{boss} backs away from the fight, battered, and draws into his shell."
3. "That is enough for {boss}. He retreats into his shell, and the Narrows go quiet."

Pick: 1

### shellback.driven.claws (he is driven off, claws low)

Use when: he retreats because his claws fell below the line.

1. "{boss}'s claws are battered. He draws them in and retreats into his shell."
2. "With his claws worn down, {boss} gives up the rail and retreats into his shell."
3. "{boss} cannot hold the rail any longer. He retreats into his shell."

Pick: 1

### shellback.beaten.driven (driven off counts as beaten)

Use when: the outcome is that he was driven off.

1. "{boss} is driven off. {captains} may now pass the gate."
2. "{boss} retreats into his shell, and the way past is open to {captains}."
3. "He has had enough. {captains} may now pass the gate {boss} guards."

Pick: 1

### shellback.beaten.sunk

Use when: the outcome is Sunk.

1. "The galleon on {boss}'s back gives way and he scuttles off along the seabed. {captains} may pass the gate."
2. "{boss}'s shell is wrecked. He scuttles away across the seabed, and the gate is open to {captains}."
3. "Down goes {boss}'s shell, and out scuttles a very cross crab. {captains} may pass the gate."

Pick: 3

### shellback.beaten.captured

Use when: the outcome is Captured.

1. "The claws of {boss} go slack. The boarders hold the deck, and {captains} may pass the gate."
2. "{boss} gives up the deck. His claws let go, and {captains} may now pass the gate."
3. "The last of {boss}'s claws lets go of the rail. The deck is won, and so is the gate for {captains}."

Pick: 2

### shellback.back (after any way of beating him)

Replaces the last sentence of today's line ("will be back next Tide").

1. "{boss} retreats to the Narrows and will be back next Tide."
2. "He scuttles home to the Narrows. He will be back next Tide."
3. "{boss} will be back next Tide. He has a short memory and a big shell."

Pick: 1

### shellback.points (a Victory on points does not beat him)

Use when: the outcome is Victory on points and the loser is Old Shellback. Shown after `outcome.victory`.

1. "{boss} shrugs it off. A Victory on points does not beat him, and the gate stays shut."
2. "Points mean nothing to a crab. {boss} is not beaten, and the gate stays shut."
3. "{ship} led on points, but {boss} is not beaten. The gate stays shut."

Pick: 1

## 10. Outcomes that change

The other outcome lines (Sunk, Captured, Struck Colours, Crippled) stay as `describe.ts` has them today, apart from the Shellback lines above.

### outcome.victory (Victory on points, with the smaller lead)

Use when: the outcome is a Victory. `{lead}` is the winner's lead in points of damage share, found from `BattleRecord.dealt`.

1. "{winner} wins on points after round {round}, with a lead of {lead} points in damage."
2. "{winner} leads by {lead} points of damage after round {round}. A Victory on points."
3. "After round {round}, {winner} is ahead by {lead} points. Victory on points."

Pick: 2

### outcome.draw

Use when: the outcome is a Draw.

1. "A draw after round {round}. Nobody led by enough, so nobody wins and nobody loses anything."
2. "Round {round} ends level. Nobody led by enough to win, so it is a draw."
3. "A draw. Neither side pulled far enough ahead, and nobody loses anything."

Pick: 1

### outcome.escaped.one (one ship opened range past Far)

Use when: the outcome is Escaped and exactly one ship played Open Range this round. `{ship}` is that ship.

1. "{ship} opens range past Far and slips away. Nobody wins and nobody loses anything."
2. "{ship} turns away and the range grows past Far. The fight is over."
3. "{ship} outsails {enemy} and vanishes beyond Far range. Nobody wins and nobody loses anything."

Pick: 1

### outcome.escaped.both (both ships opened range)

Use when: the outcome is Escaped and both ships played Open Range. Today's line is variant 1.

1. "Both ships turn away past Far range, and the fight is over."
2. "Neither ship wants this fight. Both turn away past Far range."
3. "Both captains open range. The ships part beyond Far, and nobody wins."

Pick: 1

## 11. Trait lines (optional)

One line each, to make the point of the spec that a trait is never a hidden bonus. The engineer can add them when the move and the style are both in the record. If it costs a new record field, skip them.

* `trait.braced`: "{ship} holds and braces, so the rake does less to it and its guns are not weakened."
* `trait.steady`: "{ship} holds a steady deck, and its guns hit harder."
* `trait.longNines`: "{ship}'s long guns trade shots at Long range while it holds."
* `trait.kite`: "{ship} turns away without weakening its guns."
* `trait.slippery`: "{ship} slips away faster. Its Helm counts for more when it opens range."

## Needs from engineer

* **Choosing a variant.** Presentation only. Choose a variant from a stable hash of (battle seed, line key, round), or from the key's own `rngFor` labels such as `text/<key>/<round>`, so text never takes a roll that shifts anyone else's. For `shellback.tell`, do not choose by the round, or the wording gives the round away.
* **Plain numbers.** `{rounds}` is always 2 or 3 and `{self}`, `{hull}` are Hull points. No line uses a plural of `{hull}` ("1 Hull" and "5 Hull" both read fine).
* **`{enemy}`.** The other side's flagship name, which is the ship that Ram, Mortar, Hot Shot, Fire Pot and Cut Free are all aimed at (D91).
* **`{bonus}`.** Derived from `RoundShipRecord.mortar.zeroing`: (zeroing minus 1) times 100, rounded.
* **`{lead}`.** Derived from `BattleRecord.dealt`: the winner's share minus the loser's, in whole points.
* **`{stage}`.** Derived from `BattleShip.drill`: 1 to 5 Deckhands, 6 to 10 Cutthroats, 11 to 15 Sea Wolves.
* **`{factor}`.** `B.shellback.mortarFactor` (3 today), so the line never goes stale.
* **`{captains}` and `{boss}`.** As `describe.ts` already builds them for the "has beaten" line.
* **`{style}`.** The style name with a capital letter, from `BattleShip.style`.
* **New record flags**, each optional, written only when true:
  * `RoundShipRecord.dash` (a Rammer's Close In moved the range one band further). The `dash` contest kind is the spoiled rake, not the dash itself.
  * `RoundShipRecord.tell` (Old Shellback, the round before he rears up).
  * `RoundRecord.snatch` (Old Shellback caught a ship: the ship id).
  * For Old Shellback: whether a hit on him was shelled (`shelled: true` on the hit), and whether a Mortar hit was the tripled kind. Or give the Hull the shell took off, so the line can say what got through.
  * An outcome or a field for "driven off", with the cause (`hull` or `claws`). `OutcomeKind` has no such kind today.
  * `DeckRecord.fistsWhy` with one of `guns`, `powder`, `pots`, `drill`, `surprise`, `collide`, for the Fists lines. It can be worked out from the record, but a field is simpler.
* **Can be inferred, no field needed:** `ram.braced` (the struck ship is a Gunline that played Hold), `ram.grapnels` (the struck ship is a Boarder that played Board), `hotshot.dry` (Hot Shot fired and Powder is 0 after), `fire.sinks` (a fire record and Hull 0), `outcome.escaped.one` (which ship played Open Range), and the `pair.*` key (the two Deck orders).
* **Shown once per battle:** `shellback.shell.intro`, `tinderbox`, `fighters`, `drill.stage`, `drill.secondWave`, `edge.holds`. A long fight would repeat them every round.
* **A spec question for the designer.** The tell is a line in the replay, but a doctrine is a standing order and cannot read a line. For the tell to be a real clue a captain can plan on, it needs something a doctrine condition can read, such as "Their last Helm move was Hold" or "Their last Guns order was Hold Fire", that only comes before the rear up. If the tell is only flavour, the three lines are still fine, but the spec's "read the tell in the fight" is then only true for a captain who watches the live replay.

## Facts I invented (PROPOSED)

* How Old Shellback gives the tell: he goes still, the sea drains out of his shell, the galleon creaks, his claws lift, the water boils around his legs.
* That after a Sunk defeat a "very cross crab" scuttles out of the broken galleon and away along the seabed. (GAMEPLAY 1.4 says he wears the galleon as a shell, so a crab inside it is a small step, but it is not written.)
* That he is a "he" in these lines. The spec and D133 say "his shell" and "his claws"; GAMEPLAY 2.5 says "it".
* That a hermit crab "has a short memory" (a joke in `shellback.back`, variant 3).
* That a crew fighting a Firebrand "keeps glancing at the barrels" (the Tinderbox, pitch in the hold). The spec says only that the crew fights weaker.
* "Boarders" as the plain name for the crew of a Boarder ship, and "musketeers" for a crew that plays Volley.
* The Gunline's fire drill is described as "buckets ready", and "ship of the line" is used as in the spec.
* The tow line in `fire.sinks` variant 3 repeats the Sunk rule (towed to a Harbour). It is not new, only worded for the replay.

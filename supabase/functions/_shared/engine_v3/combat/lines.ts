// The words of the text replay (docs/text/replay-lines.md, written by the narrative writer for P3.B2 piece 3). Each key has up to three
// variants with {variables} in braces. describe.ts picks the variant from a stable hash of the battle seed, the key and the round, so
// the same record always tells the same story and a long fight does not repeat itself. Presentation only: no line takes a random roll.
// The words are the writer's; the rules about when a line is shown are in describe.ts. No number that P3.2 may retune is typed into a
// line: numbers come from the record or from balance.ts through a variable.

export const LINES = {
  "start.far": [
    "{ship}'s spotters see {enemy} first, so the battle starts at Far range.",
    "{ship} has the sharper lookouts. The battle opens at Far range, where its Mortar can reach.",
    "The spotters of {ship} call the range early. Both ships start at Far.",
  ],
  "range.closes": [
    "The ships close from {from} to {to}.",
    "The range drops from {from} to {to}.",
    "They draw nearer: {from} becomes {to}.",
  ],
  "range.closes2": [
    "The ships close two bands at once, from {from} to {to}.",
    "Two bands in one round: {from} to {to}.",
    "The range collapses from {from} to {to}.",
  ],
  "range.opens": [
    "The ships draw apart, from {from} to {to}.",
    "The range grows from {from} to {to}.",
    "Open water between them: {from} becomes {to}.",
  ],
  "range.opens2": [
    "The ships part two bands at once, from {from} to {to}.",
    "Two bands of open water in one round: {from} to {to}.",
    "Both ships turn away, and the range jumps from {from} to {to}.",
  ],
  "range.stays": [
    "The range stays {range}.",
    "Nobody gives ground. The range stays {range}.",
    "Still {range} range.",
  ],
  "ram.hit": [
    "{ship} drives its prow into {enemy}. {enemy} loses {hull} Hull and {ship} loses {self}.",
    "{ship} rams {enemy} at speed. {hull} Hull splinters off {enemy}, and {self} off {ship}.",
    "Prow meets planking. {enemy} loses {hull} Hull, and {ship} pays {self} Hull for the privilege.",
  ],
  "ram.miss.crossed": [
    "{enemy} crosses {ship}'s bow just in time, and the ram finds only water.",
    "{ship} lines up the ram, but {enemy} has crossed its bow. Splash.",
    "The ram never lands: {enemy} crossed the bow and {ship} sails through the gap.",
  ],
  "ram.miss.outrun": [
    "{enemy} wins the chase, and {ship} rams the spot where it used to be.",
    "{ship} is too slow. {enemy} outruns the ram.",
    "{enemy} slips away before the prow arrives. No ram this round.",
  ],
  "ram.miss.contest": [
    "{ship}'s ram glances off. {enemy} turns at the last moment and takes no damage.",
    "The prow of {ship} scrapes along {enemy}'s side and does no harm.",
    "{enemy} swings aside, and the ram only scrapes the paint.",
  ],
  "ram.braced": [
    "{enemy} is braced and takes only {hull} Hull. {ship} still loses {self}.",
    "{enemy} braces for the blow. The ram does {hull} Hull, and {ship} loses {self} in the crash.",
    "A Gunline that holds its ground is hard to ram: {enemy} takes {hull} Hull and {ship} loses {self}.",
  ],
  "ram.grapnels": [
    "{enemy}'s grapnels are already on {ship}'s prow. The ram does only {hull} Hull.",
    "{enemy} is already throwing grapnels, and the ram lands as half a blow: {hull} Hull.",
    "The grapnel lines of {enemy} catch the bow of {ship}. Only {hull} Hull of the ram gets through.",
  ],
  "ram.dash": [
    "{ship} dashes in, closing two bands at once.",
    "{ship} puts on a burst of speed and closes two bands in a single round.",
    "No time to think: {ship} dashes from {from} to {to}.",
  ],
  "ram.dash.spoils": [
    "{enemy} crosses {ship}'s bow, but the dash spoils the rake. It lands weaker, and {ship} is not weakened.",
    "The dash carries {ship} through {enemy}'s rake. The rake does less, and {ship}'s guns stay at full strength.",
    "{ship} dashes straight through the rake, and {enemy} gets less out of it.",
  ],
  "ram.dash.fails": [
    "{ship}'s dash is not enough, and {enemy}'s rake lands in full.",
    "{enemy} crosses the bow, and {ship} cannot spoil the rake.",
    "The dash comes up short. {enemy} rakes {ship} as planned.",
  ],
  "mortar.hit": [
    "{ship}'s Mortar shell drops onto {enemy} for {hull} Hull.",
    "The shell from {ship}'s Mortar lands on {enemy}'s deck and takes off {hull} Hull.",
    "{ship} lobs a shell over the horizon. {enemy} loses {hull} Hull.",
  ],
  "mortar.miss": [
    "{ship}'s Mortar shell misses {enemy} and splashes into the sea.",
    "The shell from {ship} lands in the water. The fish have opinions.",
    "{ship} misses with the Mortar. The shell does no harm.",
  ],
  "mortar.zeroing": [
    "{ship}'s spotters have the range. Zeroing In: the Mortar does {bonus}% more.",
    "The range has not changed, so {ship}'s shells land closer. Mortar damage is up {bonus}%.",
    "Zeroing In: {ship} walks its shells onto the target. {bonus}% more damage.",
  ],
  "mortar.zeroing.reset": [
    "The range changed, so {ship} must find its mark again. Zeroing In starts over.",
    "{ship} lost the range. Zeroing In starts again.",
    "New range, new aim. {ship}'s Mortar starts over.",
  ],
  "mortar.refused": [
    "{ship} has no mortar, so it fires Round shot instead.",
    "{ship} was told to use the Mortar, but only a Bombardier has one. Round shot it is.",
    "No Mortar aboard {ship}. It fires Round shot.",
  ],
  "mortar.dry": [
    "{ship} is out of Powder, so its guns fire weakly.",
    "{ship}'s magazine is empty. The shot goes out at a poor strength.",
    "No Powder aboard {ship}. Whatever it fires now hardly stings.",
  ],
  "hotshot.hit": [
    "{ship}'s Hot Shot, heated in the galley fire, hits {enemy} for {hull} Hull.",
    "A glowing ball from {ship} slams into {enemy}. {hull} Hull lost.",
    "{ship} fires Hot Shot at {enemy}: {hull} Hull, and a lot of smoke.",
  ],
  "hotshot.toofar": [
    "{ship}'s Hot Shot falls short at {range} range. Hot Shot is best at Short and Close.",
    "At {range} range the Hot Shot loses its bite. {ship} should save it for Short and Close.",
    "The Hot Shot of {ship} cools on the way. It is too far to do much.",
  ],
  "hotshot.dry": [
    "{ship} puts the last of its Powder into a Hot Shot. The magazine is empty.",
    "Hot Shot eats Powder. {ship} fires it and has none left.",
    "{ship} has Powder for only part of a Hot Shot. It fires anyway, and the magazine is empty.",
  ],
  "hotshot.refused": [
    "Only a Firebrand fires Hot Shot, so {ship} fires Round shot instead.",
    "{ship} has no way to heat its shot. Round shot it is.",
    "No Hot Shot for {ship}: it is not a Firebrand. It fires Round shot.",
  ],
  "fire.lit.hotShot": [
    "{by}'s Hot Shot lodges in {ship} and the pitch catches. {ship} is on fire for {rounds} rounds.",
    "The glowing shot from {by} sets {ship} alight. The fire will burn for {rounds} rounds.",
    "{ship} catches fire from {by}'s Hot Shot. Expect {rounds} rounds of flames.",
  ],
  "fire.lit.mortar": [
    "{by}'s shell bursts on {ship} and sets it alight. The fire burns for {rounds} rounds.",
    "A Mortar shell from {by} starts a fire on {ship}'s deck. It will burn for {rounds} rounds.",
    "{ship} is on fire. {by}'s shell burst on the deck, and the flames last {rounds} rounds.",
  ],
  "fire.lit.firePots": [
    "A Fire Pot from {by} breaks on {ship}'s deck. {ship} is on fire for {rounds} rounds.",
    "The pitch from {by}'s pot catches. {ship} burns for {rounds} rounds.",
    "{by}'s Fire Pot finds its mark, and {ship} goes up like a lantern for {rounds} rounds.",
  ],
  "fire.lit.ram": [
    "{ship} rams a ship full of pitch. The blaze jumps aboard and burns for {rounds} rounds.",
    "Ramming {by} was a hot idea. {ship} catches fire for {rounds} rounds.",
    "The pitch in {by}'s hold spills over {ship}'s prow. {ship} burns for {rounds} rounds.",
  ],
  "fire.lit.embers": [
    "Embers from {by} drift across the lashings, and {ship}'s deck catches fire for {rounds} rounds.",
    "Lashed to a Firebrand, {ship} catches the embers. It burns for {rounds} rounds.",
    "Sparks leap from {by} to {ship}. The fire burns for {rounds} rounds.",
  ],
  "fire.burns": [
    "The fire on {ship} burns on. It loses {hull} Hull.",
    "{ship} is still burning and loses {hull} Hull.",
    "Flames climb {ship}'s masts. {hull} Hull lost to the fire.",
  ],
  "fire.out": [
    "The fire on {ship} burns out.",
    "{ship}'s crew beats out the last flames.",
    "The flames die down on {ship}. It is still afloat.",
  ],
  "fire.sinks": [
    "The fire is too much for {ship}. It sinks in round {round}.",
    "{ship} burns down to the waterline and sinks.",
    "{ship} is lost to the flames. It will be towed to a Harbour, as always.",
  ],
  "fire.drill": [
    "{ship}'s crew has drilled for fire. The flames cost it only {hull} Hull.",
    "A ship of the line keeps its buckets ready. {ship} loses only {hull} Hull to the fire.",
    "{ship}'s fire drill pays off: only {hull} Hull instead of the full burn.",
  ],
  "fire.pitch": [
    "{ship} is full of pitch. The fire costs it {hull} Hull.",
    "The pitch in {ship}'s hold burns too. {hull} Hull lost to the fire.",
    "{ship} carries barrels of pitch below deck, and the fire loves them. {hull} Hull lost.",
  ],
  "deck.quiet": [
    "The ships are Grappled. The great guns are quiet and the crews fight on deck.",
    "Too close for the guns. The crews fight on the decks.",
    "Grappled ships cannot fire their great guns. The deck fight decides.",
  ],
  "deck.charge": [
    "{ship}'s crew charges with cutlasses.",
    "{ship}'s crew draws cutlasses and charges across the rail.",
    "Cutlasses out: {ship}'s crew charges.",
  ],
  "deck.volley": [
    "{ship}'s crew fires a volley of muskets and swivel guns.",
    "Muskets and swivel guns crackle from {ship}'s rail.",
    "{ship}'s musketeers line the rail and fire.",
  ],
  "deck.repel": [
    "{ship}'s crew sets pikes along the rail.",
    "Pikes bristle along {ship}'s rail.",
    "{ship}'s crew stands behind the pikes and holds the rail.",
  ],
  "deck.firePots": [
    "{ship}'s crew throws clay pots of lit pitch and rum.",
    "Clay pots of pitch and rum fly from {ship}.",
    "{ship}'s crew lights its pots and throws them across the rail.",
  ],
  "deck.fists": [
    "{ship}'s crew fights with fists and belaying pins.",
    "No clear order: {ship}'s crew brawls with whatever is to hand.",
    "{ship}'s crew has no plan and fights with fists and belaying pins.",
  ],
  "deck.fists.guns": [
    "The guns are quiet while Grappled, so {ship}'s crew fights with fists.",
    "{ship} ordered the guns, but there is no room to fire them. The crew brawls.",
    "A Guns order means nothing on a Grappled deck. {ship}'s crew fights with fists.",
  ],
  "deck.fists.powder": [
    "{ship} has no Powder for a Volley, so its crew fights with fists.",
    "The muskets of {ship} are dry. The crew fights with fists.",
    "No Powder, no Volley. {ship}'s crew fights with fists.",
  ],
  "deck.fists.drill": [
    "{ship}'s crew is not yet drilled to throw Fire Pots, so it fights with fists.",
    "{ship} has pots but its crew is not drilled to throw them. Fists it is.",
    "Fire Pots take a drilled crew. {ship}'s crew fights with fists.",
  ],
  "deck.fists.surprise": [
    "{ship}'s crew did not expect boarders and fights with fists.",
    "The boarders catch {ship}'s crew unready. It fights with fists.",
    "{ship}'s crew had chosen its order before the grapple, so it grabs belaying pins.",
  ],
  "deck.fists.collide": [
    "Both ships Closed In. Neither boarded, so both crews fight with fists.",
    "The ships meet bow to bow. Nobody boarded, and both crews brawl.",
    "A collision, not a boarding. Both crews fight with fists.",
  ],
  "pair.chargeVolley": [
    "{winner}'s charge reaches {loser}'s muskets before they reload. {loser}'s crew gives way.",
    "The charge of {winner} reaches the muskets before they reload. {loser} gives way.",
    "{loser}'s muskets are still reloading when {winner}'s cutlasses arrive.",
  ],
  "pair.volleyRepel": [
    "{winner}'s muskets find the crew massed at {loser}'s rail. {loser}'s crew gives way.",
    "The pikes of {loser} are no use against muskets. {winner}'s volley wins the exchange.",
    "{loser}'s crew is bunched at the rail, an easy target for {winner}'s muskets.",
  ],
  "pair.repelCharge": [
    "{loser}'s charge runs onto {winner}'s pikes and stops. {loser}'s crew gives way.",
    "The pikes hold the rail and the charge breaks. {winner} wins the exchange.",
    "{winner}'s pikes are exactly what a charge does not need.",
  ],
  "pair.even": [
    "Neither order has the edge. The crews trade blows evenly.",
    "Nothing wins the exchange: it is a plain scrap.",
    "The orders do not beat each other. The fight is even this round.",
  ],
  "pair.pots": [
    "{winner}'s pots fly over the pikes. Pikes do not stop a pot.",
    "Repel is no use against Fire Pots. {loser}'s pikes cannot hold off the pitch.",
    "The pots of {winner} land behind {loser}'s pikes.",
  ],
  "edge.firstOver": [
    "{ship} is over the rail first. Its Board fights as a Charge, and {enemy}'s crew is caught unready.",
    "{ship}'s crew goes over the rail first, and {enemy}'s crew has no time to form up.",
    "First over the rail: {ship}'s crew hits {enemy} before it can answer.",
  ],
  "edge.bothBoard": [
    "Both ships Board at once. Both crews charge, and nobody is first over the rail.",
    "Two boarders meet at the rail. Neither has the edge.",
    "Both ships throw grapnels together, and nobody gets there first.",
  ],
  "edge.holds": [
    "{ship} boarded, so it holds the edge. {enemy} will find it hard to cut free.",
    "{ship} holds the boarder's edge for as long as the ships are lashed together.",
    "The edge is {ship}'s. {enemy} is lashed fast and will struggle to break away.",
  ],
  "edge.none": [
    "Nobody boarded, so nobody holds the edge.",
    "The ships came together without a boarder. Nobody holds the edge.",
    "Neither ship boarded the other. The edge is nobody's.",
  ],
  "cutfree.hard": [
    "{ship} is lashed fast to {enemy}. Cutting free will be hard.",
    "{enemy}'s lines hold {ship} tight. Cutting free is hard.",
    "Lashed fast: {enemy}'s Helm score counts double while {ship} tries to cut free.",
  ],
  "cutfree.win": [
    "{ship} cuts the lines and drifts free. The range goes back to Close.",
    "The axes win: {ship} is free of {enemy}. No fighting this round.",
    "{ship}'s crew hacks through the grapnel lines. The ships are apart again.",
  ],
  "cutfree.fail": [
    "{ship} hacks at the lines, but they hold. The ships stay Grappled.",
    "The grapnel lines hold. {ship} stays lashed to {enemy}.",
    "{ship}'s axes bite, but {enemy}'s lines are too many. Still Grappled.",
  ],
  "cutfree.quiet": [
    "Every hand is at the axes, so the guns of both ships stay quiet this round.",
    "The guns stay quiet in the round a ship cuts free: every hand is at the axes.",
    "Nobody is at the guns while the lines are cut.",
  ],
  "pots.caught": [
    "{ship} throws a Fire Pot and the pitch catches. {enemy}'s deck is on fire.",
    "The pot from {ship} breaks and the pitch catches. {enemy} burns.",
    "{ship}'s Fire Pot lands true. The flames spread across {enemy}'s deck.",
  ],
  "pots.flash": [
    "{ship}'s pot flashes. Both ships lose {hull} Hull before the crews beat it out.",
    "The pitch flares between the lashed ships. {ship} and {enemy} lose {hull} Hull each.",
    "A pot catches between the two ships. The crews put it out, but both lose {hull} Hull.",
  ],
  "pots.noFire": [
    "{ship}'s pot breaks on the deck, and the pitch does not catch.",
    "The pitch from {ship}'s pot fizzles out.",
    "{ship}'s Fire Pot splashes across the planks and goes out.",
  ],
  "pots.last": [
    "{ship} throws its last Fire Pot.",
    "That was the last Fire Pot aboard {ship}.",
    "{ship}'s hold is out of pots after that throw.",
  ],
  "pots.none": [
    "{ship} has no Fire Pots left, so its crew fights with fists.",
    "The pots of {ship} are all gone. Its crew picks up belaying pins.",
    "Nothing left to throw: {ship}'s crew fights with fists.",
  ],
  "tinderbox": [
    "{ship}'s crew fights a ship full of pitch and keeps glancing at the barrels. It fights weaker.",
    "{ship}'s crew is nervous about the pitch aboard {enemy} and fights weaker for it.",
    "Tinderbox: crews fighting {enemy} are shaken by the pitch, and {ship}'s crew is no exception.",
  ],
  "fighters": [
    "{ship}'s Boarders are Fighters: their crew fights with extra strength.",
    "Fighters: {ship}'s crew is picked for the rail and hits harder.",
    "{ship}'s crew has done this before. It fights with extra strength.",
  ],
  "drill.stage": [
    "{ship}'s {stage} are well drilled and fight harder for it.",
    "Drill pays off: {ship}'s {stage} hit harder than an untrained crew.",
    "{ship}'s crew has trained as {stage}, and the deck fight shows it.",
  ],
  "drill.secondWave": [
    "Second Wave: {ship}'s Sea Wolves strike again after the first exchange.",
    "{ship}'s Sea Wolves come on in a second wave.",
    "The Sea Wolves of {ship} do not stop after one blow.",
  ],
  "board.short.ok": [
    "{ship} throws its grapnel lines from Short range and hauls {enemy} in. The ships are Grappled.",
    "From Short, {ship}'s grapnels reach {enemy}'s rail. The ships are Grappled.",
    "{ship} does not need to get closer. Its grapnel lines reach from Short, and {enemy} is caught.",
  ],
  "board.grapnels.win": [
    "{ship} cannot match {enemy}'s Helm, but the grapnels take hold anyway.",
    "{enemy} nearly slips away, but {ship}'s grapnels catch the rail.",
    "The Board fails on Helm, then the grapnels catch. {ship} hauls {enemy} in.",
  ],
  "board.fail": [
    "{ship} throws its grapnels, but they fall short.",
    "{ship}'s grapnel lines miss and splash into the sea.",
    "{ship} tries to board and fails.",
  ],
  "round.header.overtime": [
    "Round {round}, overtime, at {range} range.",
  ],
  "overtime.start": [
    "Overtime. The deck fight is not decided, so the crews fight on.",
    "Round {round}. The crews are still at it, and the battle goes into overtime.",
    "The deck fight goes on. Overtime, with the guns still quiet.",
  ],
  "overtime.last": [
    "Last round of overtime. After this the battle ends, one way or another.",
    "Second and last round of overtime. The fight ends here.",
    "The crews fight on for one more round. Then it is over.",
  ],
  "shellback.shell.intro": [
    "{boss} wears a sunken galleon for a shell. It takes the sting out of every hit, unless he rears up.",
    "The galleon on {boss}'s back soaks up part of every hit. It only opens when he rears up.",
    "Hits glance off the galleon on {boss}'s back. He is only fully open when he rears up.",
  ],
  "shellback.shell": [
    "{boss}'s shell takes the sting out of {ship}'s hit. It does {hull} Hull.",
    "The shell turns the worst of the blow. {ship}'s shot does {hull} Hull to {boss}.",
    "{ship}'s shot rings off the galleon on {boss}'s back. {hull} Hull gets through.",
  ],
  "shellback.tell": [
    "{boss} goes very still and the sea drains out of his shell. He is about to rear up.",
    "The old galleon on {boss}'s back creaks, and his claws lift. He is about to rear up.",
    "{boss} plants his legs and the water boils around him. Next round he rears up.",
  ],
  "shellback.rears": [
    "{boss} rears up and his shell swings open. Every hit lands in full this round.",
    "{boss} rears up, and the galleon on his back opens like a door. Nothing takes the sting out of hits now.",
    "Up he comes! {boss} rears up with his shell wide open. Full damage this round.",
  ],
  "shellback.snatch": [
    "{ship} crosses {boss}'s bow and a claw closes on its rail. The ships are Grappled, and he holds the edge.",
    "{boss} snatches {ship} out of its turn. The ships are Grappled and he holds the edge.",
    "{ship} sails across {boss}'s bow, and a claw snaps shut. Grappled, with him holding the edge.",
  ],
  "shellback.noRake": [
    "Crossing his bow does not rake {boss}. It only risks a snatch at Short and Close.",
    "{ship} crosses the bow, but a rake is no use against a shell this size.",
    "{boss} does not mind being crossed. A rake gets {ship} nothing here.",
  ],
  "shellback.mortar": [
    "{ship}'s Mortar shell falls on {boss}'s shell from above. It does {factor} times the damage and ignores the shell.",
    "A Mortar shell drops on the roof of {boss}'s shell. Much more damage: {hull} Hull.",
    "{ship}'s shell comes down from above and cracks his shell like a nut. {hull} Hull.",
  ],
  "shellback.driven.hull": [
    "{boss}'s shell is cracked. He has had enough and draws into it.",
    "{boss} backs away from the fight, battered, and draws into his shell.",
    "That is enough for {boss}. He retreats into his shell, and the Narrows go quiet.",
  ],
  "shellback.driven.claws": [
    "{boss}'s claws are battered. He draws them in and retreats into his shell.",
    "With his claws worn down, {boss} gives up the rail and retreats into his shell.",
    "{boss} cannot hold the rail any longer. He retreats into his shell.",
  ],
  "shellback.beaten.driven": [
    "{boss} is driven off. {captains} may now pass the gate.",
    "{boss} retreats into his shell, and the way past is open to {captains}.",
    "He has had enough. {captains} may now pass the gate {boss} guards.",
  ],
  "shellback.beaten.sunk": [
    "The galleon on {boss}'s back gives way and he scuttles off along the seabed. {captains} may pass the gate.",
    "{boss}'s shell is wrecked. He scuttles away across the seabed, and the gate is open to {captains}.",
    "Down goes {boss}'s shell, and out scuttles a very cross crab. {captains} may pass the gate.",
  ],
  "shellback.beaten.captured": [
    "The claws of {boss} go slack. The boarders hold the deck, and {captains} may pass the gate.",
    "{boss} gives up the deck. His claws let go, and {captains} may now pass the gate.",
    "The last of {boss}'s claws lets go of the rail. The deck is won, and so is the gate for {captains}.",
  ],
  "shellback.back": [
    "{boss} retreats to the Narrows and will be back next Tide.",
    "He scuttles home to the Narrows. He will be back next Tide.",
    "{boss} will be back next Tide. He has a short memory and a big shell.",
  ],
  "shellback.points": [
    "{boss} shrugs it off. A Victory on points does not beat him, and the gate stays shut.",
    "Points mean nothing to a crab. {boss} is not beaten, and the gate stays shut.",
    "{ship} led on points, but {boss} is not beaten. The gate stays shut.",
  ],
  "outcome.victory": [
    "{winner} wins on points after round {round}, with a lead of {lead} points in damage.",
    "{winner} leads by {lead} points of damage after round {round}. A Victory on points.",
    "After round {round}, {winner} is ahead by {lead} points. Victory on points.",
  ],
  "outcome.draw": [
    "A draw after round {round}. Nobody led by enough, so nobody wins and nobody loses anything.",
    "Round {round} ends level. Nobody led by enough to win, so it is a draw.",
    "A draw. Neither side pulled far enough ahead, and nobody loses anything.",
  ],
  "outcome.escaped.one": [
    "{ship} opens range past Far and slips away. Nobody wins and nobody loses anything.",
    "{ship} turns away and the range grows past Far. The fight is over.",
    "{ship} outsails {enemy} and vanishes beyond Far range. Nobody wins and nobody loses anything.",
  ],
  "outcome.escaped.both": [
    "Both ships turn away past Far range, and the fight is over.",
    "Neither ship wants this fight. Both turn away past Far range.",
    "Both captains open range. The ships part beyond Far, and nobody wins.",
  ],
  "badge.head": [
    "{ship} sails as a {style}.",
  ],
  "trait.braced": [
    "{ship} holds and braces, so the rake does less to it and its guns are not weakened.",
  ],
  "trait.steady": [
    "{ship} holds a steady deck, and its guns hit harder.",
  ],
  "trait.longNines": [
    "{ship}'s long guns trade shots at Long range while it holds.",
  ],
  "trait.kite": [
    "{ship} turns away without weakening its guns.",
  ],
  "trait.slippery": [
    "{ship} slips away faster. Its Helm counts for more when it opens range.",
  ],
} as const satisfies Record<string, readonly string[]>;

export type LineKey = keyof typeof LINES;

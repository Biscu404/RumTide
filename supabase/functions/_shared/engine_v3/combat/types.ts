// Types for combat (GAMEPLAY 8). Pure data: no classes, no enums, JSON friendly.
// Section numbers point at docs/GAMEPLAY.md. The rules for these shapes live next to them:
// helm.ts and guns.ts (P2.1), boarding.ts, battle.ts and loot.ts (P2.2), doctrine.ts (P2.3).

import type { CaptainId, FightingStyle, HullId, ShipId, Terrain, WaterId, WindKind } from "../types.ts";
import type { Carried, SalvagePile } from "./loot.ts";

// ---------- Range, Helm moves and Guns orders (8.2, 8.4, 8.5) ----------

/**
 * The six distances, from far to near (D121). Grappled comes from a mutual Close In at Close or from Board (8.4, 8.6), and a
 * ship escapes by going past Far.
 */
export type Range = "far" | "long" | "medium" | "short" | "close" | "grappled";
export const RANGES: readonly Range[] = ["far", "long", "medium", "short", "close", "grappled"];

/** What a Lurker who springs an ambush may choose as the starting range (8.1). */
export type AmbushRange = "long" | "medium";

export type HelmMove = "closeIn" | "hold" | "openRange" | "crossTheirBow";
export const HELM_MOVES: readonly HelmMove[] = ["closeIn", "hold", "openRange", "crossTheirBow"];

/**
 * The orders a rule can give next to its Helm move. Round shot, Chain shot, Grapeshot, Mortar and Hot Shot fire the great guns;
 * Charge, Volley, Repel and Fire Pots are Deck orders that only count while Grappled (boarding spec section 2), and Board
 * grapples. Only a Bombardier can fire the Mortar and only a Firebrand Hot Shot; any other ship that is given one fires Round
 * shot (spec edge cases). While Grappled the great guns are quiet, so a Guns order there means Fists.
 */
export type GunsOrder =
  | "roundShot" | "chainShot" | "grapeshot" | "holdFire" | "board" | "repel" | "mortar" | "hotShot" | "charge" | "volley" | "firePots";
export const GUNS_ORDERS: readonly GunsOrder[] = [
  "roundShot", "chainShot", "grapeshot", "holdFire", "board", "repel", "mortar", "hotShot", "charge", "volley", "firePots",
];

/**
 * What a crew really fights with in a Grappled round. The four Deck orders a rule can give, and Fists, the fallback for a
 * Guns order, a Volley with no Powder and Fire Pots with no pot or no Drill 5. Fists is never a choice in a doctrine.
 */
export type DeckOrder = "charge" | "volley" | "repel" | "firePots" | "fists";
export const DECK_ORDERS: readonly DeckOrder[] = ["charge", "volley", "repel", "firePots", "fists"];

/** How a Deck order met the enemy flagship's: it won the pairing of the cycle, lost it, or neither (8.6). */
export type Pairing = "won" | "lost" | "even";

/** The three things a ship can lose in battle (6.3). */
export type DamageTrack = "hull" | "rigging" | "hands";
export const DAMAGE_TRACKS: readonly DamageTrack[] = ["hull", "rigging", "hands"];

/** A battle has two sides. A side is one ship, or a fleet of several that fight together (P2.5). */
export type BattleSide = "hunter" | "target";
export const BATTLE_SIDES: readonly BattleSide[] = ["hunter", "target"];

/** The row of the Helm pair table (8.4) that applied. "grappled" means the table was skipped because the ships are locked together. */
export type HelmRow =
  | "closeClose" | "closeHold" | "closeOpen" | "holdHold" | "holdOpen"
  | "openOpen" | "crossClose" | "crossHold" | "crossOpen" | "crossCross"
  | "grappled";

// ---------- Battle state (8.2) ----------

/** What a ship remembers about its own Guns orders: the staleness streak and Hold Fire's bonus (8.5). */
export interface GunsMemory {
  order: GunsOrder | null; // the order played last round, null before round 1
  repeats: number; // how many rounds in a row that order has been played, 0 before round 1
  charged: boolean; // Hold Fire was played last round, so this round's guns do extra damage
}

/** One ship as the battle sees it. Built from a Ship at the start and copied, never mutated, from round to round. */
export interface BattleShip {
  shipId: ShipId;
  captainId: CaptainId;
  name: string;
  side: BattleSide;
  hull: HullId;
  style?: FightingStyle; // the captain's Fighting Style, for its trait and the replay's badge. Absent for a ship with none
  // Fixed for the whole battle.
  cannons: number; // the Cannons stat value (10 for a fresh sloop)
  sails: number; // the Sails stat value (10 for a fresh sloop)
  maxHullPoints: number;
  maxRiggingPoints: number; // 0 for a monster with no Rigging (Old Shellback, P2.6)
  maxHands: number;
  helmBonus: number; // Helmsman, skill and trait bonuses to the Helm score as a fraction, 0.1 is +10%. 0 until crew (P8)
  boardingBonus: number; // Bosun, trait and Background bonuses to boarding strength (8.6), same unit. 0 until crew (P8)
  fixedHelm?: number; // a monster's Helm score; when set it is the score, with no gauge, terrain or crew on top (D101). Absent for every player ship
  charted: boolean; // the battle's water was Charted for this captain when the Tide began (D12)
  withCurrent: boolean; // moving with a Strong Current (2.2), decided when the battle is set up (P2.4)
  lurker: boolean; // springs an ambush (8.1)
  drill?: number; // the ship's Drill level (boarding spec section 4); absent means 0
  // Changing during the battle.
  hullPoints: number;
  riggingPoints: number;
  hands: number;
  powder: number;
  firePots?: number; // Fire Pots left; absent for a ship that never carried any
  abilities: string[]; // unused crew abilities, sorted (empty until P8.4)
  guns: GunsMemory;
}

// ---------- Records (the replay of a battle) ----------

/** One Helm contest (8.4, 8.6): `side` won with probability `chance`, by rolling `roll` below it. */
export interface ContestRecord {
  // The Close In against Open Range chase, a big ship reaching Close in Shallows, a Grappled ship trying to get away, a
  // Rammer's Ram finding its mark, a dashing Rammer spoiling the rake of a ship that crosses its bow, or the grapnels
  // taking hold when a Board failed on Helm score.
  kind: "chase" | "shallows" | "cutFree" | "ram" | "dash" | "grapnel";
  side: BattleSide; // the ship whose chance this is
  ship?: ShipId; // set for a fleet mate that is not its side's flagship: it contests the enemy flagship (P2.5)
  scores: Record<BattleSide, number>;
  chance: number;
  roll: number;
  winner: BattleSide;
}

/** A Fire Pot thrown in a Grappled round: its roll against `deck.fireChance`, and whether the pitch caught. */
export interface PotRecord {
  roll: number;
  fire: boolean;
}

/** What one crew did in the deck fight of a Grappled round (boarding spec section 2). */
export interface DeckRecord {
  order: DeckOrder; // what the crew really fought with, after the fallbacks
  pairing: Pairing; // against the enemy flagship's Deck order
  thrown?: PotRecord; // only when a Fire Pot was thrown
}

/** A ship burning at the end of a round: the Hull the fire took, and the rounds it has left to burn (fighting styles spec section 3). */
export interface BurnRecord {
  hull: number; // Hull lost to the fire at the end of this round
  left: number; // rounds still to burn after this one
}

export interface RoundShipRecord {
  ship: ShipId;
  rule: number; // index of the doctrine rule that gave the Helm move and Guns order (replays show it, 8.8)
  abilities: { rule: number; ability: string }[]; // ability rules that fired above it, in order
  helm: HelmMove; // the move played, after the Crippled rule
  guns: GunsOrder; // the order played: a ship given an order its style cannot give plays Round shot (see `asked`)
  asked?: GunsOrder; // the order the doctrine gave, only when the ship could not give it and played `guns` instead
  mortar?: { roll: number; hit: boolean; zeroing: number }; // only when the Mortar was fired: its hit roll, and the Zeroing In factor
  exposed?: number; // a monster reared up this round: Round shot does this many times the damage to it. Absent for every other round (D102)
  deck?: DeckRecord; // only in a round of the deck fight (the ships were Grappled when the guns had fired)
  fire?: BurnRecord; // only for a ship that burned at the end of this round
  helmScore: number;
  shot: { track: DamageTrack | null; damage: number; powderUsed: number }; // what this ship's guns did
  scrape: number; // Hull lost to a Reef scrape this round
  jettison: boolean; // the ship threw its cargo overboard this round (8.7); the loot step turns it into Flotsam
  // The ship's state after the round.
  hullPoints: number;
  riggingPoints: number;
  hands: number;
  powder: number;
  firePots?: number; // only for a ship that carries or carried Fire Pots
}

/** A Board order played at Close, or at Short for a Boarder (8.5): did the ship grapple, and why. */
export interface GrappleRecord {
  side: BattleSide;
  ship?: ShipId; // set for a fleet mate that is not its side's flagship (P2.5)
  ok: boolean;
  // The first reason that let it succeed, or "failed". "grapnels" is the Helm contest a failed Board gets (kind "grapnel" in the
  // round's contests).
  why: "helm" | "theyBoard" | "theyHold" | "grapnels" | "failed";
}

/**
 * A Rammer's Close In at Close (spec section 3): it misses when the other ship crossed its bow or won the chase, and otherwise
 * a Helm contest decides (kind "ram" in the round's contests). A Ram that lands never grapples.
 */
export interface RamRecord {
  side: BattleSide; // the ramming ship's side
  ship?: ShipId; // set for a fleet mate that is not its side's flagship; every Ram strikes the enemy flagship (D91)
  hit: boolean;
  why: "contest" | "crossed" | "outrun"; // the Helm contest decided, or they crossed its bow, or they won the chase
  hull: number; // Hull the struck ship lost
  self: number; // Hull the Rammer lost
}

/** The boarding melee of a Grappled round (8.6). */
export interface MeleeRecord {
  strength: Record<BattleSide, number>; // boarding strength going in
  lost: Record<BattleSide, number>; // Hands each side lost
  hands: Record<BattleSide, number>; // Hands each side has left
  firstOver?: BattleSide; // only in the grapple round: the boarder's Board fought as a Charge with First over the rail
}

/** Where a fire came from (fighting styles spec section 3). */
export type FireSource = "hotShot" | "mortar" | "firePots" | "ram" | "embers";

/**
 * A fire lit, or a Fire Pot's flash. `rounds` is how many rounds the new fire burns, this one included; the ship keeps whichever
 * fire burns longer. A Fire Pot thrown by a ship that is not a Firebrand does not burn: `rounds` is 0 and it costs the
 * `hull` named here at once, never taking a ship below 1 Hull.
 */
export interface FireRecord {
  source: FireSource;
  ship: ShipId; // the ship set alight, or hurt by the flash
  by: ShipId; // the ship whose shot, pot, prow or embers did it
  rounds: number;
  hull?: number; // only for a flash
}

/** One round. */
export interface RoundRecord {
  round: number; // 1 to B.combat.rounds, and up to B.combat.overtime more for a deck fight that is still going
  rangeBefore: Range;
  rangeAfter: Range;
  escaped: boolean; // the range went past Far
  row: HelmRow;
  contests: ContestRecord[]; // in the order they were rolled
  grapples: GrappleRecord[]; // Board orders played at Close, hunter first
  rams?: RamRecord[]; // only in a round a Rammer played Close In at Close, hunter side first
  edge?: BattleSide; // only while a side holds the boarder's edge: the side whose Board made the grapple (First over the rail, Lashed fast)
  fires?: FireRecord[]; // only in a round a fire was lit, in the order they were lit
  overtime?: true; // only after the last round: a deck fight going on in overtime (D127)
  melee: MeleeRecord | null; // null unless the ships were Grappled when the guns had fired. In a fleet battle each number is the whole side's
  crippled: BattleSide[]; // sides whose Rigging reached 0 this round (6.3)
  struck: BattleSide[]; // sides whose doctrine said Surrender; nothing else happens in that round
  ships: RoundShipRecord[]; // every ship, the hunter side first and each side in ship id order
  fleet?: FleetRoundRecord; // only in a fleet battle, where a side has more than one ship (P2.5)
}

// ---------- Outcomes (8.7) ----------

/** The seven rows of the outcome table. Crippled does not end a battle by itself, the others do. */
export type OutcomeKind = "sunk" | "captured" | "struckColours" | "crippled" | "escaped" | "victory" | "draw";

export interface BattleOutcome {
  kind: OutcomeKind;
  winner: BattleSide | null; // null for Escaped and Draw
  loser: BattleSide | null; // null for Escaped and Draw
  round: number; // the round it was decided in
}

// ---------- Doctrines (8.8) ----------

export type EnemyType = "merchant" | "navy" | "monster" | "player" | "brethren";
export const ENEMY_TYPES: readonly EnemyType[] = ["merchant", "navy", "monster", "player", "brethren"];

export type DoctrineCondition =
  | { kind: "range"; op: "is" | "atLeast" | "atMost"; range: Range }
  | { kind: "round"; op: "is" | "atLeast"; n: number }
  | { kind: "track"; who: "mine" | "theirs"; track: DamageTrack; op: "above" | "below"; pct: number } // pct is 0 to 100
  | { kind: "theirLastHelm"; move: HelmMove }
  | { kind: "theirLastGuns"; order: GunsOrder }
  | { kind: "enemyType"; type: EnemyType }
  | { kind: "enemyCaptain"; captainId: CaptainId }
  | { kind: "theirStyle"; style: FightingStyle } // false against a ship with no style (D128)
  | { kind: "terrain"; terrain: Terrain }
  | { kind: "windGauge"; holder: "mine" | "theirs" }
  | { kind: "havePowder" }
  | { kind: "haveFirePots" }
  | { kind: "abilityUnused"; ability: string };

export type DoctrineAction =
  | { kind: "fight"; helm: HelmMove; guns: GunsOrder; exposed?: number } // `exposed` is for monsters only: a captain's saved doctrine may not carry it (D102)
  | { kind: "ability"; ability: string } // fires the crew ability, then the rules below still give the Helm move and Guns order
  | { kind: "surrender" } // Struck Colours
  | { kind: "jettison" }; // cargo overboard becomes Flotsam; the round plays Hold and Hold Fire, and the rule fires once per battle (D65)

/** IF up to two conditions THEN an action. The last rule of a doctrine is Otherwise: no conditions. */
export interface DoctrineRule {
  if: DoctrineCondition[];
  then: DoctrineAction;
}

/** A named list of rules. Each round the first rule whose conditions all hold fires. */
export interface Doctrine {
  name: string;
  rules: DoctrineRule[];
}

// ---------- The whole battle ----------

export interface BattleRecord {
  tide: number;
  seed: number; // the Tide seed; every round's stream is rngFor(seed, "battle", hunter, target, round)
  at: WaterId;
  terrain: Terrain;
  wind: WindKind;
  hunter: ShipId; // the hunter side's flagship (its only ship, in a one ship battle)
  target: ShipId; // the target side's flagship
  doctrines: Record<BattleSide, string>; // the doctrine name each side's flagship used
  startRange: Range;
  gauge: BattleSide | null; // who holds the wind gauge
  ships: BattleShip[]; // every ship as round 1 began, the hunter side first and each side in ship id order
  rounds: RoundRecord[];
  outcome: BattleOutcome;
  final: BattleShip[]; // every ship as the battle ended, in the same order
  dealt: Record<BattleSide, number>; // damage share each side dealt, the measure for Victory on points (D56)
  jettisoned: BattleSide[]; // sides with a ship that threw its cargo overboard at some point
  fleet?: FleetRecord; // only in a fleet battle (P2.5); a one ship a side record has no such field
}

// ---------- Fleets (P2.5, GAME_DESIGN 7.5) ----------

/** What one side's damage is multiplied by: the fleet bonus, and Desperate Defence for an outnumbered side of player ships. */
export interface SideBonus {
  ships: number; // ships on the side
  fleet: number; // 1 plus the fleet bonus
  desperate: number; // 1 plus Desperate Defence, 1 when the side is not outnumbered or has an NPC ship
  total: number; // fleet times desperate
}

/** What a fleet battle adds to a BattleRecord. */
export interface FleetRecord {
  sides: Record<BattleSide, ShipId[]>; // every ship on each side, in ship id order
  doctrines: Record<ShipId, string>; // the doctrine each ship fought with
  bonus: Record<BattleSide, SideBonus>;
  dealtBy: Record<ShipId, number>; // the damage share each ship dealt, which the loot and the bounty are split by
  jettisoned: ShipId[]; // ships that threw their cargo overboard
}

/** What a fleet round adds to a RoundRecord. */
export interface FleetRoundRecord {
  damage: Record<BattleSide, Record<DamageTrack, number>>; // what each side's guns dealt, after the bonus and what the foe had left
  taken: Record<ShipId, Record<DamageTrack, number>>; // what each ship lost to the guns, shared out by max Hull
  crippled: ShipId[]; // ships whose Rigging reached 0 this round
  struck: ShipId[]; // ships whose doctrine said Surrender this round; the round ends the battle when there are any
}

// ---------- What a battle did to the world (P2.4) ----------

/** What the winner took and the loser gave up, after the fairness factor, the Cradle halving and the cap (8.7). */
export interface BattleLoot {
  share: number; // the table's share for the outcome
  fairness: number;
  cradle: number;
  capped: boolean;
  taken: Carried; // to the winner
  lost: Carried; // from the loser; for a Sunk ship this is more than `taken`, the rest went into the Wreck
}

/** The changes a finished battle made to ships, captains and the season, written down for the replay (P2.4). */
export interface BattleAftermath {
  pvp: boolean; // both captains are players
  winner: ShipId | null; // the winning side's flagship
  loser: ShipId | null; // the losing side's flagship
  loot: BattleLoot | null; // null when the outcome pays nothing; in a fleet battle the whole side's
  wreck: SalvagePile | null; // Sunk only, when something was left to wreck
  flotsam: SalvagePile[]; // cargo thrown overboard, one pile per ship that jettisoned
  bounty: { added: number; collected: number }; // added to the winner for hunting a weaker ship or refusing parley; collected from the loser
  shieldUntil: number | null; // the loser of a PvP battle is shielded until this Tide
  towed: boolean; // the loser is towed to a Harbour at the end of the Tide. A beaten boss is never towed (D104)
  beaten?: { boss: CaptainId; by: CaptainId[] }; // only when the losing side was a boss: the winning player captains, who now pass its gate (D105)
  fleet?: FleetAftermath; // only in a fleet battle (P2.5)
}

/** Who got what in a fleet battle: loot and bounties are per ship, shields per captain. */
export interface FleetAftermath {
  winners: ShipId[]; // every ship on the winning side, in ship id order
  losers: ShipId[];
  taken: Record<ShipId, Carried>; // what each winning ship took
  lost: Record<ShipId, Carried>; // what each losing ship gave up
  bounties: { captain: CaptainId; added: number; collected: number }[];
  towed: ShipId[];
}

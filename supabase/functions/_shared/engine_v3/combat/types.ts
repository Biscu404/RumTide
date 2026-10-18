// Types for combat (GAMEPLAY 8). Pure data: no classes, no enums, JSON friendly.
// Section numbers point at docs/GAMEPLAY.md. The rules for these shapes live next to them:
// helm.ts and guns.ts (P2.1), boarding.ts, battle.ts and loot.ts (P2.2), doctrine.ts (P2.3).

import type { CaptainId, HullId, ShipId, Terrain, WaterId, WindKind } from "../types.ts";
import type { Carried, SalvagePile } from "./loot.ts";

// ---------- Range, Helm moves and Guns orders (8.2, 8.4, 8.5) ----------

/** The four range bands, from far to near. Grappled comes from a mutual Close In at Close or from Board (8.4, 8.6). */
export type Range = "long" | "medium" | "close" | "grappled";
export const RANGES: readonly Range[] = ["long", "medium", "close", "grappled"];

/** What a Lurker who springs an ambush may choose as the starting range (8.1). */
export type AmbushRange = "long" | "medium";

export type HelmMove = "closeIn" | "hold" | "openRange" | "crossTheirBow";
export const HELM_MOVES: readonly HelmMove[] = ["closeIn", "hold", "openRange", "crossTheirBow"];

export type GunsOrder = "roundShot" | "chainShot" | "grapeshot" | "holdFire" | "board" | "repel";
export const GUNS_ORDERS: readonly GunsOrder[] = ["roundShot", "chainShot", "grapeshot", "holdFire", "board", "repel"];

/** The three things a ship can lose in battle (6.3). */
export type DamageTrack = "hull" | "rigging" | "hands";
export const DAMAGE_TRACKS: readonly DamageTrack[] = ["hull", "rigging", "hands"];

/** A battle has two sides. Fleets (P2.5) put several ships on a side. */
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
  // Fixed for the whole battle.
  cannons: number; // the Cannons stat value (10 for a fresh sloop)
  sails: number; // the Sails stat value (10 for a fresh sloop)
  maxHullPoints: number;
  maxRiggingPoints: number; // 0 for a monster with no Rigging (Old Shellback, P2.6)
  maxHands: number;
  helmBonus: number; // Helmsman, skill and trait bonuses to the Helm score as a fraction, 0.1 is +10%. 0 until crew (P8)
  boardingBonus: number; // Bosun, trait and Background bonuses to boarding strength (8.6), same unit. 0 until crew (P8)
  charted: boolean; // the battle's water was Charted for this captain when the Tide began (D12)
  withCurrent: boolean; // moving with a Strong Current (2.2), decided when the battle is set up (P2.4)
  lurker: boolean; // springs an ambush (8.1)
  // Changing during the battle.
  hullPoints: number;
  riggingPoints: number;
  hands: number;
  powder: number;
  abilities: string[]; // unused crew abilities, sorted (empty until P8.4)
  guns: GunsMemory;
}

// ---------- Records (the replay of a battle) ----------

/** One Helm contest (8.4, 8.6): `side` won with probability `chance`, by rolling `roll` below it. */
export interface ContestRecord {
  kind: "chase" | "shallows" | "cutFree"; // the Close In against Open Range chase, a big ship reaching Close in Shallows, or a Grappled ship trying to get away
  side: BattleSide; // the ship whose chance this is
  scores: Record<BattleSide, number>;
  chance: number;
  roll: number;
  winner: BattleSide;
}

export interface RoundShipRecord {
  ship: ShipId;
  rule: number; // index of the doctrine rule that gave the Helm move and Guns order (replays show it, 8.8)
  abilities: { rule: number; ability: string }[]; // ability rules that fired above it, in order
  helm: HelmMove; // the move played, after the Crippled rule
  guns: GunsOrder;
  helmScore: number;
  shot: { track: DamageTrack | null; damage: number; powderUsed: number }; // what this ship's guns did
  scrape: number; // Hull lost to a Reef scrape this round
  jettison: boolean; // the ship threw its cargo overboard this round (8.7); the loot step turns it into Flotsam
  // The ship's state after the round.
  hullPoints: number;
  riggingPoints: number;
  hands: number;
  powder: number;
}

/** A Board order played at Close (8.5): did the ship grapple, and why. */
export interface GrappleRecord {
  side: BattleSide;
  ok: boolean;
  why: "helm" | "theyBoard" | "theyHold" | "failed"; // the first reason that let it succeed, or "failed"
}

/** The boarding melee of a Grappled round (8.6). */
export interface MeleeRecord {
  strength: Record<BattleSide, number>; // boarding strength going in
  lost: Record<BattleSide, number>; // Hands each side lost
  hands: Record<BattleSide, number>; // Hands each side has left
}

/** One round. */
export interface RoundRecord {
  round: number; // 1 to B.combat.rounds
  rangeBefore: Range;
  rangeAfter: Range;
  escaped: boolean; // the range went past Long
  row: HelmRow;
  contests: ContestRecord[]; // in the order they were rolled
  grapples: GrappleRecord[]; // Board orders played at Close, hunter first
  melee: MeleeRecord | null; // null unless the ships were Grappled when the guns had fired
  crippled: BattleSide[]; // sides whose Rigging reached 0 this round (6.3)
  struck: BattleSide[]; // sides whose doctrine said Surrender; nothing else happens in that round
  ships: RoundShipRecord[]; // hunter first
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
  | { kind: "terrain"; terrain: Terrain }
  | { kind: "windGauge"; holder: "mine" | "theirs" }
  | { kind: "havePowder" }
  | { kind: "abilityUnused"; ability: string };

export type DoctrineAction =
  | { kind: "fight"; helm: HelmMove; guns: GunsOrder }
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
  hunter: ShipId; // the hunter's flagship
  target: ShipId; // the target's flagship
  doctrines: Record<BattleSide, string>; // the doctrine name each side used
  startRange: Range;
  gauge: BattleSide | null; // who holds the wind gauge
  ships: BattleShip[]; // every ship as round 1 began, hunter first
  rounds: RoundRecord[];
  outcome: BattleOutcome;
  final: BattleShip[]; // every ship as the battle ended, hunter first
  dealt: Record<BattleSide, number>; // damage share each side dealt, the measure for Victory on points (D56)
  jettisoned: BattleSide[]; // sides that threw their cargo overboard at some point
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
  winner: ShipId | null;
  loser: ShipId | null;
  loot: BattleLoot | null; // null when the outcome pays nothing
  wreck: SalvagePile | null; // Sunk only, when something was left to wreck
  flotsam: SalvagePile[]; // cargo thrown overboard, one pile per ship that jettisoned
  bounty: { added: number; collected: number }; // added to the winner for hunting a weaker ship or refusing parley; collected from the loser
  shieldUntil: number | null; // the loser of a PvP battle is shielded until this Tide
  towed: boolean; // the loser is towed to a Harbour at the end of the Tide
}

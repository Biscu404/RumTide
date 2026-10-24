// Helm (GAMEPLAY 8.4): Helm scores, the wind gauge, Helm contests, the pair table of moves and the terrain overrides.
// Pure: no network, no clock, no Math.random. Every roll comes from a labelled child of the round's stream,
// battleRng(...), so adding a roll in one place never shifts another.

import { B } from "../balance.ts";
import { rngFor } from "../rng.ts";
import type { Rng } from "../rng.ts";
import type { HullId, ShipId, Terrain, WindKind } from "../types.ts";
import { canSpoilRake, dashBands, spoiledRake, styleGunsMods, styleHelmFactor } from "./styles.ts";
import { BATTLE_SIDES, RANGES } from "./types.ts";
import type { AmbushRange, BattleShip, BattleSide, ContestRecord, HelmMove, HelmRow, Range } from "./types.ts";

const C = B.combat;
const FAR = RANGES.indexOf("far");
const MEDIUM = RANGES.indexOf("medium");
const SHORT = RANGES.indexOf("short");
const CLOSE = RANGES.indexOf("close");
const GRAPPLED = RANGES.indexOf("grappled");
const NEUTRAL = 1; // a guns modifier that changes nothing
const SHALLOWS_BIG: readonly HullId[] = ["brigantine", "frigate"]; // hulls that must win a contest to reach Close in Shallows (2.2)

const other = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");
const band = (position: number): Range => RANGES[position] ?? "far";

/** The stream for one round of one battle. Combat draws only from labelled children of it. */
export const battleRng = (tideSeed: number, hunterId: ShipId, targetId: ShipId, round: number): Rng =>
  rngFor(tideSeed, "battle", hunterId, targetId, round);

// ---------- Helm score and the wind gauge ----------

/** Rigging reached 0 (6.3). A monster with no Rigging at all cannot lose what it never had. */
export const isCrippled = (ship: BattleShip): boolean => ship.maxRiggingPoints > 0 && ship.riggingPoints <= 0;

/** Fighting in a water this captain has Charted against a ship that has not (4.2). */
export const hasLocalKnowledge = (ship: BattleShip, opponent: BattleShip): boolean => ship.charted && !opponent.charted;

/**
 * Helm score = Sails x (Rigging left / max Rigging) x (1 + crew bonuses) x wind gauge x terrain (8.4).
 * A monster has a fixed score instead (Old Shellback, D101): nothing multiplies it. A ship with no max Rigging and no
 * fixed score would score 0.
 */
export function helmScore(ship: BattleShip, opponent: BattleShip, terrain: Terrain, gauge: boolean): number {
  if (ship.fixedHelm !== undefined) return ship.fixedHelm;
  const rigging = ship.maxRiggingPoints > 0 ? ship.riggingPoints / ship.maxRiggingPoints : 0;
  let score = ship.sails * rigging * (NEUTRAL + ship.helmBonus);
  if (gauge) score *= C.windGaugeBonus;
  if (terrain === "shallows" && ship.hull === "sloop") score *= C.terrainHelm.shallowsSloop;
  if (hasLocalKnowledge(ship, opponent)) score *= C.terrainHelm.localKnowledge;
  if (ship.withCurrent) score *= C.terrainHelm.withStrongCurrent;
  return score;
}

/**
 * Who holds the wind gauge at the start (8.1): the higher Helm score, Lurkers get a bonus on this check only,
 * nobody in a Calm, nobody on a tie. The check does not include the gauge bonus it is deciding.
 */
export function windGauge(hunter: BattleShip, target: BattleShip, terrain: Terrain, wind: WindKind): BattleSide | null {
  if (wind === "calm") return null;
  const check = (ship: BattleShip, opponent: BattleShip) =>
    helmScore(ship, opponent, terrain, false) * (ship.lurker ? C.lurkerGaugeBonus : NEUTRAL);
  const h = check(hunter, target);
  const t = check(target, hunter);
  if (h === t) return null;
  return h > t ? "hunter" : "target";
}

/**
 * Long, or Medium in Fog; a Lurker who springs an ambush chooses (8.1). Spotters (a Bombardier flagship) turn a start at Long
 * into a start at Far, as the prototype did, so Fog and an ambush at Medium still start at Medium. Kelp never lets the range
 * pass Medium (8.4).
 */
export function startingRange(terrain: Terrain, ambush?: AmbushRange, spotted = false): Range {
  let start: Range = ambush ?? (terrain === "fog" ? "medium" : "long");
  if (spotted && start === "long") start = "far";
  return terrain === "kelp" && RANGES.indexOf(start) < MEDIUM ? "medium" : start;
}

// ---------- The Helm contest ----------

export interface ContestRoll {
  chance: number; // A's chance of winning
  roll: number;
  aWins: boolean;
}

/** Ship A wins with probability A over A plus B (8.4). Draws one number from `rng`. Two zero scores are an even contest. */
export function helmContest(rng: Rng, a: number, b: number): ContestRoll {
  const [x, y] = a + b > 0 ? [a, b] : [NEUTRAL, NEUTRAL];
  const chance = x / (x + y);
  const roll = rng.next();
  return { chance, roll, aWins: roll < chance };
}

/** One Helm contest, written down for the replay: `side` against the other ship, scored by `scores`. */
export function contestRecord(rng: Rng, kind: ContestRecord["kind"], side: BattleSide, scores: Record<BattleSide, number>): ContestRecord {
  const c = helmContest(rng, scores[side], scores[other(side)]);
  return { kind, side, scores: { ...scores }, chance: c.chance, roll: c.roll, winner: c.aWins ? side : other(side) };
}

// ---------- The pair table (8.4) ----------

const ROWS: Record<HelmMove, Record<HelmMove, HelmRow>> = {
  closeIn: { closeIn: "closeClose", hold: "closeHold", openRange: "closeOpen", crossTheirBow: "crossClose" },
  hold: { closeIn: "closeHold", hold: "holdHold", openRange: "holdOpen", crossTheirBow: "crossHold" },
  openRange: { closeIn: "closeOpen", hold: "holdOpen", openRange: "openOpen", crossTheirBow: "crossOpen" },
  crossTheirBow: { closeIn: "crossClose", hold: "crossHold", openRange: "crossOpen", crossTheirBow: "crossCross" },
};

/** The table row for two moves. The table is the same whichever ship plays which. */
export const pairRow = (a: HelmMove, b: HelmMove): HelmRow => ROWS[a][b];

export interface PairOutcome {
  row: HelmRow;
  position: number; // index in RANGES; below Far means the range went past Far
  gunsMod: Record<BattleSide, number>; // rake, flank or stern shot, weakened; NEUTRAL for a ship with none
}

/**
 * One row of the table, before terrain. `chaseWinner` is who won the Helm contest of the Close In against
 * Open Range chase; the other rows ignore it. A mutual Close In from Close is the only way the table grapples.
 */
export function applyPair(moves: Record<BattleSide, HelmMove>, range: Range, chaseWinner: BattleSide): PairOutcome {
  const gunsMod = { hunter: NEUTRAL, target: NEUTRAL };
  if (range === "grappled") return { row: "grappled", position: GRAPPLED, gunsMod };
  const row = pairRow(moves.hunter, moves.target);
  const here = RANGES.indexOf(range);
  const nearer = (bands: number) => Math.min(here + bands, CLOSE);
  const farther = (bands: number) => here - bands;
  const sideOf = (move: HelmMove): BattleSide => (moves.hunter === move ? "hunter" : "target");
  let position = here;
  switch (row) {
    case "closeClose":
      position = here >= CLOSE ? GRAPPLED : nearer(C.bands.closeClose);
      break;
    case "closeHold":
      position = nearer(C.bands.closeHold);
      break;
    case "closeOpen": {
      const closer = sideOf("closeIn");
      if (chaseWinner === closer) {
        position = nearer(C.bands.chase);
        gunsMod[closer] = C.flank; // the stern shot
      } else {
        position = farther(C.bands.chase);
      }
      break;
    }
    case "holdOpen":
      position = farther(C.bands.holdOpen);
      gunsMod[sideOf("openRange")] = C.weakened; // turning away
      break;
    case "openOpen":
      position = farther(C.bands.openOpen);
      break;
    case "crossClose":
    case "crossHold": {
      const crosser = sideOf("crossTheirBow");
      gunsMod[crosser] = C.rake;
      gunsMod[other(crosser)] = C.weakened;
      if (row === "crossClose") position = nearer(C.bands.rakeCloseIn);
      break;
    }
    case "crossOpen": {
      const crosser = sideOf("crossTheirBow");
      gunsMod[other(crosser)] = C.flank; // the ship that Opens gets the flank shot
      gunsMod[crosser] = C.weakened;
      position = farther(C.bands.crossFails);
      break;
    }
    case "crossCross":
      gunsMod.hunter = C.weakened;
      gunsMod.target = C.weakened;
      break;
    case "holdHold":
    case "grappled":
      break;
  }
  return { row, position, gunsMod };
}

// ---------- A whole Helm step ----------

/** Hull a ship loses to a Reef scrape: it plays Close In or Cross Their Bow in a Reef water that is not Charted for its captain (D44). */
export const reefScrape = (terrain: Terrain, ship: BattleShip, move: HelmMove): number =>
  terrain === "reef" && (move === "closeIn" || move === "crossTheirBow") && !ship.charted ? C.reefScrape : 0;

/** A Crippled ship cannot Open Range or Cross Their Bow (6.3); it holds instead. */
export function playableMove(ship: BattleShip, move: HelmMove): HelmMove {
  return isCrippled(ship) && (move === "openRange" || move === "crossTheirBow") ? "hold" : move;
}

export interface HelmInput {
  range: Range;
  terrain: Terrain;
  hunter: BattleShip;
  target: BattleShip;
  moves: Record<BattleSide, HelmMove>; // what the doctrines asked for
  gauge: BattleSide | null; // who holds the wind gauge for the whole battle
}

export interface HelmResult {
  row: HelmRow;
  moves: Record<BattleSide, HelmMove>; // what was played, after the Crippled rule
  scores: Record<BattleSide, number>;
  range: Range; // after the round; Far when the ships escaped
  escaped: boolean; // the range went past Far. The guns of that round are for the caller to skip
  gunsMod: Record<BattleSide, number>;
  scrape: Record<BattleSide, number>; // Hull lost to a Reef scrape
  contests: ContestRecord[]; // every Helm contest rolled, in order
}

/**
 * Step 3 of a round (8.3): both Helm scores, the pair table, the Fighting Style traits, then the terrain overrides.
 * `rng` is the round's stream; the rolls come from its children "helm/chase", "helm/dash/<side>" and "helm/shallows/<side>".
 * While Grappled the table does not apply (Cut Free is boarding, 8.6).
 *
 * The traits: Slippery (a Smuggler that Opens Range scores more, in every contest of the round), Dash (a Rammer's Close In
 * moves one band further, and a Rammer whose bow is crossed may spoil the rake), Kite, Braced and Steady Deck (styles.ts).
 */
export function resolveHelm(input: HelmInput, rng: Rng): HelmResult {
  const { range, terrain, hunter, target, gauge } = input;
  const ships: Record<BattleSide, BattleShip> = { hunter, target };
  const moves = { hunter: playableMove(hunter, input.moves.hunter), target: playableMove(target, input.moves.target) };
  const scores = {
    hunter: helmScore(hunter, target, terrain, gauge === "hunter") * styleHelmFactor(hunter, moves.hunter),
    target: helmScore(target, hunter, terrain, gauge === "target") * styleHelmFactor(target, moves.target),
  };
  const contests: ContestRecord[] = [];
  const scrape = { hunter: 0, target: 0 };

  if (range === "grappled") {
    return { row: "grappled", moves, scores, range, escaped: false, gunsMod: { hunter: NEUTRAL, target: NEUTRAL }, scrape, contests };
  }

  let chaseWinner: BattleSide = "hunter";
  if (pairRow(moves.hunter, moves.target) === "closeOpen") {
    const chase = contestRecord(rng.stream("helm", "chase"), "chase", "hunter", scores);
    contests.push(chase);
    chaseWinner = chase.winner;
  }
  const pair = applyPair(moves, range, chaseWinner);
  let position = pair.position;
  let gunsMod = styleGunsMods(pair.row, ships, moves, pair.gunsMod);

  // Dash: a Rammer's Close In that brings the ships nearer moves one band further, never past Close.
  const here = RANGES.indexOf(range);
  for (const side of BATTLE_SIDES) {
    const extra = dashBands(ships[side], moves[side]);
    if (extra > 0 && position > here && position < GRAPPLED) position = Math.min(position + extra, CLOSE);
  }
  // The dash spoils a rake: a Rammer whose bow is crossed while it Closes In wins a Helm contest to spoil it.
  for (const side of BATTLE_SIDES) {
    if (!canSpoilRake(pair.row, ships[side], moves[side])) continue;
    const spoil = contestRecord(rng.stream("helm", "dash", side), "dash", side, scores);
    contests.push(spoil);
    if (spoil.winner === side) gunsMod = spoiledRake(side, gunsMod);
  }

  // Kelp: the range never goes beyond Medium, so nobody escapes by range.
  if (terrain === "kelp") position = Math.max(position, MEDIUM);

  // Shallows: each Brigantine or Frigate without Local Knowledge must win a Helm contest for the range to reach Close.
  if (terrain === "shallows" && position === CLOSE && here < CLOSE) {
    let reached = true;
    for (const side of BATTLE_SIDES) {
      if (!SHALLOWS_BIG.includes(ships[side].hull) || hasLocalKnowledge(ships[side], ships[other(side)])) continue;
      const roll = contestRecord(rng.stream("helm", "shallows", side), "shallows", side, scores);
      contests.push(roll);
      if (roll.winner !== side) reached = false;
    }
    if (!reached) position = SHORT; // the range stops one band short of Close (D42)
  }

  // Reef: every Cross or Close In scrapes the hull, unless the water is Charted for that captain.
  for (const side of BATTLE_SIDES) scrape[side] = reefScrape(terrain, ships[side], moves[side]);

  const escaped = position < FAR;
  return { row: pair.row, moves, scores, range: escaped ? band(FAR) : band(position), escaped, gunsMod, scrape, contests };
}

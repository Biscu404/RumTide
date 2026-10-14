// Sections 7.1, 7.2 and 7.5: one battle of three rounds, one side against another.
// Pure: the only randomness is the luck roll from the Rng passed in. Ids are processed in sorted
// order so a battle replays exactly from its seed.

import { B, desperateDefence, fleetBattleBonus, roundDamage } from "./balance.ts";
import type { Rng } from "./rng.ts";
import type { BattleSide, Maneuver, RoundRecord, RoundShipRecord } from "./types.ts";

/** A ship as the battle sees it. `kind` is "npc" for merchants and the galleon. */
export interface Combatant {
  id: string;
  kind: "player" | "npc";
  pr: number;
  /** Stat values from statValue(), not levels. */
  cannons: number; sails: number; crew: number;
  hullPoints: number; maxHull: number;
  plan: readonly Maneuver[];
  /** Breaks flagship ties on a side (section 7.5). */
  startedHunt?: boolean;
}

export type BattleOutcome = "decisive" | "victory" | "draw";

export interface BattleResult {
  /** The sides as fought: ids in sorted order, with their flagships. */
  sides: [BattleSide, BattleSide];
  rounds: RoundRecord[];
  outcome: BattleOutcome;
  /** Index of the winning side, or null on a draw. */
  winner: 0 | 1 | null;
  /** Damage each side dealt, as a share of the other side's total max hull. */
  shares: [number, number];
  /** Damage each ship dealt over the battle, before the side multipliers. Loot is split by this. */
  damageDealt: Record<string, number>;
  /** Hull points left, never below 0. */
  hullAfter: Record<string, number>;
}

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const BEATS: Record<Maneuver, Maneuver> = {
  broadside: "board", board: "outmaneuver", outmaneuver: "broadside",
};

export const matchup = (mine: Maneuver, theirs: Maneuver) =>
  mine === theirs ? B.combat.tie : BEATS[mine] === theirs ? B.combat.win : B.combat.lose;

const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0);

const statFor = (c: Combatant, m: Maneuver) =>
  m === "broadside" ? c.cannons : m === "outmaneuver" ? c.sails : c.crew;

/** The highest PR ship. Ties go to whoever started the hunt, then to the lower id. */
export function pickFlagship(side: readonly Combatant[]): Combatant {
  const best = [...side].sort((a, b) =>
    b.pr - a.pr || Number(b.startedHunt === true) - Number(a.startedHunt === true) || compareIds(a.id, b.id))[0];
  if (!best) throw new Error("A battle side needs at least one ship");
  return best;
}

function checkSides(sides: readonly (readonly Combatant[])[]) {
  const seen = new Set<string>();
  for (const side of sides) {
    if (side.length === 0) throw new Error("A battle side needs at least one ship");
    for (const c of side) {
      if (seen.has(c.id)) throw new Error(`Ship ${c.id} is in the battle twice`);
      seen.add(c.id);
      if (c.plan.length < B.combat.rounds) throw new Error(`Ship ${c.id} needs a plan of ${B.combat.rounds} maneuvers`);
      if (!(c.hullPoints > 0) || !(c.maxHull > 0)) throw new Error(`Ship ${c.id} needs hull points to fight`);
    }
  }
}

const sumOf = (ships: readonly Combatant[], pick: (c: Combatant) => number) =>
  ships.reduce((total, c) => total + pick(c), 0);

export function resolveBattle(
  input: readonly [readonly Combatant[], readonly Combatant[]], rng: Rng,
): BattleResult {
  checkSides(input);
  const sides: [Combatant[], Combatant[]] = [
    [...input[0]].sort((a, b) => compareIds(a.id, b.id)),
    [...input[1]].sort((a, b) => compareIds(a.id, b.id)),
  ];
  const flagships = [pickFlagship(sides[0]), pickFlagship(sides[1])] as const;
  const maxHullOf: [number, number] = [sumOf(sides[0], (c) => c.maxHull), sumOf(sides[1], (c) => c.maxHull)];

  const hull = new Map<string, number>();
  const damageDealt: Record<string, number> = {};
  for (const c of [...sides[0], ...sides[1]]) { hull.set(c.id, c.hullPoints); damageDealt[c.id] = 0; }
  const lastManeuver = new Map<string, Maneuver>();

  const rounds: RoundRecord[] = [];
  const dealt: [number, number] = [0, 0];

  for (let round = 1; round <= B.combat.rounds; round++) {
    const maneuverOf = (c: Combatant) => c.plan[round - 1]!;
    const shipRecords: RoundShipRecord[] = [];
    const sideDamage: [number, number] = [0, 0];

    // Both sides hit at the same time, so work out all damage before any hull changes.
    for (const s of [0, 1] as const) {
      const own = sides[s], enemy = sides[other(s)];
      const enemyManeuver = maneuverOf(flagships[other(s)]);
      let sum = 0;
      for (const c of own) {
        const maneuver = maneuverOf(c);
        const m = matchup(maneuver, enemyManeuver);
        const stale = lastManeuver.get(c.id) === maneuver;
        const luck = rng.range(B.combat.luckMin, B.combat.luckMax);
        const damage = roundDamage(statFor(c, maneuver), m, stale, luck);
        shipRecords.push({ shipId: c.id, maneuver, matchup: m, stale, luck, damage });
        damageDealt[c.id]! += damage;
        sum += damage;
      }
      const outnumbered = own.every((c) => c.kind === "player") && enemy.length > own.length;
      sideDamage[s] = sum * fleetBattleBonus(own.length - 1)
        * (outnumbered ? desperateDefence(enemy.length - own.length) : 1);
    }

    // Damage a side receives is split across its ships in proportion to their max hull.
    let anyZero = false;
    for (const s of [0, 1] as const) {
      for (const c of sides[s]) {
        const left = Math.max(0, hull.get(c.id)! - sideDamage[other(s)] * (c.maxHull / maxHullOf[s]));
        hull.set(c.id, left);
        if (left <= 0) anyZero = true;
      }
      dealt[s] += sideDamage[s];
    }
    for (const sr of shipRecords) lastManeuver.set(sr.shipId, sr.maneuver);

    rounds.push({
      round, ships: shipRecords, sideDamage,
      hullAfter: Object.fromEntries([...hull].sort(([a], [b]) => compareIds(a, b))),
    });
    if (anyZero) break;   // after any round in which a hull reaches zero, the battle ends
  }

  const shares: [number, number] = [dealt[0] / maxHullOf[1], dealt[1] / maxHullOf[0]];
  const zero = (s: 0 | 1) => sides[s].some((c) => hull.get(c.id)! <= 0);

  let outcome: BattleOutcome = "draw";
  let winner: 0 | 1 | null = null;
  if (zero(0) || zero(1)) {
    outcome = "decisive";
    // If both sides lose a ship in the same round, whoever dealt more damage wins.
    if (zero(0) && zero(1)) {
      if (shares[0] === shares[1]) outcome = "draw";
      else winner = shares[0] > shares[1] ? 0 : 1;
    } else {
      winner = zero(0) ? 1 : 0;
    }
  } else if (Math.abs(shares[0] - shares[1]) >= B.combat.victoryMargin) {
    outcome = "victory";
    winner = shares[0] > shares[1] ? 0 : 1;
  }

  const sideRecord = (s: 0 | 1): BattleSide => ({
    captainIds: sides[s].filter((c) => c.kind === "player").map((c) => c.id),
    npcIds: sides[s].filter((c) => c.kind === "npc").map((c) => c.id),
    flagshipId: flagships[s].id,
  });

  return {
    sides: [sideRecord(0), sideRecord(1)],
    rounds, outcome, winner, shares, damageDealt,
    hullAfter: Object.fromEntries([...hull].sort(([a], [b]) => compareIds(a, b))),
  };
}

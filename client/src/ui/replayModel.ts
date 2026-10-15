import type { GameMap } from "@engine/map.ts";
import type { Battle, Maneuver } from "@engine/types.ts";
import { C, rgb } from "../palette.ts";
import { sailColour } from "../scenes/layout.ts";
import { listOf, shipLabel, type Names } from "./gazetteModel.ts";
import { maneuverLabel } from "./ordersModel.ts";

// What the battle replay shows (section 16.1: two sprites, plans revealed round by round, damage
// numbers, smoke), worked out from the saved Battle record and nothing else, so the animation can
// only show what happened. No Phaser in here, so it can be tested. The scene (ReplayScene) draws it.

/**
 * How a maneuver looks. Shape and colour both say which it is, so the replay reads without colour
 * (section 16.1: colour blind safe maneuver icons).
 */
export const MANEUVER_STYLE: Record<Maneuver, { shape: "circle" | "triangle" | "diamond"; colour: number; label: string }> = {
  broadside: { shape: "circle", colour: rgb(C.danger), label: maneuverLabel("broadside") },
  outmaneuver: { shape: "triangle", colour: rgb(C.shallows), label: maneuverLabel("outmaneuver") },
  board: { shape: "diamond", colour: rgb(C.gold), label: maneuverLabel("board") },
};

export type Edge = "edge" | "even" | "weak";

export interface ReplayShip {
  id: string;
  label: string;
  side: 0 | 1;
  /** Place in its side's line, the flagship first. */
  slot: number;
  flagship: boolean;
  npc: boolean;
  hullBefore: number;
  maxHull: number;
  sail: number;
}

export interface ReplayMove {
  shipId: string;
  maneuver: Maneuver;
  edge: Edge;
  /** Repeated last round's maneuver, so it hit weaker. */
  stale: boolean;
}

export interface ReplayRound {
  round: number;
  moves: ReplayMove[];
  /** Hull points each ship lost this round (never more than it had), and what it has left. */
  hullLost: Record<string, number>;
  hullAfter: Record<string, number>;
  /**
   * The side that dealt more damage this round, or null when it was level. Worked out from the damage
   * dealt, not the hull lost, because a ship on its last hull points loses less than the blow that sank it.
   */
  winner: 0 | 1 | null;
}

export interface Replay {
  id: string;
  title: string;
  place: string;
  ships: ReplayShip[];
  rounds: ReplayRound[];
  ending: {
    headline: string;
    /** Who won, as words for the second line. Empty on a draw. */
    winners: string;
    winnerSide: 0 | 1 | null;
    /** Ships whose hull reached zero: they strike their colours. */
    struck: string[];
    /** The winning captain's Parting Shot, if they wrote one (section 2.4). */
    partingShot: { shipId: string; text: string } | null;
  };
}

/** A name that fits over a ship: no article, and one word if the whole is longer than `max`. */
export function shortName(label: string, max = 11): string {
  const bare = label.replace(/^(a|an|the) /i, "");
  if (bare.length <= max) return bare;
  const first = bare.split(" ")[0]!;
  return first.length <= max ? first : `${first.slice(0, max - 1)}.`;
}

const NPC_SAIL = { smallTrader: rgb(C.mist), fatMerchant: rgb(C.steel), galleon: rgb(C.goldLight) } as const;
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const edgeOf = (matchup: number): Edge => (matchup > 1 ? "edge" : matchup < 1 ? "weak" : "even");

/**
 * Hulls at the start of the fight. Battles saved before the record held them are worked out from the
 * first round: what a ship had left plus its share of the damage its side took.
 */
function starts(battle: Battle, sideOf: Map<string, 0 | 1>): Record<string, { hullBefore: number; maxHull: number }> {
  if (battle.ships) return battle.ships;
  const first = battle.rounds[0];
  const out: Record<string, { hullBefore: number; maxHull: number }> = {};
  for (const [id, left] of Object.entries(first?.hullAfter ?? {})) {
    const side = sideOf.get(id) ?? 0;
    const onSide = [...sideOf.values()].filter((s) => s === side).length;
    const hull = left + (first?.sideDamage[side === 0 ? 1 : 0] ?? 0) / onSide;
    out[id] = { hullBefore: hull, maxHull: hull };
  }
  return out;
}

export function buildReplay(
  battle: Battle, names: Names, map: GameMap, partingShots: Record<string, string> = {},
): Replay {
  const sideOf = new Map<string, 0 | 1>();
  const lineOf: string[][] = battle.sides.map((s, i) => {
    const ids = [...s.captainIds, ...s.npcIds].sort(compareIds);
    ids.forEach((id) => sideOf.set(id, i as 0 | 1));
    return [s.flagshipId, ...ids.filter((id) => id !== s.flagshipId)];
  });
  const begin = starts(battle, sideOf);

  const ships: ReplayShip[] = lineOf.flatMap((line, side) => line.map((id, slot): ReplayShip => {
    const kind = names.npcs[id];
    const label = shipLabel(id, names);
    return {
      id, label, side: side as 0 | 1, slot, flagship: slot === 0, npc: kind !== undefined,
      hullBefore: begin[id]?.hullBefore ?? 1, maxHull: begin[id]?.maxHull ?? begin[id]?.hullBefore ?? 1,
      sail: kind !== undefined ? NPC_SAIL[kind] : sailColour(label),
    };
  }));

  let hull: Record<string, number> = Object.fromEntries(ships.map((s) => [s.id, s.hullBefore]));
  const rounds = battle.rounds.map((r): ReplayRound => {
    const lost: Record<string, number> = {};
    for (const s of ships) lost[s.id] = Math.max(0, (hull[s.id] ?? 0) - (r.hullAfter[s.id] ?? 0));
    hull = { ...r.hullAfter };
    return {
      round: r.round,
      moves: r.ships.map((m) => ({ shipId: m.shipId, maneuver: m.maneuver, edge: edgeOf(m.matchup), stale: m.stale })),
      hullLost: lost, hullAfter: { ...r.hullAfter },
      winner: r.sideDamage[0] > r.sideDamage[1] ? 0 : r.sideDamage[1] > r.sideDamage[0] ? 1 : null,
    };
  });

  const labels = lineOf.map((line) => listOf(line.map((id) => shipLabel(id, names))));
  const winnerSide = battle.winner;
  const headline = winnerSide === null ? "A DRAW" : battle.outcome === "decisive" ? "DECISIVE WIN" : "VICTORY";
  const last = battle.rounds[battle.rounds.length - 1];
  const struck = ships.filter((s) => (last?.hullAfter[s.id] ?? s.hullBefore) <= 0).map((s) => s.id);

  // The winning side's Parting Shot: the flagship's if it wrote one, else the first captain who did.
  let partingShot: Replay["ending"]["partingShot"] = null;
  if (winnerSide !== null) {
    for (const id of lineOf[winnerSide]!) {
      const text = names.npcs[id] === undefined ? partingShots[id]?.trim() : undefined;
      if (text) { partingShot = { shipId: id, text }; break; }
    }
  }

  return {
    id: battle.id,
    title: `${labels[0]} against ${labels[1]}`,
    place: map.node(battle.nodeId).name,
    ships, rounds,
    ending: { headline, winners: winnerSide === null ? "" : labels[winnerSide]!, winnerSide, struck, partingShot },
  };
}

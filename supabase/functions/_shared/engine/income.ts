// Section 8.2 (convoy) and section 12.4 (Shore Leave, Fair Winds): three bonuses on income.
// Income here is the profit on goods sold and the gold from merchant and galleon prizes. PvP loot,
// tribute and bounties only move gold between captains, so they get no bonus (docs/DECISIONS.md).
//
// The bonuses add together (1 + 0.5 + 0.2 + 0.1 per fleet mate), they never multiply, and the
// extra gold is rounded to a whole doubloon. All numbers live in balance.ts.

import { B } from "./balance.ts";
import type { GameMap } from "./map.ts";
import type { Captain } from "./types.ts";

/** What the bonuses depend on besides the captain's own row. Fair Winds is on the row itself. */
export interface IncomeFacts {
  /** Fleet mates who are on the same node or an adjacent one. */
  convoyMates: number;
}

/** One captain as the convoy sees them: which fleet and where the ship is. */
export interface IncomeRosterEntry {
  id: string;
  fleetId: string | null;
  nodeId: string;
}

/** The pieces of a snapshot the roster is read from. */
export interface RosterSource {
  captains: readonly Pick<Captain, "id" | "fleetId">[];
  ships: readonly { captainId: string; nodeId: string }[];
}

export const incomeRoster = (source: RosterSource): IncomeRosterEntry[] =>
  source.captains.map((c) => ({
    id: c.id, fleetId: c.fleetId, nodeId: source.ships.find((s) => s.captainId === c.id)!.nodeId,
  }));

/**
 * Section 12.4: captains below 70% of the median Legend get Fair Winds. The resolver works it out
 * as each Tide opens, so it holds for the whole Tide and does not flicker as scores move. Nobody is below a median of 0.
 */
export const hasFairWinds = (legend: number, medianLegend: number) =>
  legend < B.catchUp.fairWindsBelowMedian * medianLegend;

/** Section 8.2 rule 1: fleet mates on the same node or next to it. A ship is not its own mate. */
export function convoyMatesOf(map: GameMap, me: IncomeRosterEntry, roster: readonly IncomeRosterEntry[]): number {
  if (me.fleetId === null) return 0;
  return roster.filter((r) =>
    r.id !== me.id && r.fleetId === me.fleetId && (r.nodeId === me.nodeId || map.adjacent(r.nodeId, me.nodeId))).length;
}

/** The facts for one captain, read from everyone's place in the season. */
export function incomeFacts(map: GameMap, captainId: string, roster: readonly IncomeRosterEntry[]): IncomeFacts {
  const me = roster.find((r) => r.id === captainId);
  if (!me) throw new Error(`Unknown captain ${captainId}`);
  return { convoyMates: convoyMatesOf(map, me, roster) };
}

/** Is Shore Leave paying out in this Tide? Either a stored Tide of it was already spent in this Tide, or one is stored. */
export const shoreLeaveActive = (captain: Pick<Captain, "shoreLeaveTides" | "shoreLeaveUsedTide">, tide: number) =>
  captain.shoreLeaveUsedTide === tide || captain.shoreLeaveTides > 0;

/** The extra share of income a captain would get right now, such as 0.7 for Shore Leave and Fair Winds. Spends nothing. */
export const bonusRate = (captain: Captain, tide: number, facts: IncomeFacts) =>
  (shoreLeaveActive(captain, tide) ? B.catchUp.shoreLeaveBonus : 0)
  + (captain.fairWinds ? B.catchUp.fairWindsBonus : 0)
  + B.fleet.convoyPerMate * facts.convoyMates;

export interface IncomeBonus {
  /** The captain, with a stored Tide of Shore Leave spent if this income used one. */
  captain: Captain;
  shoreLeave: boolean;
  fairWinds: boolean;
  convoyMates: number;
  /** Extra share of the base income. */
  rate: number;
  /** Whole doubloons added on top of the base income. */
  extra: number;
}

/**
 * The bonus on `base` doubloons of income earned in `tide`. A stored Tide of Shore Leave is spent on
 * the first Tide it pays out in, and every income in that Tide gets it. Income of nothing spends nothing.
 */
export function incomeBonus(captain: Captain, tide: number, base: number, facts: IncomeFacts): IncomeBonus {
  if (!(base > 0)) return { captain, shoreLeave: false, fairWinds: false, convoyMates: 0, rate: 0, extra: 0 };

  const shoreLeave = shoreLeaveActive(captain, tide);
  const spend = shoreLeave && captain.shoreLeaveUsedTide !== tide;
  const rate = bonusRate(captain, tide, facts);
  return {
    captain: spend
      ? { ...captain, shoreLeaveTides: captain.shoreLeaveTides - 1, shoreLeaveUsedTide: tide }
      : captain,
    shoreLeave, fairWinds: captain.fairWinds, convoyMates: facts.convoyMates, rate,
    extra: Math.round(base * rate),
  };
}

/** The bonus in words for a message, such as "Shore Leave and a convoy of 2", or null when there is none. */
export function describeBonus(b: Pick<IncomeBonus, "shoreLeave" | "fairWinds" | "convoyMates">): string | null {
  const parts = [
    ...(b.shoreLeave ? ["Shore Leave"] : []),
    ...(b.fairWinds ? ["Fair Winds"] : []),
    ...(b.convoyMates > 0 ? [b.convoyMates === 1 ? "a convoy mate" : `a convoy of ${b.convoyMates}`] : []),
  ];
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

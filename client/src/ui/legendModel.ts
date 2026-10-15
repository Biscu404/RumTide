import type { Fleet } from "@engine/types.ts";
import { listOf } from "./gazetteModel.ts";

// What the Legend screen shows, with no Preact in it so it can be tested (section 6.4: Legend is the
// score, and the leaderboard ranks it). Legend is public: `public_captains` carries it for everyone.
//
// Fog of Legend (section 9 rule 11): in the last `fogOfLegendTides` Tides of a season the exact
// scores are hidden and the ranks stay visible, so nobody can aim a last minute dogpile at a precise
// gap. Season 0 has no fog (SEASON_PRESETS). A captain still sees their own score.
//
// Once the season is over (status `ended`) there is nothing left to aim at, so the fog is down and the
// ranking is final: every score shows and the winner is named.
//
// This hides the numbers on screen only. `public_captains` still carries the raw Legend, so before a
// season with fog (not Season 0) that view must stop showing it, see docs/DECISIONS.md.

/** A captain as `public_captains` shows them. */
export interface LegendRow {
  id: string;
  shipName: string;
  legend: number;
  bounty: number;
  fleetId: string | null;
  status: "active" | "ashore";
}

export interface LegendEntry {
  /** Competition ranking (1, 2, 2, 4), or null while nobody has earned any Legend yet. */
  rank: number | null;
  captainId: string;
  shipName: string;
  isMe: boolean;
  /** Whole Legend points, or null when the fog hides this captain's score. */
  legend: number | null;
  bounty: number;
  fleetName: string | null;
  fleetColour: string | null;
  ashore: boolean;
  /** The Legend leader wears the Most Wanted mark (section 9 rule 7) while the season runs. */
  mostWanted: boolean;
  /** Top of the final ranking. Equal scores share it. Only once the season is over. */
  champion: boolean;
}

export interface LegendScreen {
  entries: LegendEntry[];
  /** Somebody has Legend, so there is a ranking. */
  started: boolean;
  fogged: boolean;
  /** The season is over, so this is the final ranking. */
  final: boolean;
  /** The first Tide the fog is down, or null when this season has none. */
  fogFromTide: number | null;
  note: string | null;
}

export interface LegendInput {
  captains: readonly LegendRow[];
  fleets: readonly Pick<Fleet, "id" | "name" | "colour">[];
  myCaptainId: string;
  /** The Tide that is open. */
  tide: number;
  lengthTides: number;
  /** From the season's settings; 0 means no fog. */
  fogOfLegendTides: number;
  /** The season has ended: the fog is down and the ranking is final. */
  ended: boolean;
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Is the fog down? It covers the last `fogTides` Tides, the open one included. */
export const isFogged = (tide: number, lengthTides: number, fogTides: number) =>
  fogTides > 0 && tide > lengthTides - fogTides;

/**
 * The Most Wanted captain: the Legend leader, and the lowest id among equals. This is the rule
 * resolveTide uses, so the mark on screen is the one the engine pays out on.
 */
export function mostWantedId(captains: readonly Pick<LegendRow, "id" | "legend">[]): string | null {
  let best: string | null = null, bestLegend = 0;
  for (const c of [...captains].sort((x, y) => compare(x.id, y.id))) {
    if (c.legend > bestLegend) { best = c.id; bestLegend = c.legend; }
  }
  return best;
}

export function legendScreen(input: LegendInput): LegendScreen {
  const { captains, fleets } = input;
  const fogged = !input.ended && isFogged(input.tide, input.lengthTides, input.fogOfLegendTides);
  const started = captains.some((c) => c.legend > 0);
  const wanted = mostWantedId(captains);
  const fleetOf = new Map(fleets.map((f) => [f.id, f]));

  // Highest Legend first. Equal scores (such as everyone on 0) keep a steady order by name.
  const sorted = [...captains].sort((a, b) => b.legend - a.legend || a.shipName.localeCompare(b.shipName) || compare(a.id, b.id));
  const entries = sorted.map((c): LegendEntry => {
    const fleet = c.fleetId === null ? undefined : fleetOf.get(c.fleetId);
    const isMe = c.id === input.myCaptainId;
    const rank = started ? 1 + sorted.findIndex((x) => x.legend === c.legend) : null;
    return {
      rank,
      captainId: c.id, shipName: c.shipName, isMe,
      legend: fogged && !isMe ? null : Math.round(c.legend),
      bounty: Math.round(c.bounty),
      fleetName: fleet?.name ?? null, fleetColour: fleet?.colour ?? null,
      ashore: c.status === "ashore",
      mostWanted: !input.ended && c.id === wanted,
      champion: input.ended && rank === 1,
    };
  });

  const fogFromTide = input.fogOfLegendTides > 0 ? input.lengthTides - input.fogOfLegendTides + 1 : null;
  let note: string | null = null;
  if (input.ended) note = finalNote(entries.filter((e) => e.champion).map((e) => e.shipName));
  else if (fogged) note = "Fog of Legend: exact scores are hidden until the season ends. Ranks stay visible.";
  else if (!started) note = "Nobody has earned any Legend yet. It comes from profit banked, battles won and prizes taken.";
  else if (fogFromTide !== null) note = `From Tide ${fogFromTide} exact scores are hidden. Ranks stay visible.`;
  return { entries, started, fogged, final: input.ended, fogFromTide, note };
}

function finalNote(champions: readonly string[]): string {
  if (champions.length === 0) return "Final ranking. The season ended before anyone earned any Legend.";
  if (champions.length === 1) return `Final ranking. ${champions[0]} is the Legend champion of the season.`;
  return `Final ranking. ${listOf(champions)} share first place.`;
}

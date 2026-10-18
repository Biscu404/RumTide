// WCS: the Wind and Current System (GAMEPLAY 3.3 and 3.4).
// Every hop costs Watches = max(1, base + terrain + current + wind), each a small whole number.

import { B } from "./balance.ts";
import { LEVEL } from "./types.ts";
import type { ArchipelagoId, HullId, Knowledge, LaneId, MapLane, MapWater, PencilMark, Wind, WindKind, WaterId } from "./types.ts";
import { angleBetween, travelBearing, type World } from "./map.ts";
import { rngFor } from "./rng.ts";
import { believedCurrent, levelOf } from "./knowledge.ts";

const WIND_KINDS: readonly WindKind[] = ["calm", "breeze", "gale"];
const COMPASS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/**
 * The wind in an archipelago for a Tide. Derived from the SEASON seed, so it can be forecast
 * any number of Tides ahead and never depends on what players do.
 */
export function windFor(seasonSeed: number, archipelago: ArchipelagoId, tide: number): Wind {
  const rng = rngFor(seasonSeed, "wind", archipelago, tide);
  const chances = B.wind.chances[archipelago] ?? (B.wind.chances.default as { calm: number; breeze: number; gale: number });
  const kind = rng.weighted(chances, WIND_KINDS);
  if (kind === "calm") return { kind, from: 0 };
  return { kind, from: rng.pick(COMPASS) };
}

/** Winds for every archipelago of the map for one Tide, with optional overrides (tests, dev tools). */
export function windsFor(w: World, seasonSeed: number, tide: number, override?: Record<ArchipelagoId, Wind>): Record<ArchipelagoId, Wind> {
  const out: Record<ArchipelagoId, Wind> = {};
  for (const a of w.archipelagoIds) out[a] = override?.[a] ?? windFor(seasonSeed, a, tide);
  return out;
}

export interface HopCost {
  total: number;
  base: number;
  terrain: number;
  current: number;
  wind: number;
  /** True when the number is a guess because the captain does not know some part of it. */
  estimated: boolean;
}

function currentPart(current: PencilMark | null, lane: MapLane, from: WaterId): number {
  if (!current || current.strength === "none") return 0;
  const movingAB = lane.a === from;
  const withIt = (current.flow === "ab") === movingAB;
  const c = B.current[current.strength];
  return withIt ? c.with : c.against;
}

export function windPart(wind: Wind, bearing: number, hull: HullId): number {
  const rig = B.hulls[hull].rig;
  if (wind.kind === "calm") return rig === "foreAft" && B.wind.sloop.ignoresCalm ? 0 : B.wind.calm;
  const downwind = (wind.from + 180) % 360;
  const cone = B.wind.coneDegrees;
  if (angleBetween(bearing, downwind) <= cone) {
    const d = wind.kind === "gale" ? B.wind.gale.down : B.wind.breeze.down;
    return d + (rig === "square" ? B.wind.frigateExtraDown : 0);
  }
  if (angleBetween(bearing, wind.from) <= cone) {
    if (rig === "foreAft") return wind.kind === "gale" ? B.wind.sloop.galeUp : B.wind.sloop.breezeUp;
    return wind.kind === "gale" ? B.wind.gale.up : B.wind.breeze.up;
  }
  return 0;
}

/**
 * Extra Watches to leave a water because of its terrain (2.2).
 * `chartedBefore` says whether the captain had Charted that water before this Tide began: arriving
 * in a reef charts it, but you only sail it like a local once you knew it in advance.
 */
export function terrainPart(water: MapWater, hull: HullId, chartedBefore: boolean): number {
  const T = B.terrain;
  switch (water.terrain) {
    case "kelp": return T.kelpLeave;
    case "reef": return chartedBefore ? 0 : T.reefUnchartedLeave;
    case "shallows": return hull === "frigate" ? T.shallowsFrigateLeave : 0;
    default: return 0;
  }
}

/** The TRUE cost of a hop, used when the Tide resolves. */
export function hopCost(
  w: World, laneId: LaneId, from: WaterId, hull: HullId, wind: Wind, chartedBefore: boolean,
): HopCost {
  const lane = w.lane[laneId] as MapLane;
  const water = w.water[from] as MapWater;
  const terrain = terrainPart(water, hull, chartedBefore);
  const current = currentPart(lane.current, lane, from);
  const windCost = windPart(wind, travelBearing(w, laneId, from), hull);
  const base = B.actions.hopBase;
  return { total: Math.max(B.actions.hopMin, base + terrain + current + windCost), base, terrain, current, wind: windCost, estimated: false };
}

/**
 * What the CAPTAIN thinks a hop costs, from their own knowledge (3.4). Unknown currents count as none
 * (or use the captain's pencil mark), and the wind only counts if the captain knows the forecast.
 */
export function estimateHop(
  w: World, k: Knowledge, laneId: LaneId, from: WaterId, hull: HullId, winds: Record<ArchipelagoId, Wind>,
): HopCost {
  const lane = w.lane[laneId] as MapLane;
  const water = w.water[from] as MapWater;
  let estimated = false;

  const fromLevel = levelOf(k, from);
  let terrain = 0;
  if (fromLevel >= LEVEL.sketched) terrain = terrainPart(water, hull, fromLevel >= LEVEL.charted);
  else estimated = true;

  const believed = believedCurrent(w, k, laneId);
  if (levelOf(k, laneId) < LEVEL.charted) estimated = true;
  const current = currentPart(believed, lane, from);

  const arch = w.archOf[from] as ArchipelagoId;
  let windCost = 0;
  const wind = winds[arch];
  if (wind && k.visited.includes(arch)) windCost = windPart(wind, travelBearing(w, laneId, from), hull);
  else estimated = true;

  const base = B.actions.hopBase;
  return { total: Math.max(B.actions.hopMin, base + terrain + current + windCost), base, terrain, current, wind: windCost, estimated };
}

/** True if this captain had the water Charted at the start of the Tide. */
export function chartedAt(start: Knowledge, water: WaterId): boolean {
  return levelOf(start, water) >= LEVEL.charted;
}


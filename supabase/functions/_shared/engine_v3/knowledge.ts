// What each captain knows about the map (GAMEPLAY 4).
// Levels only ever go up. Every function here mutates the Knowledge it is given and reports what changed.

import { B } from "./balance.ts";
import { LEVEL } from "./types.ts";
import type { Captain, IslandId, Knowledge, LaneId, Level, MapLane, MapWater, PencilMark, SiteId, WaterId } from "./types.ts";
import { otherEnd, type World } from "./map.ts";
import type { Rng } from "./rng.ts";

export function emptyKnowledge(): Knowledge {
  return { levels: {}, pencil: {}, unlocks: [], visited: [] };
}

/** The knowledge every new captain starts with on this map (2.4). */
export function startKnowledge(w: World): Knowledge {
  const k = emptyKnowledge();
  const sk = w.map.startKnowledge;
  for (const id of sk.rumoured) raise(k, id, LEVEL.rumoured);
  for (const id of sk.sketched) raise(k, id, LEVEL.sketched);
  for (const id of sk.charted) raise(k, id, LEVEL.charted);
  k.visited = [...sk.visited].sort();
  return k;
}

export function levelOf(k: Knowledge, id: string): Level {
  return k.levels[id] ?? LEVEL.unknown;
}

/** Raises an element to at least `to`. Returns true if the level changed. */
export function raise(k: Knowledge, id: string, to: Level): boolean {
  if (levelOf(k, id) >= to) return false;
  k.levels[id] = to;
  return true;
}

/** A hidden lane is invisible until it has been revealed (Sketched or better). */
export function laneVisible(w: World, k: Knowledge, laneId: LaneId): boolean {
  const lane = w.lane[laneId] as MapLane;
  return !lane.hidden || levelOf(k, laneId) >= LEVEL.sketched;
}

/** The current a captain believes a lane has: the real one if Charted, else their pencil mark, else null. */
export function believedCurrent(w: World, k: Knowledge, laneId: LaneId): PencilMark | null {
  const lane = w.lane[laneId] as MapLane;
  if (levelOf(k, laneId) >= LEVEL.charted) return lane.current;
  return k.pencil[laneId] ?? null;
}

function sketchAround(w: World, k: Knowledge, water: WaterId): void {
  for (const laneId of w.lanesAt[water] ?? []) {
    if (!laneVisible(w, k, laneId)) continue;
    raise(k, laneId, LEVEL.sketched);
    const far = otherEnd(w.lane[laneId] as MapLane, water);
    raise(k, far, LEVEL.sketched);
    raise(k, (w.water[far] as MapWater).island, LEVEL.sketched);
  }
}

function chartLanesAround(w: World, k: Knowledge, water: WaterId, out: string[]): void {
  for (const laneId of w.lanesAt[water] ?? []) {
    if (!laneVisible(w, k, laneId)) continue;
    if (raise(k, laneId, LEVEL.charted)) out.push(laneId);
    const far = otherEnd(w.lane[laneId] as MapLane, water);
    raise(k, far, LEVEL.sketched);
    raise(k, (w.water[far] as MapWater).island, LEVEL.sketched);
  }
}

function markVisited(w: World, k: Knowledge, water: WaterId): void {
  const arch = w.archOf[water] as string;
  raise(k, arch, LEVEL.sketched);
  if (!k.visited.includes(arch)) k.visited = [...k.visited, arch].sort();
}

/**
 * A ship arrives in a water (or starts a Tide in it). Charts the water and the lane it came along,
 * sketches everything visible next to it, and applies captain Seamanship (5.3).
 * Returns the ids that became Charted.
 */
export function onArrive(w: World, captain: Captain, water: WaterId, viaLane: LaneId | null): string[] {
  const k = captain.knowledge;
  const charted: string[] = [];
  if (raise(k, water, LEVEL.charted)) charted.push(water);
  if (viaLane && raise(k, viaLane, LEVEL.charted)) charted.push(viaLane);
  raise(k, (w.water[water] as MapWater).island, LEVEL.sketched);
  markVisited(w, k, water);
  sketchAround(w, k, water);
  const rank = captain.skills.seamanship;
  if (rank >= 1) chartLanesAround(w, k, water, charted);
  if (rank >= 3) {
    for (const laneId of w.lanesAt[water] ?? []) {
      if (!laneVisible(w, k, laneId)) continue;
      chartLanesAround(w, k, otherEnd(w.lane[laneId] as MapLane, water), charted);
    }
  }
  return charted.sort();
}

export interface SurveyResult {
  charted: string[];
  revealed: string[];
}

/**
 * Survey (3.2): charts every visible lane touching the water, sketches the island's sites,
 * and rolls once to reveal a hidden lane that can be found by surveying.
 */
export function onSurvey(w: World, captain: Captain, water: WaterId, rng: Rng): SurveyResult {
  const k = captain.knowledge;
  const charted: string[] = [];
  const revealed: string[] = [];
  if (raise(k, water, LEVEL.charted)) charted.push(water);
  chartLanesAround(w, k, water, charted);
  const island = (w.water[water] as MapWater).island;
  for (const siteId of w.sitesOf[island] ?? []) raise(k, siteId, LEVEL.sketched);

  const candidates = (w.lanesAt[water] ?? []).filter((id) => {
    const lane = w.lane[id] as MapLane;
    return lane.hidden?.by === "survey" && levelOf(k, id) < LEVEL.sketched;
  });
  if (candidates.length > 0 && rng.chance(B.survey.hiddenRevealChance)) {
    const laneId = rng.pick(candidates);
    raise(k, laneId, LEVEL.charted);
    const far = otherEnd(w.lane[laneId] as MapLane, water);
    raise(k, far, LEVEL.sketched);
    raise(k, (w.water[far] as MapWater).island, LEVEL.rumoured);
    revealed.push(laneId);
    charted.push(laneId);
  }
  return { charted: charted.sort(), revealed };
}

export interface LandResult {
  charted: string[];
  unlocked: string[];
}

/**
 * Land on a site (4.3): charts it and applies its unlocks. An unlock reveals every lane hidden behind
 * that key as Sketched, and makes the far side Rumoured.
 */
export function onLand(w: World, captain: Captain, siteId: SiteId): LandResult {
  const k = captain.knowledge;
  const charted: string[] = [];
  const unlocked: string[] = [];
  if (raise(k, siteId, LEVEL.charted)) charted.push(siteId);
  for (const key of w.site[siteId]?.unlocks ?? []) {
    if (k.unlocks.includes(key)) continue;
    k.unlocks = [...k.unlocks, key].sort();
    unlocked.push(key);
    for (const laneId of w.laneIds) {
      const lane = w.lane[laneId] as MapLane;
      if (lane.hidden?.by !== "unlock" || lane.hidden.key !== key) continue;
      raise(k, laneId, LEVEL.sketched);
      for (const end of [lane.a, lane.b]) {
        raise(k, end, LEVEL.rumoured);
        raise(k, (w.water[end] as MapWater).island, LEVEL.rumoured);
      }
    }
  }
  return { charted, unlocked };
}

/** True when every water, lane and site of an island is Charted (4.2). */
export function islandFullyCharted(w: World, k: Knowledge, island: IslandId): boolean {
  const ids = [...(w.watersOf[island] ?? []), ...(w.lanesOf[island] ?? []), ...(w.sitesOf[island] ?? [])];
  return ids.length > 0 && ids.every((id) => levelOf(k, id) >= LEVEL.charted);
}

/** Coverage = (Charted points + half of Sketched points) / total points (4.2). From 0 to 1. */
export function coverage(w: World, k: Knowledge): number {
  const K = B.knowledge;
  const score = (id: string, pts: number) => {
    const lv = levelOf(k, id);
    return lv >= LEVEL.charted ? pts : lv >= LEVEL.sketched ? pts * K.sketchedShare : 0;
  };
  let sum = 0;
  for (const id of w.waterIds) sum += score(id, K.waterPoints);
  for (const id of w.laneIds) sum += score(id, K.lanePoints);
  for (const id of w.siteIds) sum += score(id, K.sitePoints);
  return w.totalPoints ? sum / w.totalPoints : 0;
}

/** Writes or clears a pencil mark (3.4). Pencil marks never override a Charted current. */
export function setPencil(k: Knowledge, laneId: LaneId, mark: PencilMark | null): void {
  if (mark) k.pencil[laneId] = mark;
  else delete k.pencil[laneId];
}

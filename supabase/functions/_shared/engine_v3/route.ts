// Routing through what a captain knows (GAMEPLAY 3.4 and 3.6).
// A route may only use lanes the captain can see (Sketched or better) and waters at least Rumoured.
// Costs are the captain's ESTIMATES, so a route can be wrong in exactly the ways the captain is.

import { LEVEL } from "./types.ts";
import type { ArchipelagoId, HullId, Knowledge, LaneId, MapLane, WaterId, Wind } from "./types.ts";
import { otherEnd, laneBetween, type World } from "./map.ts";
import { laneVisible, levelOf } from "./knowledge.ts";
import { estimateHop } from "./wcs.ts";

export interface Route {
  waters: WaterId[]; // from start to destination, both included
  lanes: LaneId[];
  estimate: number; // estimated Watches
  estimated: boolean; // true if any hop cost is a guess
}

function usableLane(w: World, k: Knowledge, laneId: LaneId): boolean {
  return laneVisible(w, k, laneId) && levelOf(k, laneId) >= LEVEL.sketched;
}

function usableWater(k: Knowledge, water: WaterId): boolean {
  return levelOf(k, water) >= LEVEL.rumoured;
}

/** Cheapest known route by estimated Watches; ties broken by fewer hops, then by water ids. Null if none. */
export function findRoute(
  w: World, k: Knowledge, from: WaterId, to: WaterId, hull: HullId, winds: Record<ArchipelagoId, Wind>,
): Route | null {
  if (from === to) return { waters: [from], lanes: [], estimate: 0, estimated: false };
  if (!usableWater(k, to)) return null;
  type Node = { cost: number; hops: number; path: WaterId[]; lanes: LaneId[]; estimated: boolean };
  const best = new Map<WaterId, Node>();
  const open: Node[] = [{ cost: 0, hops: 0, path: [from], lanes: [], estimated: false }];
  const better = (a: Node, b: Node) =>
    a.cost !== b.cost ? a.cost < b.cost : a.hops !== b.hops ? a.hops < b.hops : a.path.join(",") < b.path.join(",");
  while (open.length) {
    open.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
    const cur = open.shift() as Node;
    const at = cur.path[cur.path.length - 1] as WaterId;
    if (at === to) return { waters: cur.path, lanes: cur.lanes, estimate: cur.cost, estimated: cur.estimated };
    const seen = best.get(at);
    if (seen && seen !== cur && !better(cur, seen)) continue;
    for (const laneId of w.lanesAt[at] ?? []) {
      if (!usableLane(w, k, laneId)) continue;
      const next = otherEnd(w.lane[laneId] as MapLane, at);
      if (cur.path.includes(next) || !usableWater(k, next)) continue;
      const hop = estimateHop(w, k, laneId, at, hull, winds);
      const node: Node = {
        cost: cur.cost + hop.total,
        hops: cur.hops + 1,
        path: [...cur.path, next],
        lanes: [...cur.lanes, laneId],
        estimated: cur.estimated || hop.estimated,
      };
      const prev = best.get(next);
      if (!prev || better(node, prev)) {
        best.set(next, node);
        open.push(node);
      }
    }
  }
  return null;
}

/** Checks a route the player pinned by hand. Returns the Route, or null if it is not sailable with what they know. */
export function pinnedRoute(
  w: World, k: Knowledge, from: WaterId, waters: WaterId[], hull: HullId, winds: Record<ArchipelagoId, Wind>,
): Route | null {
  const path = waters[0] === from ? waters : [from, ...waters];
  const lanes: LaneId[] = [];
  let estimate = 0;
  let estimated = false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as WaterId, b = path[i] as WaterId;
    const lane = laneBetween(w, a, b);
    if (!lane || !usableLane(w, k, lane.id) || !usableWater(k, b)) return null;
    const hop = estimateHop(w, k, lane.id, a, hull, winds);
    lanes.push(lane.id);
    estimate += hop.total;
    estimated = estimated || hop.estimated;
  }
  return { waters: path, lanes, estimate, estimated };
}

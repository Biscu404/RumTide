// The sea is a graph of named nodes joined by lanes (section 4.1).
// loadMap validates raw JSON and builds the adjacency lookups. Lanes work in both directions.

import type { Good } from "./types.ts";

export type NodeType = "port" | "sea" | "island" | "wreck" | "fort";
export type Zone = "crown" | "free" | "maw";

/** What a port makes (cheap) and wants (dear). Last Lantern makes nothing and wants "all" at a premium. */
export interface PortTrade { makes: Good | null; wants: Good | "all"; }

export interface MapNode {
  id: string; name: string; type: NodeType; zone: Zone;
  x: number; y: number;                    // drawing position only, never used by rules
  trade?: PortTrade;                       // every port has one, no other node does
}

export interface MapData {
  id: string; name: string;
  nodes: MapNode[];
  lanes: [string, string][];
}

export interface GameMap {
  id: string; name: string;
  /** Every node id in sorted order. Iterate this, never the Map, so results are reproducible. */
  nodeIds: readonly string[];
  node(id: string): MapNode;
  has(id: string): boolean;
  /** Adjacent node ids in sorted order. */
  neighbours(id: string): readonly string[];
  adjacent(a: string, b: string): boolean;
}

const NODE_TYPES: readonly string[] = ["port", "sea", "island", "wreck", "fort"];
const ZONES: readonly string[] = ["crown", "free", "maw"];
const GOODS: readonly string[] = ["rum", "sugar", "spice"];

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function loadMap(raw: unknown): GameMap {
  const data = raw as Partial<MapData> | null;
  if (!data || typeof data.id !== "string" || typeof data.name !== "string"
      || !Array.isArray(data.nodes) || !Array.isArray(data.lanes)) {
    throw new Error("Map needs id, name, nodes and lanes");
  }

  const nodes = new Map<string, MapNode>();
  for (const n of data.nodes as MapNode[]) {
    if (typeof n?.id !== "string" || n.id === "") throw new Error("Map node without an id");
    if (nodes.has(n.id)) throw new Error(`Duplicate map node ${n.id}`);
    if (typeof n.name !== "string") throw new Error(`Node ${n.id} needs a name`);
    if (!NODE_TYPES.includes(n.type)) throw new Error(`Node ${n.id} has unknown type ${n.type}`);
    if (!ZONES.includes(n.zone)) throw new Error(`Node ${n.id} has unknown zone ${n.zone}`);
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) throw new Error(`Node ${n.id} needs x and y`);
    if (n.type === "port") {
      const t = n.trade;
      if (!t || !(t.makes === null || GOODS.includes(t.makes)) || !(t.wants === "all" || GOODS.includes(t.wants))) {
        throw new Error(`Port ${n.id} needs trade with makes and wants`);
      }
    } else if (n.trade !== undefined) {
      throw new Error(`Node ${n.id} is not a port and cannot trade`);
    }
    nodes.set(n.id, n);
  }

  const links = new Map<string, Set<string>>();
  for (const id of nodes.keys()) links.set(id, new Set());
  for (const lane of data.lanes as [string, string][]) {
    const [a, b] = lane ?? [];
    if (!nodes.has(a as string) || !nodes.has(b as string)) {
      throw new Error(`Lane ${String(a)} to ${String(b)} uses an unknown node`);
    }
    if (a === b) throw new Error(`Lane from ${a} to itself`);
    if (links.get(a as string)!.has(b as string)) throw new Error(`Duplicate lane ${a} and ${b}`);
    links.get(a as string)!.add(b as string);
    links.get(b as string)!.add(a as string);
  }

  const nodeIds = [...nodes.keys()].sort(compareIds);
  const sortedLinks = new Map<string, readonly string[]>();
  for (const id of nodeIds) sortedLinks.set(id, [...links.get(id)!].sort(compareIds));

  // Every ship must be able to reach every node.
  const first = nodeIds[0];
  if (first !== undefined) {
    const seen = new Set([first]);
    const queue = [first];
    for (let i = 0; i < queue.length; i++) {
      for (const next of sortedLinks.get(queue[i]!)!) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    if (seen.size !== nodeIds.length) throw new Error("Map is not connected");
  }

  const need = (id: string) => {
    const n = nodes.get(id);
    if (!n) throw new Error(`Unknown node ${id}`);
    return n;
  };

  return {
    id: data.id, name: data.name, nodeIds,
    node: need,
    has: (id) => nodes.has(id),
    neighbours: (id) => {
      need(id);
      return sortedLinks.get(id)!;
    },
    adjacent: (a, b) => links.get(a)?.has(b) ?? false,
  };
}

/** Hops from `from` to every reachable node (breadth first). */
export function hopsFrom(map: GameMap, from: string): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const here = queue[i]!;
    for (const next of map.neighbours(here)) {
      if (!dist.has(next)) { dist.set(next, dist.get(here)! + 1); queue.push(next); }
    }
  }
  return dist;
}

/**
 * The nodes to sail through to get from `from` to `to`, not counting `from`. Of several shortest
 * routes it takes the one that goes through the lowest node ids, so the answer is always the same.
 * Empty when `from` is `to`.
 */
export function shortestPath(map: GameMap, from: string, to: string): string[] {
  const back = hopsFrom(map, to);   // hops to the destination from every node
  const path: string[] = [];
  let here = from;
  while (here !== to) {
    const next = map.neighbours(here).find((n) => back.get(n) === back.get(here)! - 1);
    if (next === undefined) throw new Error(`No route from ${from} to ${to}`);
    path.push(next);
    here = next;
  }
  return path;
}

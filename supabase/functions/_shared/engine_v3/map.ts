// Map loading, validation and lookups (GAMEPLAY 2).
// Maps are static JSON files in supabase/functions/_shared/maps. validateMap is the gate: the engine
// only ever works with a map that passed it.

import type {
  ArchipelagoId, ElementKind, GameMap, IslandId, LaneId, MapIsland, MapLane, MapSite, MapStrait,
  MapWater, SiteId, Terrain, Tier, WaterId,
} from "./types.ts";
import { B } from "./balance.ts";

const TERRAINS: readonly Terrain[] = ["open", "shallows", "reef", "rocky", "fog", "kelp", "strongCurrent", "harbour"];
const TIERS: readonly Tier[] = ["wild", "village", "town", "city"];

export interface World {
  map: GameMap;
  water: Record<WaterId, MapWater>;
  lane: Record<LaneId, MapLane>;
  island: Record<IslandId, MapIsland>;
  site: Record<SiteId, MapSite>;
  strait: Record<string, MapStrait>;
  kind: Record<string, ElementKind>;
  /** Lanes touching each water, sorted by id. */
  lanesAt: Record<WaterId, LaneId[]>;
  /** Waters of each island, sorted by id. */
  watersOf: Record<IslandId, WaterId[]>;
  /** Sites of each island, sorted by id. */
  sitesOf: Record<IslandId, SiteId[]>;
  /** Lanes with at least one end on each island, sorted by id. */
  lanesOf: Record<IslandId, LaneId[]>;
  /** Archipelago of every water. */
  archOf: Record<WaterId, ArchipelagoId>;
  /** Compass bearing of each lane travelling from a to b, rounded to the nearest 45 degrees. */
  bearingAB: Record<LaneId, number>;
  /** Total chart points in the map (4.2). */
  totalPoints: number;
  /** Sorted id lists, for deterministic iteration. */
  waterIds: WaterId[];
  laneIds: LaneId[];
  islandIds: IslandId[];
  siteIds: SiteId[];
  archipelagoIds: ArchipelagoId[];
}

export class MapError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super("Invalid map:\n  " + problems.join("\n  "));
    this.problems = problems;
  }
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> => {
  const out: Record<string, T> = {};
  for (const it of items) out[it.id] = it;
  return out;
};

/** Bearing from one point to another, 0 = north, 90 = east, rounded to 45 degrees. */
export function bearingBetween(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const deg = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  const norm = (deg + 360) % 360;
  return (Math.round(norm / 45) * 45) % 360;
}

/** Smallest angle between two bearings, 0 to 180. */
export function angleBetween(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/** Checks a raw map. Returns a list of problems; empty means valid. */
export function validateMap(m: GameMap): string[] {
  const p: string[] = [];
  const seen = new Map<string, string>();
  const claim = (id: string, what: string) => {
    if (!/^[a-z0-9_]+$/.test(id)) p.push(`${what} id "${id}" must use lowercase letters, digits and underscores`);
    if (seen.has(id)) p.push(`id "${id}" is used by both a ${seen.get(id)} and a ${what}`);
    seen.set(id, what);
  };
  for (const a of m.archipelagos) claim(a.id, "archipelago");
  for (const i of m.islands) claim(i.id, "island");
  for (const w of m.waters) claim(w.id, "water");
  for (const l of m.lanes) claim(l.id, "lane");
  for (const s of m.sites) claim(s.id, "site");
  for (const s of m.straits) claim(s.id, "strait");

  const arch = byId(m.archipelagos), isl = byId(m.islands), wat = byId(m.waters), sit = byId(m.sites);

  for (const i of m.islands) {
    if (!arch[i.archipelago]) p.push(`island ${i.id}: unknown archipelago ${i.archipelago}`);
    if (!TIERS.includes(i.tier)) p.push(`island ${i.id}: unknown tier ${i.tier}`);
    const ws = m.waters.filter((w) => w.island === i.id);
    if (ws.length < 2 || ws.length > 4) p.push(`island ${i.id}: has ${ws.length} waters, needs 2 to 4`);
    const ss = m.sites.filter((s) => s.island === i.id);
    if (ss.length < 1 || ss.length > 3) p.push(`island ${i.id}: has ${ss.length} sites, needs 1 to 3`);
    const harbours = ws.filter((w) => w.terrain === "harbour").length;
    if (i.tier === "wild" && harbours > 0) p.push(`island ${i.id}: wild islands cannot have a Harbour`);
    if (i.tier !== "wild" && harbours !== 1) p.push(`island ${i.id}: a settlement needs exactly one Harbour water, has ${harbours}`);
    const settlements = ss.filter((s) => s.kind === "settlement").length;
    if (i.tier !== "wild" && settlements !== 1) p.push(`island ${i.id}: a settlement island needs exactly one settlement site`);
    if (i.tier === "wild" && settlements > 0) p.push(`island ${i.id}: wild islands cannot have a settlement site`);
  }
  for (const w of m.waters) {
    if (!isl[w.island]) p.push(`water ${w.id}: unknown island ${w.island}`);
    if (!TERRAINS.includes(w.terrain)) p.push(`water ${w.id}: unknown terrain ${w.terrain}`);
    if (!Number.isFinite(w.x) || !Number.isFinite(w.y)) p.push(`water ${w.id}: needs numeric x and y`);
  }
  for (const s of m.sites) if (!isl[s.island]) p.push(`site ${s.id}: unknown island ${s.island}`);

  const pairs = new Set<string>();
  const unlockKeys = new Set(m.sites.flatMap((s) => s.unlocks ?? []));
  for (const l of m.lanes) {
    const a = wat[l.a], b = wat[l.b];
    if (!a || !b) { p.push(`lane ${l.id}: unknown water`); continue; }
    if (l.a === l.b) p.push(`lane ${l.id}: joins a water to itself`);
    const key = [l.a, l.b].sort().join("|");
    if (pairs.has(key)) p.push(`lane ${l.id}: a second lane between ${l.a} and ${l.b}`);
    pairs.add(key);
    if (l.current.strength !== "none" && l.current.flow !== "ab" && l.current.flow !== "ba") p.push(`lane ${l.id}: a current needs a flow of "ab" or "ba"`);
    if (l.current.strength === "none" && l.current.flow) p.push(`lane ${l.id}: no current, so no flow`);
    const ia = isl[a.island], ib = isl[b.island];
    if (ia && ib && ia.archipelago !== ib.archipelago) p.push(`lane ${l.id}: lanes stay inside one archipelago; use a strait`);
    if (ia && ib && ia.hidden !== ib.hidden && !l.hidden) p.push(`lane ${l.id}: a lane into a hidden island must be hidden`);
    if (l.hidden?.by === "unlock" && !unlockKeys.has(l.hidden.key)) p.push(`lane ${l.id}: no site unlocks key ${l.hidden.key}`);
    if (a.x === b.x && a.y === b.y) p.push(`lane ${l.id}: both ends are at the same position`);
  }
  for (const s of m.straits) {
    if (!wat[s.from]) p.push(`strait ${s.id}: unknown water ${s.from}`);
  }
  for (const boss of m.bosses) {
    if (!wat[boss.water]) p.push(`boss ${boss.id}: unknown water ${boss.water}`);
    for (const g of boss.gates) if (!m.straits.some((s) => s.id === g)) p.push(`boss ${boss.id}: unknown strait ${g}`);
  }

  // Every water must be reachable from every other inside its archipelago once all hidden lanes are known.
  for (const a of m.archipelagos) {
    const ws = m.waters.filter((w) => isl[w.island]?.archipelago === a.id).map((w) => w.id);
    if (ws.length === 0) continue;
    const reached = new Set<string>([ws[0] as string]);
    const queue = [ws[0] as string];
    while (queue.length) {
      const cur = queue.shift() as string;
      for (const l of m.lanes) {
        const other = l.a === cur ? l.b : l.b === cur ? l.a : null;
        if (other && !reached.has(other)) { reached.add(other); queue.push(other); }
      }
    }
    const missing = ws.filter((w) => !reached.has(w));
    if (missing.length) p.push(`archipelago ${a.id}: cannot reach ${missing.join(", ")}`);
  }

  const sk = m.startKnowledge;
  for (const id of [...sk.charted, ...sk.sketched, ...sk.rumoured]) if (!seen.has(id)) p.push(`startKnowledge: unknown id ${id}`);
  for (const id of sk.visited) if (!arch[id]) p.push(`startKnowledge.visited: unknown archipelago ${id}`);
  for (const id of [...sk.charted, ...sk.sketched]) {
    const i = isl[id] ?? (wat[id] ? isl[wat[id].island] : undefined) ?? (sit[id] ? isl[sit[id].island] : undefined);
    if (i?.hidden) p.push(`startKnowledge: ${id} is on a hidden island`);
  }
  return p;
}

/** Validates and indexes a map. Throws MapError when the map is invalid. */
export function loadMap(raw: unknown): World {
  const m = raw as GameMap;
  const problems = validateMap(m);
  if (problems.length) throw new MapError(problems);

  const kind: Record<string, ElementKind> = {};
  for (const a of m.archipelagos) kind[a.id] = "archipelago";
  for (const i of m.islands) kind[i.id] = "island";
  for (const w of m.waters) kind[w.id] = "water";
  for (const l of m.lanes) kind[l.id] = "lane";
  for (const s of m.sites) kind[s.id] = "site";
  for (const s of m.straits) kind[s.id] = "strait";

  const sortIds = (xs: { id: string }[]) => xs.map((x) => x.id).sort();
  const water = byId(m.waters), island = byId(m.islands);
  const lanesAt: Record<WaterId, LaneId[]> = {};
  const watersOf: Record<IslandId, WaterId[]> = {};
  const sitesOf: Record<IslandId, SiteId[]> = {};
  const lanesOf: Record<IslandId, LaneId[]> = {};
  const archOf: Record<WaterId, ArchipelagoId> = {};
  const bearingAB: Record<LaneId, number> = {};

  for (const i of m.islands) { watersOf[i.id] = []; sitesOf[i.id] = []; lanesOf[i.id] = []; }
  for (const w of [...m.waters].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    lanesAt[w.id] = [];
    watersOf[w.island]?.push(w.id);
    archOf[w.id] = (island[w.island] as MapIsland).archipelago;
  }
  for (const s of [...m.sites].sort((x, y) => (x.id < y.id ? -1 : 1))) sitesOf[s.island]?.push(s.id);
  for (const l of [...m.lanes].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    lanesAt[l.a]?.push(l.id);
    lanesAt[l.b]?.push(l.id);
    const ia = (water[l.a] as MapWater).island, ib = (water[l.b] as MapWater).island;
    lanesOf[ia]?.push(l.id);
    if (ib !== ia) lanesOf[ib]?.push(l.id);
    bearingAB[l.id] = bearingBetween(water[l.a] as MapWater, water[l.b] as MapWater);
  }

  const K = B.knowledge;
  const totalPoints = m.waters.length * K.waterPoints + m.lanes.length * K.lanePoints + m.sites.length * K.sitePoints;

  return {
    map: m,
    water,
    lane: byId(m.lanes),
    island,
    site: byId(m.sites),
    strait: byId(m.straits),
    kind,
    lanesAt,
    watersOf,
    sitesOf,
    lanesOf,
    archOf,
    bearingAB,
    totalPoints,
    waterIds: sortIds(m.waters),
    laneIds: sortIds(m.lanes),
    islandIds: sortIds(m.islands),
    siteIds: sortIds(m.sites),
    archipelagoIds: sortIds(m.archipelagos),
  };
}

/** The water at the other end of a lane. */
export function otherEnd(lane: MapLane, from: WaterId): WaterId {
  return lane.a === from ? lane.b : lane.a;
}

/** Bearing of a lane when travelling away from `from`. */
export function travelBearing(w: World, laneId: LaneId, from: WaterId): number {
  const lane = w.lane[laneId] as MapLane;
  const ab = w.bearingAB[laneId] as number;
  return lane.a === from ? ab : (ab + 180) % 360;
}

/** The lane joining two waters, if any. */
export function laneBetween(w: World, a: WaterId, b: WaterId): MapLane | undefined {
  for (const id of w.lanesAt[a] ?? []) {
    const l = w.lane[id] as MapLane;
    if ((l.a === a && l.b === b) || (l.a === b && l.b === a)) return l;
  }
  return undefined;
}

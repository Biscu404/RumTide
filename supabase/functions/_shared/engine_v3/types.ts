// Core types for the Rumtide engine. Pure data: no classes, no enums, JSON friendly.
// Section numbers point at docs/GAMEPLAY.md.

import type { PresetId } from "./balance.ts";

export type ArchipelagoId = string;
export type IslandId = string;
export type WaterId = string;
export type LaneId = string;
export type SiteId = string;
export type StraitId = string;
export type CaptainId = string;
export type ShipId = string;

// ---------- Map (2.1) ----------

export type Terrain = "open" | "shallows" | "reef" | "rocky" | "fog" | "kelp" | "strongCurrent" | "harbour";
export type Tier = "wild" | "village" | "town" | "city";
export type CurrentStrength = "none" | "mild" | "strong";
export type SiteKind = "settlement" | "ruins" | "wreck" | "cave" | "camp" | "dig" | "lair";

export interface MapArchipelago {
  id: ArchipelagoId;
  name: string;
}

export interface MapIsland {
  id: IslandId;
  archipelago: ArchipelagoId;
  name: string;
  tier: Tier;
  hidden: boolean; // hidden islands are invisible until Rumoured
}

export interface MapWater {
  id: WaterId;
  island: IslandId;
  name: string;
  terrain: Terrain;
  x: number; // map position, east is +x
  y: number; // map position, south is +y
}

export type LaneHidden = { by: "survey" } | { by: "unlock"; key: string };

export interface MapLane {
  id: LaneId;
  a: WaterId;
  b: WaterId;
  current: { strength: CurrentStrength; flow?: "ab" | "ba" };
  hidden?: LaneHidden;
}

export interface MapSite {
  id: SiteId;
  island: IslandId;
  name: string;
  kind: SiteKind;
  unlocks?: string[]; // unlock keys revealed by Landing here
}

export interface MapStrait {
  id: StraitId;
  from: WaterId;
  to: ArchipelagoId;
  name: string;
}

export interface MapBoss {
  id: string;
  water: WaterId;
  gates: StraitId[]; // straits this boss blocks until a captain beats it
}

export interface MapStartKnowledge {
  charted: string[];
  sketched: string[];
  rumoured: string[];
  visited: ArchipelagoId[];
}

export interface GameMap {
  id: string;
  version: number;
  name: string;
  archipelagos: MapArchipelago[];
  islands: MapIsland[];
  waters: MapWater[];
  lanes: MapLane[];
  sites: MapSite[];
  straits: MapStrait[];
  bosses: MapBoss[];
  startKnowledge: MapStartKnowledge;
}

export type ElementKind = "archipelago" | "island" | "water" | "lane" | "site" | "strait";

// ---------- Knowledge (4.1) ----------

/** 0 Unknown, 1 Rumoured, 2 Sketched, 3 Charted. */
export type Level = 0 | 1 | 2 | 3;
export const LEVEL = { unknown: 0, rumoured: 1, sketched: 2, charted: 3 } as const;

export interface PencilMark {
  strength: CurrentStrength;
  flow?: "ab" | "ba";
}

export interface Knowledge {
  levels: Record<string, Level>; // element id to level; missing means Unknown
  pencil: Record<LaneId, PencilMark>; // the captain's own unverified current notes (3.4)
  unlocks: string[]; // unlock keys found (sorted)
  visited: ArchipelagoId[]; // archipelagos sailed in (sorted); their wind forecast is known
}

// ---------- Captains and ships ----------

export type HullId = "sloop" | "brigantine" | "frigate";
export type Stat = "hull" | "cannons" | "sails" | "berths" | "hold";
export type Good = "provisions" | "powder" | "timber" | "rum" | "sugar" | "spice";
export const GOODS: readonly Good[] = ["provisions", "powder", "timber", "rum", "sugar", "spice"];
export const CARGO_GOODS: readonly Good[] = ["timber", "rum", "sugar", "spice"]; // goods that count as cargo for hunters

export type CaptainKind = "player" | "npc";
export type NpcRole = "merchant" | "navy" | "pirate" | "rookie" | "local" | "boss";

export interface Skills {
  seamanship: number;
  command: number;
  cunning: number;
}

export interface Captain {
  id: CaptainId;
  name: string;
  kind: CaptainKind;
  npcRole?: NpcRole;
  shipId: ShipId;
  chest: number; // banked doubloons, never at risk
  knowledge: Knowledge;
  skills: Skills;
  perks: string[]; // granted by crew, Background and trinkets, e.g. "lookout", "navigator.watch" (sorted)
  fleetId: string | null;
  shieldUntilTide: number; // players cannot hunt this captain while tide <= this
  queuedPlan: { tide: number; plan: VoyagePlan } | null; // Plan B carried over (3.6)
}

export interface Ship {
  id: ShipId;
  captainId: CaptainId;
  name: string;
  hull: HullId;
  waterId: WaterId;
  docked: boolean;
  levels: Record<Stat, number>;
  hullPoints: number;
  riggingPoints: number;
  hands: number;
  handsWounded: number;
  hold: Record<Good, number>;
  plunder: number; // doubloons carried, at risk until docked
  shortRations: boolean;
}

// ---------- Orders (3.6) ----------

export type Stance = "trade" | "quiet" | "hunt";

export type HuntFilter =
  | { kind: "anyone" }
  | { kind: "players" }
  | { kind: "npcs" }
  | { kind: "merchants" }
  | { kind: "carryingCargo" }
  | { kind: "captain"; captainId: CaptainId };

export type Condition =
  | { kind: "shipInSight"; filter: HuntFilter }
  | { kind: "watchesAtLeast"; n: number }
  | { kind: "hullBelow"; pct: number }
  | { kind: "windIs"; wind: WindKind }
  | { kind: "captainHere"; captainId: CaptainId };

export type Step =
  | { kind: "sail"; to: WaterId; stance?: Stance; filter?: HuntFilter; route?: WaterId[]; if?: Condition }
  | { kind: "survey"; if?: Condition }
  | { kind: "land"; site: SiteId; if?: Condition }
  | { kind: "dock"; if?: Condition }
  | { kind: "lurk"; filter: HuntFilter; if?: Condition }
  | { kind: "repair"; if?: Condition };

export type StepKind = Step["kind"];

export interface VoyagePlan {
  steps: Step[];
  doctrine?: string; // used from P2
}

export interface Orders {
  tide: number;
  planA: VoyagePlan;
  planB?: VoyagePlan;
}

// ---------- Weather (3.3) ----------

export type WindKind = "calm" | "breeze" | "gale";

export interface Wind {
  kind: WindKind;
  from: number; // compass bearing the wind blows FROM, in degrees; 0 when calm
}

// ---------- Season state ----------

export interface SeasonState {
  seasonId: string;
  preset: PresetId;
  seed: number; // season seed: drives weather and anything that must be forecast
  tide: number; // the next Tide to resolve
  mapId: string;
  captains: Record<CaptainId, Captain>;
  ships: Record<ShipId, Ship>;
}

// ---------- Replay ----------

export type StopReason = "becalmedShort" | "outOfWatches";
export type SkipReason = "conditionFalse" | "invalid" | "noKnownRoute" | "notAHarbour" | "siteNotHere" | "siteUnknown" | "nothingToRepair" | "noTimber" | "alreadyThere";

export type ReplayEvent =
  | { t: number; kind: "tideStart"; tide: number; winds: Record<ArchipelagoId, Wind> }
  | { t: number; kind: "plan"; ship: ShipId; source: "orders" | "planB" | "standing"; steps: number; watches: number }
  | { t: number; kind: "undock"; ship: ShipId; water: WaterId }
  | { t: number; kind: "hop"; ship: ShipId; from: WaterId; to: WaterId; lane: LaneId; cost: number; ends: number }
  | { t: number; kind: "arrive"; ship: ShipId; water: WaterId; charted: string[] }
  | { t: number; kind: "stop"; ship: ShipId; water: WaterId; reason: StopReason; needed: number; left: number }
  | { t: number; kind: "skip"; ship: ShipId; step: number; reason: SkipReason }
  | { t: number; kind: "survey"; ship: ShipId; water: WaterId; charted: string[]; revealed: string[] }
  | { t: number; kind: "land"; ship: ShipId; site: SiteId; charted: string[]; unlocked: string[] }
  | { t: number; kind: "dock"; ship: ShipId; water: WaterId; banked: number }
  | { t: number; kind: "lurk"; ship: ShipId; water: WaterId }
  | { t: number; kind: "repair"; ship: ShipId; hullPoints: number }
  | { t: number; kind: "galeDamage"; ship: ShipId; riggingPoints: number }
  | { t: number; kind: "meet"; a: ShipId; b: ShipId; at: string; onLane: boolean }
  | { t: number; kind: "encounter"; hunter: ShipId; target: ShipId; at: string; onLane: boolean; result: string }
  | { t: number; kind: "islandCharted"; captain: CaptainId; island: IslandId }
  | { t: number; kind: "supplies"; ship: ShipId; provisionsUsed: number; provisionsLeft: number; shortRations: boolean }
  | { t: number; kind: "tideEnd"; tide: number };

export type ReplayKind = ReplayEvent["kind"];

export interface EncounterRecord {
  t: number;
  at: string;
  onLane: boolean;
  hunter: ShipId;
  target: ShipId;
  result: string;
}

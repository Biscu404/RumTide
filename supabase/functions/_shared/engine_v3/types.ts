// Core types for the Rumtide engine. Pure data: no classes, no enums, JSON friendly.
// Section numbers point at docs/GAMEPLAY.md.

import type { PresetId } from "./balance.ts";
import type { AmbushRange, BattleAftermath, BattleRecord, Doctrine } from "./combat/types.ts";
import type { SalvagePile } from "./combat/loot.ts";

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

/**
 * A captain's Fighting Style (docs/specs/fighting-styles.md, D122, D123): a trait that pays only when its own move or order is
 * played, and a template doctrine. Six fight; the Smuggler is the trader's style and sits outside the wheel.
 */
export type FightingStyle = "bombardier" | "gunline" | "skirmisher" | "rammer" | "boarder" | "firebrand" | "smuggler";
export const FIGHTING_STYLES: readonly FightingStyle[] = ["bombardier", "gunline", "skirmisher", "rammer", "boarder", "firebrand", "smuggler"];

/** The six ship upgrades (6.2). Drill (boarding spec section 4) is the Hands track, 0 to 15; the others go to 10. */
export type Stat = "hull" | "cannons" | "sails" | "berths" | "hold" | "drill";
/** What a hold carries. Provisions, Powder and Fire Pots are supplies; the rest is cargo. */
export type Good = "provisions" | "powder" | "firePots" | "timber" | "rum" | "sugar" | "spice";
export const GOODS: readonly Good[] = ["provisions", "powder", "firePots", "timber", "rum", "sugar", "spice"];
export const CARGO_GOODS: readonly Good[] = ["timber", "rum", "sugar", "spice"]; // goods that count as cargo for hunters

export type CaptainKind = "player" | "npc";
export type NpcRole = "merchant" | "navy" | "pirate" | "rookie" | "local" | "boss";

export interface Skills {
  seamanship: number;
  command: number;
  cunning: number;
}

/** The parley threshold a captain sets (v0.2 7.6): off, or pay tribute to a hunter whose Power Rating is that many times theirs. */
export type ParleySetting = "off" | 1.25 | 1.5;

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
  doctrines: Doctrine[]; // the captain's saved doctrines, up to 3 with different names (8.8)
  defaultDoctrine: string; // the name of the doctrine used when neither the step nor the plan picks one
  parley: ParleySetting;
  noQuarter: boolean; // refuse every parley offer when hunting (v0.2 7.6)
  bounty: number; // doubloons the Admiralty pays whoever beats this captain; shrinks each Tide (v0.2 9 rule 2)
  bossesBeaten: string[]; // boss ids this captain has been on the winning side against (sorted); the Narrows gate (2.5)
}

/**
 * A monster's fixed numbers (GAMEPLAY 2.5). A ship that has one takes these in place of what its hull and levels would
 * give, so Old Shellback can have Hull 300 and no Rigging. Bosses rewrite it every Tide from balance (shellback.ts).
 */
export interface Statline {
  maxHull: number;
  maxRigging: number; // 0 for a monster with no Rigging at all
  maxHands: number; // the Hands its claws fight as
  cannons: number; // 0 for a monster with no guns
  sails: number; // the escape roll and the Power Rating read this
  helm: number; // its Helm score, fixed: no wind gauge, terrain or crew changes it
}

export interface Ship {
  id: ShipId;
  captainId: CaptainId;
  name: string;
  hull: HullId; // a monster's hull is `sloop`, the neutral one; its statline replaces what the hull would give
  statline?: Statline; // only monsters have one
  style?: FightingStyle; // the captain's Fighting Style; absent for a ship with none (Old Shellback, NPCs until P9)
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
  | { kind: "captain"; captainId: CaptainId }
  | { kind: "notBeaten"; boss: string }; // players who are not yet in their own `bossesBeaten` for this boss (2.5). A boss's own plan uses it; players cannot

export type Condition =
  | { kind: "shipInSight"; filter: HuntFilter }
  | { kind: "watchesAtLeast"; n: number }
  | { kind: "hullBelow"; pct: number }
  | { kind: "windIs"; wind: WindKind }
  | { kind: "captainHere"; captainId: CaptainId };

// A ship fights with the doctrine its step names, else the plan's, else the captain's default (8.8).
export type Step =
  | { kind: "sail"; to: WaterId; stance?: Stance; filter?: HuntFilter; route?: WaterId[]; doctrine?: string; if?: Condition }
  | { kind: "survey"; if?: Condition }
  | { kind: "land"; site: SiteId; if?: Condition }
  | { kind: "dock"; if?: Condition }
  | { kind: "lurk"; filter: HuntFilter; doctrine?: string; ambushRange?: AmbushRange; if?: Condition } // ambushRange defaults to Medium (8.1)
  | { kind: "repair"; if?: Condition };

export type StepKind = Step["kind"];

export interface VoyagePlan {
  steps: Step[];
  doctrine?: string; // the doctrine for every step that does not name one
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
  wrecks: Record<string, SalvagePile>; // what a Sunk ship left behind, by pile id (8.7). Salvaging is P5
  flotsam: Record<string, SalvagePile>; // cargo thrown overboard, by pile id (8.7)
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
  | { t: number; kind: "parley"; hunter: ShipId; target: ShipId; threshold: number; accepted: boolean; paid: { plunder: number; goods: Partial<Record<Good, number>> } }
  | { t: number; kind: "escape"; hunter: ShipId; target: ShipId; chance: number; roll: number; escaped: boolean }
  | { t: number; kind: "battle"; record: BattleRecord; aftermath: BattleAftermath }
  | { t: number; kind: "towed"; ship: ShipId; from: WaterId; to: WaterId; hullPoints: number; banked: number }
  | { t: number; kind: "bossRecovers"; ship: ShipId; hullPoints: number; maxHullPoints: number } // a boss is whole again at the start of the Tide (2.5)
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

// Core game types, from section 15.3 of docs/GAME_DESIGN.md.
// In Postgres each interface becomes a table with snake case columns.
// The engine has zero dependencies: relative imports use the .ts extension so Deno can run it.

export type Stat = "hull" | "cannons" | "sails" | "crew" | "hold";
export type Good = "rum" | "sugar" | "spice";
export type HullId = "sloop" | "brigantine" | "frigate";
export type Maneuver = "broadside" | "outmaneuver" | "board";
export type Intent = "trade" | "quiet" | "hunt" | "explore" | "escort";

// Only the NPCs Season 0 needs (section 16.1). Navy Patrol and Sea Serpent appear from week 3,
// after Season 0 ends (section 4.6).
export type NpcKind = "smallTrader" | "fatMerchant" | "galleon";

export interface Season {
  id: string; name: string; status: "draft" | "active" | "ended";
  mapId: string; timezone: string; tideTimeLocal: string;   // "Europe/Bucharest", "21:00"
  lengthTides: number; currentTide: number; settings: SeasonSettings;
}

export interface SeasonSettings {
  preset: "season0" | "full";            // copied from SEASON_PRESETS when the season is created
  progressionCostMult: number; hullsEnabled: HullId[]; galleonTides: number[];
  fogOfLegendTides: number; mawOpens: boolean; mutinyRules: boolean;
}

export interface Captain {
  id: string; seasonId: string; userId: string;
  shipName: string; flag: string; partingShot: string;
  legend: number; chestGold: number; bounty: number;
  shieldUntilTide: number | null; fleetId: string | null;
  standingPlan: [Maneuver, Maneuver, Maneuver]; standingParley: "off" | 1.25 | 1.5;
  shoreLeaveTides: number; lastOrdersTide: number; status: "active" | "ashore";
}

export interface Ship {
  captainId: string; hull: HullId; nodeId: string; docked: boolean;
  hullPoints: number; levels: Record<Stat, number>;
  plunderGold: number; cargo: Record<Good, number>; cargoCostBasis: Record<Good, number>;
  shipwrightProgress: number;
}

export interface Orders {
  tide: number; captainId: string;
  course: string[];                          // node ids, length at most speed
  intent: Intent;
  huntFilter?: "merchants" | "players" | "anyone" | { captainId: string };
  escortCaptainId?: string;
  plan: [Maneuver, Maneuver, Maneuver];
  parley: "off" | 1.25 | 1.5; noQuarter: boolean;
  ready: boolean;
}

export interface Tide {
  seasonId: string; number: number; status: "open" | "resolving" | "resolved" | "failed";
  dueAt: string; resolvedAt: string | null; seed: number; gazette: Gazette | null;
}

export interface Battle {
  id: string; tide: number; nodeId: string;
  sides: BattleSide[]; rounds: RoundRecord[];      // everything the replay needs
  outcome: "decisive" | "victory" | "draw"; loot: LootRecord[]; bountiesAdded: BountyRecord[];
}

export interface Npc { id: string; seasonId: string; kind: NpcKind; nodeId: string; pr: number;
  habit: Maneuver[]; cargoUnits: number; spawnedTide: number; status: "active" | "taken" | "gone"; }

export interface Fleet { id: string; seasonId: string; name: string; flag: string; colour: string; createdTide: number; }
export interface FleetMember { fleetId: string; captainId: string; joinedTide: number; leavingAtTide: number | null; }
export interface MarketRow { seasonId: string; portId: string; good: Good; drift: number; soldThisTide: number; }
export interface LogEvent { id: string; tide: number; captainId: string | null;
  visibility: "public" | "fleet" | "private"; kind: string; text: string; data: unknown; }
export interface Transaction { id: string; captainId: string; tide: number; kind: string;
  amount: number; balanceAfter: number; data: unknown; }   // audit trail for debugging and charts

// Section 15.3 uses the types below without defining them. These are placeholders:
// give them real fields when the engine first produces them (battles and loot on day 3,
// the Gazette when Tide resolution is built).

export interface BattleSide { captainIds: string[]; npcIds: string[]; }
export interface RoundRecord { round: number; }
export interface LootRecord { fromId: string; toId: string; gold: number; }
export interface BountyRecord { captainId: string; amount: number; }
export interface Gazette { headlines: string[]; }

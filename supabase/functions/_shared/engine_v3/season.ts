// Creating seasons, captains and ships.

import { B, SEASON_PRESETS, type PresetId } from "./balance.ts";
import type { Captain, CaptainKind, HullId, NpcRole, SeasonState, Ship, WaterId } from "./types.ts";
import { startKnowledge } from "./knowledge.ts";
import { newShip } from "./ship.ts";
import { templateDoctrine } from "./combat/doctrine.ts";
import type { World } from "./map.ts";

export interface NewCaptainSpec {
  id: string;
  name: string;
  shipName: string;
  kind?: CaptainKind;
  npcRole?: NpcRole;
  hull?: HullId;
  water?: WaterId;
  docked?: boolean;
}

/** A new captain and ship as they start a season: start knowledge, starting gold, docked at the start water. */
export function newCaptain(world: World, preset: PresetId, spec: NewCaptainSpec): { captain: Captain; ship: Ship } {
  const p = SEASON_PRESETS[preset];
  const shipId = `ship_${spec.id}`;
  const water = spec.water ?? p.startWater;
  const docked = spec.docked ?? world.water[water]?.terrain === "harbour";
  const captain: Captain = {
    id: spec.id,
    name: spec.name,
    kind: spec.kind ?? "player",
    ...(spec.npcRole ? { npcRole: spec.npcRole } : {}),
    shipId,
    chest: B.start.gold,
    knowledge: startKnowledge(world),
    skills: { seamanship: 0, command: 0, cunning: 0 },
    perks: [],
    fleetId: null,
    shieldUntilTide: 0,
    queuedPlan: null,
    doctrines: [templateDoctrine("Brawler")],
    defaultDoctrine: "Brawler",
    parley: "off",
    noQuarter: false,
    bounty: 0,
    bossesBeaten: [],
  };
  const ship = newShip(shipId, spec.id, spec.shipName, spec.hull ?? "sloop", water, docked);
  return { captain, ship };
}

export interface NewSeasonSpec {
  seasonId: string;
  preset: PresetId;
  seed: number;
  world: World;
  captains: NewCaptainSpec[];
}

export function newSeason(spec: NewSeasonSpec): SeasonState {
  const state: SeasonState = {
    seasonId: spec.seasonId,
    preset: spec.preset,
    seed: spec.seed >>> 0,
    tide: 1,
    mapId: spec.world.map.id,
    captains: {},
    ships: {},
    wrecks: {},
    flotsam: {},
  };
  for (const c of [...spec.captains].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const { captain, ship } = newCaptain(spec.world, spec.preset, c);
    state.captains[captain.id] = captain;
    state.ships[ship.id] = ship;
  }
  return state;
}

// Creating seasons, captains and ships.

import { B, SEASON_PRESETS, type PresetId } from "./balance.ts";
import { LEVEL } from "./types.ts";
import type { Captain, CaptainKind, FightingStyle, HullId, MapBoss, NpcRole, SeasonState, Ship, WaterId } from "./types.ts";
import { raise, startKnowledge } from "./knowledge.ts";
import { newShip } from "./ship.ts";
import { styleTemplate, templateDoctrine } from "./combat/doctrine.ts";
import { SHELLBACK_DOCTRINE, SHELLBACK_ID, applyStatline, shellbackDoctrine, shellbackStatline } from "./combat/shellback.ts";
import type { World } from "./map.ts";

export interface NewCaptainSpec {
  id: string;
  name: string;
  shipName: string;
  kind?: CaptainKind;
  npcRole?: NpcRole;
  hull?: HullId;
  style?: FightingStyle; // the Fighting Style the captain picks with the starting doctrine (spec section 2); none if absent
  water?: WaterId;
  docked?: boolean;
}

/**
 * A new captain and ship as they start a season: start knowledge, starting gold, docked at the start water. A captain who
 * picks a Fighting Style sails with it and starts with its template doctrine; any other starts with the Boarder.
 */
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
    doctrines: [templateDoctrine(styleTemplate(spec.style))],
    defaultDoctrine: styleTemplate(spec.style),
    parley: "off",
    noQuarter: false,
    bounty: 0,
    bossesBeaten: [],
  };
  const ship = newShip(shipId, spec.id, spec.shipName, spec.hull ?? "sloop", water, docked, spec.style);
  return { captain, ship };
}

/**
 * A boss of the map as a captain and ship, lying in its water (2.5). Null for a boss this engine has no statline for yet.
 * Old Shellback is an NPC with the `boss` role, a sloop hull that only names him (his statline replaces every number a hull
 * would give), no gold of his own, and the Narrows Charted for him: it is his home, so he has Local Knowledge there (D79).
 */
export function newBoss(world: World, preset: PresetId, boss: MapBoss): { captain: Captain; ship: Ship } | null {
  if (boss.id !== SHELLBACK_ID) return null;
  const { captain, ship } = newCaptain(world, preset, {
    id: boss.id, name: "Old Shellback", shipName: "Old Shellback", kind: "npc", npcRole: "boss", hull: "sloop", water: boss.water, docked: false,
  });
  captain.chest = 0;
  captain.doctrines = [shellbackDoctrine()];
  captain.defaultDoctrine = SHELLBACK_DOCTRINE;
  raise(captain.knowledge, boss.water, LEVEL.charted);
  applyStatline(ship, shellbackStatline(1, SEASON_PRESETS[preset].shellbackDecayFromTide));
  return { captain, ship };
}

export interface NewSeasonSpec {
  seasonId: string;
  preset: PresetId;
  seed: number;
  world: World;
  captains: NewCaptainSpec[];
  bosses?: boolean; // put the map's bosses in their waters (default true). A test that only cares about movement leaves them out
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
  if (spec.bosses ?? true) {
    for (const boss of spec.world.map.bosses) {
      const made = newBoss(spec.world, spec.preset, boss);
      if (!made) continue;
      state.captains[made.captain.id] = made.captain;
      state.ships[made.ship.id] = made.ship;
    }
  }
  return state;
}

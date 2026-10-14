// The state of a season at the start of a Tide, and how a new season begins (section 15.5).
// A TideSnapshot is what resolveTide (resolve.ts) takes in and hands back for the next Tide, so it
// is plain data: the Edge Function loads it from Postgres and writes the next one back.

import { SEASON_PRESETS } from "./balance.ts";
import type { GameMap } from "./map.ts";
import { boomPortForTide, newMarket } from "./market.ts";
import { spawnNpcs } from "./npc.ts";
import { createRng } from "./rng.ts";
import { newCaptain, newShip, shipPowerRating } from "./state.ts";
import type { Captain, MarketRow, Npc, SeasonSettings, Ship } from "./types.ts";

export interface TideSnapshot {
  seasonId: string;
  settings: SeasonSettings;
  lengthTides: number;
  /** The Tide that is open now, and the one resolveTide will resolve. */
  tide: number;
  /** Captains in id order. */
  captains: Captain[];
  /** One ship per captain, in captain id order. */
  ships: Ship[];
  /** The NPCs that are on the map during this Tide (created while the Tide before resolved). */
  npcs: Npc[];
  market: MarketRow[];
  /** The port with this week's Trade Winds boom, or null when there is none. */
  boomPortId: string | null;
}

export function seasonSettings(preset: SeasonSettings["preset"]): SeasonSettings {
  const { lengthTides: _length, ...rest } = SEASON_PRESETS[preset];
  return { preset, ...rest, hullsEnabled: [...rest.hullsEnabled], galleonTides: [...rest.galleonTides] };
}

export interface NewCaptain { id: string; shipName?: string; fleetId?: string | null; }

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/**
 * Tide 1 of a new season: every captain a fresh sloop docked in port (ports are handed out in id
 * order, round the map), prices at normal, and the first NPCs on the map.
 */
export function startSeason(
  map: GameMap, seasonId: string, preset: SeasonSettings["preset"], captains: readonly NewCaptain[], seed: number,
): TideSnapshot {
  const settings = seasonSettings(preset);
  const rng = createRng(seed);
  const ports = map.nodeIds.filter((id) => map.node(id).type === "port");
  const sorted = [...captains].sort((a, b) => compareIds(a.id, b.id));
  if (new Set(sorted.map((c) => c.id)).size !== sorted.length) throw new Error("Captain ids must be unique");

  const made = sorted.map((c, i) => ({
    captain: { ...newCaptain(c.id, seasonId), shipName: c.shipName ?? c.id, fleetId: c.fleetId ?? null },
    ship: newShip(c.id, ports[i % ports.length]!),
  }));
  const medianPR = median(made.map((m) => shipPowerRating(m.ship)));
  const boomPortId = boomPortForTide(map, 1, null, rng);

  return {
    seasonId, settings, lengthTides: SEASON_PRESETS[preset].lengthTides, tide: 1,
    captains: made.map((m) => m.captain), ships: made.map((m) => m.ship),
    npcs: spawnNpcs(map, { seasonId, tide: 1, players: made.length, medianPR, galleonTides: settings.galleonTides }, rng),
    market: newMarket(map, seasonId), boomPortId,
  };
}

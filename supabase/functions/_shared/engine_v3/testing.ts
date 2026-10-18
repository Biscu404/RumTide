// Shared test helpers.

import cradleRaw from "../maps/cradle.json";
import { loadMap, newSeason, resolveTide, stubEncounter } from "./index.ts";
import type { EncounterResolver, GameMap, NewCaptainSpec, Orders, Rng, SeasonState, TideResult, Wind } from "./index.ts";

export const world = loadMap(cradleRaw);
export const rawCradle = (): GameMap => structuredClone(cradleRaw) as GameMap;

export const WEST_BREEZE: Record<string, Wind> = { cradle: { kind: "breeze", from: 270 } };

export function season(captains: NewCaptainSpec[], tide = 6): SeasonState {
  const s = newSeason({ seasonId: "test", preset: "season0", seed: 99, world, captains });
  s.tide = tide;
  return s;
}

export function ship(state: SeasonState, captainId: string) {
  const s = state.ships[`ship_${captainId}`];
  if (!s) throw new Error(`no ship for ${captainId}`);
  return s;
}

/** Resolves a Tide. Encounters use the stand in that freezes both ships unless a resolver is given, so movement tests stay about movement. */
export function run(
  state: SeasonState, orders: Record<string, Orders>,
  opts: { seed?: number; wind?: Record<string, Wind>; resolveEncounter?: EncounterResolver } = {},
): TideResult {
  return resolveTide({
    state, world, orders, seed: opts.seed ?? 7, windOverride: opts.wind ?? WEST_BREEZE, resolveEncounter: opts.resolveEncounter ?? stubEncounter,
  });
}

export const kinds = (r: TideResult) => r.replay.map((e) => e.kind);

/** An Rng stand in that always says yes and always picks the first item. */
export const yesRng = { chance: () => true, pick: <T>(xs: readonly T[]) => xs[0] as T } as unknown as Rng;
/** An Rng stand in that always says no. */
export const noRng = { chance: () => false, pick: <T>(xs: readonly T[]) => xs[0] as T } as unknown as Rng;

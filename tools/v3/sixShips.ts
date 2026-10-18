// The six ship fixture: one Tide in the Cradle that exercises every Phase 1 rule at once.
// Used by engine_v3/golden.test.ts, `npm run tide:demo` and `npm run golden:update`.
//
//   Salty Gull   hunts ships carrying cargo and meets the Wet Sock head on in the lane to Driftwood
//   Wet Sock     carries rum from Driftwood to Gullhaven and gets caught on the way
//   Inkwell      is on Short Rations and does not know the Tarpot current, so it is becalmed short
//   Black Gannet lies in wait at Gullhaven Reefside
//   Merry Widow  surveys, then sails into the Gannet's trap; it has a Plan B for the next Tide
//   Old Biscuit  an NPC merchant with no orders; standing orders take it home to dock

import { readFileSync } from "node:fs";
import { LEVEL, hash32, loadMap, newSeason, raise, replayHash, resolveTide } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { Orders, SeasonState, Wind } from "../../supabase/functions/_shared/engine_v3/index.ts";

export const cradle = loadMap(JSON.parse(readFileSync(new URL("../../supabase/functions/_shared/maps/cradle.json", import.meta.url), "utf8")));

export const SIX_SHIPS_TIDE = 6;
export const SIX_SHIPS_WIND: Record<string, Wind> = { cradle: { kind: "breeze", from: 270 } };

export function sixShips(): { state: SeasonState; orders: Record<string, Orders>; seed: number; windOverride: Record<string, Wind> } {
  const state = newSeason({
    seasonId: "fixture",
    preset: "season0",
    seed: 1234,
    world: cradle,
    captains: [
      { id: "cap_a", name: "Anna", shipName: "Salty Gull", water: "gh_lee" },
      { id: "cap_b", name: "Bogdan", shipName: "Wet Sock", water: "dw_harbour" },
      { id: "cap_c", name: "Cami", shipName: "Inkwell", water: "tp_harbour" },
      { id: "cap_d", name: "Dragos", shipName: "Black Gannet", water: "gh_reefside" },
      { id: "cap_e", name: "Elena", shipName: "Merry Widow", water: "gh_harbour" },
      { id: "cap_f", name: "Old Biscuit", shipName: "Old Biscuit", water: "dw_shallows", kind: "npc", npcRole: "merchant" },
    ],
  });
  state.tide = SIX_SHIPS_TIDE;
  const ship = (c: string) => state.ships[`ship_${c}`]!;
  ship("cap_b").hold.rum = 3;
  ship("cap_c").shortRations = true;
  ship("cap_c").hold.provisions = 0;
  raise(state.captains.cap_c!.knowledge, "tp_harbour", LEVEL.charted);
  ship("cap_f").hold.sugar = 4; // a laden merchant: hold over 80% full costs it a Watch
  ship("cap_f").plunder = 30;

  const orders: Record<string, Orders> = {
    cap_a: { tide: 6, planA: { steps: [{ kind: "sail", to: "dw_harbour", stance: "hunt", filter: { kind: "carryingCargo" } }] } },
    cap_b: { tide: 6, planA: { steps: [{ kind: "sail", to: "gh_harbour" }, { kind: "dock" }] } },
    cap_c: { tide: 6, planA: { steps: [{ kind: "sail", to: "tp_kelp" }, { kind: "sail", to: "dw_harbour" }, { kind: "dock" }] } },
    cap_d: { tide: 6, planA: { steps: [{ kind: "lurk", filter: { kind: "players" } }] } },
    cap_e: {
      tide: 6,
      planA: { steps: [{ kind: "survey" }, { kind: "sail", to: "gh_reefside", stance: "quiet" }, { kind: "land", site: "gullhaven_lighthouse" }] },
      planB: { steps: [{ kind: "sail", to: "gh_harbour" }, { kind: "dock" }] },
    },
  };
  return { state, orders, seed: hash32("fixture/tide/6"), windOverride: SIX_SHIPS_WIND };
}

/** What the golden file records for the six ship Tide. */
export function goldenSnapshot() {
  const { state, orders, seed, windOverride } = sixShips();
  const r = resolveTide({ state, world: cradle, orders, seed, windOverride });
  const ships = Object.fromEntries(Object.values(r.state.ships).map((s) => [s.id, {
    water: s.waterId, docked: s.docked, provisions: s.hold.provisions, shortRations: s.shortRations, rigging: s.riggingPoints,
  }]));
  return { hash: replayHash(r.replay), encounters: r.encounters, ships, replay: r.replay };
}

export const GOLDEN_FILE = new URL("../../supabase/functions/_shared/engine_v3/golden/six-ships.json", import.meta.url);

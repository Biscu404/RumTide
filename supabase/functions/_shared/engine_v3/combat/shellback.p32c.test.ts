// P3.2c, D225: Old Shellback fights every captain who reaches him in a Tide, each against a whole Old Shellback. A battle does
// not freeze him, and he is made whole right after it.

import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { newSeason } from "../season.ts";
import { resolveTide } from "../tide.ts";
import type { TideResult } from "../tide.ts";
import { world } from "../testing.ts";
import type { Orders, ReplayEvent, SeasonState } from "../types.ts";
import { SHELLBACK_ID, restoreBoss, shellbackStatline, upkeepBosses } from "./shellback.ts";

const S = B.shellback;
const NARROWS = "the_narrows";
const SHIP = `ship_${SHELLBACK_ID}`;
const BREEZE = { cradle: { kind: "breeze" as const, from: 270 } };

function crabSeason(ids: string[], tide = 6): SeasonState {
  const state = newSeason({
    seasonId: "crab", preset: "season0", seed: 5, world, bosses: true,
    captains: ids.map((id) => ({ id, name: id.toUpperCase(), shipName: `The ${id}`, water: NARROWS, docked: false })),
  });
  state.tide = tide;
  return state;
}

/** Lies in wait for any NPC: Old Shellback is the only one in the Narrows, so this is a challenge. */
const challenge = (tide: number): Orders => ({ tide, planA: { steps: [{ kind: "lurk", filter: { kind: "npcs" } }] } });
const resolve = (state: SeasonState, orders: Record<string, Orders>, seed = 1000): TideResult =>
  resolveTide({ state, world, orders, seed, windOverride: BREEZE });
const battles = (r: TideResult) => r.replay.flatMap((e) => (e.kind === "battle" ? [e] : []));
const only = <K extends ReplayEvent["kind"]>(r: TideResult, kind: K) =>
  r.replay.filter((e): e is Extract<ReplayEvent, { kind: K }> => e.kind === kind);

describe("the queue at Old Shellback's gate (D225)", () => {
  it("fights every captain who reaches him in a Tide, each against a whole Old Shellback", () => {
    const ids = ["p1", "p2", "p3"];
    for (const seed of [1000, 2000, 3000]) {
      const r = resolve(crabSeason(ids), Object.fromEntries(ids.map((id) => [id, challenge(6)])), seed);
      expect(r.encounters).toHaveLength(3);
      expect(battles(r)).toHaveLength(3);
      for (const { record } of battles(r)) {
        expect([record.hunter, record.target]).toContain(SHIP);
        // The third meets him as whole as the first.
        expect(record.ships.find((s) => s.shipId === SHIP)).toMatchObject({ hullPoints: S.hull, hands: S.clawHands });
      }
      expect(r.state.ships[SHIP]).toMatchObject({ hullPoints: S.hull, hands: S.clawHands, waterId: NARROWS, docked: false });
    }
  });

  it("says he comes out of his shell after a fight that hurt him, on the tick of the battle, and not when it left him whole", () => {
    const ids = ["p1", "p2", "p3"];
    const r = resolve(crabSeason(ids), Object.fromEntries(ids.map((id) => [id, challenge(6)])));
    let told = 0;
    r.replay.forEach((e, i) => {
      if (e.kind !== "battle") return;
      const final = e.record.final.find((s) => s.shipId === SHIP)!;
      const hurt = final.hullPoints < S.hull || final.hands < S.clawHands;
      const next = r.replay[i + 1]!;
      if (hurt) {
        expect(next).toMatchObject({ kind: "bossRecovers", t: e.t, ship: SHIP, hullPoints: S.hull, maxHullPoints: S.hull });
        told++;
      } else {
        expect(next.kind).not.toBe("bossRecovers");
      }
    });
    expect(only(r, "bossRecovers")).toHaveLength(told);
    expect(told).toBeGreaterThan(0);
  });

  it("meets a captain once a Tide, though he does not stop after a fight", () => {
    const r = resolve(crabSeason(["p"]), { p: challenge(6) });
    expect(r.encounters).toHaveLength(1);
    expect(battles(r)).toHaveLength(1);
  });

  it("still stops every other ship that fought for the rest of the Tide (D81)", () => {
    // Two captains who hunt everyone: each fights him, and the two never fight each other afterwards, because both are stopped.
    const hunt = (tide: number): Orders => ({ tide, planA: { steps: [{ kind: "lurk", filter: { kind: "anyone" } }] } });
    const r = resolve(crabSeason(["p1", "p2"]), { p1: hunt(6), p2: hunt(6) });
    const withHim = battles(r).filter(({ record }) => [record.hunter, record.target].includes(SHIP));
    expect(battles(r).length - withHim.length).toBeLessThanOrEqual(1);
    const fought = new Set<string>();
    for (const { record } of battles(r)) {
      for (const id of [record.hunter, record.target]) {
        if (id === SHIP) continue;
        expect(fought.has(id)).toBe(false); // a player ship is in one battle a Tide at most
        fought.add(id);
      }
    }
  });

  it("replays the same Tide from the same seed", () => {
    const ids = ["p1", "p2", "p3"];
    const orders = Object.fromEntries(ids.map((id) => [id, challenge(6)]));
    expect(resolve(crabSeason(ids), orders).replay).toEqual(resolve(crabSeason(ids), orders).replay);
  });
});

describe("restoreBoss", () => {
  it("makes him whole with the statline of the Tide, and returns the event only when something changed", () => {
    const state = crabSeason(["p"]);
    const ship = state.ships[SHIP]!;
    expect(restoreBoss(state, ship, 6)).toBeNull();
    ship.hullPoints = 1;
    ship.hands = 2;
    expect(restoreBoss(state, ship, 6, 7)).toEqual({ t: 7, kind: "bossRecovers", ship: SHIP, hullPoints: S.hull, maxHullPoints: S.hull });
    expect(ship).toMatchObject({ hullPoints: S.hull, hands: S.clawHands });
    const tired = shellbackStatline(12, 9);
    expect(restoreBoss(state, ship, 12)).toMatchObject({ t: 0, hullPoints: tired.maxHull });
  });

  it("is what the upkeep at the start of a Tide uses", () => {
    const state = crabSeason(["p"]);
    state.ships[SHIP]!.hullPoints = 1;
    expect(upkeepBosses(state, 6)).toEqual([{ t: 0, kind: "bossRecovers", ship: SHIP, hullPoints: S.hull, maxHullPoints: S.hull }]);
    expect(upkeepBosses(state, 6)).toEqual([]);
  });
});

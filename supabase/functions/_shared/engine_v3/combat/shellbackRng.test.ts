// Old Shellback's rolls have streams of their own (D16, D177, D202). The rear up round is drawn once per fight, only when he is in it,
// from rngFor(seed, "battle", hunter, target, "rearUp"). Every other roll of a battle with him, and every roll of a battle without
// him, comes from the stream it always came from: the round streams rngFor(seed, "battle", hunter, target, round).

import { describe, expect, it, vi } from "vitest";
import { runBattle } from "./battle.ts";
import { always, battleOf, styleShip, testShip } from "./testing.ts";
import type { BattleShip } from "./types.ts";
import { battleShipOf } from "./encounter.ts";
import { newBoss } from "../season.ts";
import { world } from "../testing.ts";
import { doctrineChooser } from "./doctrine.ts";
import { SHELLBACK_ID, shellbackDoctrine } from "./shellback.ts";

// Every rngFor call a battle makes, in order, with its labels.
const calls = vi.hoisted(() => [] as (string | number)[][]);
vi.mock("../rng.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("../rng.ts")>();
  return { ...real, rngFor: (seed: number, ...labels: (string | number)[]) => { calls.push([seed, ...labels]); return real.rngFor(seed, ...labels); } };
});

const crab = (): BattleShip => battleShipOf(newBoss(world, "season0", world.map.bosses[0]!)!.ship, { id: SHELLBACK_ID }, "target", { charted: true, withCurrent: false, lurker: false });

describe("the streams of a battle", () => {
  it("draws nothing for Old Shellback in a battle without him: only the round streams, as before", () => {
    for (const style of ["bombardier", "gunline", "rammer", "boarder", "firebrand"] as const) {
      calls.length = 0;
      const r = runBattle(battleOf(styleShip("hunter", style), testShip("target"), { hunter: always("closeIn", "board"), target: always("hold", "roundShot") }, { seed: 5, ambush: "medium" }));
      expect(calls.length).toBe(r.rounds.length);
      r.rounds.forEach((round, i) => expect(calls[i]).toEqual([5, "battle", "ship_hunter", "ship_target", round.round]));
    }
  });

  it("draws his rear up round once, from its own stream, and every other roll from the round streams", () => {
    calls.length = 0;
    const r = runBattle(battleOf(testShip("hunter", "sloop", { maxHullPoints: 400, hullPoints: 400, maxHands: 60, hands: 60 }), crab(), {
      hunter: always("hold", "holdFire"), target: doctrineChooser(shellbackDoctrine(), { enemyType: "player" }),
    }, { terrain: "shallows", seed: 5 }));
    const own = calls.filter((c) => c.includes("rearUp"));
    expect(own).toEqual([[5, "battle", "ship_hunter", `ship_${SHELLBACK_ID}`, "rearUp"]]);
    const rest = calls.filter((c) => !c.includes("rearUp"));
    expect(rest).toHaveLength(r.rounds.length);
    r.rounds.forEach((round, i) => expect(rest[i]).toEqual([5, "battle", "ship_hunter", `ship_${SHELLBACK_ID}`, round.round]));
  });

  it("gives the same old rolls to the same ship in a fight with him as in a fight with an identical ship that has no shell", () => {
    // The hunter's luck comes from rngFor(seed, "battle", hunter, target, round).stream("guns", hunter): the same key either way.
    const fire = always("hold", "roundShot");
    const run = (target: BattleShip) => runBattle(battleOf(testShip("hunter", "sloop", { maxHullPoints: 400, hullPoints: 400 }), target, { hunter: fire, target: always("hold", "holdFire") }, { terrain: "shallows", ambush: "medium", seed: 9 }));
    const shelled = run(crab());
    const bare = run({ ...crab(), captainId: "someone_else" });
    const raw = (r: ReturnType<typeof run>) => r.rounds.map((x) => x.ships[0]!.shot.damage);
    // Each round's damage differs by the shell alone (a fifth, or all of it in the round he rears up), never by a different roll.
    raw(shelled).forEach((damage, i) => expect(Math.abs(damage - raw(bare)[i]!)).toBeLessThanOrEqual(Math.ceil(0.2 * raw(bare)[i]!) + 1));
  });
});

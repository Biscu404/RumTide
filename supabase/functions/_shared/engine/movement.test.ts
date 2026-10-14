import { describe, expect, it } from "vitest";
import brineJson from "../maps/brine.json";
import { B } from "./balance.ts";
import { loadMap } from "./map.ts";
import { advanceStep, courseError, simulateMovement, type Mover } from "./movement.ts";
import { createRng } from "./rng.ts";

const brine = loadMap(brineJson);
const ship = (id: string, nodeId: string, ...course: string[]): Mover => ({ id, nodeId, course });
const finalNodes = (steps: ReturnType<typeof simulateMovement>) =>
  Object.fromEntries(steps[steps.length - 1]!.ships.map((s) => [s.id, s.nodeId]));

describe("courseError", () => {
  it("accepts an empty course and a connected course within speed", () => {
    expect(courseError(brine, "port_regal", [], 2)).toBeNull();
    expect(courseError(brine, "port_regal", ["sea02", "isle4"], 2)).toBeNull();
  });

  it("rejects a course longer than speed", () => {
    expect(courseError(brine, "port_regal", ["sea02", "isle4", "sea03"], 2)).toMatch(/speed/);
  });

  it("rejects a hop without a lane, even to a real node", () => {
    expect(courseError(brine, "port_regal", ["rumhaven"], 2)).toMatch(/No lane/);
    expect(courseError(brine, "port_regal", ["sea02", "port_regal", "rumhaven"], 3)).toMatch(/No lane/);
  });

  it("rejects an unknown node", () => {
    expect(courseError(brine, "port_regal", ["atlantis"], 2)).toMatch(/Unknown/);
  });
});

describe("movement in steps", () => {
  it("moves ships one hop per step and stops them when their course runs out", () => {
    const steps = simulateMovement(brine, [
      ship("a", "port_regal", "sea02", "isle4"),
      ship("b", "saint_brine", "sea01"),
      ship("c", "gullrock"),
    ]);
    expect(steps).toHaveLength(2);
    expect(steps[0]!.ships.map((s) => s.nodeId)).toEqual(["sea02", "sea01", "gullrock"]);
    expect(finalNodes(steps)).toEqual({ a: "isle4", b: "sea01", c: "gullrock" });
  });

  it("plays nothing when nobody has a course", () => {
    expect(simulateMovement(brine, [ship("a", "gullrock")])).toEqual([]);
  });

  it("never plays more steps than B.movement.steps", () => {
    const long = ship("a", "port_regal", "sea02", "isle4", "sea03", "sea04", "sea05");
    expect(simulateMovement(brine, [long])).toHaveLength(B.movement.steps);
  });

  it("refuses to sail along a missing lane", () => {
    expect(() => advanceStep(brine, [ship("a", "port_regal", "rumhaven")], 1)).toThrow(/cannot sail/);
  });

  it("keeps a stopped ship in place while its mate keeps sailing", () => {
    const result = advanceStep(brine, [ship("a", "port_regal", "sea02"), ship("b", "isle1", "sea02")], 1, new Set(["b"]));
    expect(result.ships.map((s) => s.nodeId)).toEqual(["sea02", "isle1"]);
  });

  it("does not change its input", () => {
    const input = [ship("a", "port_regal", "sea02")];
    advanceStep(brine, input, 1);
    expect(input[0]).toEqual({ id: "a", nodeId: "port_regal", course: ["sea02"] });
  });
});

describe("meetings (section 4.4 rule 3)", () => {
  // The day 2 check: six ships around the Brine, with every kind of meeting and one ship that meets nobody.
  it("finds the right meetings for 6 ships", () => {
    const steps = simulateMovement(brine, [
      ship("A", "port_regal", "sea02", "isle4"),          // meets B on Bone Key at step 2
      ship("B", "sea06", "isle4"),
      ship("C", "driftwood_key", "sea10"),                // swaps lanes with D at step 1
      ship("D", "sea10", "driftwood_key"),
      ship("E", "gullrock", "sea08", "driftwood_key"),    // meets D, who is waiting on Driftwood Key
      ship("F", "saint_brine", "sea01", "port_regal"),    // sails past everyone
    ]);

    expect(finalNodes(steps)).toEqual({
      A: "isle4", B: "isle4", C: "sea10", D: "driftwood_key", E: "driftwood_key", F: "port_regal",
    });
    expect(steps.map((s) => s.meetings)).toEqual([
      [{ step: 1, kind: "swap", nodeId: "driftwood_key", lane: ["driftwood_key", "sea10"], ships: ["C", "D"] }],
      [
        { step: 2, kind: "same", nodeId: "driftwood_key", ships: ["D", "E"] },
        { step: 2, kind: "same", nodeId: "isle4", ships: ["A", "B"] },
      ],
    ]);
  });

  it("meets only where ships coincide, not when one has sailed on", () => {
    const steps = simulateMovement(brine, [
      ship("A", "port_regal", "sea02", "isle4"),
      ship("B", "isle1", "sea02"),
    ]);
    // Step 1: both arrive on Regal Reach. Step 2: A sails on to Bone Key while B stays.
    expect(steps[0]!.meetings.map((m) => m.nodeId)).toEqual(["sea02"]);
    expect(steps[1]!.meetings).toEqual([]);
  });

  it("counts a ship that passes through a node where another ship waits", () => {
    const steps = simulateMovement(brine, [ship("A", "sea08", "driftwood_key", "sea10"), ship("B", "driftwood_key")]);
    expect(steps[0]!.meetings).toEqual([{ step: 1, kind: "same", nodeId: "driftwood_key", ships: ["A", "B"] }]);
    expect(steps[1]!.meetings).toEqual([]);
  });

  it("reports every pair when three ships share a node", () => {
    const steps = simulateMovement(brine, [
      ship("A", "sea02", "isle4"), ship("B", "sea03", "isle4"), ship("C", "sea06", "isle4"),
    ]);
    expect(steps[0]!.meetings.map((m) => m.ships)).toEqual([["A", "B"], ["A", "C"], ["B", "C"]]);
  });

  it("does not call a swap when only one ship moved", () => {
    const steps = simulateMovement(brine, [ship("A", "sea02", "isle4"), ship("B", "isle4")]);
    expect(steps[0]!.meetings).toEqual([{ step: 1, kind: "same", nodeId: "isle4", ships: ["A", "B"] }]);
  });

  it("does not mistake a stopped ship for a swap", () => {
    const result = advanceStep(brine, [ship("A", "sea02", "isle4"), ship("B", "isle4", "sea02")], 1, new Set(["B"]));
    expect(result.meetings).toEqual([{ step: 1, kind: "same", nodeId: "isle4", ships: ["A", "B"] }]);
  });

  it("orders meetings by node id within a step, whatever order the ships are given in", () => {
    const ships = [
      ship("D", "sea10", "driftwood_key"), ship("C", "driftwood_key", "sea10"),
      ship("B", "sea06", "isle4"), ship("A", "sea02", "isle4"),
    ];
    const forward = advanceStep(brine, ships, 1).meetings;
    const backward = advanceStep(brine, [...ships].reverse(), 1).meetings;
    expect(forward).toEqual(backward);
    expect(forward.map((m) => m.nodeId)).toEqual(["driftwood_key", "isle4"]);
  });
});

describe("random fleets", () => {
  const randomCourse = (rng: ReturnType<typeof createRng>, from: string, hops: number) => {
    const course: string[] = [];
    let here = from;
    for (let i = 0; i < hops; i++) {
      here = rng.pick(brine.neighbours(here));
      course.push(here);
    }
    return course;
  };

  const randomShips = (seed: number): Mover[] => {
    const rng = createRng(seed);
    return ["a", "b", "c", "d", "e", "f"].map((id) => {
      const from = rng.pick(brine.nodeIds);
      return { id, nodeId: from, course: randomCourse(rng, from, rng.int(3)) };
    });
  };

  it("is reproducible from the seed", () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(simulateMovement(brine, randomShips(seed))).toEqual(simulateMovement(brine, randomShips(seed)));
    }
  });

  it("agrees with a brute force check of every pair, step by step", () => {
    for (let seed = 1; seed <= 200; seed++) {
      let before = randomShips(seed);
      for (const step of simulateMovement(brine, before)) {
        const pos = (list: Mover[], id: string) => list.find((s) => s.id === id)!.nodeId;
        const expected: string[] = [];
        for (const a of before) {
          for (const b of before) {
            if (a.id >= b.id) continue;
            const [a1, b1] = [pos(step.ships, a.id), pos(step.ships, b.id)];
            const bothMoved = a1 !== a.nodeId && b1 !== b.nodeId;
            if (a1 === b1 || (bothMoved && a1 === b.nodeId && b1 === a.nodeId)) expected.push(`${a.id}${b.id}`);
          }
        }
        expect(step.meetings.map((m) => m.ships.join("")).sort(), `seed ${seed}`).toEqual(expected.sort());
        before = step.ships;
      }
    }
  });
});

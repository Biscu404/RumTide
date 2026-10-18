import { describe, expect, it } from "vitest";
import { Rng, hash32, rngFor } from "./index.ts";

describe("seeded random (P1.2)", () => {
  it("gives the same numbers for the same seed and labels", () => {
    const a = rngFor(42, "survey", "ship_a", 1);
    const b = rngFor(42, "survey", "ship_a", 1);
    const xs = Array.from({ length: 20 }, () => a.next());
    const ys = Array.from({ length: 20 }, () => b.next());
    expect(xs).toEqual(ys);
  });

  it("gives different numbers for different labels or seeds", () => {
    expect(rngFor(42, "a").next()).not.toBe(rngFor(42, "b").next());
    expect(rngFor(42, "a").next()).not.toBe(rngFor(43, "a").next());
  });

  it("keeps streams independent: drawing from one never shifts another", () => {
    const root = new Rng("root");
    const before = root.stream("wind").next();
    const busy = new Rng("root");
    for (let i = 0; i < 100; i++) busy.next();
    expect(busy.stream("wind").next()).toBe(before);
  });

  it("keeps numbers inside their ranges", () => {
    const r = new Rng("ranges");
    for (let i = 0; i < 2000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = r.int(3, 5);
      expect(n === 3 || n === 4 || n === 5).toBe(true);
    }
  });

  it("roughly follows chances and weights", () => {
    const r = new Rng("chances");
    let yes = 0;
    for (let i = 0; i < 10000; i++) if (r.chance(0.3)) yes++;
    expect(yes / 10000).toBeGreaterThan(0.27);
    expect(yes / 10000).toBeLessThan(0.33);
    const counts = { calm: 0, breeze: 0, gale: 0 };
    for (let i = 0; i < 10000; i++) counts[r.weighted({ calm: 1, breeze: 8, gale: 1 }, ["calm", "breeze", "gale"])]++;
    expect(counts.breeze / 10000).toBeGreaterThan(0.77);
    expect(counts.breeze / 10000).toBeLessThan(0.83);
  });

  it("shuffles without losing items", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = new Rng("shuffle").shuffle(xs);
    expect([...out].sort()).toEqual(xs);
    expect(xs).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("hashes strings stably", () => {
    expect(hash32("rumtide")).toBe(hash32("rumtide"));
    expect(hash32("rumtide")).not.toBe(hash32("rumtidE"));
  });
});
